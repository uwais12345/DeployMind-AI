import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ChevronLeft, Rocket, Wand2, Loader2, Link2, ExternalLink } from 'lucide-react';
import { projectsAPI, deploymentsAPI, providersAPI } from '../services/api';
import useUIStore from '../store/useUIStore';

const STEPS = ['Project Type', 'Provider', 'Environment', 'Deploy Mode', 'Confirm'];

const PROVIDERS = [
  { id: 'vercel', name: 'Vercel', icon: '▲', desc: 'Best for React, Next.js, Vue', best: ['frontend', 'fullstack'] },
  { id: 'render', name: 'Render', icon: '⬡', desc: 'Best for Node.js, FastAPI, Django', best: ['backend'] },
  { id: 'railway', name: 'Railway', icon: '🚂', desc: 'Full-stack apps, databases', best: ['backend', 'fullstack'] },
  { id: 'netlify', name: 'Netlify', icon: '◆', desc: 'Static sites and JAMstack', best: ['frontend', 'static'] },
];

const PROJECT_TYPES = ['frontend', 'backend', 'fullstack', 'static'];

export default function DeploymentWizard() {
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({
    projectType: '',
    projectId: '',
    provider: '',
    envVars: [],
    deployMode: 'production',
    branch: 'main',
  });
  const [envKey, setEnvKey] = useState('');
  const [envVal, setEnvVal] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [providerCredentials, setProviderCredentials] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  React.useEffect(() => {
    const loadProviders = async () => {
      setLoadingProviders(true);
      try {
        const res = await providersAPI.getCredentials();
        setProviderCredentials(res.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingProviders(false);
      }
    };
    loadProviders();
  }, []);

  const update = (key, val) => setConfig(c => ({ ...c, [key]: val }));

  const canNext = () => {
    if (step === 0) return !!config.projectType && !!config.projectId;
    if (step === 1) return !!config.provider;
    return true;
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const res = await deploymentsAPI.start({
        project_id: parseInt(config.projectId),
        provider: config.provider,
        deploy_mode: config.deployMode,
        branch: config.branch,
      });
      addToast('Deployment started!', 'success');
      navigate(`/deployments/${res.data.deployment_id}`);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to start deployment', 'error');
      setDeploying(false);
    }
  };

  const addEnvVar = () => {
    if (!envKey.trim()) return;
    update('envVars', [...config.envVars, { key: envKey, value: envVal }]);
    setEnvKey(''); setEnvVal('');
  };

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Deployment Wizard</h1>
          <p className="page-subtitle">No-code guided deployment setup</p>
        </div>
      </div>

      {/* Step Indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: i < step ? 'var(--success)' : i === step ? 'var(--accent)' : 'var(--bg-tertiary)',
                border: `2px solid ${i < step ? 'var(--success)' : i === step ? 'var(--accent)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                color: i <= step ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}>
                {i < step ? <Check size={12} /> : i + 1}
              </div>
              <span style={{ fontSize: 10, color: i === step ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === step ? 600 : 400, textAlign: 'center', whiteSpace: 'nowrap' }}>
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < step ? 'var(--success)' : 'var(--border-subtle)', margin: '0 4px', marginBottom: 22, transition: 'background 0.3s' }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="card"
          style={{ marginBottom: 20 }}
        >
          {step === 0 && (
            <div>
              <div className="card-header"><span className="card-title">Project Type</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">Project ID</label>
                  <input className="form-input" placeholder="Enter project ID (from upload)" value={config.projectId} onChange={e => update('projectId', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {PROJECT_TYPES.map(t => (
                      <button
                        key={t}
                        onClick={() => update('projectType', t)}
                        className="btn"
                        style={{
                          border: `1px solid ${config.projectType === t ? 'var(--accent)' : 'var(--border)'}`,
                          background: config.projectType === t ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                          color: config.projectType === t ? 'var(--accent-hover)' : 'var(--text-secondary)',
                          justifyContent: 'center',
                          textTransform: 'capitalize',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="card-header"><span className="card-title">Choose Provider</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loadingProviders ? (
                  <div style={{ textAlign: 'center', padding: 20 }}><Loader2 size={16} className="spin" style={{ color: 'var(--text-muted)' }} /></div>
                ) : (
                  PROVIDERS.filter(p => !config.projectType || p.best.includes(config.projectType)).map(p => {
                    const isConfigured = providerCredentials.some(c => c.provider === p.id && c.status === 'connected');
                    const isSelected = config.provider === p.id;
                    
                    return (
                      <button
                        key={p.id}
                        onClick={() => isConfigured && update('provider', p.id)}
                        disabled={!isConfigured}
                        style={{
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSelected ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                          borderRadius: 'var(--radius)',
                          padding: '12px 16px',
                          display: 'flex', alignItems: 'center', gap: 14,
                          cursor: isConfigured ? 'pointer' : 'not-allowed', textAlign: 'left', width: '100%',
                          transition: 'all 0.15s',
                          opacity: isConfigured ? 1 : 0.6
                        }}
                      >
                        <span style={{ fontSize: 20, width: 28, textAlign: 'center', filter: isConfigured ? 'none' : 'grayscale(1)' }}>{p.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? 'var(--accent-hover)' : 'var(--text-primary)' }}>{p.name}</div>
                            {!isConfigured && <span className="badge badge-muted" style={{ fontSize: 9, padding: '2px 4px' }}>Not Configured</span>}
                            {isConfigured && <span className="badge badge-success" style={{ fontSize: 9, padding: '2px 4px' }}>Connected</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.desc}</div>
                        </div>
                        {isSelected && <Check size={14} style={{ color: 'var(--accent)' }} />}
                        {!isConfigured && (
                          <div style={{ fontSize: 10, color: 'var(--accent)' }} onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}>
                            Connect <Link2 size={10} style={{ verticalAlign: 'middle' }}/>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="card-header"><span className="card-title">Environment Variables</span></div>
              {config.envVars.map((v, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontFamily: 'monospace', fontSize: 12 }}>
                  <span style={{ color: 'var(--accent)' }}>{v.key}</span>
                  <span style={{ color: 'var(--text-muted)' }}>=</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{v.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="form-input" placeholder="KEY" value={envKey} onChange={e => setEnvKey(e.target.value)} style={{ flex: 1 }} />
                <input className="form-input" placeholder="VALUE" value={envVal} onChange={e => setEnvVal(e.target.value)} style={{ flex: 2 }} />
                <button className="btn btn-secondary btn-sm" onClick={addEnvVar}>Add</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="card-header"><span className="card-title">Deploy Mode</span></div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                {['production', 'preview'].map(m => (
                  <button
                    key={m}
                    className="btn"
                    onClick={() => update('deployMode', m)}
                    style={{
                      flex: 1,
                      border: `1px solid ${config.deployMode === m ? 'var(--accent)' : 'var(--border)'}`,
                      background: config.deployMode === m ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                      color: config.deployMode === m ? 'var(--accent-hover)' : 'var(--text-secondary)',
                      justifyContent: 'center', padding: '12px',
                    }}
                  >
                    {m === 'production' ? '🚀 Production' : '👁 Preview'}
                  </button>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Branch</label>
                <input className="form-input" value={config.branch} onChange={e => update('branch', e.target.value)} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="card-header"><span className="card-title">Confirm Deployment</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Project ID', value: config.projectId },
                  { label: 'Type', value: config.projectType },
                  { label: 'Provider', value: config.provider },
                  { label: 'Mode', value: config.deployMode },
                  { label: 'Branch', value: config.branch },
                  { label: 'Env Vars', value: `${config.envVars.length} configured` },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
          <ChevronLeft size={14} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleDeploy} disabled={deploying}>
            {deploying ? 'Deploying...' : <><Rocket size={14} /> Launch Deployment</>}
          </button>
        )}
      </div>
    </div>
  );
}
