import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, Rocket, GitBranch, Plus, Trash2, Shield, Settings, Terminal, Globe, Loader, RefreshCw, Clock } from 'lucide-react';
import { projectsAPI, deploymentsAPI } from '../services/api';
import ScoreGauge from '../components/ui/ScoreGauge';
import StatusBadge from '../components/ui/StatusBadge';
import useUIStore from '../store/useUIStore';
import useWebSocket from '../hooks/useWebSocket';

function IssueList({ items = [], color }) {
  if (!items.length) return <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>None found</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
          <span style={{ color, flexShrink: 0, marginTop: 2 }}>•</span>
          <span style={{ color: 'var(--text-secondary)' }}>{typeof item === 'string' ? item : item.description}</span>
        </div>
      ))}
    </div>
  );
}

export default function AIAnalysis() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [activeTab, setActiveTab] = useState('analysis');
  
  // Env Var States
  const [envVars, setEnvVars] = useState([]);
  const [newVar, setNewVar] = useState({ key: '', value: '', is_secret: false });
  const [deployments, setDeployments] = useState([]);

  const fetchProject = async () => {
    try {
      const res = await projectsAPI.get(id);
      setProject(res.data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const fetchEnvVars = async () => {
    try {
      const res = await projectsAPI.listEnvVars(id);
      setEnvVars(res.data);
    } catch (err) {
      console.error('Failed to fetch env vars', err);
    }
  };

  const fetchDeployments = async () => {
    try {
      const res = await deploymentsAPI.listByProject(id);
      setDeployments(res.data);
    } catch (err) {
      console.error('Failed to fetch deployments', err);
    }
  };

  // WebSocket for real-time updates
  const wsUrl = `ws://localhost:8000/ws/projects/${id}/status`;
  useWebSocket(wsUrl, (data) => {
    if (data.event === 'project.status') {
      const { status, score } = data.payload;
      setProject(prev => prev ? ({ ...prev, status, readiness_score: score || prev.readiness_score }) : prev);
      if (status === 'completed') {
        addToast('Analysis completed!', 'success');
        fetchProject(); // Refetch to get full analysis data
      } else if (status === 'failed') {
        addToast('Analysis failed', 'error');
      }
    }
  });

  useEffect(() => {
    fetchProject();
    fetchEnvVars();
    fetchDeployments();
  }, [id]);


  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const res = await deploymentsAPI.start({
        project_id: parseInt(id),
        provider: 'vercel',
        deploy_mode: 'production',
      });
      addToast('Deployment started!', 'success');
      navigate(`/deployments/${res.data.deployment_id}`);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Deployment failed to start', 'error');
      setDeploying(false);
    }
  };

  const handleRetry = async (depId) => {
    try {
      const res = await deploymentsAPI.retry(depId);
      addToast('Retry initiated', 'success');
      navigate(`/deployments/${res.data.deployment_id}`);
    } catch (err) {
      addToast('Cannot retry', 'error');
    }
  };
  
  const handleRollback = async (depId) => {
    if (!window.confirm('Are you sure you want to rollback to this version?')) return;
    try {
      const res = await deploymentsAPI.rollback(depId);
      addToast('Rollback initiated', 'success');
      navigate(`/deployments/${res.data.deployment_id}`);
    } catch (err) {
      addToast('Cannot rollback', 'error');
    }
  };

  const handleAddEnvVar = async (e) => {
    e.preventDefault();
    if (!newVar.key || !newVar.value) return;
    try {
      await projectsAPI.addEnvVar(id, newVar);
      addToast('Variable added', 'success');
      setNewVar({ key: '', value: '', is_secret: false });
      fetchEnvVars();
    } catch (err) {
      addToast('Failed to add variable', 'error');
    }
  };

  const handleDeleteEnvVar = async (varId) => {
    try {
      await projectsAPI.deleteEnvVar(id, varId);
      addToast('Variable deleted', 'warning');
      fetchEnvVars();
    } catch (err) {
      addToast('Failed to delete', 'error');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120 }} />)}
    </div>
  );

  if (!project) return (
    <div className="empty-state">
      <div style={{ color: 'var(--text-muted)' }}>Project not found</div>
    </div>
  );

  const getStatusDisplay = () => {
    switch (project.status) {
      case 'uploaded': return 'Preparing files...';
      case 'extracting': return 'Extracting project...';
      case 'scanning': return 'Running security scans...';
      case 'ai_analyzing': return 'Running Groq AI analysis...';
      case 'persisting_results': return 'Saving results...';
      case 'failed': return 'Analysis failed';
      default: return 'Processing...';
    }
  };

  const PROCESSING_STATUSES = ['uploaded', 'extracting', 'scanning', 'ai_analyzing', 'persisting_results'];
  const isProcessing = PROCESSING_STATUSES.includes(project?.status);

  if (isProcessing) return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analysis in Progress</h1>
          <p className="page-subtitle">{project.name} · {project.framework}</p>
        </div>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ marginBottom: 20 }}>
          <Loader size={32} className="spin" style={{ color: 'var(--accent)', margin: '0 auto' }} />
        </div>
        <h3 style={{ fontSize: 18, marginBottom: 8, color: 'var(--text-primary)' }}>{getStatusDisplay()}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto' }}>
          We are analyzing your project for security vulnerabilities, malware patterns, and deployment readiness. This usually takes 15-30 seconds.
        </p>
      </motion.div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
        {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 120 }} />)}
      </div>
    </div>
  );

  const ai = project.ai_analysis || {};
  const sec = project.security_scan || {};
  const mal = project.malware_scan || {};
  const cr = project.code_review || {};
  const score = Math.round(project.readiness_score || ai.score || 0);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="page-title">AI Analysis Report</h1>
            <p className="page-subtitle">{project.name} · {project.framework}</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleDeploy} disabled={deploying}>
          {deploying ? 'Starting...' : <><Rocket size={14} /> Deploy Now</>}
        </button>
      </div>

      {/* Score + Summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ display: 'flex', gap: 32, alignItems: 'center', marginBottom: 20 }}
      >
        <ScoreGauge score={score} size={110} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Deployment Readiness Score
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 600 }}>
            {ai.summary || 'Analysis complete.'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <StatusBadge status={sec.risk_level || 'low'} />
            <span className="badge badge-muted">{project.framework}</span>
            {mal.is_safe && <span className="badge badge-success">✓ Malware-free</span>}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {[
          { id: 'analysis', label: 'AI Analysis', icon: <Globe size={13} /> },
          { id: 'security', label: 'Security', icon: <Shield size={13} /> },
          { id: 'environment', label: 'Environment', icon: <Terminal size={13} /> },
          { id: 'infrastructure', label: 'Build Settings', icon: <Settings size={13} /> },
          { id: 'history', label: 'History', icon: <Clock size={13} /> },
          { id: 'code-review', label: 'Code Review', icon: <GitBranch size={13} /> },
        ].map(tab => (
          <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{tab.icon} {tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'environment' && (
        <motion.div key="env" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><span className="card-title">Add Variable</span></div>
            <form onSubmit={handleAddEnvVar} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 12, alignItems: 'end' }}>
              <div className="form-group">
                <label className="form-label">Key</label>
                <input 
                  className="form-input" 
                  placeholder="e.g. API_KEY" 
                  value={newVar.key} 
                  onChange={e => setNewVar({...newVar, key: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Value</label>
                <input 
                  className="form-input" 
                  type={newVar.is_secret ? 'password' : 'text'} 
                  placeholder="Value" 
                  value={newVar.value} 
                  onChange={e => setNewVar({...newVar, value: e.target.value})}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={newVar.is_secret} 
                    onChange={e => setNewVar({...newVar, is_secret: e.target.checked})}
                  />
                  Secret
                </label>
              </div>
              <button className="btn btn-primary" type="submit"><Plus size={14} /> Add</button>
            </form>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Environment Variables</span></div>
            {envVars.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No environment variables defined</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Key</th><th>Value</th><th>Env</th><th>Actions</th></tr></thead>
                <tbody>
                  {envVars.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {v.key}
                          {v.is_secret && <Shield size={12} style={{ color: 'var(--success)' }} title="Secret" />}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.value}</td>
                      <td><span className="badge badge-muted">{v.environment}</span></td>
                      <td>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteEnvVar(v.id)}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'infrastructure' && (
        <motion.div key="infra" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid-2">
          <div className="card">
            <div className="card-header"><span className="card-title">Build Pipeline</span></div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Install Command</label>
              <input className="form-input" value={project.install_command || 'npm install'} readOnly />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Build Command</label>
              <input className="form-input" value={project.build_command || 'npm run build'} readOnly />
            </div>
            <div className="form-group">
              <label className="form-label">Output Directory</label>
              <input className="form-input" value={project.output_directory || 'dist'} readOnly />
            </div>
            <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
              These settings are currently derived from framework detection. Custom overrides coming soon.
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Compute & Runtime</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Region</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Washington, D.C. (iad1)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Runtime</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Node.js 18.x</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Plan</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Pro (DeployMind AI Managed)</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'analysis' && (
        <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid-2">
          <div className="card">
            <div className="card-header"><span className="card-title">Issues Detected</span></div>
            <IssueList items={ai.issues || []} color="var(--warning)" />
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Recommendations</span></div>
            <IssueList items={ai.recommendations || []} color="var(--accent)" />
          </div>
          {ai.checks && (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header"><span className="card-title">Project Checks</span></div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {Object.entries(ai.checks).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {k.replace(/_/g, ' ')}:
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: v === true || v === 'good' ? 'var(--success)' : v === false ? 'var(--danger)' : 'var(--warning)' }}>
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'security' && (
        <motion.div key="security" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
          <div className="card-header">
            <span className="card-title">Security Findings</span>
            <StatusBadge status={sec.risk_level || 'low'} />
          </div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 20 }}>
            {[
              { label: 'Total Findings', value: sec.total_findings || 0 },
              { label: 'Risk Level', value: sec.risk_level || 'low' },
              { label: 'Deployment Safe', value: sec.is_safe ? 'Yes' : 'Blocked' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
              </div>
            ))}
          </div>
          {(sec.findings || []).length === 0 ? (
            <div style={{ color: 'var(--success)', fontSize: 13 }}>✓ No secrets or credentials exposed</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Type</th><th>Severity</th><th>File</th><th>Line</th><th>Preview</th></tr></thead>
              <tbody>
                {(sec.findings || []).map((f, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{f.type}</td>
                    <td><StatusBadge status={f.severity} /></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{f.file}</td>
                    <td>{f.line || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--danger)' }}>{f.value_preview || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      )}

      {activeTab === 'code-review' && (
        <motion.div key="cr" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="grid-3" style={{ marginBottom: 20 }}>
            {[
              { label: 'Quality Score', value: `${Math.round(cr.overall_quality_score || 0)}%`, color: 'var(--success)' },
              { label: 'Critical Issues', value: cr.critical_count || 0, color: 'var(--danger)' },
              { label: 'Warnings', value: cr.warning_count || 0, color: 'var(--warning)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div className="grid-2">
            {[
              { title: 'Security Issues', items: cr.security_issues, color: 'var(--danger)' },
              { title: 'Code Smells', items: cr.code_smells, color: 'var(--warning)' },
              { title: 'Performance', items: cr.performance_issues, color: 'var(--info)' },
              { title: 'Dependencies', items: cr.dependency_issues, color: 'var(--accent)' },
            ].map(({ title, items, color }) => (
              <div key={title} className="card">
                <div className="card-header"><span className="card-title">{title}</span></div>
                <IssueList items={items || []} color={color} />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'malware' && (
        <motion.div key="malware" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
          <div className="card-header">
            <span className="card-title">Malware Scan Results</span>
            <span className={`badge ${mal.is_safe ? 'badge-success' : 'badge-danger'}`}>
              {mal.is_safe ? '✓ Clean' : '⚠ Threats Found'}
            </span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Scanned {mal.scanned_files || 0} files — {mal.total_findings || 0} findings
            </span>
          </div>
          {(mal.findings || []).length === 0 ? (
            <div style={{ color: 'var(--success)', fontSize: 13 }}>✓ No malware patterns detected</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Type</th><th>Category</th><th>Severity</th><th>File</th><th>Line</th></tr></thead>
              <tbody>
                {(mal.findings || []).map((f, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{f.type}</td>
                    <td style={{ textTransform: 'capitalize' }}>{f.category}</td>
                    <td><StatusBadge status={f.severity} /></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{f.file}</td>
                    <td>{f.line || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      )}

      {activeTab === 'history' && (
        <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
          <div className="card-header"><span className="card-title">Deployment History</span></div>
          {deployments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No deployment history found</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Deployment</th><th>Status</th><th>Provider</th><th>Branch</th><th>Duration</th><th>Actions</th></tr></thead>
              <tbody>
                {deployments.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>#{d.id}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(d.created_at).toLocaleString()}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={d.status} /></td>
                    <td><span className="badge badge-muted">{d.provider}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.branch}</td>
                    <td style={{ fontSize: 12 }}>{d.build_duration_seconds ? `${d.build_duration_seconds}s` : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/deployments/${d.id}`)}>View</button>
                        {(d.status === 'failed' || d.status === 'cancelled') && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }} onClick={() => handleRetry(d.id)} title="Retry">
                            <RefreshCw size={12} />
                          </button>
                        )}
                        {d.status === 'completed' && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--warning)' }} onClick={() => handleRollback(d.id)} title="Rollback to this">
                            <Clock size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      )}
    </div>
  );
}
