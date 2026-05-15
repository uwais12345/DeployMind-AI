import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, ClipboardList } from 'lucide-react';
import { auditAPI } from '../services/api';
import StatusBadge from '../components/ui/StatusBadge';

const CATEGORIES = ['', 'deployment', 'security', 'auth', 'project'];

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (category) params.category = category;
      if (search) params.event_type = search;
      const res = await auditAPI.list(params);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch { setLogs([]); }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [category]);

  const severityColor = (s) =>
    s === 'critical' ? 'var(--danger)' :
    s === 'warning'  ? 'var(--warning)' :
    'var(--text-muted)';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">{total} total events tracked</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        <select className="form-input" style={{ width: 160 }} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={fetchLogs}>Apply</button>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 40 }} />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><ClipboardList size={22} /></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No audit events</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Events are recorded as you use the platform.</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Category</th>
                <th>Description</th>
                <th>Severity</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)' }}>{log.event_type}</td>
                  <td><span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>{log.event_category || '—'}</span></td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.description}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, color: severityColor(log.severity), textTransform: 'uppercase' }}>
                      {log.severity}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
}
