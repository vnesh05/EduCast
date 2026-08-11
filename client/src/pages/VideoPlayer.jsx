import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { 
  ArrowLeft, 
  Play, 
  Clock, 
  Calendar, 
  UserCheck, 
  MessageSquare, 
  Download, 
  Film 
} from 'lucide-react';

export function VideoPlayer({ recordingId, onBack }) {
  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchRecording() {
      try {
        const data = await apiRequest(`/api/recordings/${recordingId}`);
        setRecording(data.recording);
      } catch (err) {
        setError(err.message || 'Failed to load video recording');
      } finally {
        setLoading(false);
      }
    }
    fetchRecording();
  }, [recordingId]);

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading video recording...</div>;
  }

  if (error || !recording) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '24px' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginBottom: '20px' }}>
          <ArrowLeft size={16} /> Back to Class
        </button>
        <div style={{ padding: '20px', background: 'rgba(244, 63, 94, 0.1)', color: '#fda4af', borderRadius: '8px' }}>
          {error || 'Recording not found'}
        </div>
      </div>
    );
  }

  const session = recording.session;
  const chatMessages = session?.chatMessages || [];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '36px 24px' }} className="animate-fade-in">
      <button onClick={onBack} className="btn btn-secondary" style={{ marginBottom: '24px', padding: '8px 16px' }}>
        <ArrowLeft size={16} /> Back to Class
      </button>

      {/* Main Video & Replay Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        {/* Left Column: Player & Meta */}
        <div>
          <div style={{
            background: '#000',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-glow)',
            marginBottom: '24px'
          }}>
            <video 
              controls 
              autoPlay 
              style={{ width: '100%', maxHeight: '560px', display: 'block' }}
              src={recording.videoUrl}
            >
              Your browser does not support video playback.
            </video>
          </div>

          {/* Details Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px' }}>
              {session?.title}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.9rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserCheck size={16} color="var(--accent-primary)" />
                Instructor: <strong style={{ color: '#fff' }}>{session?.class?.instructor?.name}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} color="#10b981" />
                Recorded: {new Date(recording.createdAt).toLocaleDateString()}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="#f59e0b" />
                File Size: {(recording.fileSize / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Recorded Chat Log */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '680px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={18} color="var(--accent-primary)" /> Session Chat Replay
          </h3>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '6px' }}>
            {chatMessages.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No chat messages were recorded during this live stream.</p>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} style={{
                  padding: '10px 12px',
                  background: 'var(--bg-input)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '2px' }}>
                    {msg.sender?.name} ({msg.sender?.role})
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#fff' }}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
