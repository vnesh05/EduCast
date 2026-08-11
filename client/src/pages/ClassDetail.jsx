import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LiveSession } from './LiveSession';
import { VideoPlayer } from './VideoPlayer';
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
  Film,
  BarChart3
} from 'lucide-react';

export function ClassDetail({ classId, onBack }) {
  const { user } = useAuth();
  const [classData, setClassData] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/classes/${classId}`);
      setClassData(data.class);

      const recData = await apiRequest(`/api/classes/${classId}/recordings`);
      setRecordings(recData.recordings || []);
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

  if (showAnalytics) {
    return <Analytics classId={classId} onBack={() => setShowAnalytics(false)} />;
  }

  if (selectedRecordingId) {
    return <VideoPlayer recordingId={selectedRecordingId} onBack={() => setSelectedRecordingId(null)} />;
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

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '36px 24px' }} className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {classData.isInstructor && (
          <button onClick={() => setShowAnalytics(true)} className="btn btn-secondary" style={{ gap: '8px', padding: '8px 16px' }}>
            <BarChart3 size={18} color="var(--accent-primary)" /> View Analytics & Attendance
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserCheck size={16} color="var(--accent-primary)" />
                Instructor: <strong style={{ color: '#fff' }}>{classData.instructor?.name}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} color="#10b981" />
                {classData._count?.enrollments || 0} Enrolled Students
              </span>
            </div>
          </div>

          {/* Join Code Box */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Class Join Code
            </span>
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="code-pill">{classData.code}</span>
              <button 
                onClick={handleCopyCode} 
                className="btn btn-secondary" 
                style={{ padding: '8px 12px' }}
                title="Copy Join Code"
              >
                {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Sessions & VODs */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Sessions Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Video size={20} color="var(--accent-primary)" /> Live Sessions & Streams
              </h3>
              {classData.isInstructor && (
                <button 
                  onClick={handleStartLiveSession} 
                  disabled={startingSession}
                  className="btn btn-primary" 
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  <Radio size={16} /> {startingSession ? 'Launching...' : 'Start Live Session'}
                </button>
              )}
            </div>

            {(() => {
              const activeSessions = (classData.sessions || []).filter(s => s.status === 'LIVE');
              if (activeSessions.length === 0) {
                return (
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
                );
              }

              return (
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
              );
            })()}
          </div>

          {/* Recorded VOD Library Section */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Film size={20} color="#10b981" /> Recorded VOD Library ({recordings.length})
            </h3>

            {recordings.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No recorded video streams available yet. Recorded live sessions will appear here automatically for student playback.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                {recordings.map((rec) => (
                  <div key={rec.id} style={{
                    padding: '16px',
                    background: 'var(--bg-input)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>
                        {rec.session?.title || 'Class Recording'}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '12px' }}>
                        Recorded {new Date(rec.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <button 
                      onClick={() => setSelectedRecordingId(rec.id)}
                      className="btn btn-secondary"
                      style={{ width: '100%', fontSize: '0.85rem', padding: '6px 12px' }}
                    >
                      <Play size={14} color="#10b981" /> Watch VOD Replay
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Enrolled Students Roster */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="#10b981" /> Roster
          </h3>

          {classData.enrollments?.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No students enrolled yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                    color: '#fff'
                  }}>
                    {enr.student?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{enr.student?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{enr.student?.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

