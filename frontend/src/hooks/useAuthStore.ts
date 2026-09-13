// ============================================================================
// ADALAT360 - Auth Store (Zustand)
// Global authentication state management
// ============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaRequired: boolean;
  mfaToken?: string;

  // Actions
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setMfaRequired: (required: boolean) => void;
  setMfaToken: (token?: string) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  hydrate: () => void;
}

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  mfaRequired: false,
  mfaToken: undefined,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTokens: (accessToken: string, refreshToken: string) => {
        set({ accessToken, refreshToken, isAuthenticated: true });
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      setMfaRequired: (required: boolean) => {
        set({ mfaRequired: required });
      },

      setMfaToken: (token?: string) => {
        set({ mfaToken: token });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          mfaRequired: false,
          mfaToken: undefined,
        });
      },

      hydrate: () => {
        const { accessToken, refreshToken, user, isAuthenticated } = get();
        if (accessToken && refreshToken && user && isAuthenticated) {
          set({ isLoading: false });
        } else {
          set({ ...initialState, isLoading: false });
        }
      },
    }),
    {
      name: 'adalat360-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);