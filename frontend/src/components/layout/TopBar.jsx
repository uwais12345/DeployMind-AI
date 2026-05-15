import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

const BREADCRUMB_MAP = {
  '/dashboard': ['Dashboard'],
  '/upload': ['Projects', 'Upload'],
  '/wizard': ['Projects', 'Deploy Wizard'],
  '/deployments': ['Deployments'],
  '/logs': ['Deployments', 'Logs Explorer'],
  '/analysis': ['AI', 'Analysis'],
  '/audit': ['Management', 'Audit Logs'],
  '/versions': ['Management', 'Version History'],
  '/previews': ['Management', 'Preview URLs'],
  '/settings': ['Settings'],
  '/profile': ['Account', 'Profile'],
};

export default function TopBar() {
  const { user } = useAuthStore();
  const location = useLocation();
  const parts = BREADCRUMB_MAP[location.pathname] || [location.pathname.slice(1)];

  return (
    <header className="topbar">
      <div className="topbar-breadcrumb">
        {parts.map((part, i) => (
          <React.Fragment key={part}>
            {i > 0 && <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
            <span className={i === parts.length - 1 ? 'current' : ''}>{part}</span>
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          style={{
            background: 'none',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius)',
            padding: '6px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <Bell size={14} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: 'white',
            }}
          >
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
            {user?.full_name || user?.email?.split('@')[0] || 'User'}
          </span>
        </div>
      </div>
    </header>
  );
}
