import React from 'react';

const PROVIDER_CONFIG = {
  vercel: { label: 'Vercel', icon: '▲', color: '#fff', bg: '#000' },
  render: { label: 'Render', icon: '⬡', color: '#fff', bg: '#4353ff' },
  railway: { label: 'Railway', icon: '🚂', color: '#fff', bg: '#0b0c0f' },
  netlify: { label: 'Netlify', icon: '◆', color: '#fff', bg: '#20c5b7' },
  mock: { label: 'Mock', icon: '🧪', color: '#888', bg: '#1a1a28' },
};

export default function ProviderBadge({ provider }) {
  const cfg = PROVIDER_CONFIG[provider?.toLowerCase()] || PROVIDER_CONFIG.mock;
  
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '2px 8px',
      borderRadius: 4,
      background: cfg.bg,
      color: cfg.color,
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.02em',
      border: '1px solid rgba(255,255,255,0.1)'
    }}>
      <span style={{ fontSize: 12 }}>{cfg.icon}</span>
      {cfg.label}
    </div>
  );
}
