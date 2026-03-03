import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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
    usage: { tokens_used: 0, tokens_limit: 5000, posts_used: 0, posts_limit: 24, schedule_used: 0, schedule_limit: 12 },
    activeApp: 'content-factory',
    isPayPerUse: false
  });

  // Use a ref to always have the latest `me` inside polling callbacks
  // without adding `me` to useEffect deps (which caused the infinite loop)
  const meRef = useRef(me);
  meRef.current = me;

  const refreshMe = async (email?: string, isBackground?: boolean): Promise<MeResponse> => {
    try {
      if (email) api.setActiveUserEmail(email);
      const fullMe = await api.getMe();

      // Protect against transient background poll failures
      if (isBackground && meRef.current.authenticated && !fullMe.authenticated) {
        console.warn('genOS AuthContext: transient unauthenticated response during background poll — ignoring.');
        return meRef.current;
      }

      setMe(fullMe);
      return fullMe;
    } catch (err) {
      console.error('genOS AuthContext: Refresh Error:', err);
      // On background poll error: keep current state; on initial/login: fall through
      if (isBackground) return meRef.current;

      const fallback = {
        authenticated: false,
        user: null,
        tenant: null,
        wallet: { credits: 0, overage: 0 },
        usage: { tokens_used: 0, tokens_limit: 5000, posts_used: 0, posts_limit: 24, schedule_used: 0, schedule_limit: 12 }
      };
      setMe(fallback as any);
      return fallback as any;
    }
  };

  // ── Single mount effect: initial load + 60s background polling ──────────────
  // Empty deps [] ensures this runs ONCE only → no loop
  useEffect(() => {
    refreshMe();
    const interval = setInterval(() => refreshMe(undefined, true), 60_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshWallet = useCallback(async () => {
    const data = await api.getMe(true);
    setMe(data);
  }, []);

  const login = async (email: string): Promise<boolean> => {
    localStorage.setItem('genOS_activeUserEmail', email);
    const data = await refreshMe(email);
    if (data.authenticated) {
      sessionStorage.setItem('genOS_system_analysis_after_login', '1');
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
