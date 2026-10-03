import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/tokens.js';
import { saveChatMessage, endSession } from '../services/sessionService.js';

const disconnectTimers = new Map();

export function initSocketServer(httpServer, corsOrigin) {
  const allowedOrigins = corsOrigin && corsOrigin.includes(',')
    ? corsOrigin.split(',').map(o => o.trim())
    : (corsOrigin || '*');

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Socket Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  const broadcastRoomCount = (roomName) => {
    const roomSockets = io.sockets.adapter.rooms.get(roomName);
    if (!roomSockets) {
      io.in(roomName).emit('room-user-count', { count: 0 });
      return;
    }
    const uniqueUserIds = new Set();
    for (const socketId of roomSockets) {
      const s = io.sockets.sockets.get(socketId);
      if (s && s.user && s.user.userId) {
        uniqueUserIds.add(s.user.userId);
      }
    }
    const count = Math.max(1, uniqueUserIds.size);
    io.in(roomName).emit('room-user-count', { count });
  };

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (User: ${socket.user.name}, Role: ${socket.user.role})`);

    // Join Session Room
    socket.on('join-room', ({ sessionId }) => {
      const roomName = `session:${sessionId}`;
      socket.join(roomName);
      socket.currentRoom = roomName;
      socket.currentSessionId = sessionId;

      // Cancel any pending disconnect auto-end timer if instructor rejoined
      if (socket.user?.role === 'INSTRUCTOR' && disconnectTimers.has(sessionId)) {
        clearTimeout(disconnectTimers.get(sessionId));
        disconnectTimers.delete(sessionId);
      }

      // Get all other connected sockets in this room
      const roomSockets = io.sockets.adapter.rooms.get(roomName);
      const existingPeers = [];
      if (roomSockets) {
        for (const id of roomSockets) {
          if (id !== socket.id) {
            const peerSocket = io.sockets.sockets.get(id);
            if (peerSocket) {
              existingPeers.push({
                socketId: id,
                user: peerSocket.user
              });
            }
          }
        }
      }

      // Send existing peers list to newly joined client
      socket.emit('room-peers', { peers: existingPeers });

      // Notify existing peers that a new user joined
      socket.to(roomName).emit('user-joined', {
        socketId: socket.id,
        user: socket.user
      });

      // Broadcast authoritative room count to all occupants
      broadcastRoomCount(roomName);

      console.log(`👤 ${socket.user.name} joined room ${roomName}`);
    });

    // WebRTC Signaling: Student requests live stream
    socket.on('request-stream', ({ sessionId }) => {
      const roomName = `session:${sessionId}`;
      socket.to(roomName).emit('request-stream', {
        studentSocketId: socket.id,
        user: socket.user
      });
    });

    // WebRTC Signaling: Relay Offer
    socket.on('signal-offer', ({ targetSocketId, sdp }) => {
      io.to(targetSocketId).emit('receive-offer', {
        senderSocketId: socket.id,
        user: socket.user,
        sdp
      });
    });

    // WebRTC Signaling: Relay Answer
    socket.on('signal-answer', ({ targetSocketId, sdp }) => {
      io.to(targetSocketId).emit('receive-answer', {
        senderSocketId: socket.id,
        user: socket.user,
        sdp
      });
    });

    // WebRTC Signaling: Relay ICE Candidate
    socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('receive-candidate', {
        senderSocketId: socket.id,
        candidate
      });
    });

    // Real-Time Chat Message Handler
    socket.on('send-chat', async ({ sessionId, content }) => {
      try {
        const savedMessage = await saveChatMessage({
          sessionId,
          senderId: socket.user.userId,
          content
        });

        // Broadcast persisted message to everyone in the room (including sender for sync)
        io.in(`session:${sessionId}`).emit('receive-chat', savedMessage);
      } catch (err) {
        socket.emit('chat-error', { error: err.message });
      }
    });

    // Disconnect Handler
    socket.on('disconnect', async () => {
      if (socket.currentRoom) {
        const room = socket.currentRoom;
        const sessionId = socket.currentSessionId;
        const instructorId = socket.user?.userId;

        // If instructor disconnected, provide 15s grace period before auto-ending to accommodate page reloads
        if (sessionId && socket.user?.role === 'INSTRUCTOR') {
          if (disconnectTimers.has(sessionId)) {
            clearTimeout(disconnectTimers.get(sessionId));
          }

          const timer = setTimeout(async () => {
            disconnectTimers.delete(sessionId);
            const roomSockets = io.sockets.adapter.rooms.get(room);
            let instructorReconnected = false;
            if (roomSockets) {
              for (const id of roomSockets) {
                const s = io.sockets.sockets.get(id);
                if (s?.user?.userId === instructorId) {
                  instructorReconnected = true;
                  break;
                }
              }
            }

            if (!instructorReconnected) {
              console.log(`🎬 Instructor disconnected. Auto-ending session ${sessionId}...`);
              try {
                await endSession({
                  sessionId,
                  instructorId
                });
                io.in(room).emit('session-ended', {
                  sessionId,
                  reason: 'Presenter disconnected or ended stream'
                });
              } catch (e) {
                console.error('Error ending session on instructor disconnect:', e.message);
              }
            }
          }, 15000);

          disconnectTimers.set(sessionId, timer);
        }

        socket.to(room).emit('user-left', {
          socketId: socket.id,
          user: socket.user
        });
        setTimeout(() => broadcastRoomCount(room), 100);
      }
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}
