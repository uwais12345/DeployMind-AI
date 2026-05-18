import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, XCircle, RefreshCw, Search, Copy, Download, Filter, AlertCircle, Settings } from 'lucide-react';
import { deploymentsAPI } from '../services/api';
import DeploymentSteps from '../components/ui/DeploymentSteps';
import StatusBadge from '../components/ui/StatusBadge';
import useUIStore from '../store/useUIStore';
import useWebSocket from '../hooks/useWebSocket';
import Terminal from '../components/ui/Terminal';
import ProviderBadge from '../components/ui/ProviderBadge';

const POLL_INTERVAL = 3000;
const ACTIVE = ['queued', 'preparing', 'creating_repository', 'pushing_code', 'provisioning', 'scanning', 'analyzing', 'uploading', 'building', 'deploying', 'verifying'];

export default function DeploymentMonitor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const [deployment, setDeployment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logFilter, setLogFilter] = useState('all');

  const fetchDeployment = async () => {
    try {
      const res = await deploymentsAPI.get(id);
      setDeployment(res.data);
      setLoading(false);
      if (res.data.status === 'failed' && !diagnostics) {
        fetchDiagnostics();
      }
    } catch {
      setLoading(false);
    }
  };

  const fetchDiagnostics = async () => {
    setAnalyzing(true);
    try {
      const res = await deploymentsAPI.diagnostics(id);
      setDiagnostics(res.data);
    } catch (err) {
      console.error('Failed to fetch diagnostics', err);
    } finally {
      setAnalyzing(false);
    }
  };

  // WebSocket for real-time updates
  const wsUrl = `ws://localhost:8000/ws/deployments/${id}/logs`;
  useWebSocket(wsUrl, useCallback((data) => {
    if (data.event === 'deployment.log') {
      const { message, stage } = data.payload;
      setDeployment(prev => {
        if (!prev) return prev;
        const logExists = prev.logs?.some(l => l.message === message && Math.abs(new Date(l.created_at) - new Date(data.timestamp)) < 1000);
        if (logExists) return prev;
        
        return {
          ...prev,
          logs: [...(prev.logs || []), {
            id: Date.now(),
            message: message,
            level: data.severity,
            stage: stage,
            created_at: data.timestamp
          }]
        };
      });
    } else if (data.event === 'deployment.status') {
      const { status } = data.payload;
      setDeployment(prev => prev ? ({ ...prev, status, ...data.payload }) : prev);
      if (status === 'completed') {
        addToast('Deployment completed successfully!', 'success');
      } else if (status === 'failed') {
        addToast('Deployment failed', 'error');
        fetchDiagnostics();
      }
    }
  }, [id, addToast]));

  useEffect(() => {
    fetchDeployment();
  }, [id]);


  const handleCancel = async () => {
    try {
      await deploymentsAPI.cancel(id);
      addToast('Deployment cancelled', 'warning');
      fetchDeployment();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Cannot cancel', 'error');
    }
  };

  const handleRetry = async () => {
    try {
      const res = await deploymentsAPI.retry(id);
      addToast('Retry initiated', 'success');
      navigate(`/deployments/${res.data.deployment_id}`);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Cannot retry', 'error');
    }
  };

  const handleRollback = async () => {
    if (!window.confirm('Are you sure you want to rollback to this version?')) return;
    try {
      const res = await deploymentsAPI.rollback(id);
      addToast('Rollback initiated', 'success');
      navigate(`/deployments/${res.data.deployment_id}`);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Cannot rollback', 'error');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
    </div>
  );

  if (!deployment) return <div className="empty-state"><div style={{ color: 'var(--text-muted)' }}>Deployment not found</div></div>;

  const isActive = ACTIVE.includes(deployment.status);
  const isFailed = deployment.status === 'failed' || deployment.status === 'cancelled';
  const isSuccess = deployment.status === 'completed';
  const logs = deployment.logs || [];

  const filteredLogs = logs.filter(log => {
    if (logFilter !== 'all' && log.level !== logFilter && !(logFilter === 'info' && log.level === 'success')) return false;
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs.map(l => `[${new Date(l.created_at).toISOString()}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    addToast('Logs copied to clipboard', 'success');
  };

  const handleExportLogs = () => {
    const text = filteredLogs.map(l => `[${new Date(l.created_at).toISOString()}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${id}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Logs exported', 'success');
  };

  // Detect provider failure type from logs for elegant UX
  const detectProviderFailure = () => {
    const allMessages = (deployment?.logs || []).map(l => l.message.toLowerCase()).join(' ');
    if (allMessages.includes('token') && (allMessages.includes('invalid') || allMessages.includes('expired') || allMessages.includes('unauthorized') || allMessages.includes('401'))) {
      return { type: 'auth', provider: deployment.provider };
    }
    if (allMessages.includes('rate limit') || allMessages.includes('429') || allMessages.includes('too many requests')) {
      return { type: 'ratelimit', provider: deployment.provider };
    }
    if (allMessages.includes('quota') || allMessages.includes('limit exceeded') || allMessages.includes('upgrade')) {
      return { type: 'quota', provider: deployment.provider };
    }
    return null;
  };

  const FAILURE_RECOVERY = {
    auth:      { title: 'Provider Authentication Failed',   body: (p) => `Your ${p} API token appears to be invalid or has expired. Reconnect your provider in Profile Settings to continue deploying.`, cta: 'Update Token', path: '/profile' },
    ratelimit: { title: 'Provider Rate Limit Reached',     body: (p) => `${p} has temporarily rate-limited this account. Wait a few minutes before retrying the deployment.`, cta: null, path: null },
    quota:    { title: 'Provider Quota Exceeded',          body: (p) => `Your ${p} account has reached its deployment quota. Upgrade your ${p} plan or wait for your quota to reset.`, cta: 'Manage Providers', path: '/profile' },
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/deployments')}>
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="page-title">Deployment Monitor</h1>
            <p className="page-subtitle">#{deployment.id} · {deployment.provider} · {deployment.deploy_mode}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {deployment.deployment_url && (
            <a href={deployment.deployment_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              <ExternalLink size={13} /> Open URL
            </a>
          )}
          {isActive && (
            <button className="btn btn-danger btn-sm" onClick={handleCancel}>
              <XCircle size={13} /> Cancel
            </button>
          )}
          {isFailed && (
            <button className="btn btn-primary btn-sm" onClick={handleRetry}>
              <RefreshCw size={13} /> Retry
            </button>
          )}
          {isSuccess && (
            <button className="btn btn-secondary btn-sm" onClick={handleRollback}>
              <ArrowLeft size={13} /> Rollback to here
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={fetchDeployment}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        {/* Pipeline Steps */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="card" style={{ alignSelf: 'start' }}>
          <div className="card-header">
            <span className="card-title">Pipeline</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ProviderBadge provider={deployment.provider} />
              <StatusBadge status={deployment.status} pulse={isActive} />
            </div>
          </div>
          <DeploymentSteps status={deployment.status} />
          {deployment.build_duration_seconds && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-muted)' }}>
              Total duration: {deployment.build_duration_seconds}s
            </div>
          )}
          {deployment.deployment_url && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>
              <a href={deployment.deployment_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={10} /> {deployment.deployment_url}
              </a>
            </div>
          )}
          {isFailed && (() => {
            const failure = detectProviderFailure();
            const recovery = failure && FAILURE_RECOVERY[failure.type];
            if (recovery) {
              return (
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    marginTop: 12, padding: '12px 14px',
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {recovery.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: recovery.cta ? 10 : 0 }}>
                        {recovery.body(failure.provider || 'the provider')}
                      </div>
                      {recovery.cta && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 10 }}
                          onClick={() => navigate(recovery.path)}
                        >
                          <Settings size={10} /> {recovery.cta}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            }
            // Fallback to generic error card
            return deployment.error_message ? (
              <div className="error-card" style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Deployment Failed</div>
                <div style={{ fontSize: 10 }}>{deployment.error_message}</div>
              </div>
            ) : null;
          })()}

          {/* AI Diagnostics Panel */}
          {(analyzing || diagnostics) && (
            <div className="diagnostics-panel" style={{ marginTop: 20 }}>
              <div className="panel-label">AI DIAGNOSTICS</div>
              {analyzing ? (
                <div className="analyzing-state">
                  <RefreshCw className="spin" size={12} /> Analyzing logs...
                </div>
              ) : (
                <div className="diagnostics-content">
                  <div className={`severity-badge ${diagnostics.severity}`}>
                    {diagnostics.severity}
                  </div>
                  <div className="reason-text">{diagnostics.reason}</div>
                  <div className="suggestion-box">
                    <div className="suggestion-label">Suggested Fix:</div>
                    <div className="suggestion-text">{diagnostics.fix_suggestion}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Terminal Logs */}
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
          <div className="terminal-panel">
            <div className="terminal-header" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
                <div className="terminal-dot" style={{ background: '#ff5f57' }} />
                <div className="terminal-dot" style={{ background: '#febc2e' }} />
                <div className="terminal-dot" style={{ background: '#28c840' }} />
                <span style={{ marginLeft: 8, fontSize: 11, color: '#44445a' }}>
                  deploymind — deployment-{deployment.id}.log
                </span>
                {isActive && <span className="pulse-dot" style={{ marginLeft: 8, width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#8888b8' }} />
                  <input 
                    type="text" 
                    placeholder="Search logs..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ background: '#11111a', border: '1px solid #1a1a28', borderRadius: 4, padding: '4px 8px 4px 24px', fontSize: 11, color: '#e8e8f0', width: 140, outline: 'none' }}
                  />
                </div>
                
                <div style={{ display: 'flex', background: '#11111a', border: '1px solid #1a1a28', borderRadius: 4, overflow: 'hidden' }}>
                  {['all', 'info', 'warning', 'error'].map(f => (
                    <button 
                      key={f}
                      onClick={() => setLogFilter(f)}
                      style={{ 
                        background: logFilter === f ? '#1e1e2e' : 'transparent', 
                        color: logFilter === f ? '#e8e8f0' : '#8888b8',
                        border: 'none', padding: '4px 8px', fontSize: 10, cursor: 'pointer', textTransform: 'capitalize' 
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div style={{ width: 1, height: 16, background: '#1a1a28', margin: '0 4px' }} />
                <button onClick={handleCopyLogs} title="Copy Logs" style={{ background: 'transparent', border: 'none', color: '#8888b8', cursor: 'pointer', padding: 4, display: 'flex' }}><Copy size={13} /></button>
                <button onClick={handleExportLogs} title="Export Logs" style={{ background: 'transparent', border: 'none', color: '#8888b8', cursor: 'pointer', padding: 4, display: 'flex' }}><Download size={13} /></button>
              </div>
            </div>
            <Terminal logs={filteredLogs} isActive={isActive} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
