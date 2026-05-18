import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Shield, GitBranch, Save } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { githubAPI } from '../services/api';
import useUIStore from '../store/useUIStore';
import CloudProvidersPanel from '../components/profile/CloudProvidersPanel';

export default function ProfileSettings() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [githubStatus, setGithubStatus] = useState(null);

  const checkGitHub = async () => {
    try {
      const res = await githubAPI.status();
      setGithubStatus(res.data);
    } catch {
      addToast('Failed to check GitHub status', 'error');
    }
  };

  const connectGitHub = async () => {
    try {
      const res = await githubAPI.oauthUrl();
      window.location.href = res.data.url;
    } catch {
      addToast('GitHub OAuth not configured. Add GITHUB_CLIENT_ID to backend .env', 'warning');
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Manage your account settings</p>
        </div>
      </div>

      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">Account Information</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: 'var(--bg-primary)', flexShrink: 0,
          }}>
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.full_name || user?.email?.split('@')[0] || 'User'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <span className="badge badge-accent">{user?.role || 'user'}</span>
              {user?.is_verified && <span className="badge badge-success">Verified</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: Mail, label: 'Email', value: user?.email },
            { icon: User, label: 'Name', value: user?.full_name || '—' },
            { icon: Shield, label: 'Role', value: user?.role || 'user' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 80 }}>{label}</span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* GitHub Connection */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitBranch size={15} style={{ color: 'var(--text-secondary)' }} />
            <span className="card-title">GitHub Integration</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={checkGitHub}>Check Status</button>
        </div>

        {githubStatus ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                {githubStatus.connected ? `Connected as @${githubStatus.github_username}` : 'Not connected'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {githubStatus.connected ? 'GitHub is connected. Deployments can push to GitHub.' : 'Connect GitHub to enable auto-push on deployment.'}
              </div>
            </div>
            <span className={`badge ${githubStatus.connected ? 'badge-success' : 'badge-muted'}`}>
              {githubStatus.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Connect your GitHub account to enable automatic repository creation and code push during deployments.
            </div>
            <button className="btn btn-secondary" onClick={connectGitHub}>
              <GitBranch size={14} /> Connect GitHub
            </button>
          </div>
        )}
      </motion.div>

      {/* Cloud Providers Panel */}
      <CloudProvidersPanel />
    </div>
  );
}
