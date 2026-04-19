import { create } from 'zustand';
import type { User } from 'firebase/auth';

interface AuthStore {
  user: User | null;
  loading: boolean;
  // Login modal state
  loginModalOpen: boolean;
  loginModalMessage: string;
  // Pending export action that fires after login
  pendingExportAction: (() => void) | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  openLoginModal: (message?: string, pendingAction?: () => void) => void;
  closeLoginModal: () => void;
  runPendingExport: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: true, // true until Firebase resolves on first load
  loginModalOpen: false,
  loginModalMessage: 'Sign in to continue',
  pendingExportAction: null,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),

  openLoginModal: (message = 'Sign in to continue', pendingAction) =>
    set({
      loginModalOpen: true,
      loginModalMessage: message,
      pendingExportAction: pendingAction ?? null,
    }),

  closeLoginModal: () =>
    set({
      loginModalOpen: false,
      pendingExportAction: null,
    }),

  runPendingExport: () => {
    const { pendingExportAction } = get();
    if (pendingExportAction) {
      pendingExportAction();
      set({ pendingExportAction: null });
    }
  },
}));
