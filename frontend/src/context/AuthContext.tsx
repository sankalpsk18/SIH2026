// ============================================================================
// ADALAT360 - Auth Context
// React context for authentication state management
// ============================================================================

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuthStore } from '../hooks/useAuthStore';
import { authApi } from '../services/api';
import { User, LoginRequest, LoginResponse, MfaSetupResponse } from '../types';
import { toast } from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaRequired: boolean;
  mfaToken?: string;
  login: (credentials: LoginRequest) => Promise<{ requiresMfa: boolean; mfaToken?: string }>;
  verifyMfa: (code: string, type: 'totp' | 'backup') => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setupMfa: () => Promise<MfaSetupResponse>;
  enableMfa: (code: string) => Promise<string[]>;
  disableMfa: (password: string) => Promise<void>;
  regenerateBackupCodes: (password: string) => Promise<string[]>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    isLoading,
    mfaRequired,
    mfaToken,
    setTokens,
    setUser,
    setMfaRequired,
    setMfaToken,
    clearAuth,
    hydrate,
  } = useAuthStore();

  // Hydrate on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const login = async (credentials: LoginRequest): Promise<{ requiresMfa: boolean; mfaToken?: string }> => {
    try {
      const response = await authApi.login(credentials);
      const data = response.data as LoginResponse;

      if (data.requires_mfa) {
        setMfaRequired(true);
        if (data.mfa_method === 'totp') {
          // MFA token would be in response headers or body
          // For now, we'll handle it via the verifyMfa flow
        }
        return { requiresMfa: true };
      }

      setTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      setMfaRequired(false);
      toast.success(`Welcome back, ${data.user.full_name}!`);
      return { requiresMfa: false };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const verifyMfa = async (code: string, type: 'totp' | 'backup'): Promise<void> => {
    try {
      const token = useAuthStore.getState().mfaToken;
      if (!token) throw new Error('No MFA session');

      const response = await authApi.mfaVerify(token, { code, type });
      const data = response.data as LoginResponse;

      setTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      setMfaRequired(false);
      setMfaToken(undefined);
      toast.success('Two-factor authentication successful');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Invalid authentication code';
      toast.error(message);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const token = useAuthStore.getState().accessToken;
      const refresh = useAuthStore.getState().refreshToken;
      await authApi.logout(token, refresh);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
      toast.success('Logged out successfully');
    }
  };

  const refreshProfile = async (): Promise<void> => {
    try {
      const response = await authApi.getProfile();
      setUser(response.data);
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  const setupMfa = async (): Promise<MfaSetupResponse> => {
    const response = await authApi.setupMfa();
    return response.data;
  };

  const enableMfa = async (code: string): Promise<string[]> => {
    const response = await authApi.enableMfa(code);
    return response.data.backup_codes;
  };

  const disableMfa = async (password: string): Promise<void> => {
    await authApi.disableMfa(password);
    toast.success('Two-factor authentication disabled');
  };

  const regenerateBackupCodes = async (password: string): Promise<string[]> => {
    const response = await authApi.regenerateBackupCodes(password);
    toast.success('Backup codes regenerated');
    return response.data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        mfaRequired,
        mfaToken,
        login,
        verifyMfa,
        logout,
        refreshProfile,
        setupMfa,
        enableMfa,
        disableMfa,
        regenerateBackupCodes,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}