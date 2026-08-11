import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Video, LogOut, User as UserIcon } from 'lucide-react';

export function Navbar({ onNavigate, currentView }) {
  const { user, logout } = useAuth();

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 32px',
      borderBottom: '1px solid var(--border-color)',
      background: 'rgba(9, 13, 22, 0.8)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      {/* Brand Logo */}
      <div 
        onClick={() => user && onNavigate && onNavigate('dashboard')} 
        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: user ? 'pointer' : 'default' }}
      >
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'var(--accent-gradient)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-glow)'
        }}>
          <Video size={20} color="#fff" />
        </div>
        <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
          Edu<span style={{ color: 'var(--accent-primary)' }}>Cast</span>
        </span>
      </div>

      {/* User Actions */}
      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

          <div style={{
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            boxSizing: 'border-box'
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: user.role === 'INSTRUCTOR' ? 'var(--accent-gradient)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.name}</span>
          </div>

          <button 
            onClick={logout} 
            className="btn btn-secondary" 
            title="Sign out"
            style={{ height: '36px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <LogOut size={16} color="#9ca3af" />
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => onNavigate('login')} className="btn btn-secondary">Sign In</button>
          <button onClick={() => onNavigate('signup')} className="btn btn-primary">Get Started</button>
        </div>
      )}
    </nav>
  );
}
