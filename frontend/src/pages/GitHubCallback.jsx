import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader, CheckCircle, XCircle } from 'lucide-react';
import { githubAPI } from '../services/api';
import useUIStore from '../store/useUIStore';

export default function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const [status, setStatus] = useState('processing'); // processing, success, error

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setStatus('error');
      addToast('No OAuth code found', 'error');
      setTimeout(() => navigate('/profile'), 2000);
      return;
    }

    githubAPI.callback(code)
      .then(() => {
        setStatus('success');
        addToast('GitHub connected successfully', 'success');
        setTimeout(() => navigate('/profile'), 2000);
      })
      .catch((err) => {
        setStatus('error');
        addToast(err.response?.data?.detail || 'GitHub connection failed', 'error');
        setTimeout(() => navigate('/profile'), 3000);
      });
  }, []);

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card"
        style={{ width: '100%', maxWidth: 400, textAlign: 'center', padding: 40 }}
      >
        {status === 'processing' && (
          <>
            <Loader size={48} className="spin" style={{ color: 'var(--accent)', margin: '0 auto 24px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Connecting GitHub</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Verifying your credentials with GitHub...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto 24px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Success!</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your GitHub account has been linked. Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} style={{ color: 'var(--danger)', margin: '0 auto 24px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Connection Failed</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>We couldn't link your GitHub account. Redirecting back...</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
