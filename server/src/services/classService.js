import { prisma } from '../config/db.js';
import { generateClassCode } from '../utils/codeGenerator.js';

export async function createClass({ title, description, instructorId }) {
  if (!title || !title.trim()) {
    const error = new Error('Class title is required');
    error.statusCode = 400;
    throw error;
  }

  // Generate unique code with collision check retry
  let code;
  let attempts = 0;
  while (attempts < 5) {
    code = generateClassCode();
    const existing = await prisma.class.findUnique({ where: { code } });
    if (!existing) break;
    attempts++;
  }

  if (attempts >= 5) {
    const error = new Error('Failed to generate unique class code. Please try again.');
    error.statusCode = 500;
    throw error;
  }

  const newClass = await prisma.class.create({
    data: {
      title: title.trim(),
      description: description ? description.trim() : null,
      code,
      instructorId
    },
    include: {
      instructor: {
        select: { id: true, name: true, email: true }
      },
      _count: {
        select: { enrollments: true, sessions: true }
      }
    }
  });

  return newClass;
}

export async function getUserClasses({ userId, role }) {
  if (role === 'INSTRUCTOR') {
    const classes = await prisma.class.findMany({
      where: { instructorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        instructor: { select: { id: true, name: true, email: true } },
        sessions: {
          orderBy: { createdAt: 'desc' }
        },
        enrollments: {
          select: { id: true, status: true }
        }
      }
    });

    return classes.map(cls => {
      const approvedEnrollments = cls.enrollments.filter(e => e.status === 'APPROVED');
      const pendingRequests = cls.enrollments.filter(e => e.status === 'PENDING');
      const liveSessions = cls.sessions.filter(s => s.status === 'LIVE');

      return {
        id: cls.id,
        title: cls.title,
        description: cls.description,
        code: cls.code,
        createdAt: cls.createdAt,
        updatedAt: cls.updatedAt,
        instructor: cls.instructor,
        pendingRequestsCount: pendingRequests.length,
        _count: {
          enrollments: approvedEnrollments.length,
          sessions: cls.sessions.length,
          liveSessions: liveSessions.length
        }
      };
    });
  } else {
    // STUDENT
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: userId },
      orderBy: { enrolledAt: 'desc' },
      include: {
        class: {
          include: {
            instructor: { select: { id: true, name: true, email: true } },
            sessions: {
              where: { status: 'LIVE' }
            }
          }
        }
      }
    });

    return enrollments.map(e => ({
      id: e.class.id,
      title: e.class.title,
      description: e.class.description,
      code: e.class.code,
      createdAt: e.class.createdAt,
      instructor: e.class.instructor,
      enrollmentStatus: e.status, // PENDING | APPROVED | REJECTED
      _count: {
        sessions: e.class.sessions.length
      }
    }));
  }
}

