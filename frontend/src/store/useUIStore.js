import { create } from 'zustand';

let toastId = 0;

const useUIStore = create((set, get) => ({
  toasts: [],

  addToast: (message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }));
    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration);
    }
    return id;
  },

  removeToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  toast: {
    success: (msg, dur) => useUIStore.getState().addToast(msg, 'success', dur),
    error: (msg, dur) => useUIStore.getState().addToast(msg, 'error', dur),
    warning: (msg, dur) => useUIStore.getState().addToast(msg, 'warning', dur),
    info: (msg, dur) => useUIStore.getState().addToast(msg, 'info', dur),
  },
}));

export default useUIStore;
