import * as attendanceService from '../services/attendanceService.js';

export async function logAttendance(req, res, next) {
  try {
    const sessionId = req.params.sessionId;
    const studentId = req.user.userId;
    const { durationSeconds } = req.body;

    const attendance = await attendanceService.recordAttendance({
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
    const analytics = await attendanceService.getClassAnalytics(classId, instructorId);
    res.json({ analytics });
  } catch (error) {
    next(error);
  }
}

export async function getAttendanceHistory(req, res, next) {
  try {
    const classId = req.params.classId;
    const instructorId = req.user.userId;
    const history = await attendanceService.getClassAttendanceHistory({ classId, instructorId });
    res.json({
      ...history,
      history
    });
  } catch (error) {
    next(error);
  }
}
