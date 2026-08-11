import { prisma } from '../config/db.js';

export async function saveRecording({ sessionId, videoUrl, fileSize, durationSec, instructorId }) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { class: true }
  });

  if (!session) {
    const error = new Error('Session not found');
    error.statusCode = 404;
    throw error;
  }

  if (session.class.instructorId !== instructorId) {
    const error = new Error('Only the instructor can save session recordings');
    error.statusCode = 403;
    throw error;
  }

  const recording = await prisma.videoRecording.upsert({
    where: { sessionId },
    update: {
      videoUrl,
      fileSize: fileSize || 0,
      durationSec: durationSec || 0
    },
    create: {
      sessionId,
      videoUrl,
      fileSize: fileSize || 0,
      durationSec: durationSec || 0
    },
    include: {
      session: {
        include: {
          class: { select: { id: true, title: true } }
        }
      }
    }
  });

  return recording;
}

export async function getClassRecordings(classId, userId) {
  // Ensure user has access to class
  const targetClass = await prisma.class.findUnique({
    where: { id: classId },
    include: { enrollments: { select: { studentId: true } } }
  });

  if (!targetClass) {
    const error = new Error('Class not found');
    error.statusCode = 404;
    throw error;
  }

  const isInstructor = targetClass.instructorId === userId;
  const isEnrolled = targetClass.enrollments.some(e => e.studentId === userId);

  if (!isInstructor && !isEnrolled) {
    const error = new Error('Access denied');
    error.statusCode = 403;
    throw error;
  }

  const recordings = await prisma.videoRecording.findMany({
    where: {
      session: { classId }
    },
    include: {
      session: {
        include: {
          class: { select: { title: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return recordings;
}

export async function getRecordingById(recordingId, userId) {
  const recording = await prisma.videoRecording.findUnique({
    where: { id: recordingId },
    include: {
      session: {
        include: {
          class: {
            include: {
              instructor: { select: { id: true, name: true, email: true } },
              enrollments: { select: { studentId: true } }
            }
          },
          chatMessages: {
            include: { sender: { select: { name: true, role: true } } },
            orderBy: { createdAt: 'asc' }
          }
        }
      }
    }
  });

  if (!recording) {
    const error = new Error('Recording not found');
    error.statusCode = 404;
    throw error;
  }

  const isInstructor = recording.session.class.instructorId === userId;
  const isEnrolled = recording.session.class.enrollments.some(e => e.studentId === userId);

  if (!isInstructor && !isEnrolled) {
    const error = new Error('Access denied');
    error.statusCode = 403;
    throw error;
  }

  return recording;
}

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
      const sessionsAttended = attendances.length;
      const attendanceRate = totalSessions > 0 ? Math.round((sessionsAttended / totalSessions) * 100) : 0;

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
