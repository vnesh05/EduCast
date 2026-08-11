// API Client wrapper for ClassHub with Access Token injection & Automatic Refresh logic

let accessToken = localStorage.getItem('classhub_access_token');
let refreshToken = localStorage.getItem('classhub_refresh_token');

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  if (access) localStorage.setItem('classhub_access_token', access);
  else localStorage.removeItem('classhub_access_token');
  
  if (refresh) localStorage.setItem('classhub_refresh_token', refresh);
  else localStorage.removeItem('classhub_refresh_token');
}

export function clearTokens() {
  setTokens(null, null);
}

export function getStoredUser() {
  const userJson = localStorage.getItem('classhub_user');
  return userJson ? JSON.parse(userJson) : null;
}

export function setStoredUser(user) {
  if (user) localStorage.setItem('classhub_user', JSON.stringify(user));
  else localStorage.removeItem('classhub_user');
}

export async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const config = {
    ...options,
    headers
  };

  let response = await fetch(endpoint, config);

  // Auto refresh token logic on HTTP 401
  if (response.status === 401 && refreshToken && !options._isRetry) {
    try {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setTokens(refreshData.accessToken, refreshData.refreshToken);
        if (refreshData.user) setStoredUser(refreshData.user);

        // Retry original request
        headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
        response = await fetch(endpoint, {
          ...config,
          headers,
          _isRetry: true
        });
      } else {
        // Refresh token failed/revoked -> log out user
        clearTokens();
        setStoredUser(null);
        window.dispatchEvent(new Event('classhub_logout'));
      }
    } catch (err) {
      clearTokens();
      setStoredUser(null);
      window.dispatchEvent(new Event('classhub_logout'));
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'API Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
