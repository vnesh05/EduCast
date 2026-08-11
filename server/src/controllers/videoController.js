import * as videoService from '../services/videoService.js';

export async function uploadRecording(req, res, next) {
  try {
    const sessionId = req.params.sessionId;
    const instructorId = req.user.userId;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    // Static local video URL endpoint path
    const videoUrl = `/uploads/recordings/${req.file.filename}`;
    const fileSize = req.file.size;
    const durationSec = req.body.durationSec ? parseInt(req.body.durationSec, 10) : 0;

    const recording = await videoService.saveRecording({
      sessionId,
      videoUrl,
      fileSize,
      durationSec,
      instructorId
    });

    res.status(201).json({ message: 'Recording uploaded successfully', recording });
  } catch (error) {
    next(error);
  }
}

export async function listClassRecordings(req, res, next) {
  try {
    const classId = req.params.classId;
    const userId = req.user.userId;
    const recordings = await videoService.getClassRecordings(classId, userId);
    res.json({ recordings });
  } catch (error) {
    next(error);
  }
}

export async function getRecording(req, res, next) {
  try {
    const recordingId = req.params.id;
    const userId = req.user.userId;
    const recording = await videoService.getRecordingById(recordingId, userId);
    res.json({ recording });
  } catch (error) {
    next(error);
  }
}

export async function logAttendance(req, res, next) {
  try {
    const sessionId = req.params.sessionId;
    const studentId = req.user.userId;
    const { durationSeconds } = req.body;
    
    const attendance = await videoService.recordAttendance({
      sessionId,
      studentId,
      durationSeconds: parseInt(durationSeconds, 10) || 0
    });

    res.json({ message: 'Attendance recorded', attendance });
  } catch (error) {
    next(error);
  }
}

export async function getAnalytics(req, res, next) {
  try {
    const classId = req.params.classId;
    const instructorId = req.user.userId;
    const analytics = await videoService.getClassAnalytics(classId, instructorId);
    res.json({ analytics });
  } catch (error) {
    next(error);
  }
}
