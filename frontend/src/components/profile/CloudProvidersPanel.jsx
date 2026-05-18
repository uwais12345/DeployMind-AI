import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CheckCircle2, Plus, X, Eye, EyeOff, Loader2, Link2, Trash2, RefreshCw, AlertTriangle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { providersAPI } from '../../services/api';
import useUIStore from '../../store/useUIStore';

const PROVIDERS_CONFIG = [
  { id: 'render',  name: 'Render',  icon: '⬡', desc: 'Deploy web services, static sites, and databases.', docsUrl: 'https://render.com/docs/api' },
  { id: 'vercel',  name: 'Vercel',  icon: '▲', desc: 'The platform for frontend frameworks and static sites.', docsUrl: 'https://vercel.com/account/tokens' },
  { id: 'railway', name: 'Railway', icon: '🚂', desc: 'Infrastructure platform for any application stack.', docsUrl: 'https://railway.app/account/tokens' },
  { id: 'netlify', name: 'Netlify', icon: '◆', desc: 'Develop and deploy modern web projects.', docsUrl: 'https://app.netlify.com/user/applications' },
];

const HEALTH_CONFIG = {
  healthy:      { color: 'var(--success)',  bg: 'rgba(34,197,94,0.1)',  label: 'Healthy',      icon: CheckCircle2 },
  warning:      { color: 'var(--warning)',  bg: 'rgba(234,179,8,0.1)', label: 'Warning',       icon: AlertTriangle },
  degraded:     { color: 'var(--danger)',   bg: 'rgba(239,68,68,0.1)', label: 'Degraded',      icon: AlertCircle },
  disconnected: { color: 'var(--text-muted)', bg: 'var(--bg-tertiary)', label: 'Disconnected', icon: WifiOff },
};

function HealthBadge({ health }) {
  const cfg = HEALTH_CONFIG[health] || HEALTH_CONFIG.disconnected;
  const Icon = cfg.icon;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: cfg.bg, border: `1px solid ${cfg.color}22`, borderRadius: 20, padding: '2px 8px' }}>
      <Icon size={10} style={{ color: cfg.color }} />
      <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
    </div>
  );
}

function StatItem({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{value ?? '—'}</span>
    </div>
  );
}

export default function CloudProvidersPanel() {
  const { addToast } = useUIStore();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState(null);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testError, setTestError] = useState('');

  const fetchCredentials = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await providersAPI.getCredentials();
      setCredentials(res.data || []);
    } catch {
      addToast('Failed to load cloud providers', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchCredentials(); }, []);

  const getProviderState = (providerId) => credentials.find(c => c.provider === providerId);

  const handleDisconnect = async (providerId) => {
    if (!confirm(`Disconnect ${providerId}? Deployments using this provider will fall back to simulation mode.`)) return;
    try {
      await providersAPI.deleteCredential(providerId);
      addToast(`${providerId} disconnected`, 'info');
      fetchCredentials();
    } catch {
      addToast(`Failed to disconnect ${providerId}`, 'error');
    }
  };

  const handleTestAndSave = async () => {
    if (!token.trim()) return addToast('Please enter an API token', 'error');
    setTestError('');
    setTestingConnection(true);
    try {
      const testRes = await providersAPI.testConnection({ provider: selectedProvider.id, token });
      if (!testRes.data.success) {
        setTestingConnection(false);
        setTestError(testRes.data.error || 'Connection failed. Please verify your token and try again.');
        return;
      }
      setTestingConnection(false);
      setSaving(true);
      await providersAPI.saveCredential({ provider: selectedProvider.id, token });
      addToast(`${selectedProvider.name} connected successfully!`, 'success');
      setSelectedProvider(null);
      setToken('');
      setTestError('');
      fetchCredentials();
    } catch {
      setTestingConnection(false);
      setTestError('An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatRelativeTime = (isoStr) => {
    if (!isoStr) return null;
    const diff = Date.now() - new Date(isoStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cloud size={15} style={{ color: 'var(--text-secondary)' }} />
          <span className="card-title">Cloud Providers</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => fetchCredentials(true)} disabled={refreshing}>
          <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Connect your deployment platforms. Tokens are AES-encrypted at rest and injected securely at runtime.
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--radius)' }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {PROVIDERS_CONFIG.map(p => {
            const cred = getProviderState(p.id);
            const isConnected = !!cred;
            const health = cred?.health || 'disconnected';

            return (
              <div key={p.id} style={{
                border: `1px solid ${isConnected ? 'var(--border)' : 'var(--border-subtle)'}`,
                background: isConnected ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                borderRadius: 'var(--radius)',
                padding: '14px',
                display: 'flex', flexDirection: 'column', gap: 10,
                transition: 'all 0.2s',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Health indicator stripe */}
                {isConnected && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: 2, height: '100%',
                    background: HEALTH_CONFIG[health]?.color || 'var(--success)',
                  }} />
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{p.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                  </div>
                  {isConnected
                    ? <HealthBadge health={health} />
                    : <span className="badge badge-muted" style={{ fontSize: 10 }}>Not Configured</span>
                  }
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {p.desc}
                </div>

                {isConnected ? (
                  <>
                    {/* Token preview */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: 4 }}>
                      <CheckCircle2 size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />
                      {cred.masked_token}
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: 12, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                      <StatItem label="Deploys" value={cred.total_deployments} />
                      <StatItem label="Success" value={cred.success_rate != null ? `${cred.success_rate}%` : null} />
                      <StatItem label="Last used" value={formatRelativeTime(cred.last_used_at)} />
                    </div>

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', justifyContent: 'center', color: 'var(--danger)', marginTop: 2 }}
                      onClick={() => handleDisconnect(p.id)}
                    >
                      <Trash2 size={12} /> Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                    onClick={() => { setSelectedProvider(p); setToken(''); setTestError(''); }}
                  >
                    <Plus size={12} /> Connect {p.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Connection Modal */}
      <AnimatePresence>
        {selectedProvider && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 20,
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="card"
              style={{ width: '100%', maxWidth: 420, boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{selectedProvider.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Connect {selectedProvider.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Token is verified before saving</div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => setSelectedProvider(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">
                  API Token
                  <a href={selectedProvider.docsUrl} target="_blank" rel="noopener noreferrer"
                    style={{ marginLeft: 8, fontSize: 10, color: 'var(--accent)', fontWeight: 400 }}>
                    How to generate →
                  </a>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showToken ? 'text' : 'password'}
                    className="form-input"
                    placeholder={`Paste your ${selectedProvider.name} API token`}
                    value={token}
                    onChange={e => { setToken(e.target.value); setTestError(''); }}
                    style={{ paddingRight: 36, fontFamily: 'monospace', fontSize: 13 }}
                    autoFocus
                  />
                  <button
                    type="button"
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    onClick={() => setShowToken(s => !s)}
                  >
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Encrypted with AES-256 before storage. Never exposed in plaintext.
                </p>
              </div>

              {/* Error message — human-readable */}
              {testError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 6, padding: '10px 12px', marginTop: 4,
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                  }}
                >
                  <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.5 }}>{testError}</span>
                </motion.div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedProvider(null)} disabled={testingConnection || saving}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleTestAndSave} disabled={!token.trim() || testingConnection || saving}>
                  {testingConnection
                    ? <><Loader2 size={14} className="spin" /> Verifying…</>
                    : saving
                    ? <><Loader2 size={14} className="spin" /> Saving…</>
                    : <><Link2 size={14} /> Verify & Connect</>
                  }
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