export async function joinClassByCode({ code, studentId }) {
  if (!code || !code.trim()) {
    const error = new Error('Class join code is required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedCode = code.trim().toUpperCase();
  const targetClass = await prisma.class.findUnique({
    where: { code: normalizedCode },
    include: { instructor: { select: { id: true, name: true, email: true } } }
  });

  if (!targetClass) {
    const error = new Error('Invalid class code. No class found.');
    error.statusCode = 404;
    throw error;
  }

  if (targetClass.instructorId === studentId) {
    const error = new Error('You are the instructor of this class.');
    error.statusCode = 400;
    throw error;
  }

  const existingEnrollment = await prisma.enrollment.findUnique({
    where: {
      classId_studentId: {
        classId: targetClass.id,
        studentId
      }
    }
  });

  if (existingEnrollment) {
    if (existingEnrollment.status === 'PENDING') {
      const error = new Error('Your join request is already pending instructor approval.');
      error.statusCode = 400;
      throw error;
    }
    if (existingEnrollment.status === 'APPROVED') {
      const error = new Error('You are already enrolled in this class.');
      error.statusCode = 400;
      throw error;
    }
    // If previously rejected, re-apply as PENDING
    const updated = await prisma.enrollment.update({
      where: { id: existingEnrollment.id },
      data: { status: 'PENDING', enrolledAt: new Date() }
    });
    return {
      message: 'Join request re-submitted. Awaiting instructor approval.',
      status: 'PENDING',
      enrollment: updated,
      class: targetClass
    };
  }

  const newEnrollment = await prisma.enrollment.create({
    data: {
      classId: targetClass.id,
      studentId,
      status: 'PENDING'
    }
  });

  return {
    message: 'Join request submitted! An instructor must approve your request before you can access the classroom.',
    status: 'PENDING',
    enrollment: newEnrollment,
    class: targetClass
  };
}

export async function getClassById({ classId, userId }) {
  const targetClass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      instructor: { select: { id: true, name: true, email: true } },
      sessions: {
        orderBy: { createdAt: 'desc' }
      },
      enrollments: {
        include: {
          student: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });

  if (!targetClass) {
    const error = new Error('Class not found');
    error.statusCode = 404;
    throw error;
  }

  const isInstructor = targetClass.instructorId === userId;
  const userEnrollment = targetClass.enrollments.find(e => e.studentId === userId);
  const isEnrolled = !!userEnrollment && userEnrollment.status === 'APPROVED';

  if (!isInstructor && !isEnrolled) {
    if (userEnrollment && userEnrollment.status === 'PENDING') {
      const error = new Error('Your enrollment request is pending instructor approval.');
      error.statusCode = 403;
      throw error;
    }
    const error = new Error('Access denied. You are not enrolled in this class.');
    error.statusCode = 403;
    throw error;
  }

  // Filter approved enrollments for roster
  const approvedEnrollments = targetClass.enrollments.filter(e => e.status === 'APPROVED');
  const pendingRequests = isInstructor 
    ? targetClass.enrollments.filter(e => e.status === 'PENDING')
    : [];

  return {
    id: targetClass.id,
    title: targetClass.title,
    description: targetClass.description,
    code: targetClass.code,
    createdAt: targetClass.createdAt,
    updatedAt: targetClass.updatedAt,
    instructor: targetClass.instructor,
    sessions: targetClass.sessions,
    enrollments: approvedEnrollments,
    pendingRequests,
    isInstructor,
    isEnrolled,
    _count: {
      enrollments: approvedEnrollments.length,
      sessions: targetClass.sessions.length,
      pendingRequests: pendingRequests.length
    }
  };
}

export async function getClassPendingRequests({ classId, instructorId }) {
  const targetClass = await prisma.class.findUnique({
    where: { id: classId }
  });

  if (!targetClass) {
    const error = new Error('Class not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetClass.instructorId !== instructorId) {
    const error = new Error('Only the instructor can view join requests');
    error.statusCode = 403;
    throw error;
  }

  const pendingRequests = await prisma.enrollment.findMany({
    where: {
      classId,
      status: 'PENDING'
    },
    include: {
      student: { select: { id: true, name: true, email: true } }
    },
    orderBy: { enrolledAt: 'desc' }
  });

  return pendingRequests;
}

export async function approveStudentRequest({ classId, enrollmentId, instructorId }) {
  const targetClass = await prisma.class.findUnique({
    where: { id: classId }
  });

  if (!targetClass) {
    const error = new Error('Class not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetClass.instructorId !== instructorId) {
    const error = new Error('Only the instructor can approve student requests');
    error.statusCode = 403;
    throw error;
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { student: { select: { id: true, name: true, email: true } } }
  });

  if (!enrollment || enrollment.classId !== classId) {
    const error = new Error('Enrollment request not found');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status: 'APPROVED' },
    include: { student: { select: { id: true, name: true, email: true } } }
  });

  return updated;
}

export async function rejectStudentRequest({ classId, enrollmentId, instructorId }) {
  const targetClass = await prisma.class.findUnique({
    where: { id: classId }
  });

  if (!targetClass) {
    const error = new Error('Class not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetClass.instructorId !== instructorId) {
    const error = new Error('Only the instructor can reject student requests');
    error.statusCode = 403;
    throw error;
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId }
  });

  if (!enrollment || enrollment.classId !== classId) {
    const error = new Error('Enrollment request not found');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status: 'REJECTED' }
  });

  return updated;
}
