import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await api.post('/users/login', { email, password });
      const { access_token, refresh_token, user } = res.data;
      localStorage.setItem('token', access_token);
      if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
      set({ token: access_token, user, isAuthenticated: true, loading: false });
      return { success: true };
    } catch (err) {
      set({ loading: false });
      let errorMsg = err.response?.data?.detail || 'Login failed';
      if (Array.isArray(errorMsg)) errorMsg = errorMsg.map(d => d.msg).join(', ');
      return { success: false, error: errorMsg };
    }
  },

  register: async (email, password, full_name) => {
    set({ loading: true });
    try {
      await api.post('/users/register', { email, password, full_name });
      set({ loading: false });
      return { success: true };
    } catch (err) {
      set({ loading: false });
      let errorMsg = err.response?.data?.detail || 'Registration failed';
      if (Array.isArray(errorMsg)) errorMsg = errorMsg.map(d => d.msg).join(', ');
      return { success: false, error: errorMsg };
    }
  },

  fetchUser: async () => {
    try {
      const res = await api.get('/users/me');
      set({ user: res.data, isAuthenticated: true });
    } catch {
      get().logout();
    }
  },

  updateProfile: async (data) => {
    try {
      const res = await api.put('/users/me', data);
      set({ user: res.data });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail || 'Update failed' };
    }
  },

  changePassword: async (old_password, new_password) => {
    try {
      await api.put('/users/me/password', { old_password, new_password });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail || 'Password change failed' };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  setAuth: (token, user, refresh_token = null) => {
    localStorage.setItem('token', token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
    set({ token, user, isAuthenticated: true });
  },
}));

export default useAuthStore;

