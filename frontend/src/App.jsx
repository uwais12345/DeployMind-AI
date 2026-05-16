import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/useAuthStore';
import AppLayout from './layouts/AppLayout';
import ToastContainer from './components/ui/Toast';

// Auth pages
import Login from './pages/Login';
import Register from './pages/Register';

// App pages
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import DeploymentMonitor from './pages/DeploymentMonitor';
import Deployments from './pages/Deployments';
import AIAnalysis from './pages/AIAnalysis';
import AuditLogs from './pages/AuditLogs';
import VersionHistory from './pages/VersionHistory';
import PreviewDeployments from './pages/PreviewDeployments';
import ProjectSettings from './pages/ProjectSettings';
import ProfileSettings from './pages/ProfileSettings';
import DeploymentWizard from './pages/DeploymentWizard';
import GitHubCallback from './pages/GitHubCallback';
import GoogleCallback from './pages/GoogleCallback';
import LandingPage from './pages/LandingPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuthStore();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { fetchUser, token } = useAuthStore();

  useEffect(() => {
    if (token) fetchUser();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected App */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/wizard" element={<DeploymentWizard />} />
          <Route path="/deployments" element={<Deployments />} />
          <Route path="/deployments/:id" element={<DeploymentMonitor />} />
          <Route path="/analysis/:id" element={<AIAnalysis />} />
          <Route path="/analysis" element={<Navigate to="/dashboard" replace />} />
          <Route path="/audit" element={<AuditLogs />} />
          <Route path="/versions" element={<VersionHistory />} />
          <Route path="/previews" element={<PreviewDeployments />} />
          <Route path="/settings" element={<ProjectSettings />} />
          <Route path="/profile" element={<ProfileSettings />} />
          <Route path="/auth/callback" element={<GitHubCallback />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />
        </Route>

        {/* Public Landing */}
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Global Toast Notifications */}
      <ToastContainer />
    </BrowserRouter>
  );
}
