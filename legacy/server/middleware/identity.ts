import type { NextFunction, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { buildUserFromIdentity, hasPermission, type Permission, type Role } from '../services/rbac';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

interface IdentityProvider {
  name: string;
  resolveEmail: (req: Request) => string | null;
}

function sanitizeEmail(value: string | undefined): string | null {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  if (!email.includes('@') || email.length < 6) return null;
  return email;
}

const wixIdentityProvider: IdentityProvider = {
  name: 'wix',
  resolveEmail(req) {
    const header = req.headers['x-wix-user-email']
      || req.headers['x-wix-member-email']
      || req.headers['x-wix-email'];
    const value = Array.isArray(header) ? header[0] : header;
    return sanitizeEmail(value);
  },
};

const headerIdentityProvider: IdentityProvider = {
  name: 'header',
  resolveEmail(req) {
    const header = req.headers['x-user-email'] || req.headers['x-auth-email'];
    const value = Array.isArray(header) ? header[0] : header;
    return sanitizeEmail(value);
  },
};

const queryIdentityProvider: IdentityProvider = {
  name: 'query',
  resolveEmail(req) {
    const value = String(req.query.user_email || req.query.as_user || '');
    return sanitizeEmail(value);
  },
};

const providers: IdentityProvider[] = [
  wixIdentityProvider,
  headerIdentityProvider,
  queryIdentityProvider,
];

export async function identityMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    // 1. Try Supabase JWT first (Production Standard)
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user && !error) {
        const tenant = (req as any).tenant;
        const identityUser = await buildUserFromIdentity({
          email: user.email!,
          source: 'supabase-jwt',
          tenant,
        });
        (req as any).user = identityUser;
        return next();
      }
    }

    // 2. Fallback to legacy providers (Development / Migration)
    for (const provider of providers) {
      const email = provider.resolveEmail(req);
      if (!email) continue;

      const tenant = (req as any).tenant;
      const user = await buildUserFromIdentity({
        email,
        source: provider.name,
        tenant,
      });
      (req as any).user = user;
      break;
    }
  } catch (err) {
    console.warn('[identity] failed to resolve user identity:', err);
  }
  next();
}

export function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({
      error: 'Authentication required. Provide identity via JWT or legacy headers.',
    });
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({
        error: 'Insufficient role.',
        required: roles,
        actual: user.role,
      });
    }
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!hasPermission(user, permission)) {
      return res.status(403).json({
        error: 'Permission denied.',
        permission,
      });
    }
    next();
  };
}
