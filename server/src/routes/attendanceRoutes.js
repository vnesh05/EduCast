import { Router } from 'express';
import * as attendanceController from '../controllers/attendanceController.js';
import { authenticate, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);

// Student: Log attendance & watch duration for live session
router.post('/sessions/:sessionId/attendance', requireRole('STUDENT'), attendanceController.logAttendance);

// Instructor only: Get class attendance & watch time overall analytics
router.get('/classes/:classId/analytics', requireRole('INSTRUCTOR'), attendanceController.getAnalytics);

// Instructor only: Get previous classes session-by-session attendance tracker with student rosters
router.get('/classes/:classId/attendance-history', requireRole('INSTRUCTOR'), attendanceController.getAttendanceHistory);

export default router;
