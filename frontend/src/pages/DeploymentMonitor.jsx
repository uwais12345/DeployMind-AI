import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, XCircle, RefreshCw } from 'lucide-react';
import { deploymentsAPI } from '../services/api';
import DeploymentSteps from '../components/ui/DeploymentSteps';
import StatusBadge from '../components/ui/StatusBadge';
import useUIStore from '../store/useUIStore';
import useWebSocket from '../hooks/useWebSocket';

const POLL_INTERVAL = 3000;
const ACTIVE = ['queued', 'preparing', 'creating_repository', 'pushing_code', 'provisioning', 'scanning', 'analyzing', 'uploading', 'building', 'deploying', 'verifying'];

export default function DeploymentMonitor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const [deployment, setDeployment] = useState(null);
  const [loading, setLoading] = useState(true);
  const logEndRef = useRef(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchDeployment = async () => {
    try {
      const res = await deploymentsAPI.get(id);
      setDeployment(res.data);
      setLoading(false);
      if (res.data.status === 'failed' && !diagnostics) {
        fetchDiagnostics();
      }
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const levelColor = (level) =>
    level === 'success' ? 'var(--success)' :
    level === 'error'   ? 'var(--danger)'  :
    level === 'warning' ? 'var(--warning)' :
    'var(--text-muted)';

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{deployment.provider}</span>
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
          {deployment.error_message && (
            <div className="error-card" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Deployment Failed</div>
              <div style={{ fontSize: 10 }}>{deployment.error_message}</div>
            </div>
          )}

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
            <div className="terminal-header">
              <div className="terminal-dot" style={{ background: '#ff5f57' }} />
              <div className="terminal-dot" style={{ background: '#febc2e' }} />
              <div className="terminal-dot" style={{ background: '#28c840' }} />
              <span style={{ marginLeft: 8, fontSize: 11, color: '#44445a' }}>
                deploymind — deployment-{deployment.id}.log
              </span>
              {isActive && <span className="pulse-dot" style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />}
            </div>
            <div className="terminal-body">
              {logs.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Waiting for deployment logs...</div>
              )}
              {logs.map((log) => (
                <div key={log.id} className="log-line">
                  <span className="log-time">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                  <span style={{ color: levelColor(log.level) }}>{log.message}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
