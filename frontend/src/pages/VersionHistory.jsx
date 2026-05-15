import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, RotateCcw, CheckCircle, Clock } from 'lucide-react';
import { versionsAPI } from '../services/api';
import useProjectStore from '../store/useProjectStore';
import useUIStore from '../store/useUIStore';

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
    if (!confirm(`Roll back to version ${versionNumber}?`)) return;
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
          <p className="page-subtitle">Deployment snapshots and rollback controls</p>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select className="form-input" style={{ maxWidth: 280 }} value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
          <option value="">Select a project...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : !selectedProject ? (
        <div className="empty-state">
          <div className="empty-state-icon"><GitBranch size={22} /></div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Select a project</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Choose a project to view its version history</div>
        </div>
      ) : versions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Clock size={22} /></div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No versions yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Versions are created automatically after each successful deployment.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {versions.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 16 }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: v.is_current ? 'var(--success-dim)' : 'var(--bg-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {v.is_current
                  ? <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                  : <GitBranch size={16} style={{ color: 'var(--text-muted)' }} />
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    v{v.version_number}
                  </span>
                  {v.is_current && <span className="badge badge-success">Current</span>}
                  {v.version_tag && <span className="badge badge-muted">{v.version_tag}</span>}
                </div>
                {v.commit_hash && (
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 2 }}>
                    commit: {v.commit_hash}
                  </div>
                )}
                {v.changelog && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{v.changelog}</div>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                {new Date(v.created_at).toLocaleString()}
              </div>
              {!v.is_current && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleRollback(v.id, v.version_number)}
                >
                  <RotateCcw size={12} /> Rollback
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
