import { Router } from 'express';
import * as classController from '../controllers/classController.js';
import { authenticate, requireRole } from '../middlewares/auth.js';

const router = Router();

// All class routes require authentication
router.use(authenticate);

// Instructor only: Create class
router.post('/', requireRole('INSTRUCTOR'), classController.create);

// Student only: Join class by code (submits request for instructor approval)
router.post('/join', requireRole('STUDENT'), classController.join);

// List user classes (Role-aware list)
router.get('/', classController.list);

// Get single class details
router.get('/:id', classController.getById);

// Instructor only: View pending enrollment requests for class
router.get('/:id/requests', requireRole('INSTRUCTOR'), classController.getPendingRequests);

// Instructor only: Approve student enrollment request
router.post('/:id/requests/:enrollmentId/approve', requireRole('INSTRUCTOR'), classController.approveRequest);

// Instructor only: Reject student enrollment request
router.post('/:id/requests/:enrollmentId/reject', requireRole('INSTRUCTOR'), classController.rejectRequest);

export default router;
