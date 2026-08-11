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
  let rawClasses = [];
  if (role === 'INSTRUCTOR') {
    rawClasses = await prisma.class.findMany({
      where: { instructorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        instructor: { select: { id: true, name: true, email: true } },
        sessions: {
          include: { videoRecording: true }
        },
        _count: { select: { enrollments: true } }
      }
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
              include: { videoRecording: true }
            },
            _count: { select: { enrollments: true } }
          }
        }
      }
    });
    rawClasses = enrollments.map(e => e.class);
  }

  return rawClasses.map(cls => {
    const validCount = cls.sessions ? cls.sessions.filter(s => s.status === 'LIVE' || s.videoRecording).length : 0;
    return {
      ...cls,
      _count: {
        ...cls._count,
        sessions: validCount,
        recordings: validCount
      }
    };
  });
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
    error.statusCode = 444;
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
    const error = new Error('You are already enrolled in this class.');
    error.statusCode = 400;
    throw error;
  }

  await prisma.enrollment.create({
    data: {
      classId: targetClass.id,
      studentId
    }
  });

  return targetClass;
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
      },
      _count: { select: { enrollments: true, sessions: true } }
    }
  });

  if (!targetClass) {
    const error = new Error('Class not found');
    error.statusCode = 404;
    throw error;
  }

  // Check access permissions (must be instructor or enrolled student)
  const isInstructor = targetClass.instructorId === userId;
  const isEnrolled = targetClass.enrollments.some(e => e.studentId === userId);

  if (!isInstructor && !isEnrolled) {
    const error = new Error('Access denied. You are not enrolled in this class.');
    error.statusCode = 403;
    throw error;
  }

  return {
    ...targetClass,
    isInstructor,
    isEnrolled
  };
}
