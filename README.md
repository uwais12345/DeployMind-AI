# DeployMind AI 🚀

DeployMind AI is an enterprise-grade, AI-powered deployment orchestration platform. It transforms raw source code into production-ready web applications with zero configuration, featuring an advanced AI engine that analyzes code readiness, fixes build errors, and seamlessly provisions external hosting infrastructure.

---

## 🌟 Key Features

### 🧠 AI-Driven Orchestration
- **Automated Readiness Scoring**: Evaluates code quality, framework detection, and security posture prior to deployment.
- **Fix My Project**: A dedicated interactive AI assistant that automatically triages syntax errors, missing dependencies, and architectural issues.
- **Build Error Assistant**: If a deployment fails, the AI parses the live build logs to instantly diagnose the root cause and provide actionable fixes.

### ⚡ Enterprise Observability & Operations
- **Multi-Deployment Analytics**: Real-time visualization of deployment success rates, trends, and platform volume.
- **AI Deployment Insights**: Proactive, cached AI analysis of operational telemetry to provide executive-level deployment insights.
- **Live Deployment Monitor**: Streaming WebSocket logs provide transparent real-time feedback directly from the build pipeline, with smart provider failure detection and recovery UX.
- **Version Control & Rollbacks**: Instant one-click rollback functionality for rapid recovery from failed deployments, tracking provider and deploy mode.

### 🛡️ Secure by Design
- **Encrypted Multi-Tenant Orchestration**: Provider credentials (Vercel, Render, Railway, Netlify) are AES-encrypted at rest and injected dynamically per-tenant at runtime.
- **Vault-Level Environment Variables**: AES-encrypted storage of sensitive application secrets.
- **Robust Authentication**: JWT-based secure user sessions with refresh token rotation (Google OAuth + Email).
- **Comprehensive Audit Trail**: Complete immutable logging of system events, deployments, provider connections, and security incidents.

### 🚀 Seamless Infrastructure Integrations
- **Provider-Agnostic Engine**: Abstracted integration interface with unified health monitoring, deployment stats, and error masking for Vercel, Render, Netlify, and Railway.
- **Preview Environments**: Automated staging generation to preview code changes before production.
- **GitHub Sync (Upcoming)**: Direct continuous integration from version control.

---

## 🏗️ Technology Stack

**Frontend (Client)**
- React + Vite
- Zustand (State Management)
- Axios (API Client)
- Framer Motion (Animations)
- Recharts (Analytics Data Visualization)
- Tailwind Utility Classes + Vanilla CSS System

**Backend (Server)**
- FastAPI (High-performance Async Python)
- Celery + Redis (Distributed Background Task Queue)
- SQLAlchemy ORM
- JWT / Passlib (Security)
- WebSockets (Streaming logs)

**Infrastructure**
- Supabase (PostgreSQL Database)
- Groq AI / LLaMA (Inference Engine)

---

## 📖 Documentation

For a deep dive into the platform's system architecture, database schema, and core API surfaces, please refer to the [ARCHITECTURE.md](./ARCHITECTURE.md) document.

---

## 🚀 Quick Start

1. **Clone the repository.**
2. **Environment Setup**: Ensure `backend/.env` is configured with valid `DATABASE_URL` (Supabase), `REDIS_URL`, and `GROQ_API_KEY`.
3. **Start the Backend**:
   ```bash
   cd backend
   python -m uvicorn main:app --reload --port 8000
   ```
   *Note: Ensure Celery workers are running alongside the server.*
4. **Start the Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
5. Navigate to `http://localhost:5173` to access the DeployMind AI Platform.
