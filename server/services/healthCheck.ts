// genOS Full v1.0.0 "Lumina" — healthCheck.ts (Addendum C — AJUSTE 6/9)
// Periodic system health checks + startup diagnostics

import { supabase } from './supabaseClient';
import { emitFeedEvent } from './activityFeed';

export interface CheckResult {
  label: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
  latency_ms: number;
}

export interface HealthCheckResult {
  checks: CheckResult[];
  timestamp: Date;
  allOk: boolean;
}

async function checkSupabase(): Promise<Omit<CheckResult, 'label'>> {
  const start = Date.now();
  try {
    const { count, error } = await supabase.from('tenants').select('id', { count: 'exact', head: true });
    const ms = Date.now() - start;
    if (error) return { status: 'error', detail: error.message, latency_ms: ms };
    return { status: 'ok', detail: `Connected (${ms}ms)`, latency_ms: ms };
  } catch (err) {
    return { status: 'error', detail: String(err), latency_ms: Date.now() - start };
  }
}

async function checkPendingFeedback(): Promise<Omit<CheckResult, 'label'>> {
  const start = Date.now();
  try {
    const { count, error } = await supabase
      .from('feedback_queue')
      .select('id', { count: 'exact', head: true })
      .eq('processing_status', 'pending');

    const ms = Date.now() - start;
    if (error) return { status: 'warning', detail: error.message, latency_ms: ms };
    const n = count || 0;
    return { status: n > 10 ? 'warning' : 'ok', detail: `${n} pending`, latency_ms: ms };
  } catch {
    return { status: 'warning', detail: 'Unable to check', latency_ms: Date.now() - start };
  }
}

async function checkComplianceRules(): Promise<Omit<CheckResult, 'label'>> {
  const start = Date.now();
  try {
    const { count } = await supabase
      .from('compliance_rules')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    const ms = Date.now() - start;
    return { status: 'ok', detail: `Rules loaded: ${count || 0}`, latency_ms: ms };
  } catch {
    return { status: 'warning', detail: 'Unable to check', latency_ms: Date.now() - start };
  }
}

async function checkRetryQueue(): Promise<Omit<CheckResult, 'label'>> {
  const start = Date.now();
  try {
    const { count } = await supabase
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'needs_manual_review');

    const ms = Date.now() - start;
    const n = count || 0;
    return { status: n > 0 ? 'warning' : 'ok', detail: `${n} posts in review queue`, latency_ms: ms };
  } catch {
    return { status: 'warning', detail: 'Unable to check', latency_ms: Date.now() - start };
  }
}

async function checkBrandDNA(): Promise<Omit<CheckResult, 'label'>> {
  const start = Date.now();
  try {
    const { count } = await supabase
      .from('brand_dna')
      .select('id', { count: 'exact', head: true });

    const ms = Date.now() - start;
    return { status: 'ok', detail: `Loaded for ${count || 0} clients`, latency_ms: ms };
  } catch {
    return { status: 'warning', detail: 'Unable to check', latency_ms: Date.now() - start };
  }
}

// Check API keys are configured (not actual API calls)
function checkApiKey(envVar: string, label: string): Omit<CheckResult, 'label'> {
  const key = process.env[envVar];
  if (key && key.length > 10 && !key.includes('your-') && !key.includes('placeholder')) {
    return { status: 'ok', detail: 'Key configured', latency_ms: 0 };
  }
  return { status: 'warning', detail: 'Key not configured (using local mock)', latency_ms: 0 };
}

export async function runHealthCheck(tenantId?: string): Promise<HealthCheckResult> {
  const checks: CheckResult[] = [];

  const checkDefs: Array<{ label: string; fn: () => Promise<Omit<CheckResult, 'label'>> | Omit<CheckResult, 'label'> }> = [
    { label: 'Supabase Cloud', fn: checkSupabase },
    { label: 'Gemini API', fn: () => checkApiKey('GOOGLE_AI_KEY', 'Gemini') },
    { label: 'Claude API', fn: () => checkApiKey('ANTHROPIC_API_KEY', 'Claude') },
    { label: 'Feedback Queue', fn: checkPendingFeedback },
    { label: 'MasterCompliance', fn: checkComplianceRules },
    { label: 'Quality Gate', fn: checkRetryQueue },
    { label: 'Brand DNA', fn: checkBrandDNA },
  ];

  for (const def of checkDefs) {
    try {
      const result = await def.fn();
      checks.push({ label: def.label, ...result });
    } catch (err) {
      checks.push({ label: def.label, status: 'error', detail: String(err), latency_ms: 0 });
    }
  }

  const errors = checks.filter(r => r.status === 'error');
  const allOk = errors.length === 0;

  // Emit feed event if we have a tenant context
  if (tenantId) {
    await emitFeedEvent({
      tenant_id: tenantId,
      severity: errors.length > 0 ? 'error' : 'info',
      category: 'system',
      action: 'health_check',
      summary: errors.length > 0
        ? `Health Check: ${errors.length} service(s) down`
        : 'All services operational',
      detail: checks.map(r => {
        const icon = r.status === 'ok' ? '✓' : r.status === 'warning' ? '⚠' : '✕';
        return `${icon} ${r.label}: ${r.detail}`;
      }).join('\n'),
      is_autonomous: true,
      show_toast: errors.length > 0,
    });
  }

  return { checks, timestamp: new Date(), allOk };
}

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

export function startPeriodicHealthCheck(tenantId: string, intervalMs = 15 * 60 * 1000): void {
  if (healthCheckInterval) clearInterval(healthCheckInterval);

  // Run immediately on startup
  runHealthCheck(tenantId).then(result => {
    const ok = result.checks.filter(c => c.status === 'ok').length;
    const warn = result.checks.filter(c => c.status === 'warning').length;
    const err = result.checks.filter(c => c.status === 'error').length;
    console.log(`[healthCheck] Startup: ${ok} ok, ${warn} warning, ${err} error`);
  });

  // Then every 15 minutes
  healthCheckInterval = setInterval(() => runHealthCheck(tenantId), intervalMs);
  console.log(`[healthCheck] Periodic check started (every ${Math.round(intervalMs / 60000)}min)`);
}
