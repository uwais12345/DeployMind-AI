import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Plus, Trash2, Copy, ExternalLink, Timer } from 'lucide-react';
import { previewsAPI } from '../services/api';
import useProjectStore from '../store/useProjectStore';
import useUIStore from '../store/useUIStore';

function timeLeft(expiresAt) {
  if (!expiresAt) return '—';
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
}

export default function PreviewDeployments() {
  const { projects, fetchProjects } = useProjectStore();
  const { addToast } = useUIStore();
  const [selectedProject, setSelectedProject] = useState('');
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    previewsAPI.listByProject(selectedProject)
      .then(r => setPreviews(r.data || []))
      .catch(() => setPreviews([]))
      .finally(() => setLoading(false));
  }, [selectedProject]);

  const handleCreate = async () => {
    if (!selectedProject) return;
    setCreating(true);
    try {
      const res = await previewsAPI.create(selectedProject);
      setPreviews(p => [res.data, ...p]);
      addToast('Preview deployment created!', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to create preview', 'error');
    }
    setCreating(false);
  };

  const handleDelete = async (id) => {
    try {
      await previewsAPI.delete(id);
      setPreviews(p => p.filter(x => x.id !== id));
      addToast('Preview deleted', 'info');
    } catch {
      addToast('Delete failed', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Preview Deployments</h1>
          <p className="page-subtitle">Temporary staging URLs for your projects</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate} disabled={!selectedProject || creating}>
          <Plus size={14} /> {creating ? 'Creating...' : 'New Preview'}
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select className="form-input" style={{ maxWidth: 280 }} value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
          <option value="">Select a project...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid-3">
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 140 }} />)}
        </div>
      ) : previews.filter(p => p.status !== 'deleted').length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Eye size={22} /></div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No preview URLs</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Create a preview deployment to test before going live.</div>
        </div>
      ) : (
        <div className="grid-3">
          {previews.filter(p => p.status !== 'deleted').map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-muted'}`}>{p.status}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all', marginBottom: 8, fontFamily: 'monospace' }}>
                {p.preview_url}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                <Timer size={11} />
                {timeLeft(p.expires_at)}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { navigator.clipboard.writeText(p.preview_url); addToast('Copied!', 'success'); }}
                >
                  <Copy size={11} /> Copy
                </button>
                <a href={p.preview_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                  <ExternalLink size={11} /> Open
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
