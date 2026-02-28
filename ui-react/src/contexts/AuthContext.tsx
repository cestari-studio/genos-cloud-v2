import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { MeResponse, Permission } from '../services/api';

const AuthContext = createContext<MeResponse | null>(null);

export function AuthProvider({ value, children }: { value: MeResponse; children: ReactNode }) {
  // Merge missing wallet defaults if none provided by API
  const enrichedValue = {
    ...value,
    wallet: value.wallet || { credits: 0, overage: 0 },
    activeApp: value.activeApp || 'content-factory',
    isPayPerUse: value.wallet ? value.wallet.credits <= 0 : false
  };

  return <AuthContext.Provider value={enrichedValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): MeResponse {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      authenticated: false,
      user: null,
      tenant: null,
      wallet: { credits: 0, overage: 0 },
      activeApp: 'content-factory',
      isPayPerUse: false
    };
  }
  return ctx;
}

export function hasPermission(permission: Permission, me: MeResponse): boolean {
  if (!me.user) return false;
  if (me.user.role === 'super_admin') return true;
  return me.user.permissions.includes(permission);
}
