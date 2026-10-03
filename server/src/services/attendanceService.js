import { prisma } from '../config/db.js';

export async function recordAttendance({ sessionId, studentId, durationSeconds }) {
  const existing = await prisma.attendance.findFirst({
    where: { sessionId, studentId }
  });

  if (existing) {
    return prisma.attendance.update({
      where: { id: existing.id },
      data: {
        durationSeconds: (existing.durationSeconds || 0) + (durationSeconds || 0),
        leftAt: new Date()
      }
    });
  } else {
    return prisma.attendance.create({
      data: {
        sessionId,
        studentId,
        durationSeconds: durationSeconds || 0,
        joinedAt: new Date(),
        leftAt: new Date()
      }
    });
  }
}

export async function getClassAnalytics(classId, instructorId) {
  const targetClass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      enrollments: {
        where: { status: 'APPROVED' },
        include: {
          student: { select: { id: true, name: true, email: true } }
        }
      },
      sessions: { select: { id: true, title: true, startedAt: true, endedAt: true } }
    }
  });

  if (!targetClass) {
    const error = new Error('Class not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetClass.instructorId !== instructorId) {
    const error = new Error('Only the instructor can view class analytics');
    error.statusCode = 403;
    throw error;
  }

  const totalSessions = targetClass.sessions.length;

  // Calculate per-student watch time & attendance records
  const studentAnalytics = await Promise.all(
    targetClass.enrollments.map(async (enr) => {
      const attendances = await prisma.attendance.findMany({
        where: {
          studentId: enr.studentId,
          session: { classId }
        }
      });

      const totalWatchSec = attendances.reduce((acc, a) => acc + (a.durationSeconds || 0), 0);
      const sessionsAttended = new Set(attendances.map(a => a.sessionId)).size;
      const attendanceRate = totalSessions > 0 ? Math.min(100, Math.round((sessionsAttended / totalSessions) * 100)) : 0;

      return {
        student: enr.student,
        totalWatchSec,
        totalWatchMinutes: Math.round(totalWatchSec / 60),
        sessionsAttended,
        attendanceRate
      };
    })
  );

  return {
    classTitle: targetClass.title,
    totalSessions,
    totalStudents: targetClass.enrollments.length,
    studentAnalytics
  };
}

export async function getClassAttendanceHistory({ classId, instructorId }) {
  const targetClass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      enrollments: {
        where: { status: 'APPROVED' },
        include: {
          student: { select: { id: true, name: true, email: true } }
        }
      },
      sessions: {
        orderBy: { createdAt: 'desc' },
        include: {
          attendance: {
            include: {
              student: { select: { id: true, name: true, email: true } }
            }
          }
        }
      }
    }
  });

  if (!targetClass) {
    const error = new Error('Class not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetClass.instructorId !== instructorId) {
    const error = new Error('Only the instructor can view attendance history');
    error.statusCode = 403;
    throw error;
  }

  const enrolledStudents = targetClass.enrollments.map(e => e.student);
  const totalEnrolled = enrolledStudents.length;

  // Build session-by-session previous classes tracker
  const sessionHistory = targetClass.sessions.map(sess => {
    const attendanceMap = new Map();
    sess.attendance.forEach(att => {
      const existing = attendanceMap.get(att.studentId);
      if (existing) {
        existing.durationSeconds += att.durationSeconds || 0;
        if (att.leftAt && (!existing.leftAt || att.leftAt > existing.leftAt)) {
          existing.leftAt = att.leftAt;
        }
      } else {
        attendanceMap.set(att.studentId, {
          joinedAt: att.joinedAt,
          leftAt: att.leftAt,
          durationSeconds: att.durationSeconds || 0
        });
      }
    });

    const roster = enrolledStudents.map(student => {
      const att = attendanceMap.get(student.id);
      const isPresent = !!att && att.durationSeconds > 0;
      return {
        studentId: student.id,
        name: student.name,
        email: student.email,
        attended: isPresent,
        joinedAt: att ? att.joinedAt : null,
        leftAt: att ? att.leftAt : null,
        durationSeconds: att ? att.durationSeconds : 0,
        durationMinutes: att ? Math.round(att.durationSeconds / 60) : 0
      };
    });

    const attendedCount = roster.filter(r => r.attended).length;
    const attendanceRate = totalEnrolled > 0 ? Math.round((attendedCount / totalEnrolled) * 100) : 0;

    const sessionDurationSec = sess.startedAt && sess.endedAt
      ? Math.max(1, Math.round((new Date(sess.endedAt) - new Date(sess.startedAt)) / 1000))
      : 0;

    return {
      sessionId: sess.id,
      title: sess.title,
      status: sess.status,
      startedAt: sess.startedAt,
      endedAt: sess.endedAt,
      createdAt: sess.createdAt,
      durationMinutes: Math.round(sessionDurationSec / 60),
      totalEnrolled,
      attendedCount,
      attendanceRate,
      roster
    };
  });

  return {
    classTitle: targetClass.title,
    totalSessions: targetClass.sessions.length,
    totalStudents: totalEnrolled,
    sessionHistory
  };
}
