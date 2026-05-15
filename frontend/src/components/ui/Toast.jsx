import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import useUIStore from '../../store/useUIStore';

const ICONS = {
  success: <CheckCircle size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />,
  error: <AlertCircle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />,
  warning: <AlertTriangle size={15} style={{ color: 'var(--warning)', flexShrink: 0 }} />,
  info: <Info size={15} style={{ color: 'var(--info)', flexShrink: 0 }} />,
};

export default function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`toast toast-${t.type}`}
          >
            {ICONS[t.type]}
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex' }}
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
