import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, AlertCircle, GraduationCap, Presentation } from 'lucide-react';

export function Signup({ onSwitchToLogin, onSuccess }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ name, email, password, role });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '460px',
      margin: '40px auto',
      padding: '36px',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(16px)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--glass-border)',
      boxShadow: 'var(--shadow-glow)'
    }} className="animate-fade-in">
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Join EduCast</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Select your role and create a new account
        </p>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 'var(--radius-sm)',
          color: '#fda4af',
          fontSize: '0.875rem',
          marginBottom: '20px'
        }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Role Selection Toggle */}
      <div style={{ marginBottom: '20px' }}>
        <label className="form-label">I am joining as a</label>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginTop: '6px'
        }}>
          <button
            type="button"
            onClick={() => setRole('STUDENT')}
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              border: role === 'STUDENT' ? '2px solid var(--accent-emerald)' : '1px solid var(--border-color)',
              background: role === 'STUDENT' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-input)',
              color: role === 'STUDENT' ? '#6ee7b7' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            <GraduationCap size={18} /> Student
          </button>

          <button
            type="button"
            onClick={() => setRole('INSTRUCTOR')}
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              border: role === 'INSTRUCTOR' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: role === 'INSTRUCTOR' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-input)',
              color: role === 'INSTRUCTOR' ? '#a5b4fc' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            <Presentation size={18} /> Instructor
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input 
            type="text"
            className="form-input"
            placeholder="Dr. Sarah Connor"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input 
            type="email"
            className="form-input"
            placeholder="sarah@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">Password</label>
          <input 
            type="password"
            className="form-input"
            placeholder="Min. 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={loading}
          style={{ width: '100%', padding: '12px' }}
        >
          {loading ? 'Creating Account...' : (
            <>
              <UserPlus size={18} /> Register as {role === 'INSTRUCTOR' ? 'Instructor' : 'Student'}
            </>
          )}
        </button>
      </form>

      <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Already have an account?{' '}
        <button 
          onClick={onSwitchToLogin}
          style={{ background: 'none', color: 'var(--accent-primary)', fontWeight: 600 }}
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
