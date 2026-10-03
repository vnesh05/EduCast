import * as classService from '../services/classService.js';

export async function create(req, res, next) {
  try {
    const { title, description } = req.body;
    const instructorId = req.user.userId;
    const newClass = await classService.createClass({ title, description, instructorId });
    res.status(201).json({ class: newClass });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const classes = await classService.getUserClasses({ userId, role });
    res.json({ classes });
  } catch (error) {
    next(error);
  }
}

export async function join(req, res, next) {
  try {
    const { code } = req.body;
    const studentId = req.user.userId;
    const result = await classService.joinClassByCode({ code, studentId });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const classId = req.params.id;
    const userId = req.user.userId;
    const classDetail = await classService.getClassById({ classId, userId });
    res.json({ class: classDetail });
  } catch (error) {
    next(error);
  }
}

export async function getPendingRequests(req, res, next) {
  try {
    const classId = req.params.id;
    const instructorId = req.user.userId;
    const requests = await classService.getClassPendingRequests({ classId, instructorId });
    res.json({ requests });
  } catch (error) {
    next(error);
  }
}

export async function approveRequest(req, res, next) {
  try {
    const { id: classId, enrollmentId } = req.params;
    const instructorId = req.user.userId;
    const enrollment = await classService.approveStudentRequest({ classId, enrollmentId, instructorId });
    res.json({ message: 'Student enrollment approved successfully', enrollment });
  } catch (error) {
    next(error);
  }
}

export async function rejectRequest(req, res, next) {
  try {
    const { id: classId, enrollmentId } = req.params;
    const instructorId = req.user.userId;
    const enrollment = await classService.rejectStudentRequest({ classId, enrollmentId, instructorId });
    res.json({ message: 'Student enrollment rejected', enrollment });
  } catch (error) {
    next(error);
  }
}
