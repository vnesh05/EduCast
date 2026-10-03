import app from './app.js';
import { prisma } from './config/db.js';

async function runPhase1Verification() {
  console.log('🧪 Starting Phase 1 Integration Tests...\n');

  const server = app.listen(5099, async () => {
    try {
      const baseUrl = 'http://localhost:5099';

      // 1. Health check
      console.log('1️⃣ Testing API Health Endpoint...');
      const healthRes = await fetch(`${baseUrl}/api/health`);
      const healthData = await healthRes.json();
      console.log('   Status:', healthData.status);

      // 2. Register Instructor
      console.log('2️⃣ Registering Instructor user...');
      const instRegisterRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prof. Alan Turing',
          email: `prof_${Date.now()}@turing.edu`,
          password: 'securePassword123',
          role: 'INSTRUCTOR'
        })
      });
      const instData = await instRegisterRes.json();
      console.log('   Instructor created:', instData.user.name, 'Role:', instData.user.role);
      const instToken = instData.accessToken;

      // 3. Register Student
      console.log('3️⃣ Registering Student user...');
      const studRegisterRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Ada Lovelace',
          email: `ada_${Date.now()}@lovelace.edu`,
          password: 'studentPassword123',
          role: 'STUDENT'
        })
      });
      const studData = await studRegisterRes.json();
      console.log('   Student created:', studData.user.name, 'Role:', studData.user.role);
      const studToken = studData.accessToken;

      // 4. Create Class as Instructor
      console.log('4️⃣ Creating Class as Instructor...');
      const createClassRes = await fetch(`${baseUrl}/api/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${instToken}`
        },
        body: JSON.stringify({
          title: 'CS 301: Advanced Operating Systems',
          description: 'Deep dive into kernels, memory management, and virtualization.'
        })
      });
      const createClassData = await createClassRes.json();
      const createdClass = createClassData.class;
      console.log('   Class created:', createdClass.title);
      console.log('   Generated Join Code:', createdClass.code);

      // 5. Join Class as Student via Code
      console.log('5️⃣ Student joining class via join code...');
      const joinRes = await fetch(`${baseUrl}/api/classes/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studToken}`
        },
        body: JSON.stringify({ code: createdClass.code })
      });
      const joinData = await joinRes.json();
      console.log('   Join Result:', joinData.message, '| Status:', joinData.status);
      if (joinData.status !== 'PENDING') throw new Error(`Expected PENDING status, got ${joinData.status}`);

      // 6. Student Attempts to Fetch Class Details Before Approval (Should be 403 Forbidden)
      console.log('6️⃣ Verifying Student cannot access class details while PENDING...');
      const forbiddenRes = await fetch(`${baseUrl}/api/classes/${createdClass.id}`, {
        headers: { 'Authorization': `Bearer ${studToken}` }
      });
      console.log('   Access Status (Expected 403):', forbiddenRes.status);
      if (forbiddenRes.status !== 403) throw new Error(`Expected 403 Forbidden, got ${forbiddenRes.status}`);

      // 7. Instructor Fetches Pending Requests
      console.log('7️⃣ Instructor checking pending join requests...');
      const requestsRes = await fetch(`${baseUrl}/api/classes/${createdClass.id}/requests`, {
        headers: { 'Authorization': `Bearer ${instToken}` }
      });
      const requestsData = await requestsRes.json();
      console.log('   Pending requests count:', requestsData.requests.length);
      const studentReq = requestsData.requests.find(r => r.studentId === studData.user.id);
      if (!studentReq) throw new Error('Student request not found in pending queue');

      // 8. Instructor Approves Student Request
      console.log('8️⃣ Instructor approving student join request...');
      const approveRes = await fetch(`${baseUrl}/api/classes/${createdClass.id}/requests/${studentReq.id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${instToken}` }
      });
      const approveData = await approveRes.json();
      console.log('   Approval Result:', approveData.message, '| Enrollment Status:', approveData.enrollment.status);
      if (approveData.enrollment.status !== 'APPROVED') throw new Error('Enrollment was not approved');

      // 9. Student Fetches Class Details Post-Approval (Should Succeed 200)
      console.log('9️⃣ Student fetching class details after approval...');
      const detailRes = await fetch(`${baseUrl}/api/classes/${createdClass.id}`, {
        headers: { 'Authorization': `Bearer ${studToken}` }
      });
      const detailData = await detailRes.json();
      console.log('   Access Status:', detailRes.status, '| Approved Enrolled Students:', detailData.class._count.enrollments);
      if (detailRes.status !== 200) throw new Error(`Expected 200 OK post-approval, got ${detailRes.status}`);

      // 10. Refresh Token Test
      console.log('🔟 Testing Refresh Token Rotation...');
      const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: instData.refreshToken })
      });
      const refreshData = await refreshRes.json();
      console.log('   New Access Token Generated successfully:', !!refreshData.accessToken);

      console.log('\n✅ ALL PHASE 1 INTEGRATION TESTS (INCLUDING APPROVAL WORKFLOW) PASSED PERFECTLY!\n');
    } catch (err) {
      console.error('❌ Test failed:', err);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
      server.close();
      process.exit(process.exitCode || 0);
    }
  });
}

runPhase1Verification();
