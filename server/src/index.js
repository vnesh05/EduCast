import http from 'http';
import app from './app.js';
import { PORT, CORS_ORIGIN } from './config/env.js';
import { initSocketServer } from './socket/signaling.js';

const httpServer = http.createServer(app);

// Attach Socket.IO Signaling Server
initSocketServer(httpServer, CORS_ORIGIN);

httpServer.listen(PORT, () => {
  console.log(`🚀 EduCast HTTP & Socket.IO Server running on http://localhost:${PORT}`);
});
