import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as videoController from '../controllers/videoController.js';
import { authenticate, requireRole } from '../middlewares/auth.js';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads', 'recordings');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Local Disk Storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `rec-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

const router = Router();

router.use(authenticate);

// Instructor only: Upload session recording
router.post(
  '/sessions/:sessionId/recordings',
  requireRole('INSTRUCTOR'),
  upload.single('video'),
  videoController.uploadRecording
);

// Student & Instructor: List class recordings
router.get('/classes/:classId/recordings', videoController.listClassRecordings);

// Student & Instructor: Get single recording metadata & playback
router.get('/recordings/:id', videoController.getRecording);

// Student: Log attendance & watch duration
router.post('/sessions/:sessionId/attendance', requireRole('STUDENT'), videoController.logAttendance);

// Instructor only: Get class attendance & watch time analytics
router.get('/classes/:classId/analytics', requireRole('INSTRUCTOR'), videoController.getAnalytics);

export default router;
