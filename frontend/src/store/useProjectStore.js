import { create } from 'zustand';
import api from '../services/api';

const useProjectStore = create((set, get) => ({
  projects: [],
  selectedProject: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/projects/');
      set({ projects: res.data, loading: false });
    } catch (err) {
      set({ loading: false, error: err.response?.data?.detail || 'Failed to load projects' });
    }
  },

  fetchProject: async (id) => {
    set({ loading: true });
    try {
      const res = await api.get(`/projects/${id}`);
      set({ selectedProject: res.data, loading: false });
      return res.data;
    } catch (err) {
      set({ loading: false, error: err.response?.data?.detail || 'Project not found' });
      return null;
    }
  },

  deleteProject: async (id) => {
    try {
      await api.delete(`/projects/${id}`);
      set(state => ({ projects: state.projects.filter(p => p.id !== id) }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail };
    }
  },

  setSelectedProject: (project) => set({ selectedProject: project }),
  clearSelected: () => set({ selectedProject: null }),
}));

export default useProjectStore;
