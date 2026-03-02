import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, type MeResponse, type Permission } from '../services/api';

interface AuthContextType {
  me: MeResponse;
  login: (email: string) => Promise<boolean>;
  logout: () => void;
  refreshMe: (email?: string) => Promise<MeResponse>;
  refreshWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse>({
    authenticated: false,
    user: null,
    tenant: null,
    wallet: { credits: 0, overage: 0 },
    config: { post_limit: 24, token_balance: 5000, post_language: 'pt-BR', ai_model: 'gemini-2.0-flash' },
    usage: { tokens_used: 0, tokens_limit: 5000, posts_used: 0, posts_limit: 24 },
    activeApp: 'content-factory',
    isPayPerUse: false
  });

  useEffect(() => {
    // Initial load
    refreshMe();
    // Poll usage/wallet every 60s
    const interval = setInterval(() => {
      refreshMe();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const refreshMe = async (email?: string): Promise<MeResponse> => {
    try {
      if (email) api.setActiveUserEmail(email);
      const fullMe = await api.getMe();
      setMe(fullMe);
      return fullMe;
    } catch (err) {
      console.error('genOS AuthContext: Refresh Error:', err);
      const fallback = { authenticated: false, user: null, tenant: null, wallet: { credits: 0, overage: 0 } };
      setMe(fallback);
      return fallback;
    }
  };

  const refreshWallet = useCallback(async () => {
    const data = await api.getMe(true);
    setMe(data);
  }, []);

  const login = async (email: string): Promise<boolean> => {
    localStorage.setItem('genOS_activeUserEmail', email);
    const data = await refreshMe(email);
    if (data.authenticated) {
      sessionStorage.setItem("genOS_system_analysis_after_login", "1");
    }
    return data.authenticated;
  };

  const logout = () => {
    api.logout();
    setMe({ authenticated: false, user: null, tenant: null, wallet: { credits: 0, overage: 0 } });
  };

  return (
    <AuthContext.Provider value={{ me, login, logout, refreshMe, refreshWallet }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function hasPermission(permission: Permission, me: MeResponse): boolean {
  if (!me.user) return false;
  if (me.user.role === 'super_admin') return true;
  return me.user.permissions.includes(permission);
}
