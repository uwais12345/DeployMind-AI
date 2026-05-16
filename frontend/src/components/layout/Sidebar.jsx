import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Upload, Rocket, ScrollText, Brain,
  ClipboardList, GitBranch, Eye, Settings, User,
  ChevronLeft, ChevronRight, Zap, LogOut, Wand2
} from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/upload', icon: Upload, label: 'Upload Project' },
      { to: '/wizard', icon: Wand2, label: 'Deploy Wizard' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/deployments', icon: Rocket, label: 'Deployments' },
      { to: '/analysis', icon: Brain, label: 'AI Analysis' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/audit', icon: ClipboardList, label: 'Audit Logs' },
      { to: '/versions', icon: GitBranch, label: 'Version History' },
      { to: '/previews', icon: Eye, label: 'Preview URLs' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/settings', icon: Settings, label: 'Project Settings' },
      { to: '/profile', icon: User, label: 'Profile' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">DM</div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <span className="sidebar-logo-text">DeployMind AI</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={onToggle}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="sidebar-section-label">{section.label}</div>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? 'active' : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={16} />
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div
          className="sidebar-item"
          style={{ marginBottom: '4px' }}
          title={collapsed ? user?.email : undefined}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 800,
              color: 'var(--bg-primary)',
              flexShrink: 0,
            }}
          >
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.full_name || user?.email?.split('@')[0] || 'User'}
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-item btn-ghost"
          style={{ width: '100%', border: 'none', background: 'none' }}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={16} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
