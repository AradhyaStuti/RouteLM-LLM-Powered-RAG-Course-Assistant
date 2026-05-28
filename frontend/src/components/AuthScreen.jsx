import { useState } from 'react';
import { LogIn, UserPlus, AlertCircle, Eye, EyeOff } from 'lucide-react';
import RobotMascot from './RobotMascot';

export default function AuthScreen({ onLogin, onRegister, error, loading }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    if (isLogin) {
      onLogin(username.trim(), password);
    } else {
      onRegister(username.trim(), password);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <RobotMascot size={100} />
          <h1>RouteLM</h1>
          <p>RAG-Powered Course Assistant</p>
        </div>

        <div className="auth-tabs">
          <button className={isLogin ? 'active' : ''} onClick={() => { setIsLogin(true); setPassword(''); }}>
            <LogIn size={16} /> Sign In
          </button>
          <button className={!isLogin ? 'active' : ''} onClick={() => { setIsLogin(false); setPassword(''); }}>
            <UserPlus size={16} /> Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3–30 chars, letters/digits/underscore"
              autoComplete="username"
              pattern="[a-zA-Z0-9_]+"
              title="Letters, digits, and underscores only — no spaces, dots, or @"
              minLength={3}
              maxLength={30}
              required
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? 'Enter password' : 'Min 6 characters'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading || !username.trim() || !password.trim()}>
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <span>LangChain · LangGraph · FAISS · Groq / Ollama</span>
        </div>
      </div>
    </div>
  );
}
