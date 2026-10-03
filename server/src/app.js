import express from 'express';
import cors from 'cors';
import { CORS_ORIGIN } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import classRoutes from './routes/classRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

const allowedOrigins = CORS_ORIGIN && CORS_ORIGIN.includes(',')
  ? CORS_ORIGIN.split(',').map(o => o.trim())
  : CORS_ORIGIN;

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'EduCast API', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api', attendanceRoutes);

// Error Handling
app.use(errorHandler);

export default app;
