import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload as UploadIcon, FileArchive, CheckCircle, AlertTriangle, Loader, X } from 'lucide-react';
import { projectsAPI } from '../services/api';
import useUIStore from '../store/useUIStore';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const abortControllerRef = useRef(null);
  const navigate = useNavigate();
  const { addToast } = useUIStore();

  const validateFile = (f) => {
    if (!f) return false;
    if (!f.name.endsWith('.zip')) {
      addToast('Only .zip files are supported', 'error');
      return false;
    }
    if (f.size > 100 * 1024 * 1024) {
      addToast('File too large. Maximum 100MB allowed.', 'error');
      return false;
    }
    return true;
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (validateFile(f)) setFile(f);
  }, []);

  const handleFileInput = (e) => {
    const f = e.target.files[0];
    if (validateFile(f)) setFile(f);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setStage('Uploading ZIP...');

    abortControllerRef.current = new AbortController();
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await projectsAPI.upload(fd, (pct) => {
        setProgress(pct);
        if (pct === 100) {
          setStage('Processing & Analyzing (This may take a minute)...');
        }
      }, abortControllerRef.current.signal);

      addToast('Project analyzed successfully!', 'success');
      navigate(`/analysis/${res.data.project_id}`, { state: { result: res.data } });
    } catch (err) {
      if (err.name === 'CanceledError' || err.message === 'canceled') {
        addToast('Upload cancelled', 'warning');
      } else {
        addToast(err.response?.data?.detail || 'Upload failed', 'error');
      }
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload Project</h1>
          <p className="page-subtitle">Upload a ZIP file to analyze and deploy your project</p>
        </div>
      </div>

      {/* Dropzone */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div
          className={`dropzone ${dragging ? 'active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !file && document.getElementById('file-input').click()}
          style={{ cursor: file ? 'default' : 'pointer' }}
        >
          <input
            id="file-input"
            type="file"
            accept=".zip"
            hidden
            onChange={handleFileInput}
          />

          <AnimatePresence mode="wait">
            {file ? (
              <motion.div
                key="file"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
              >
                <FileArchive size={40} style={{ color: 'var(--accent)' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                >
                  <X size={12} /> Remove
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: 'var(--accent-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <UploadIcon size={24} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Drop your project ZIP here
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    or <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>browse files</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Supports React, Vue, Next.js, FastAPI, Django, Express — Max 100MB
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Info Cards */}
      <div className="grid-3" style={{ marginTop: 20, marginBottom: 24 }}>
        {[
          { icon: '🔍', title: 'AI Analysis', desc: 'Groq AI analyzes your project structure and generates a readiness score' },
          { icon: '🛡️', title: 'Security Scan', desc: 'Detects exposed secrets, API keys, and malware patterns' },
          { icon: '🚀', title: 'Auto Deploy', desc: 'Deploys to Vercel, Render, Railway, or Netlify automatically' },
        ].map((item) => (
          <div key={item.title} className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Upload Button + Progress */}
      {uploading ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader size={15} className="spin" style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{stage}</span>
            </div>
            {progress < 100 && (
              <button className="btn btn-ghost btn-sm" onClick={handleCancel}>Cancel</button>
            )}
          </div>
          
          {progress < 100 ? (
            <>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>{progress}%</div>
            </>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ background: '#111', borderRadius: 8, padding: '16px', fontFamily: 'monospace', fontSize: 12, color: '#10b981', border: '1px solid #333' }}>
                <motion.div initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} transition={{ repeat: Infinity, duration: 0.8, repeatType: "reverse" }}>
                  <span style={{ color: '#888' }}>$</span> extract_zip /tmp/upload.zip<br/>
                  <span style={{ color: '#888' }}>$</span> detect_framework package.json<br/>
                  <span style={{ color: '#888' }}>$</span> analyze_codebase --ai=groq<br/>
                  <span style={{ color: '#888' }}>$</span> scan_secrets_and_malware<br/>
                  <br/>
                  ... please wait, generating deployment readiness report ⏳
                </motion.div>
              </div>
            </motion.div>
          )}
        </motion.div>
      ) : (
        file && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            onClick={handleUpload}
          >
            <UploadIcon size={16} /> Analyze & Deploy Project
          </motion.button>
        )
      )}
    </div>
  );
}
