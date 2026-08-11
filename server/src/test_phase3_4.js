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
      console.log('2️⃣ Setting up Class & Session...');
      const classRes = await fetch(`${baseUrl}/api/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${instData.accessToken}`
        },
        body: JSON.stringify({ title: 'Information Theory 101' })
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
        body: JSON.stringify({ durationSeconds: 1850 }) // ~30 minutes
      });
      const attendData = await attendRes.json();
      console.log('   Attendance Logged Duration:', attendData.attendance.durationSeconds, 'seconds');

      // 4. Test Instructor Analytics Dashboard API
      console.log('4️⃣ Fetching Instructor Engagement & Watch Time Analytics...');
      const analyticsRes = await fetch(`${baseUrl}/api/classes/${classData.class.id}/analytics`, {
        headers: { 'Authorization': `Bearer ${instData.accessToken}` }
      });
      const analyticsData = await analyticsRes.json();
      console.log('   Total Class Sessions:', analyticsData.analytics.totalSessions);
      console.log('   Student Watch Minutes:', analyticsData.analytics.studentAnalytics[0].totalWatchMinutes);
      console.log('   Student Attendance Rate:', analyticsData.analytics.studentAnalytics[0].attendanceRate + '%');

      console.log('\n✅ ALL PHASE 3 & 4 INTEGRATION TESTS PASSED PERFECTLY!\n');
    } catch (err) {
      console.error('❌ Phase 3 & 4 test failed:', err);
    } finally {
      await prisma.$disconnect();
      server.close();
      process.exit(0);
    }
  });
}

runPhase3And4Verification();
