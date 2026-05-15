import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, Monitor, Search, Filter } from 'lucide-react';
import { deploymentsAPI } from '../services/api';
import StatusBadge from '../components/ui/StatusBadge';

export default function DeploymentsList() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    deploymentsAPI.list().then(r => { setDeployments(r.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = deployments.filter(d =>
    (d.project_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.provider || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.status || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Deployments</h1>
          <p className="page-subtitle">All deployment runs across your projects</p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 300 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            placeholder="Search deployments..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Monitor size={22} /></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No deployments yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Upload a project and start a deployment.</div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/upload')}>Upload Project</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Project</th>
                <th>Provider</th>
                <th>Mode</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>#{d.id}</td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{d.project_name || `Project #${d.project_id}`}</td>
                  <td style={{ textTransform: 'capitalize' }}>{d.provider || '—'}</td>
                  <td><span className="badge badge-muted">{d.deploy_mode}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.branch || 'main'}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>{new Date(d.created_at).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/deployments/${d.id}`)}>
                      <Eye size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
}
