import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LiveSession } from './LiveSession';
import { Analytics } from './Analytics';
import { 
  ArrowLeft, 
  Users, 
  Video, 
  Copy, 
  Check, 
  Calendar, 
  UserCheck, 
  Radio, 
  Play,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  History,
  AlertCircle
} from 'lucide-react';

export function ClassDetail({ classId, onBack }) {
  const { user } = useAuth();
  const [classData, setClassData] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState(null);
  const [expandedSessions, setExpandedSessions] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/classes/${classId}`);
      setClassData(data.class);

      if (data.class.isInstructor) {
        const historyData = await apiRequest(`/api/classes/${classId}/attendance-history`).catch(() => null);
        if (historyData) {
          setAttendanceHistory(historyData);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load class details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [classId]);

  const handleCopyCode = () => {
    if (classData?.code) {
      navigator.clipboard.writeText(classData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartLiveSession = async () => {
    setStartingSession(true);
    try {
      const res = await apiRequest('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          classId: classData.id,
          title: `${classData.title} - Live Stream`
        })
      });
      setActiveSessionId(res.session.id);
    } catch (err) {
      alert(err.message || 'Failed to start live session');
    } finally {
      setStartingSession(false);
    }
  };

  const handleApproveStudent = async (enrollmentId) => {
    setActionLoading(prev => ({ ...prev, [enrollmentId]: 'approving' }));
    try {
      await apiRequest(`/api/classes/${classId}/requests/${enrollmentId}/approve`, {
        method: 'POST'
      });
      await fetchDetail();
    } catch (err) {
      alert(err.message || 'Failed to approve student');
    } finally {
      setActionLoading(prev => ({ ...prev, [enrollmentId]: null }));
    }
  };

  const handleRejectStudent = async (enrollmentId) => {
    if (!confirm('Are you sure you want to decline this registration request?')) return;
    setActionLoading(prev => ({ ...prev, [enrollmentId]: 'rejecting' }));
    try {
      await apiRequest(`/api/classes/${classId}/requests/${enrollmentId}/reject`, {
        method: 'POST'
      });
      await fetchDetail();
    } catch (err) {
      alert(err.message || 'Failed to reject student');
    } finally {
      setActionLoading(prev => ({ ...prev, [enrollmentId]: null }));
    }
  };

  const toggleSessionExpand = (sessionId) => {
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  if (showAnalytics) {
    return <Analytics classId={classId} onBack={() => setShowAnalytics(false)} />;
  }

  if (activeSessionId) {
    return (
      <LiveSession 
        sessionId={activeSessionId} 
        onLeave={() => {
          setActiveSessionId(null);
          fetchDetail();
        }} 
      />
    );
  }

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading class details...</div>;
  }

  if (error || !classData) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '24px' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginBottom: '20px' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <div style={{ padding: '20px', background: 'rgba(244, 63, 94, 0.1)', color: '#fda4af', borderRadius: '8px' }}>
          {error || 'Class not found'}
        </div>
      </div>
    );
  }

  const previousSessions = (classData.sessions || []).filter(s => s.status === 'ENDED');
  const activeSessions = (classData.sessions || []).filter(s => s.status === 'LIVE');
  const pendingRequests = classData.pendingRequests || [];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '36px 24px' }} className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {classData.isInstructor && (
          <button onClick={() => setShowAnalytics(true)} className="btn btn-secondary" style={{ gap: '8px', padding: '8px 16px' }}>
            <BarChart3 size={18} color="var(--accent-primary)" /> View Analytics Dashboard
          </button>
        )}
      </div>

      {/* Main Class Header Card */}
      <div className="glass-panel" style={{ padding: '32px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>{classData.title}</h1>
              {classData.isInstructor && (
                <span className="badge badge-instructor">Instructor</span>
              )}
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '650px', marginBottom: '16px' }}>
              {classData.description || 'No description provided for this classroom.'}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '0.875rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserCheck size={16} color="var(--accent-primary)" />
                Instructor: <strong style={{ color: '#fff' }}>{classData.instructor?.name}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} color="#10b981" />
                {classData._count?.enrollments || 0} Enrolled Students
              </span>
              {classData.isInstructor && pendingRequests.length > 0 && (
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#f59e0b',
                  fontWeight: 600
                }}>
                  <AlertCircle size={16} />
                  {pendingRequests.length} Pending Approval
                </span>
              )}
            </div>
          </div>

          {/* Join Code Box */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            padding: '16px 20px',
            borderRadius: '12px',
            textAlign: 'center',
            minWidth: '200px'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
              Class Join Code
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '2px', color: '#fff' }}>
                {classData.code}
              </span>
              <button 
                onClick={handleCopyCode} 
                className="btn btn-secondary" 
                style={{ padding: '6px', borderRadius: '6px' }}
                title="Copy code"
              >
                {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              </button>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Instructor approval required
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Classroom Stage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px' }}>
        
        {/* Left Column: Live Session & Attendance Tracker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Live Session Panel */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Video size={20} color="var(--accent-primary)" /> Live Classroom
              </h3>

              {classData.isInstructor && (
                <button 
                  onClick={handleStartLiveSession} 
                  disabled={startingSession}
                  className="btn btn-primary" 
                  style={{ gap: '8px' }}
                >
                  <Play size={16} /> {startingSession ? 'Launching...' : 'Start Live Session'}
                </button>
              )}
            </div>

            {activeSessions.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '30px 20px',
                border: '1px dashed var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-muted)'
              }}>
                <Calendar size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <p style={{ fontSize: '0.9rem' }}>No live stream is active right now.</p>
                <span style={{ fontSize: '0.8rem', display: 'block', marginTop: '4px' }}>
                  {classData.isInstructor ? 'Click "Start Live Session" above to launch a stream.' : 'When the instructor goes live, the stream will appear here.'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeSessions.map((sess) => (
                  <div key={sess.id} style={{
                    padding: '18px 20px',
                    background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.1) 0%, rgba(17, 24, 39, 0.9) 100%)',
                    borderRadius: '10px',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 16px rgba(244, 63, 94, 0.1)'
                  }}>
                    <div>
                      <h4 style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        {sess.title}
                        <span className="badge" style={{ background: 'rgba(244,63,94,0.2)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.4)', fontSize: '0.7rem', padding: '2px 8px' }}>
                          <Radio size={12} className="animate-pulse" /> LIVE NOW
                        </span>
                      </h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Started {new Date(sess.startedAt || sess.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <button 
                      onClick={() => setActiveSessionId(sess.id)}
                      className="btn btn-primary" 
                      style={{ padding: '8px 18px', fontSize: '0.875rem', background: '#f43f5e', border: 'none' }}
                    >
                      <Play size={16} /> Join Live Classroom
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Previous Classes & Attendance Tracker Section */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={20} color="#10b981" /> Previous Classes & Attendance Tracker
              </h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {previousSessions.length} Past Session{previousSessions.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Instructor Tracker with Attendee Breakdown */}
            {classData.isInstructor ? (
              (!attendanceHistory?.sessionHistory || attendanceHistory.sessionHistory.length === 0) ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '16px 0' }}>
                  No previous sessions have ended yet. When live classroom streams conclude, their complete student attendance records will be displayed here.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {attendanceHistory.sessionHistory.map((sess) => {
                    const isExpanded = !!expandedSessions[sess.sessionId];
                    return (
                      <div key={sess.sessionId} style={{
                        background: 'var(--bg-input)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden',
                        transition: 'all 0.2s ease'
                      }}>
                        {/* Session Header Item */}
                        <div 
                          onClick={() => toggleSessionExpand(sess.sessionId)}
                          style={{
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                              <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{sess.title}</h4>
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: sess.status === 'LIVE' ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.15)',
                                color: sess.status === 'LIVE' ? '#f43f5e' : '#10b981',
                                border: sess.status === 'LIVE' ? '1px solid rgba(244,63,94,0.3)' : '1px solid rgba(16,185,129,0.3)',
                                fontWeight: 700
                              }}>
                                {sess.status}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              <span>{new Date(sess.createdAt).toLocaleDateString()} at {new Date(sess.startedAt || sess.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {sess.durationMinutes > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={12} /> {sess.durationMinutes} min
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: sess.attendanceRate >= 75 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                color: sess.attendanceRate >= 75 ? '#10b981' : '#f59e0b',
                                border: sess.attendanceRate >= 75 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)'
                              }}>
                                {sess.attendedCount} / {sess.totalEnrolled} Attended ({sess.attendanceRate}%)
                              </span>
                            </div>

                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', gap: '4px' }}>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              {isExpanded ? 'Hide' : 'Roster'}
                            </button>
                          </div>
                        </div>

                        {/* Expandable Student Attendance Roster */}
                        {isExpanded && (
                          <div style={{
                            padding: '16px 20px',
                            borderTop: '1px solid var(--border-color)',
                            background: 'rgba(0,0,0,0.2)'
                          }}>
                            <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '12px' }}>
                              Attendee Verification Roster
                            </h5>

                            {sess.roster.length === 0 ? (
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No approved enrolled students at the time of this class.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {sess.roster.map((student) => (
                                  <div key={student.studentId} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      {student.attended ? (
                                        <CheckCircle2 size={16} color="#10b981" />
                                      ) : (
                                        <XCircle size={16} color="#ef4444" />
                                      )}
                                      <div>
                                        <span style={{ fontWeight: 600, color: '#fff' }}>{student.name}</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '8px' }}>
                                          {student.email}
                                        </span>
                                      </div>
                                    </div>

                                    <div>
                                      {student.attended ? (
                                        <span style={{
                                          padding: '2px 8px',
                                          borderRadius: '8px',
                                          background: 'rgba(16,185,129,0.15)',
                                          color: '#10b981',
                                          fontSize: '0.75rem',
                                          fontWeight: 600
                                        }}>
                                          Present ({student.durationMinutes > 0 ? `${student.durationMinutes}m` : `${student.durationSeconds}s`})
                                        </span>
                                      ) : (
                                        <span style={{
                                          padding: '2px 8px',
                                          borderRadius: '8px',
                                          background: 'rgba(239,68,68,0.15)',
                                          color: '#ef4444',
                                          fontSize: '0.75rem',
                                          fontWeight: 600
                                        }}>
                                          Absent
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Student View of Past Sessions */
              previousSessions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No previous sessions have concluded yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {previousSessions.map((sess) => (
                    <div key={sess.id} style={{
                      padding: '14px 18px',
                      background: 'var(--bg-input)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{sess.title}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Held on {new Date(sess.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '8px',
                        background: 'rgba(16,185,129,0.15)',
                        color: '#10b981',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        Concluded
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Right Column: Pending Requests (Instructor) & Roster */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Instructor Pending Requests Queue */}
          {classData.isInstructor && (
            <div className="glass-panel" style={{ padding: '24px', border: pendingRequests.length > 0 ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={18} color="#f59e0b" /> Pending Join Requests ({pendingRequests.length})
                </h3>
              </div>

              {pendingRequests.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No pending student requests. When students submit the join code, they will appear here for your approval.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pendingRequests.map((req) => {
                    const isApproving = actionLoading[req.id] === 'approving';
                    const isRejecting = actionLoading[req.id] === 'rejecting';
                    return (
                      <div key={req.id} style={{
                        padding: '12px 14px',
                        background: 'rgba(245, 158, 11, 0.05)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                            {req.student?.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {req.student?.email}
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                            Requested {new Date(req.enrolledAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => handleApproveStudent(req.id)}
                            disabled={isApproving || isRejecting}
                            className="btn btn-primary"
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              fontSize: '0.75rem',
                              background: '#10b981',
                              border: 'none',
                              gap: '4px'
                            }}
                          >
                            <Check size={14} /> {isApproving ? 'Approving...' : 'Approve'}
                          </button>
                          <button 
                            onClick={() => handleRejectStudent(req.id)}
                            disabled={isApproving || isRejecting}
                            className="btn btn-danger"
                            style={{
                              padding: '6px 10px',
                              fontSize: '0.75rem',
                              gap: '4px'
                            }}
                            title="Decline join request"
                          >
                            <XCircle size={14} /> {isRejecting ? 'Declining...' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Enrolled Students Active Roster */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="#10b981" /> Approved Roster ({classData.enrollments?.length || 0})
            </h3>

            {classData.enrollments?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No approved students enrolled yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                {classData.enrollments.map((enr) => (
                  <div key={enr.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'var(--accent-emerald)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#fff',
                      flexShrink: 0
                    }}>
                      {enr.student?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {enr.student?.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {enr.student?.email}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
