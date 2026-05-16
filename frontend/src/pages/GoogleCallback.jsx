import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader, CheckCircle, XCircle } from 'lucide-react';
import { googleAPI } from '../services/api';
import useAuthStore from '../store/useAuthStore';
import useUIStore from '../store/useUIStore';

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { addToast } = useUIStore();
  const [status, setStatus] = useState('processing'); // processing, success, error

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setStatus('error');
      addToast('No OAuth code found', 'error');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    googleAPI.callback(code)
      .then((res) => {
        const { access_token, refresh_token, user } = res.data;
        setAuth(access_token, user, refresh_token);
        setStatus('success');
        addToast(`Welcome back, ${user.full_name || user.email}!`, 'success');
        setTimeout(() => navigate('/dashboard'), 1500);
      })
      .catch((err) => {
        setStatus('error');
        addToast(err.response?.data?.detail || 'Google authentication failed', 'error');
        setTimeout(() => navigate('/login'), 3000);
      });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="auth-card"
        style={{ width: '100%', maxWidth: 400, textAlign: 'center', padding: 40 }}
      >
        {status === 'processing' && (
          <>
            <Loader size={48} className="spin" style={{ color: 'var(--accent)', margin: '0 auto 24px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Authenticating</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Verifying your credentials with Google...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto 24px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Success!</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>You have been logged in. Redirecting to dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} style={{ color: 'var(--danger)', margin: '0 auto 24px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Authentication Failed</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>We couldn't log you in with Google. Redirecting back...</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
