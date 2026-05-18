import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, ChevronRight } from 'lucide-react';
import { analyticsAPI } from '../../services/api';

/**
 * AIInsightsPanel — A compact, premium "executive insights" widget.
 * Fetches from the cached /analytics/insights endpoint (5-min TTL server-side).
 */
export default function AIInsightsPanel() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visible, setVisible] = useState(true);

  const load = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await analyticsAPI.getInsights();
      setInsights(res.data?.insights || []);
    } catch {
      // Silently fail — this is a non-critical enhancement
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (!loading && insights.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ marginBottom: 24 }}
    >
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'rgba(99,102,241,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={13} style={{ color: '#818cf8' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
              AI Deployment Insights
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '1px 6px', background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
              Operational Intelligence
            </span>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', borderRadius: 4, transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            title="Refresh insights"
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
          </button>
        </div>

        {/* Insights */}
        <div style={{ padding: '10px 0' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 16px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 16, width: `${70 + i * 8}%`, borderRadius: 4 }} />
              ))}
            </div>
          ) : (
            <AnimatePresence>
              {insights.map((insight, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '7px 16px',
                    borderBottom: i < insights.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <ChevronRight size={13} style={{ color: '#818cf8', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {insight}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
}
