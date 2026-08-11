import { Router } from 'express';
import * as sessionController from '../controllers/sessionController.js';
import { authenticate, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);

// Instructor only: Create new session
router.post('/', requireRole('INSTRUCTOR'), sessionController.create);

// Instructor only: End session
router.post('/:id/end', requireRole('INSTRUCTOR'), sessionController.end);

// Get session info
router.get('/:id', sessionController.getById);

// Get chat history
router.get('/:id/chat', sessionController.getChatHistory);

export default router;
