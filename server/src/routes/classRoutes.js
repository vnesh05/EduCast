import { Router } from 'express';
import * as classController from '../controllers/classController.js';
import { authenticate, requireRole } from '../middlewares/auth.js';

const router = Router();

// All class routes require authentication
router.use(authenticate);

// Instructor only: Create class
router.post('/', requireRole('INSTRUCTOR'), classController.create);

// Student only: Join class by code
router.post('/join', requireRole('STUDENT'), classController.join);

// List user classes (Role-aware list)
router.get('/', classController.list);

// Get single class details
router.get('/:id', classController.getById);

export default router;
