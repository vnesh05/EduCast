import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest, setTokens, clearTokens, getStoredUser, setStoredUser } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify token validity on load
    const token = localStorage.getItem('classhub_access_token');
    if (token) {
      apiRequest('/api/auth/me')
        .then(data => {
          setUser(data.user);
          setStoredUser(data.user);
        })
        .catch(() => {
          clearTokens();
          setStoredUser(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      clearTokens();
      setStoredUser(null);
      setUser(null);
      setLoading(false);
    }

    const handleLogoutEvent = () => {
      clearTokens();
      setStoredUser(null);
      setUser(null);
    };

    window.addEventListener('classhub_logout', handleLogoutEvent);
    return () => window.removeEventListener('classhub_logout', handleLogoutEvent);
  }, []);

  const login = async (email, password) => {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setTokens(data.accessToken, data.refreshToken);
    setStoredUser(data.user);
    setUser(data.user);
    return data.user;
  };

  const register = async ({ email, password, name, role }) => {
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role })
    });
    setTokens(data.accessToken, data.refreshToken);
    setStoredUser(data.user);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('classhub_refresh_token');
    try {
      if (refreshToken) {
        await apiRequest('/api/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch (e) {
      // Ignore cleanup error
    } finally {
      clearTokens();
      setStoredUser(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
