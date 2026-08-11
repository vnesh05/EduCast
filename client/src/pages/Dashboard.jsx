import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { Modal } from '../components/Modal';
import { 
  Plus, 
  KeyRound, 
  Users, 
  Video, 
  Copy, 
  Check, 
  BookOpen, 
  ArrowRight, 
  AlertCircle, 
  Sparkles 
} from 'lucide-react';

export function Dashboard({ onSelectClass }) {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState(null);

  const fetchClasses = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/api/classes');
      setClasses(data.classes || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);
    try {
      await apiRequest('/api/classes', {
        method: 'POST',
        body: JSON.stringify({ title, description })
      });
      setTitle('');
      setDescription('');
      setIsCreateOpen(false);
      fetchClasses();
    } catch (err) {
      setFormError(err.message || 'Failed to create class');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleJoinClass = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);
    try {
      await apiRequest('/api/classes/join', {
        method: 'POST',
        body: JSON.stringify({ code: joinCode })
      });
      setJoinCode('');
      setIsJoinOpen(false);
      fetchClasses();
    } catch (err) {
      setFormError(err.message || 'Failed to join class');
    } finally {
      setFormSubmitting(false);
    }
  };

  const copyCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '36px 24px' }}>
      {/* Header Banner */}
      <div 
        className="glass-panel animate-fade-in" 
        style={{
          padding: '32px',
          marginBottom: '36px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(17, 24, 39, 0.8) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.2)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>
              Welcome, {user?.name}
            </h1>
            <span className={`badge ${user?.role === 'INSTRUCTOR' ? 'badge-instructor' : 'badge-student'}`}>
              {user?.role}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            {user?.role === 'INSTRUCTOR' 
              ? 'Manage your classrooms, issue session join codes, and host live streams'
              : 'Access your enrolled classes, join live sessions, and view recordings'}
          </p>
        </div>

        <div>
          {user?.role === 'INSTRUCTOR' ? (
            <button 
              onClick={() => { setFormError(''); setIsCreateOpen(true); }}
              className="btn btn-primary"
              style={{ gap: '8px', padding: '12px 24px', fontSize: '1rem' }}
            >
              <Plus size={20} /> Create New Class
            </button>
          ) : (
            <button 
              onClick={() => { setFormError(''); setIsJoinOpen(true); }}
              className="btn btn-primary"
              style={{ gap: '8px', padding: '12px 24px', fontSize: '1rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
              <KeyRound size={20} /> Join Class with Code
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={22} color="var(--accent-primary)" />
          {user?.role === 'INSTRUCTOR' ? 'My Created Classes' : 'Enrolled Classes'}
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>({classes.length})</span>
        </h2>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading classes...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ padding: '16px', background: 'rgba(244, 63, 94, 0.1)', color: '#fda4af', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && classes.length === 0 && (
        <div 
          className="glass-panel" 
          style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border-color)' }}
        >
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Sparkles size={32} color="var(--text-muted)" />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '8px' }}>No classes found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 20px' }}>
            {user?.role === 'INSTRUCTOR' 
              ? 'Click "Create New Class" above to set up your first classroom and generate a shareable join code.'
              : 'Click "Join Class with Code" to enter a 6-character code provided by your instructor.'}
          </p>
        </div>
      )}

      {/* Class Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '24px'
      }}>
        {classes.map((cls) => (
          <div 
            key={cls.id}
            onClick={() => onSelectClass(cls.id)}
            className="glass-panel animate-fade-in"
            style={{
              padding: '24px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--glass-border)';
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{cls.title}</h3>
                
                {/* Join Code Badge for Instructor */}
                {user?.role === 'INSTRUCTOR' && (
                  <button 
                    onClick={(e) => copyCode(cls.code, e)}
                    className="code-pill"
                    title="Click to copy join code"
                  >
                    <span>{cls.code}</span>
                    {copiedCode === cls.code ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  </button>
                )}
              </div>

              {cls.description && (
                <p style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                  lineHeight: '1.5',
                  marginBottom: '20px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {cls.description}
                </p>
              )}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-color)',
              marginTop: '16px',
              fontSize: '0.85rem',
              color: 'var(--text-muted)'
            }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} color="var(--accent-primary)" />
                  {cls._count?.enrollments || 0} Students
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Video size={15} color="#10b981" />
                  {cls._count?.sessions || 0} {cls._count?.sessions === 1 ? 'VOD' : 'VODs'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                Open <ArrowRight size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create Class (Instructor) */}
      <Modal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        title="Create New Classroom"
      >
        {formError && (
          <div style={{ padding: '10px 14px', background: 'rgba(244, 63, 94, 0.1)', color: '#fda4af', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
            <AlertCircle size={16} /> {formError}
          </div>
        )}
        <form onSubmit={handleCreateClass}>
          <div className="form-group">
            <label className="form-label">Class Title</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. CS101: Distributed Systems" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Description (Optional)</label>
            <textarea 
              className="form-input" 
              rows={3} 
              placeholder="Brief course summary, office hours schedule, etc." 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
              {formSubmitting ? 'Creating...' : 'Create & Generate Code'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Join Class (Student) */}
      <Modal 
        isOpen={isJoinOpen} 
        onClose={() => setIsJoinOpen(false)} 
        title="Join Class with Code"
      >
        {formError && (
          <div style={{ padding: '10px 14px', background: 'rgba(244, 63, 94, 0.1)', color: '#fda4af', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
            <AlertCircle size={16} /> {formError}
          </div>
        )}
        <form onSubmit={handleJoinClass}>
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">6-Character Class Code</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. HUB982" 
              value={joinCode} 
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())} 
              maxLength={6}
              style={{ textTransform: 'uppercase', letterSpacing: '3px', fontSize: '1.2rem', textAlign: 'center', fontWeight: 700 }}
              required 
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setIsJoinOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
              {formSubmitting ? 'Joining...' : 'Join Classroom'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
