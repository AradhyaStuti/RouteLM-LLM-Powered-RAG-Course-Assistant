import { useState, useCallback, useEffect, useRef } from 'react';
import { onAuthExpired } from '../api/client';

const TOKEN_KEY = 'ml_tutor_token';
const USER_KEY = 'ml_tutor_user';

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState(() => localStorage.getItem(USER_KEY));
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const registeredRef = useRef(false);

  const isAuthenticated = !!token;

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUsername(null);
  }, []);

  useEffect(() => {
    if (!registeredRef.current) {
      registeredRef.current = true;
      onAuthExpired(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUsername(null);
      });
    }
  }, []);

  const saveAuth = useCallback((data) => {
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, data.username);
    setToken(data.access_token);
    setUsername(data.username);
    setError(null);
  }, []);

  const register = useCallback(async (user, pass) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');
      saveAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [saveAuth]);

  const login = useCallback(async (user, pass) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');
      saveAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [saveAuth]);

  return { token, username, isAuthenticated, error, loading, register, login, logout };
}
