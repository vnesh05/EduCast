import * as sessionService from '../services/sessionService.js';

export async function create(req, res, next) {
  try {
    const { classId, title } = req.body;
    const instructorId = req.user.userId;
    const session = await sessionService.createSession({ classId, title, instructorId });
    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
}

export async function end(req, res, next) {
  try {
    const sessionId = req.params.id;
    const instructorId = req.user.userId;
    const session = await sessionService.endSession({ sessionId, instructorId });
    res.json({ message: 'Session ended successfully', session });
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const sessionId = req.params.id;
    const userId = req.user.userId;
    const session = await sessionService.getSessionById(sessionId, userId);
    res.json({ session });
  } catch (error) {
    next(error);
  }
}

export async function getChatHistory(req, res, next) {
  try {
    const sessionId = req.params.id;
    const userId = req.user.userId;
    const messages = await sessionService.getChatHistory(sessionId, userId);
    res.json({ messages });
  } catch (error) {
    next(error);
  }
}
