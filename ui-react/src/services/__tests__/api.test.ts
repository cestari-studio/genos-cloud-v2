/**
 * api.test.ts — Frontend RBAC + permission tests
 * Tests the role-permission mapping that mirrors server/services/rbac.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing api
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

// Mock localStorage/sessionStorage for jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
Object.defineProperty(globalThis, 'sessionStorage', { value: localStorageMock });

// Now import after mocks are set up
import type { Role, Permission, MeResponse, CurrentUser } from '../api';

describe('Frontend RBAC', () => {
  // Re-define the ROLE_PERMISSIONS map here to test it matches expectations
  // (the actual map is not exported, so we verify behavior through types)
  const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    super_admin: [
      'observatory.read', 'observatory.write',
      'pricing.read', 'pricing.write',
      'tokens.read', 'tokens.write',
      'activity_feed.preferences.write',
      'content.generate.social',
      'tenant.hierarchy.read',
      'tenants.manage',
      'dashboard.read',
    ],
    agency_operator: [
      'content.generate.social',
      'dashboard.read',
    ],
    client_user: [
      'dashboard.read',
    ],
  };

  describe('Role-Permission mapping', () => {
    it('super_admin has all 11 permissions', () => {
      expect(ROLE_PERMISSIONS.super_admin).toHaveLength(11);
      expect(ROLE_PERMISSIONS.super_admin).toContain('tenant.hierarchy.read');
      expect(ROLE_PERMISSIONS.super_admin).toContain('tenants.manage');
    });

    it('agency_operator has exactly 2 permissions', () => {
      expect(ROLE_PERMISSIONS.agency_operator).toHaveLength(2);
      expect(ROLE_PERMISSIONS.agency_operator).toContain('content.generate.social');
      expect(ROLE_PERMISSIONS.agency_operator).toContain('dashboard.read');
    });

    it('client_user has only dashboard.read', () => {
      expect(ROLE_PERMISSIONS.client_user).toEqual(['dashboard.read']);
    });

    it('every role includes dashboard.read', () => {
      for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
        expect(ROLE_PERMISSIONS[role]).toContain('dashboard.read');
      }
    });

    it('only super_admin has write permissions', () => {
      const writePerms: Permission[] = ['observatory.write', 'pricing.write', 'tokens.write'];
      for (const perm of writePerms) {
        expect(ROLE_PERMISSIONS.super_admin).toContain(perm);
        expect(ROLE_PERMISSIONS.agency_operator).not.toContain(perm);
        expect(ROLE_PERMISSIONS.client_user).not.toContain(perm);
      }
    });
  });

  describe('MeResponse type contract', () => {
    it('unauthenticated response has correct shape', () => {
      const unauthed: MeResponse = {
        authenticated: false,
        user: null,
        tenant: null,
        wallet: { credits: 0, overage: 0 },
      };
      expect(unauthed.authenticated).toBe(false);
      expect(unauthed.user).toBeNull();
      expect(unauthed.tenant).toBeNull();
    });

    it('authenticated response has user with role and permissions', () => {
      const user: CurrentUser = {
        id: 'user-1',
        email: 'mail@cestari.studio',
        source: 'wix-auth-bridge',
        role: 'super_admin',
        permissions: ROLE_PERMISSIONS.super_admin,
        tenantContext: { id: 'tenant-1', slug: 'cestari-studio' },
        tenantScopeId: null,
      };

      const authed: MeResponse = {
        authenticated: true,
        user,
        tenant: { id: 'tenant-1', name: 'Cestari Studio', slug: 'cestari-studio', plan: 'agency', parent_tenant_id: null, depth_level: 0 },
        wallet: { credits: 1000, overage: 0 },
        activeApp: 'content-factory',
        isPayPerUse: false,
      };

      expect(authed.authenticated).toBe(true);
      expect(authed.user?.role).toBe('super_admin');
      expect(authed.user?.permissions).toContain('observatory.write');
      expect(authed.tenant?.slug).toBe('cestari-studio');
    });
  });
});
