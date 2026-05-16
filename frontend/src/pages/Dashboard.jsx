import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket, Upload, FolderOpen, CheckCircle, TrendingUp, Activity, Server, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import useProjectStore from '../store/useProjectStore';
import { deploymentsAPI, analyticsAPI } from '../services/api';
import StatusBadge from '../components/ui/StatusBadge';

function StatsCard({ icon: Icon, label, value, color = 'var(--accent)' }) {
  return (
    <div className="stats-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1, marginTop: 12 }}>
        {value}
      </div>
    </div>
  );
}

function EmptyProjects({ onUpload }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon"><FolderOpen size={22} /></div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No projects yet</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 280 }}>Upload your first project ZIP to get started with AI-powered deployment.</div>
      <button className="btn btn-primary" onClick={onUpload} style={{ marginTop: 8 }}>
        <Upload size={14} /> Upload Project
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { projects, fetchProjects, loading } = useProjectStore();
  const [deployments, setDeployments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
    deploymentsAPI.list().then(r => setDeployments(r.data || [])).catch(() => {});
    
    setAnalyticsLoading(true);
    analyticsAPI.getStats(7)
      .then(r => setAnalytics(r.data))
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, []);

  const successCount = deployments.filter(d => d.status === 'completed').length;
  const successRate = deployments.length ? Math.round((successCount / deployments.length) * 100) : 0;
  const avgScore = projects.length
    ? Math.round(projects.reduce((s, p) => s + (p.readiness_score || 0), 0) / projects.length)
    : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">DeployMind Platform</h1>
          <p className="page-subtitle">Multi-Deployment Analytics & Observability</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/upload')}>
          <Upload size={14} /> New Project
        </button>
      </div>

      {/* Analytics Stats */}
      <motion.div
        className="grid-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ marginBottom: 28 }}
      >
        <StatsCard icon={FolderOpen} label="Total Projects" value={analytics?.total_projects || projects.length} color="var(--accent)" />
        <StatsCard icon={Rocket}     label="Deployments (7d)" value={analytics?.total_deployments || deployments.length} color="var(--info)" />
        <StatsCard icon={CheckCircle} label="Success Rate"  value={`${analytics?.success_rate || successRate}%`} color="var(--success)" />
        <StatsCard icon={Zap}        label="Avg AI Score"   value={avgScore || '—'} color="var(--warning)" />
      </motion.div>

      {/* Deployment Activity Chart */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        style={{ marginBottom: 28 }}
      >
        <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} /> Deployment Activity
          </span>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 7 Days</div>
        </div>
        
        <div style={{ height: 280, padding: '20px 20px 20px 0', width: '100%' }}>
          {analyticsLoading ? (
            <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 8 }} />
          ) : !analytics || !analytics.trends || analytics.trends.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
              Not enough data to display chart
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.trends}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }} 
                  dy={10}
                  tickFormatter={(str) => {
                    const date = new Date(str);
                    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }} 
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: 6, boxShadow: 'var(--shadow-lg)' }}
                  itemStyle={{ fontSize: 12, fontWeight: 500 }}
                  labelStyle={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}
                />
                <Area type="monotone" dataKey="total" name="Total" stroke="var(--accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                <Area type="monotone" dataKey="success" name="Success" stroke="var(--success)" strokeWidth={2} fillOpacity={1} fill="url(#colorSuccess)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {/* Grid for Analytics Charts */}
      <div className="grid-3" style={{ marginBottom: 28 }}>
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          <div className="card-header"><span className="card-title">Frameworks</span></div>
          <div style={{ height: 200 }}>
            {analyticsLoading ? <div className="skeleton" style={{ height: '100%' }} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics?.frameworks || []}
                    dataKey="projects"
                    nameKey="name"
                    cx="50%" cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                  >
                    {(analytics?.frameworks || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--accent)' : 'var(--text-muted)'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: 6 }}
                    itemStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div
          className="card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="card-header"><span className="card-title">Provider Adoption</span></div>
          <div style={{ height: 200 }}>
            {analyticsLoading ? <div className="skeleton" style={{ height: '100%' }} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.providers || []} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    width={70}
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                    tickFormatter={(val) => val.charAt(0).toUpperCase() + val.slice(1)}
                  />
                  <Tooltip 
                    cursor={{ fill: 'var(--bg-hover)' }}
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: 6 }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div
          className="card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12 }}
        >
          <div className="card-header"><span className="card-title">Failures</span></div>
          <div style={{ height: 200 }}>
            {analyticsLoading ? <div className="skeleton" style={{ height: '100%' }} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.failures || []} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="reason" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    width={80}
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'var(--bg-hover)' }}
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: 6 }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="var(--danger)" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Recent Deployments */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="card-header">
            <span className="card-title">Recent Deployments</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/deployments')}>View all</button>
          </div>
          {deployments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
              No deployments yet
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Provider</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {deployments.slice(0, 8).map((d) => (
                  <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/deployments/${d.id}`)}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{d.project_name || `Project #${d.project_id}`}</td>
                    <td style={{ textTransform: 'capitalize' }}>{d.provider || '—'}</td>
                    <td><span className="badge badge-muted">{d.deploy_mode || 'production'}</span></td>
                    <td><StatusBadge status={d.status} /></td>
                    <td>{new Date(d.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>

        {/* Projects List */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <div className="card-header">
            <span className="card-title">Projects</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/upload')}>
              <Upload size={12} /> New
            </button>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
            </div>
          ) : projects.length === 0 ? (
            <EmptyProjects onUpload={() => navigate('/upload')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {projects.slice(0, 8).map(p => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/analysis/${p.id}`)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.framework}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: p.readiness_score >= 80 ? 'var(--success)' : p.readiness_score >= 60 ? 'var(--warning)' : 'var(--danger)',
                    }}>
                      {Math.round(p.readiness_score)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
