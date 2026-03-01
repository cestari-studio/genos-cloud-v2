/**
 * rbac.test.ts — Unit tests for role-based access control
 */

jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnValue({ data: [], error: null }),
  },
}));

import { supabase } from '../supabaseClient';
import { buildUserFromIdentity, hasPermission, getPermissionsForRole } from '../rbac';

describe('rbac', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getPermissionsForRole', () => {
    it('super_admin has all permissions', () => {
      const perms = getPermissionsForRole('super_admin');
      expect(perms).toContain('observatory.read');
      expect(perms).toContain('observatory.write');
      expect(perms).toContain('tenant.hierarchy.read');
      expect(perms).toContain('dashboard.read');
    });

    it('client_user only has dashboard.read', () => {
      const perms = getPermissionsForRole('client_user');
      expect(perms).toEqual(['dashboard.read']);
    });

    it('agency_operator has content.generate.social + dashboard.read', () => {
      const perms = getPermissionsForRole('agency_operator');
      expect(perms).toContain('content.generate.social');
      expect(perms).toContain('dashboard.read');
      expect(perms).not.toContain('observatory.write');
    });
  });

  describe('hasPermission', () => {
    it('returns false for null user', () => {
      expect(hasPermission(null, 'dashboard.read')).toBe(false);
    });

    it('super_admin always has permission', () => {
      const user = {
        email: 'mail@cestari.studio',
        source: 'header',
        role: 'super_admin' as const,
        permissions: getPermissionsForRole('super_admin'),
        tenantContext: null,
        tenantScopeId: null,
      };
      expect(hasPermission(user, 'observatory.write')).toBe(true);
      expect(hasPermission(user, 'tenant.hierarchy.read')).toBe(true);
    });

    it('client_user cannot access observatory', () => {
      const user = {
        email: 'client@example.com',
        source: 'header',
        role: 'client_user' as const,
        permissions: getPermissionsForRole('client_user'),
        tenantContext: null,
        tenantScopeId: null,
      };
      expect(hasPermission(user, 'observatory.read')).toBe(false);
      expect(hasPermission(user, 'dashboard.read')).toBe(true);
    });
  });

  describe('buildUserFromIdentity', () => {
    it('resolves super_admin for mail@cestari.studio', async () => {
      // Mock empty user_access table
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ data: [], error: null }),
          }),
        }),
      });

      const user = await buildUserFromIdentity({
        email: 'mail@cestari.studio',
        source: 'header',
      });

      expect(user.role).toBe('super_admin');
      expect(user.permissions).toContain('tenant.hierarchy.read');
    });

    it('resolves agency_operator for ocestari89@gmail.com', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ data: [], error: null }),
          }),
        }),
      });

      const user = await buildUserFromIdentity({
        email: 'ocestari89@gmail.com',
        source: 'header',
      });

      expect(user.role).toBe('agency_operator');
    });

    it('defaults unknown emails to client_user', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ data: [], error: null }),
          }),
        }),
      });

      const user = await buildUserFromIdentity({
        email: 'random@example.com',
        source: 'header',
      });

      expect(user.role).toBe('client_user');
      expect(user.permissions).toEqual(['dashboard.read']);
    });

    it('normalizes email casing', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ data: [], error: null }),
          }),
        }),
      });

      const user = await buildUserFromIdentity({
        email: '  MAIL@Cestari.Studio  ',
        source: 'header',
      });

      expect(user.email).toBe('mail@cestari.studio');
      expect(user.role).toBe('super_admin');
    });

    it('prefers user_access table role over static mapping', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              data: [{ role: 'agency_operator', tenant_id: 'tenant-1', is_active: true }],
              error: null,
            }),
          }),
        }),
      });

      const user = await buildUserFromIdentity({
        email: 'random@example.com',
        source: 'header',
        tenant: { id: 'tenant-1', slug: 'test', name: 'Test' } as any,
      });

      expect(user.role).toBe('agency_operator');
      expect(user.tenantScopeId).toBe('tenant-1');
    });
  });
});
