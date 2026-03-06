// genOS Full v1.0.0 "Lumina" — index.ts
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from project root (works with tsx and tsc)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

import { contentRouter } from './routes/content';
// syncRouter removed — CSV sync system deprecated
import { aiRouter } from './routes/ai';
import { webhooksRouter } from './routes/webhooks';
import { observatoryRouter } from './routes/observatory';
import { popupsRouter } from './routes/popups';
import { activityFeedRouter } from './routes/activityFeed';
import { dnaRouter } from './routes/dna';
import { authRouter } from './routes/auth';
import { startPopupCrons } from './jobs/popupCrons';
import { supabase, getTenantBySlug, getTenantById } from './services/supabaseClient';
// csvWatcher removed — CSV sync system deprecated
import { startPeriodicHealthCheck } from './services/healthCheck';
import { emitFeedEvent } from './services/activityFeed';
import { startNotificationTriggers } from './services/notificationTriggers';
import { identityMiddleware, requirePermission } from './middleware/identity';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const UI_DIR = path.resolve(__dirname, '..', 'ui');

// Middleware
const ALLOWED_ORIGINS = [
  'https://app.cestari.studio',
  'https://genos-cloud-v2.vercel.app',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:4000'] : [])
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 100,                    // 100 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 10,                     // 10 AI requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit exceeded. Please wait before making more AI requests.' },
});

app.use(globalLimiter);
app.use('/api/ai', aiLimiter);

// Serve UI static assets
app.use(express.static(UI_DIR));

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    const tenant = await getTenantBySlug(process.env.TENANT_SLUG || 'cestari-studio');
    res.json({
      status: 'ok',
      version: 'v1.0.0',
      codename: 'Lumina',
      timestamp: new Date().toISOString(),
      tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan } : null,
      supabase: !!tenant ? 'connected' : 'error',
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: String(err) });
  }
});

// Tenant context middleware — injects tenant into req
// Priority: X-Tenant-Id (UUID) > x-tenant-slug > env TENANT_SLUG > 'cestari-studio'
app.use('/api', async (req, _res, next) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const slug = req.headers['x-tenant-slug'] as string || process.env.TENANT_SLUG || 'cestari-studio';

    let tenant = null;
    if (tenantId) {
      tenant = await getTenantById(tenantId);
    }
    if (!tenant) {
      tenant = await getTenantBySlug(slug);
    }
    if (tenant) {
      (req as any).tenant = tenant;
    }
  } catch (_err) {
    // Continue without tenant context
  }
  next();
});

// Identity context middleware — resolves authenticated user from Wix/header identity.
app.use('/api', identityMiddleware);

// API routes
app.use('/api/content', contentRouter);
// /api/sync removed — CSV sync system deprecated
app.use('/api/ai', aiRouter);
app.use('/api/observatory', observatoryRouter);
app.use('/api/popups', popupsRouter);
app.use('/api/activity-feed', activityFeedRouter);
app.use('/api/dna', dnaRouter);
app.use('/api/auth', authRouter);
app.use('/webhooks', webhooksRouter);

// Current identity + effective access
app.get('/api/me', (req, res) => {
  const user = (req as any).user || null;
  const tenant = (req as any).tenant || null;
  res.json({
    authenticated: Boolean(user),
    user,
    tenant: tenant
      ? { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan, parent_tenant_id: tenant.parent_tenant_id }
      : null,
  });
});

// Tenant info endpoint (current)
app.get('/api/tenant', (req, res) => {
  const tenant = (req as any).tenant;
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }
  res.json(tenant);
});

