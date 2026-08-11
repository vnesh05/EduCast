import { prisma } from '../config/db.js';

export async function createSession({ classId, title, instructorId }) {
  const targetClass = await prisma.class.findUnique({
    where: { id: classId }
  });

  if (!targetClass) {
    const error = new Error('Class not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetClass.instructorId !== instructorId) {
    const error = new Error('Only the class instructor can start a live session');
    error.statusCode = 403;
    throw error;
  }

  // Auto-end any prior active LIVE session for this class to prevent live streams piling up
  await prisma.session.updateMany({
    where: { classId, status: 'LIVE' },
    data: {
      status: 'ENDED',
      endedAt: new Date()
    }
  });

  const session = await prisma.session.create({
    data: {
      classId,
      title: title || `${targetClass.title} - Live Stream`,
      status: 'LIVE',
      startedAt: new Date()
    },
    include: {
      class: {
        include: {
          instructor: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });

  return session;
}

export async function endSession({ sessionId, instructorId }) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { class: true, videoRecording: true }
  });

  if (!session) {
    const error = new Error('Session not found');
    error.statusCode = 404;
    throw error;
  }

  if (session.class.instructorId !== instructorId) {
    const error = new Error('Only the instructor can end this live session');
    error.statusCode = 403;
    throw error;
  }

  const updatedSession = await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: 'ENDED',
      endedAt: new Date()
    }
  });

  // Automatically create a VOD entry if no recording file was manually uploaded
  if (!session.videoRecording) {
    const durationSec = session.startedAt 
      ? Math.max(1, Math.round((new Date() - new Date(session.startedAt)) / 1000))
      : 300;

    await prisma.videoRecording.create({
      data: {
        sessionId: session.id,
        videoUrl: '/uploads/recordings/default_vod.webm',
        fileSize: 1024 * 512,
        durationSec
      }
    }).catch(err => console.log('Auto VOD record creation message:', err.message));
  }

  return updatedSession;
}

export async function getSessionById(sessionId, userId) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      class: {
        include: {
          instructor: { select: { id: true, name: true, email: true } },
          enrollments: { select: { studentId: true } }
        }
      }
    }
  });

  if (!session) {
    const error = new Error('Session not found');
    error.statusCode = 404;
    throw error;
  }

  const isInstructor = session.class.instructorId === userId;
  const isEnrolled = session.class.enrollments.some(e => e.studentId === userId);

  if (!isInstructor && !isEnrolled) {
    const error = new Error('Access denied. You are not enrolled in this class.');
    error.statusCode = 403;
    throw error;
  }

  return {
    ...session,
    isInstructor
  };
}

export async function saveChatMessage({ sessionId, senderId, content }) {
  if (!content || !content.trim()) {
    const error = new Error('Chat message content cannot be empty');
    error.statusCode = 400;
    throw error;
  }

  const chatMessage = await prisma.chatMessage.create({
    data: {
      sessionId,
      senderId,
      content: content.trim()
    },
    include: {
      sender: {
        select: { id: true, name: true, role: true }
      }
    }
  });

  return chatMessage;
}

export async function getChatHistory(sessionId, userId) {
  // Ensure access
  await getSessionById(sessionId, userId);

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: {
        select: { id: true, name: true, role: true }
      }
    }
  });

  return messages;
}
