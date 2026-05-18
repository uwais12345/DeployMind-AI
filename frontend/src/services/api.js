import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and it's not a retry
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/users/refresh') {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post('http://localhost:8000/api/users/refresh', {
          refresh_token: refreshToken
        });

        localStorage.setItem('token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        
        api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
        originalRequest.headers['Authorization'] = `Bearer ${data.access_token}`;

        processQueue(null, data.access_token);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ────────────────────────────────────────────
// AUTH
// ────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/users/login', data),
  register: (data) => api.post('/users/register', data),
  me: () => api.get('/users/me'),
};

// ────────────────────────────────────────────
// PROJECTS
// ────────────────────────────────────────────
export const projectsAPI = {
  list: () => api.get('/projects/'),
  get: (id) => api.get(`/projects/${id}`),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  upload: (formData, onProgress, signal) =>
    api.post('/projects/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded / e.total) * 100)),
      signal,
    }),
  fix: (id) => api.post(`/projects/${id}/fix`),
  listEnvVars: (id) => api.get(`/projects/${id}/env-vars`),
  addEnvVar: (id, data) => api.post(`/projects/${id}/env-vars`, data),
  deleteEnvVar: (id, varId) => api.delete(`/projects/${id}/env-vars/${varId}`),
};

// ────────────────────────────────────────────
// DEPLOYMENTS
// ────────────────────────────────────────────
export const deploymentsAPI = {
  start: (data) => api.post('/deployments/', data),
  get: (id) => api.get(`/deployments/${id}`),
  list: () => api.get('/deployments/'),
  listByProject: (projectId) => api.get(`/deployments/project/${projectId}`),
  cancel: (id) => api.post(`/deployments/${id}/cancel`),
  logs: (id) => api.get(`/deployments/${id}/logs`),
  rollback: (id) => api.post(`/deployments/${id}/rollback`),
  retry: (id) => api.post(`/deployments/${id}/retry`),
  diagnostics: (id) => api.post(`/deployments/${id}/diagnostics`),
};

// ────────────────────────────────────────────
// AUDIT LOGS
// ────────────────────────────────────────────
export const auditAPI = {
  list: (params) => api.get('/audit/', { params }),
  get: (id) => api.get(`/audit/${id}`),
};

// ────────────────────────────────────────────
// VERSIONS
// ────────────────────────────────────────────
export const versionsAPI = {
  listByProject: (projectId) => api.get(`/versions/project/${projectId}`),
  rollback: (projectId, versionId) => api.post(`/versions/project/${projectId}/rollback/${versionId}`),
};

// ────────────────────────────────────────────
// PREVIEWS
// ────────────────────────────────────────────
export const previewsAPI = {
  listByProject: (projectId) => api.get(`/previews/project/${projectId}`),
  create: (projectId) => api.post(`/previews/project/${projectId}`),
  delete: (id) => api.delete(`/previews/${id}`),
};

// ────────────────────────────────────────────
// GITHUB
// ────────────────────────────────────────────
export const githubAPI = {
  status: () => api.get('/github/status'),
  push: (projectId) => api.post(`/github/push/${projectId}`),
  oauthUrl: () => api.get('/github/oauth/url'),
  callback: (code) => api.get('/github/oauth/callback', { params: { code } }),
};

// ────────────────────────────────────────────
// GOOGLE
// ────────────────────────────────────────────
export const googleAPI = {
  oauthUrl: () => api.get('/google/oauth/url'),
  callback: (code) => api.get('/google/oauth/callback', { params: { code } }),
};

// ────────────────────────────────────────────
// ANALYTICS
// ────────────────────────────────────────────
export const analyticsAPI = {
  getStats: (days = 7) => api.get('/analytics/', { params: { days } }),
  getInsights: () => api.get('/analytics/insights'),
};


// ────────────────────────────────────────────
// PROVIDERS
// ────────────────────────────────────────────
export const providersAPI = {
  getCredentials: () => api.get('/providers/credentials'),
  saveCredential: (data) => api.post('/providers/credentials', data),
  updateCredential: (provider, data) => api.put(`/providers/credentials/${provider}`, data),
  deleteCredential: (provider) => api.delete(`/providers/credentials/${provider}`),
  testConnection: (data) => api.post('/providers/test-connection', data),
};

export default api;
