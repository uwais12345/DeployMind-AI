import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, RotateCcw, CheckCircle, Clock, ExternalLink, Zap } from 'lucide-react';
import { versionsAPI } from '../services/api';
import useProjectStore from '../store/useProjectStore';
import useUIStore from '../store/useUIStore';

const MODE_BADGE = {
  production: { label: 'Production', color: 'var(--success)',  bg: 'rgba(34,197,94,0.1)' },
  preview:    { label: 'Preview',    color: 'var(--info)',     bg: 'rgba(59,130,246,0.1)' },
  rollback:   { label: 'Rollback',   color: 'var(--warning)',  bg: 'rgba(234,179,8,0.1)'  },
};

const PROVIDER_ICONS = { render: '⬡', vercel: '▲', railway: '🚂', netlify: '◆', mock: '◎' };

function ModeBadge({ mode }) {
  const cfg = MODE_BADGE[mode] || MODE_BADGE.production;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {cfg.label}
    </span>
  );
}

export default function VersionHistory() {
  const { projects, fetchProjects } = useProjectStore();
  const { addToast } = useUIStore();
  const [selectedProject, setSelectedProject] = useState('');
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    versionsAPI.listByProject(selectedProject)
      .then(r => setVersions(r.data || []))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [selectedProject]);

  const handleRollback = async (versionId, versionNumber) => {
    if (!confirm(`Roll back to version ${versionNumber}? A new deployment will be triggered.`)) return;
    try {
      await versionsAPI.rollback(selectedProject, versionId);
      addToast(`Rolled back to v${versionNumber}`, 'success');
      const res = await versionsAPI.listByProject(selectedProject);
      setVersions(res.data || []);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Rollback failed', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Version History</h1>
          <p className="page-subtitle">Deployment snapshots, providers, and rollback controls</p>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select className="form-input" style={{ maxWidth: 280 }} value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
          <option value="">Select a project…</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 90 }} />)}
        </div>
      ) : !selectedProject ? (
        <div className="empty-state">
          <div className="empty-state-icon"><GitBranch size={22} /></div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Select a project</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Choose a project to view its deployment version history</div>
        </div>
      ) : versions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Clock size={22} /></div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No versions yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Versions are created automatically after each successful deployment.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {versions.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{ display: 'flex', gap: 0, position: 'relative' }}
            >
              {/* Timeline connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: v.is_current ? 'var(--success-dim)' : 'var(--bg-secondary)',
                  border: `2px solid ${v.is_current ? 'var(--success)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                }}>
                  {v.is_current
                    ? <CheckCircle size={13} style={{ color: 'var(--success)' }} />
                    : <GitBranch size={12} style={{ color: 'var(--text-muted)' }} />
                  }
                </div>
                {i < versions.length - 1 && (
                  <div style={{ width: 1, flex: 1, minHeight: 12, background: 'var(--border-subtle)', margin: '2px 0' }} />
                )}
              </div>

              {/* Card body */}
              <div style={{
                flex: 1, marginLeft: 12, marginBottom: i < versions.length - 1 ? 12 : 0,
                background: v.is_current ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                border: `1px solid ${v.is_current ? 'var(--border)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius)', padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  {/* Left: version info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      v{v.version_number}
                    </span>
                    {v.is_current && <span className="badge badge-success">Current</span>}
                    {v.deploy_mode && <ModeBadge mode={v.deploy_mode} />}
                    {v.version_tag && (
                      <span className="badge badge-muted" style={{ fontFamily: 'monospace', fontSize: 10 }}>{v.version_tag}</span>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {v.deployment_url && (
                      <a href={v.deployment_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                        <ExternalLink size={11} /> Live URL
                      </a>
                    )}
                    {!v.is_current && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRollback(v.id, v.version_number)}
                      >
                        <RotateCcw size={11} /> Rollback
                      </button>
                    )}
                  </div>
                </div>

                {/* Meta row */}
                <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                  {v.provider && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>{PROVIDER_ICONS[v.provider] || '◎'}</span>
                      <span style={{ textTransform: 'capitalize' }}>{v.provider}</span>
                    </div>
                  )}
                  {v.build_duration_seconds && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                      <Zap size={11} />
                      <span>{v.build_duration_seconds}s</span>
                    </div>
                  )}
                  {v.commit_hash && (
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {v.commit_hash.slice(0, 8)}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {new Date(v.created_at).toLocaleString()}
                  </div>
                </div>

                {v.changelog && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, fontStyle: 'italic' }}>
                    {v.changelog}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
