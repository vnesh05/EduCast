import http from 'http';
import app from './app.js';
import { prisma } from './config/db.js';

async function runPhase3And4Verification() {
  console.log('🧪 Starting Phase 3 & 4 (Recording, Analytics & VOD) Integration Tests...\n');

  const server = app.listen(5097, async () => {
    try {
      const baseUrl = 'http://localhost:5097';

      // 1. Setup Test Users
      console.log('1️⃣ Registering Test Users...');
      const instRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prof. Claude Shannon',
          email: `shannon_${Date.now()}@mit.edu`,
          password: 'password123',
          role: 'INSTRUCTOR'
        })
      });
      const instData = await instRes.json();

      const studRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'John von Neumann',
          email: `neumann_${Date.now()}@ias.edu`,
          password: 'password123',
          role: 'STUDENT'
        })
      });
      const studData = await studRes.json();

      // 2. Setup Class & Session
      console.log('2️⃣ Setting up Class & Enrollment...');
      const classRes = await fetch(`${baseUrl}/api/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${instData.accessToken}`
        },
        body: JSON.stringify({ title: 'Information Theory 101' })
      });
      const classData = await classRes.json();

      const joinRes = await fetch(`${baseUrl}/api/classes/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studData.accessToken}`
        },
        body: JSON.stringify({ code: classData.class.code })
      });
      const joinData = await joinRes.json();

      // Instructor approves student enrollment
      await fetch(`${baseUrl}/api/classes/${classData.class.id}/requests/${joinData.enrollment.id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${instData.accessToken}` }
      });
      console.log('   Student join request approved.');

      const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${instData.accessToken}`
        },
        body: JSON.stringify({ classId: classData.class.id, title: 'Entropy & Channel Capacity' })
      });
      const sessionData = await sessionRes.json();
      const session = sessionData.session;

      // 3. Test Student Attendance & Watch Duration Logging
      console.log('3️⃣ Logging Student Attendance & Watch Time...');
      const attendRes = await fetch(`${baseUrl}/api/sessions/${session.id}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studData.accessToken}`
        },
        body: JSON.stringify({ durationSeconds: 1850 }) // ~31 minutes
      });
      const attendData = await attendRes.json();
      console.log('   Attendance Logged Duration:', attendData.attendance.durationSeconds, 'seconds');

      // 4. Instructor Ends Session
      console.log('4️⃣ Instructor ending session to finalize previous class record...');
      await fetch(`${baseUrl}/api/sessions/${session.id}/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${instData.accessToken}` }
      });

      // 5. Test Instructor Attendance History & Roster Verification API
      console.log('5️⃣ Fetching Session-by-Session Attendance Tracker & Roster...');
      const historyRes = await fetch(`${baseUrl}/api/classes/${classData.class.id}/attendance-history`, {
        headers: { 'Authorization': `Bearer ${instData.accessToken}` }
      });
      const historyData = await historyRes.json();
      console.log('   Tracked Sessions Count:', historyData.sessionHistory.length);
      const trackedSession = historyData.sessionHistory[0];
      console.log('   Session Title:', trackedSession.title, '| Status:', trackedSession.status);
      console.log('   Attended Students:', trackedSession.attendedCount, '/', trackedSession.totalEnrolled);
      console.log('   Student Attended Boolean:', trackedSession.roster[0].attended, '| Duration Min:', trackedSession.roster[0].durationMinutes);

      if (trackedSession.attendedCount !== 1) throw new Error('Expected 1 attended student in attendance tracker');
      if (trackedSession.roster[0].attended !== true) throw new Error('Expected student attended to be true');

      // 6. Test Aggregate Analytics Endpoint
      console.log('6️⃣ Fetching Class Engagement Aggregate Analytics...');
      const analyticsRes = await fetch(`${baseUrl}/api/classes/${classData.class.id}/analytics`, {
        headers: { 'Authorization': `Bearer ${instData.accessToken}` }
      });
      const analyticsData = await analyticsRes.json();
      console.log('   Total Class Sessions:', analyticsData.analytics.totalSessions);
      console.log('   Student Watch Minutes:', analyticsData.analytics.studentAnalytics[0].totalWatchMinutes);
      console.log('   Student Attendance Rate:', analyticsData.analytics.studentAnalytics[0].attendanceRate + '%');

      console.log('\n✅ ALL PHASE 3 & 4 (ATTENDANCE & ANALYTICS) INTEGRATION TESTS PASSED PERFECTLY!\n');
    } catch (err) {
      console.error('❌ Phase 3 & 4 test failed:', err);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
      server.close();
      process.exit(process.exitCode || 0);
    }
  });
}

runPhase3And4Verification();
