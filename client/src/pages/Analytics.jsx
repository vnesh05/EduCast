import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { ArrowLeft, Users, Clock, Video, Award, BarChart3 } from 'lucide-react';

export function Analytics({ classId, onBack }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const data = await apiRequest(`/api/classes/${classId}/analytics`);
        setAnalytics(data.analytics);
      } catch (err) {
        setError(err.message || 'Failed to load class analytics');
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [classId]);

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading analytics dashboard...</div>;
  }

  if (error || !analytics) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '24px' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginBottom: '20px' }}>
          <ArrowLeft size={16} /> Back to Class
        </button>
        <div style={{ padding: '20px', background: 'rgba(244, 63, 94, 0.1)', color: '#fda4af', borderRadius: '8px' }}>
          {error || 'Analytics not available'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '36px 24px' }} className="animate-fade-in">
      <button onClick={onBack} className="btn btn-secondary" style={{ marginBottom: '24px', padding: '8px 16px' }}>
        <ArrowLeft size={16} /> Back to Class
      </button>

      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '6px' }}>
          Attendance & Watch-Time Analytics
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Real-time metrics for <strong style={{ color: '#fff' }}>{analytics.classTitle}</strong>
        </p>
      </div>

      {/* Overview Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <Users size={20} color="var(--accent-primary)" /> Enrolled Students
          </div>
          <span style={{ fontSize: '2rem', fontWeight: 800 }}>{analytics.totalStudents}</span>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <Video size={20} color="#10b981" /> Total Sessions Hosted
          </div>
          <span style={{ fontSize: '2rem', fontWeight: 800 }}>{analytics.totalSessions}</span>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <Clock size={20} color="#f59e0b" /> Average Attendance Rate
          </div>
          <span style={{ fontSize: '2rem', fontWeight: 800 }}>
            {analytics.studentAnalytics.length > 0
              ? Math.round(analytics.studentAnalytics.reduce((acc, s) => acc + s.attendanceRate, 0) / analytics.studentAnalytics.length)
              : 0}%
          </span>
        </div>
      </div>

      {/* Student Roster Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={20} color="var(--accent-primary)" /> Per-Student Engagement Breakdown
        </h3>

        {analytics.studentAnalytics.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No enrolled students to analyze yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>Student Name</th>
                  <th style={{ padding: '12px 16px' }}>Email</th>
                  <th style={{ padding: '12px 16px' }}>Sessions Attended</th>
                  <th style={{ padding: '12px 16px' }}>Total Watch Time</th>
                  <th style={{ padding: '12px 16px' }}>Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {analytics.studentAnalytics.map((item) => (
                  <tr key={item.student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>{item.student.name}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{item.student.email}</td>
                    <td style={{ padding: '14px 16px' }}>{item.sessionsAttended} / {analytics.totalSessions}</td>
                    <td style={{ padding: '14px 16px', color: '#10b981', fontWeight: 600 }}>
                      {item.totalWatchMinutes} mins ({item.totalWatchSec}s)
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden', maxWidth: '100px' }}>
                          <div style={{ width: `${item.attendanceRate}%`, background: 'var(--accent-gradient)', height: '100%' }} />
                        </div>
                        <span style={{ fontWeight: 700 }}>{item.attendanceRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
