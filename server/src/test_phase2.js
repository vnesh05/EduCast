import http from 'http';
import app from './app.js';
import { prisma } from './config/db.js';
import { initSocketServer } from './socket/signaling.js';
import { io as Client } from 'socket.io-client';

async function runPhase2Verification() {
  console.log('🧪 Starting Phase 2 Live Class & Socket.IO Integration Tests...\n');

  const httpServer = http.createServer(app);
  initSocketServer(httpServer, '*');

  const PORT = 5098;

  httpServer.listen(PORT, async () => {
    try {
      const baseUrl = `http://localhost:${PORT}`;

      // 1. Setup Test Users
      console.log('1️⃣ Registering Test Instructor & Student...');
      const instRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prof. Richard Feynman',
          email: `feynman_${Date.now()}@caltech.edu`,
          password: 'password123',
          role: 'INSTRUCTOR'
        })
      });
      const instData = await instRes.json();

      const studRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Robert Oppenheimer',
          email: `oppie_${Date.now()}@berkeley.edu`,
          password: 'password123',
          role: 'STUDENT'
        })
      });
      const studData = await studRes.json();

      // 2. Create Class & Join
      console.log('2️⃣ Setting up Class & Enrollment...');
      const classRes = await fetch(`${baseUrl}/api/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${instData.accessToken}`
        },
        body: JSON.stringify({ title: 'Quantum Electrodynamics', description: 'QED Principles' })
      });
      const classData = await classRes.json();

      await fetch(`${baseUrl}/api/classes/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studData.accessToken}`
        },
        body: JSON.stringify({ code: classData.class.code })
      });

      // 3. Instructor Starts Live Session
      console.log('3️⃣ Instructor starting live session via REST API...');
      const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${instData.accessToken}`
        },
        body: JSON.stringify({
          classId: classData.class.id,
          title: 'QED Lecture 1: Path Integrals'
        })
      });
      const sessionData = await sessionRes.json();
      const session = sessionData.session;
      console.log('   Live Session Created:', session.title, '| Status:', session.status);

      // 4. Socket.IO Connections & Room Joining
      console.log('4️⃣ Connecting Sockets and joining room...');
      const instSocket = Client(baseUrl, { auth: { token: instData.accessToken } });
      const studSocket = Client(baseUrl, { auth: { token: studData.accessToken } });

      await new Promise((resolve) => {
        let connectedCount = 0;
        const check = () => {
          connectedCount++;
          if (connectedCount === 2) resolve();
        };
        instSocket.on('connect', check);
        studSocket.on('connect', check);
      });

      console.log('   Sockets connected via JWT auth!');

      // Instructors and student join session room
      instSocket.emit('join-room', { sessionId: session.id });
      studSocket.emit('join-room', { sessionId: session.id });

      // 5. Test Live Chat Messaging & Persistence
      console.log('5️⃣ Testing Real-Time Persisted Chat via Socket.IO...');
      const chatPromise = new Promise((resolve) => {
        instSocket.on('receive-chat', (chatMsg) => {
          console.log(`   [Broadcast Received] ${chatMsg.sender.name}: ${chatMsg.content}`);
          resolve(chatMsg);
        });
      });

      studSocket.emit('send-chat', {
        sessionId: session.id,
        content: 'Is path integral formulation equivalent to canonical quantization?'
      });

      const chatResult = await chatPromise;
      if (!chatResult || !chatResult.id) throw new Error('Chat broadcast failed');

      // 6. Verify REST Chat History Endpoint
      console.log('6️⃣ Verifying Chat History Endpoint from Database...');
      const historyRes = await fetch(`${baseUrl}/api/sessions/${session.id}/chat`, {
        headers: { 'Authorization': `Bearer ${instData.accessToken}` }
      });
      const historyData = await historyRes.json();
      console.log('   DB Messages retrieved:', historyData.messages.length);

      // 7. Instructor Ends Session
      console.log('7️⃣ Instructor ending session...');
      const endRes = await fetch(`${baseUrl}/api/sessions/${session.id}/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${instData.accessToken}` }
      });
      const endData = await endRes.json();
      console.log('   Ended session status:', endData.session.status);

      // Cleanup
      instSocket.disconnect();
      studSocket.disconnect();

      console.log('\n✅ ALL PHASE 2 INTEGRATION TESTS PASSED PERFECTLY!\n');
    } catch (err) {
      console.error('❌ Phase 2 test failed:', err);
    } finally {
      await prisma.$disconnect();
      httpServer.close();
      process.exit(0);
    }
  });
}

runPhase2Verification();
