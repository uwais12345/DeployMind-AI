import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Terminal, 
  Shield, 
  Cpu, 
  Zap, 
  Globe, 
  Lock, 
  BarChart, 
  GitBranch,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ 
      background: '#000', 
      color: '#fff', 
      minHeight: '100vh', 
      fontFamily: 'Inter, sans-serif',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Background Grid Effect */}
      <div style={{ 
        position: 'absolute', 
        inset: 0, 
        backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse at center, black, transparent 80%)',
        pointerEvents: 'none'
      }} />

      {/* Navigation */}
      <nav style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '24px 40px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'sticky',
        top: 0,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(10px)',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#fff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} color="#000" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>DeployMind AI</span>
        </div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <a href="#features" style={{ color: '#888', textDecoration: 'none', fontSize: 14 }}>Features</a>
          <a href="#security" style={{ color: '#888', textDecoration: 'none', fontSize: 14 }}>Security</a>
          <button 
            onClick={() => navigate('/login')}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#fff', 
              fontSize: 14, 
              cursor: 'pointer' 
            }}
          >
            Log in
          </button>
          <button 
            onClick={() => navigate('/register')}
            style={{ 
              background: '#fff', 
              color: '#000', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: 6, 
              fontSize: 14, 
              fontWeight: 600, 
              cursor: 'pointer' 
            }}
          >
            Sign up
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ 
        padding: '120px 40px 80px', 
        textAlign: 'center',
        maxWidth: 1200,
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span style={{ 
            background: 'rgba(255,255,255,0.05)', 
            padding: '4px 12px', 
            borderRadius: 100, 
            fontSize: 12, 
            fontWeight: 500,
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#aaa',
            marginBottom: 24,
            display: 'inline-block'
          }}>
            V2.0 is now live · Enterprise Ready
          </span>
          <h1 style={{ 
            fontSize: '72px', 
            fontWeight: 800, 
            letterSpacing: '-0.04em', 
            lineHeight: 1.1,
            marginBottom: 24,
            background: 'linear-gradient(to bottom, #fff 40%, #888)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Orchestrate deployments<br />with AI intelligence.
          </h1>
          <p style={{ 
            fontSize: '20px', 
            color: '#888', 
            maxWidth: 600, 
            margin: '0 auto 40px',
            lineHeight: 1.6
          }}>
            The autonomous deployment platform that analyzes your code, scans for security risks, and orchestrates multi-cloud infrastructure in seconds.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button 
              onClick={() => navigate('/register')}
              style={{ 
                background: '#fff', 
                color: '#000', 
                border: 'none', 
                padding: '14px 28px', 
                borderRadius: 8, 
                fontSize: 16, 
                fontWeight: 600, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              Get Started Free <ArrowRight size={18} />
            </button>
            <button 
              style={{ 
                background: 'rgba(255,255,255,0.05)', 
                color: '#fff', 
                border: '1px solid rgba(255,255,255,0.1)', 
                padding: '14px 28px', 
                borderRadius: 8, 
                fontSize: 16, 
                fontWeight: 600, 
                cursor: 'pointer' 
              }}
            >
              Request Demo
            </button>
          </div>
        </motion.div>

        {/* Dashboard Preview Mockup */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{ 
            marginTop: 80, 
            background: '#0a0a0f', 
            borderRadius: 16, 
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '8px',
            boxShadow: '0 40px 100px rgba(0,0,0,0.8)'
          }}
        >
          <div style={{ 
            background: '#050508', 
            borderRadius: 10, 
            overflow: 'hidden',
            aspectRatio: '16/9',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ height: 40, background: '#0d0d14', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 40, color: '#fff', fontWeight: 700, marginBottom: 8 }}>98.2%</div>
                  <div style={{ color: '#10b981', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                    <CheckCircle size={14} /> DEPLOYMENT READINESS
                  </div>
               </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" style={{ padding: '100px 40px', maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 60 }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>Engineered for high-stakes DevOps.</h2>
          <p style={{ color: '#888', maxWidth: 500 }}>DeployMind handles the heavy lifting of infrastructure analysis and security.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { icon: <Shield size={24} />, title: "Security First", desc: "Automated secret scanning and malware detection before every push." },
            { icon: <Cpu size={24} />, title: "AI Diagnostics", desc: "Intelligent error analysis and automated fix suggestions for build failures." },
            { icon: <Terminal size={24} />, title: "Live Logs", desc: "Real-time deployment streaming with professional xterm.js integration." },
            { icon: <Globe size={24} />, title: "Multi-Cloud", desc: "Deploy to Vercel, Render, or Railway with a single unified workflow." },
            { icon: <BarChart size={24} />, title: "Deep Analytics", desc: "Monitor build durations, success rates, and framework trends." },
            { icon: <Lock size={24} />, title: "Encrypted Config", desc: "AES-256 encryption for all environment variables and secrets." }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -5 }}
              style={{ 
                background: '#08080c', 
                border: '1px solid rgba(255,255,255,0.05)', 
                padding: 32, 
                borderRadius: 12 
              }}
            >
              <div style={{ color: '#fff', marginBottom: 20 }}>{feature.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>{feature.title}</h3>
              <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6 }}>{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Tech Stack / Social Proof */}
      <section style={{ padding: '80px 40px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: '#555', letterSpacing: '0.1em', marginBottom: 40 }}>
          Supporting the modern tech ecosystem
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 60, flexWrap: 'wrap', opacity: 0.5 }}>
          {['Next.js', 'React', 'FastAPI', 'Node.js', 'Python', 'Go', 'Docker'].map(tech => (
            <span key={tech} style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{tech}</span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ 
        padding: '80px 40px', 
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: 1200,
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={20} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>DeployMind AI</span>
        </div>
        <div style={{ color: '#555', fontSize: 12 }}>
          © 2026 DeployMind AI Platforms Inc. All rights reserved.
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <GitBranch size={18} color="#555" />
        </div>
      </footer>
    </div>
  );
}