// List visible tenants for the authenticated user.
app.get('/api/tenants', async (req, res) => {
  const user = (req as any).user;
  const currentTenant = (req as any).tenant;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  // Non-admin users can only see their current tenant context.
  if (user.role !== 'super_admin') {
    if (!currentTenant) return res.status(404).json({ error: 'Tenant not found' });
    return res.json([{
      id: currentTenant.id,
      name: currentTenant.name,
      slug: currentTenant.slug,
      plan: currentTenant.plan,
      status: currentTenant.status,
      wix_site_id: currentTenant.wix_site_id,
      parent_tenant_id: currentTenant.parent_tenant_id,
      settings: currentTenant.settings,
    }]);
  }

  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, slug, plan, status, wix_site_id, parent_tenant_id, settings')
      .eq('status', 'active')
      .order('name');

    if (error) return res.status(500).json({ error: error.message });

    // Sort: parent (Cestari) first, then clients alphabetically
    const sorted = (data || []).sort((a: any, b: any) => {
      if (!a.parent_tenant_id && b.parent_tenant_id) return -1;
      if (a.parent_tenant_id && !b.parent_tenant_id) return 1;
      return a.name.localeCompare(b.name);
    });

    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Full hierarchy view — master account only
app.get('/api/tenants/hierarchy', requirePermission('tenant.hierarchy.read'), async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, slug, plan, status, parent_tenant_id')
      .eq('status', 'active')
      .order('name');

    if (error) return res.status(500).json({ error: error.message });

    const tenants = (data || []) as Array<{
      id: string;
      name: string;
      slug: string;
      plan: string;
      status: string;
      parent_tenant_id: string | null;
    }>;

    const byParent = new Map<string | null, typeof tenants>();
    for (const tenant of tenants) {
      const key = tenant.parent_tenant_id || null;
      const list = byParent.get(key) || [];
      list.push(tenant);
      byParent.set(key, list);
    }

    const buildTree = (parentId: string | null): any[] => {
      const children = byParent.get(parentId) || [];
      return children.map((tenant) => ({
        ...tenant,
        children: buildTree(tenant.id),
      }));
    };

    // Root node is the master account requested by product rule.
    res.json({
      root: {
        owner_email: 'mail@cestari.studio',
        label: 'Master Account',
        children: buildTree(null),
      },
      total_tenants: tenants.length,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Brand DNA endpoint
app.get('/api/brand-dna', async (req, res) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { data, error } = await supabase
    .from('brand_dna')
    .select('*')
    .eq('tenant_id', tenant.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Update Brand DNA
app.put('/api/brand-dna', async (req, res) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { data, error } = await supabase
    .from('brand_dna')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenant.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// CSV Registry endpoint removed — CSV sync system deprecated

// Compliance Rules endpoint
app.get('/api/compliance-rules', async (req, res) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { data, error } = await supabase
    .from('compliance_rules')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('rule_type');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// System Prompts endpoint
app.get('/api/system-prompts', async (req, res) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { data, error } = await supabase
    .from('system_prompts')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Dashboard stats
app.get('/api/dashboard/stats', async (req, res) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const [contentRes, promptsRes, rulesRes, sessionsRes, feedbackRes] = await Promise.all([
      supabase.from('posts').select('id, status, format, created_at, updated_at', { count: 'exact' }).eq('tenant_id', tenant.id),
      supabase.from('system_prompts').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('compliance_rules').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('ai_sessions').select('id, tokens_used, cost_usd', { count: 'exact' }).eq('tenant_id', tenant.id),
      supabase.from('feedback_queue').select('id, processing_status', { count: 'exact' }).eq('tenant_id', tenant.id),
    ]);

    const posts = contentRes.data || [];
    const statusCounts: Record<string, number> = {};
    const formatCounts: Record<string, number> = {};

    for (const item of posts) {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      formatCounts[item.format] = (formatCounts[item.format] || 0) + 1;
    }

    const sessions = sessionsRes.data || [];
    const totalTokens = sessions.reduce((sum, s) => sum + (s.tokens_used || 0), 0);
    const totalCost = sessions.reduce((sum, s) => sum + parseFloat(String(s.cost_usd || 0)), 0);

    const feedbackItems = feedbackRes.data || [];
    const pendingFeedback = feedbackItems.filter(f => f.processing_status === 'pending').length;

    res.json({
      content: {
        total: contentRes.count || 0,
        byStatus: statusCounts,
        byFormat: formatCounts,
      },
      ai: {
        totalSessions: sessionsRes.count || 0,
        totalTokens,
        totalCostUsd: Math.round(totalCost * 10000) / 10000,
        activePrompts: promptsRes.count || 0,
      },
      compliance: {
        activeRules: rulesRes.count || 0,
      },
      feedback: {
        total: feedbackRes.count || 0,
        pending: pendingFeedback,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Dashboard recent activity
app.get('/api/dashboard/recent', async (req, res) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { limit = '10' } = req.query;

  try {
    const [recentContent, recentSessions, recentActivity] = await Promise.all([
      supabase
        .from('posts')
        .select('id, title, format, status, scheduled_date, created_at, updated_at')
        .eq('tenant_id', tenant.id)
        .order('updated_at', { ascending: false })
        .limit(Number(limit)),
      supabase
        .from('ai_sessions')
        .select('id, session_type, model_used, tokens_used, cost_usd, status, context, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(Number(limit)),
      supabase
        .from('activity_log')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(Number(limit)),
    ]);

    res.json({
      recentPosts: recentContent.data || [],
      recentSessions: recentSessions.data || [],
      recentActivity: recentActivity.data || [],
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// SPA fallback for direct route access (keeps /api and /webhooks untouched)
app.get(/^\/(?!api|webhooks).*/, (_req, res) => {
  res.sendFile(path.join(UI_DIR, 'index.html'));
});

const tenantSlug = process.env.TENANT_SLUG || 'cestari-studio';

// Start server
app.listen(PORT, async () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  genOS Full v1.0.0 "Lumina"                  ║
║  Server running on http://localhost:${PORT}      ║
║  UI: http://localhost:${PORT}/                   ║
║  API: http://localhost:${PORT}/api/health        ║
╚══════════════════════════════════════════════╝
  `);

  // Auto-start periodic checks if tenant is resolvable
  try {
    const tenant = await getTenantBySlug(tenantSlug);
    if (tenant) {
      // Start periodic health check (every 15 min)
      startPeriodicHealthCheck(tenant.id, 15 * 60 * 1000);
      console.log(`[init] Periodic health check started for tenant: ${tenant.name}`);

      // Start notification triggers (every 30 min)
      startNotificationTriggers(tenant.id, 30 * 60 * 1000);
      console.log(`[init] Notification triggers started for tenant: ${tenant.name}`);

      // Start popup cron jobs (Addendum F)
      startPopupCrons();
      console.log(`[init] Popup crons started (Addendum F)`);

      // Emit startup event to activity feed
      await emitFeedEvent({
        tenant_id: tenant.id,
        severity: 'info',
        category: 'system',
        action: 'server_started',
        summary: 'genOS Lumina v1.0.0 — Server started',
        detail: `Port: ${PORT}, Tenant: ${tenant.name}`,
        is_autonomous: true,
        show_toast: false,
      });
    }
  } catch (_err) {
    console.log('[init] Periodic checks not started (tenant not resolved)');
  }
});

export default app;
