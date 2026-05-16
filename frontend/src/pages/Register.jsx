import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { googleAPI } from '../services/api';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const [error, setError] = useState('');
  const { register, loading } = useAuthStore();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await register(form.email, form.password, form.full_name);
    if (res.success) navigate('/login');
    else setError(res.error);
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await googleAPI.oauthUrl();
      window.location.href = res.data.url;
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to initialize Google login');
    }
  };

  return (
    <div className="auth-layout">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="auth-card"
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 20, fontWeight: 800, color: 'var(--bg-primary)',
          }}>DM</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Create your account
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Start deploying with AI assistance</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="form-input" placeholder="Your name" value={form.full_name} onChange={set('full_name')} />
          </div>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input className="form-input" type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="Min 8 characters" value={form.password} onChange={set('password')} required minLength={8} />
          </div>

          {error && (
            <div style={{ background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 12, color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={loading}>
            {loading ? <><Loader size={14} className="spin" /> Creating account...</> : 'Create account'}
          </button>
        </form>

        <div className="divider-with-text">or</div>

        <button 
          onClick={handleGoogleLogin} 
          className="btn btn-secondary btn-lg" 
          style={{ width: '100%', justifyContent: 'center', gap: 10, background: 'var(--bg-primary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.5 12.23c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.51-1.13 2.78-2.41 3.64v3.02h3.91c2.28-2.1 3.6-5.19 3.6-8.79z" fill="#4285F4"/>
            <path d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.91-3.02c-1.08.72-2.47 1.15-4.04 1.15-3.11 0-5.74-2.1-6.68-4.92H1.4v3.12C3.38 21.32 7.42 24 12 24z" fill="#34A853"/>
            <path d="M5.32 14.3C5.08 13.59 4.95 12.82 4.95 12s.13-1.59.37-2.3V6.58H1.4C.51 8.36 0 10.36 0 12s.51 3.64 1.4 5.42l3.92-3.12z" fill="#FBBC05"/>
            <path d="M12 4.77c1.76 0 3.35.61 4.59 1.8l3.44-3.44C17.95 1.08 15.24 0 12 0 7.42 0 3.38 2.68 1.4 6.58l3.92 3.12c.94-2.82 3.57-4.93 6.68-4.93z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="divider" />
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
