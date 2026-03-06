// genOS Full v1.0.0 "Lumina" — middleware/observatory.ts
// Access control middleware for Observatory super-tenant routes

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware: require observatory tenant
 * Checks that the current tenant has is_observatory=true in settings
 */
export function requireObservatory(req: Request, res: Response, next: NextFunction) {
  const tenant = (req as any).tenant;

  if (!tenant) {
    return res.status(401).json({ error: 'Tenant not found. Provide X-Tenant-Id or x-tenant-slug header.' });
  }

  const isObservatory = tenant.settings?.is_observatory === true;

  if (!isObservatory) {
    return res.status(403).json({
      error: 'Access denied. Observatory privileges required.',
      tenant: tenant.slug,
    });
  }

  next();
}

/**
 * Middleware: require observatory OR same-tenant access
 * Used for routes that both the observatory and the tenant itself can access
 */
export function requireObservatoryOrSelf(req: Request, res: Response, next: NextFunction) {
  const tenant = (req as any).tenant;

  if (!tenant) {
    return res.status(401).json({ error: 'Tenant not found.' });
  }

  const isObservatory = tenant.settings?.is_observatory === true;
  const targetTenantId = req.params.tenantId || req.query.tenant_id;

  // Observatory can access any tenant
  if (isObservatory) return next();

  // Non-observatory can only access own data
  if (targetTenantId && targetTenantId !== tenant.id) {
    return res.status(403).json({
      error: 'Access denied. Cannot view other tenant data.',
    });
  }

  next();
}
