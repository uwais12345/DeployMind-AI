import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Plus, Trash2, Eye, EyeOff, Save } from 'lucide-react';
import { projectsAPI } from '../services/api';
import useProjectStore from '../store/useProjectStore';
import useUIStore from '../store/useUIStore';

export default function ProjectSettings() {
  const { projects, fetchProjects, deleteProject } = useProjectStore();
  const { addToast } = useUIStore();
  const [selectedProject, setSelectedProject] = useState('');
  const [envVars, setEnvVars] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [showValues, setShowValues] = useState({});
  
  // Project Meta States
  const [projectData, setProjectData] = useState({ name: '', description: '', install_command: '', build_command: '', output_directory: '' });
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => {
    if (!selectedProject) return;
    projectsAPI.listEnvVars(selectedProject)
      .then(r => setEnvVars(r.data || []))
      .catch(() => setEnvVars([]));

    const p = projects.find(x => x.id === parseInt(selectedProject));
    if (p) {
      setProjectData({
        name: p.name || '',
        description: p.description || '',
        install_command: p.install_command || '',
        build_command: p.build_command || '',
        output_directory: p.output_directory || ''
      });
    }
  }, [selectedProject, projects]);

  const handleAddVar = async () => {
    if (!newKey.trim()) return;
    try {
      await projectsAPI.addEnvVar(selectedProject, { key: newKey, value: newVal, is_secret: isSecret, environment: 'production' });
      const res = await projectsAPI.listEnvVars(selectedProject);
      setEnvVars(res.data);
      setNewKey(''); setNewVal(''); setIsSecret(false);
      addToast('Variable added', 'success');
    } catch {
      addToast('Failed to add variable', 'error');
    }
  };

  const handleDeleteVar = async (varId) => {
    try {
      await projectsAPI.deleteEnvVar(selectedProject, varId);
      setEnvVars(v => v.filter(x => x.id !== varId));
      addToast('Variable removed', 'info');
    } catch {
      addToast('Delete failed', 'error');
    }
  };

  const handleUpdateMeta = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSavingMeta(true);
    try {
      await projectsAPI.update(selectedProject, projectData);
      addToast('Project updated', 'success');
      fetchProjects();
    } catch {
      addToast('Failed to update project', 'error');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    const project = projects.find(p => p.id === parseInt(selectedProject));
    if (!confirm(`Delete "${project?.name}"? This cannot be undone.`)) return;
    const res = await deleteProject(parseInt(selectedProject));
    if (res.success) {
      addToast('Project deleted', 'info');
      setSelectedProject('');
      setEnvVars([]);
    } else {
      addToast('Delete failed', 'error');
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Project Settings</h1>
          <p className="page-subtitle">Manage environment variables and project configuration</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Select Project</span></div>
        <select className="form-input" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
          <option value="">Choose a project...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.framework})</option>)}
        </select>
      </div>

      {selectedProject && (
        <>
          {/* Env Vars */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">Environment Variables</span>
              <span className="badge badge-muted">{envVars.length} vars</span>
            </div>

            {envVars.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>No environment variables configured.</div>
            ) : (
              <table className="data-table" style={{ marginBottom: 16 }}>
                <thead><tr><th>Key</th><th>Value</th><th>Type</th><th></th></tr></thead>
                <tbody>
                  {envVars.map(v => (
                    <tr key={v.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{v.key}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {v.is_secret
                          ? showValues[v.id] ? v.value : '••••••••'
                          : v.value}
                      </td>
                      <td>
                        <span className={`badge ${v.is_secret ? 'badge-warning' : 'badge-muted'}`}>
                          {v.is_secret ? 'Secret' : 'Plain'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {v.is_secret && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowValues(s => ({ ...s, [v.id]: !s[v.id] }))}>
                              {showValues[v.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteVar(v.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Add new var */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '1 1 140px' }}>
                <label className="form-label">Key</label>
                <input className="form-input" placeholder="DATABASE_URL" value={newKey} onChange={e => setNewKey(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: '2 1 200px' }}>
                <label className="form-label">Value</label>
                <input className="form-input" placeholder="value..." value={newVal} onChange={e => setNewVal(e.target.value)} type={isSecret ? 'password' : 'text'} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={isSecret} onChange={e => setIsSecret(e.target.checked)} />
                  Secret
                </label>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleAddVar}>
                <Plus size={12} /> Add
              </button>
            </div>
          </motion.div>

          {/* Project Metadata */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><span className="card-title">Project Configuration</span></div>
            <form onSubmit={handleUpdateMeta} style={{ display: 'grid', gap: 16 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Project Name</label>
                  <input className="form-input" value={projectData.name} onChange={e => setProjectData({...projectData, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input className="form-input" value={projectData.description} onChange={e => setProjectData({...projectData, description: e.target.value})} />
                </div>
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Install Command</label>
                  <input className="form-input" placeholder="npm install" value={projectData.install_command} onChange={e => setProjectData({...projectData, install_command: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Build Command</label>
                  <input className="form-input" placeholder="npm run build" value={projectData.build_command} onChange={e => setProjectData({...projectData, build_command: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Output Directory</label>
                  <input className="form-input" placeholder="dist" value={projectData.output_directory} onChange={e => setProjectData({...projectData, output_directory: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" type="submit" disabled={savingMeta}>
                  {savingMeta ? 'Saving...' : <><Save size={14} /> Save Changes</>}
                </button>
              </div>
            </form>
          </motion.div>

          {/* Danger Zone */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
            <div className="card-header"><span className="card-title" style={{ color: 'var(--danger)' }}>Danger Zone</span></div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>Delete this project</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>This action cannot be undone. All deployments will be removed.</div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={handleDeleteProject}>Delete Project</button>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
