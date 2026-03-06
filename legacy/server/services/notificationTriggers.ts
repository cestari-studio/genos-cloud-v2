// genOS Full v1.0.0 "Lumina" — notificationTriggers.ts (Addendum C — AJUSTE 9)
// Automated notification triggers — periodic checks that emit feed events

import { supabase } from './supabaseClient';
import { emitFeedEvent } from './activityFeed';

/**
 * Check for pending feedback items that have been waiting too long
 */
async function checkPendingFeedback(tenantId: string): Promise<void> {
  const { count } = await supabase
    .from('feedback_queue')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('processing_status', 'pending');

  const n = count || 0;
  if (n >= 5) {
    await emitFeedEvent({
      tenant_id: tenantId,
      severity: n >= 10 ? 'warning' : 'info',
      category: 'feedback',
      action: 'pending_feedback_alert',
      summary: `${n} feedbacks pendentes aguardando processamento`,
      detail: 'Execute "Processar Feedback" para atualizar os conteúdos.',
      is_autonomous: true,
      show_toast: n >= 10,
    });
  }
}

/**
 * Check for content items with low quality scores
 */
async function checkLowScores(tenantId: string): Promise<void> {
  const { data } = await supabase
    .from('content_items')
    .select('id, title, compliance_score')
    .eq('tenant_id', tenantId)
    .eq('status', 'needs_manual_review')
    .order('compliance_score', { ascending: true })
    .limit(10);

  const items = data || [];
  if (items.length > 0) {
    await emitFeedEvent({
      tenant_id: tenantId,
      severity: 'warning',
      category: 'quality_gate',
      action: 'low_scores_alert',
      summary: `${items.length} post(s) aguardando revisão manual`,
      detail: items.map(i => `• "${(i.title || '').substring(0, 40)}" — score: ${i.compliance_score || 0}`).join('\n'),
      is_autonomous: true,
      show_toast: false,
    });
  }
}

/**
 * Check for empty schedule in the next 7 days
 */
async function checkEmptySchedule(tenantId: string): Promise<void> {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const todayStr = today.toISOString().slice(0, 10);
  const nextWeekStr = nextWeek.toISOString().slice(0, 10);

  const { count } = await supabase
    .from('content_items')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('scheduled_date', todayStr)
    .lte('scheduled_date', nextWeekStr);

  const n = count || 0;
  if (n === 0) {
    await emitFeedEvent({
      tenant_id: tenantId,
      severity: 'warning',
      category: 'schedule',
      action: 'empty_schedule_alert',
      summary: 'Nenhum post agendado para os próximos 7 dias',
      detail: 'Considere usar o Batch Social para gerar conteúdo.',
      is_autonomous: true,
      show_toast: true,
    });
  } else if (n <= 2) {
    await emitFeedEvent({
      tenant_id: tenantId,
      severity: 'info',
      category: 'schedule',
      action: 'low_schedule_alert',
      summary: `Apenas ${n} post(s) agendado(s) para os próximos 7 dias`,
      is_autonomous: true,
      show_toast: false,
    });
  }
}

/**
 * Check API key configuration
 */
async function checkApiKeys(tenantId: string): Promise<void> {
  const geminiKey = process.env.GOOGLE_AI_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const missing: string[] = [];
  if (!geminiKey || geminiKey.length < 10 || geminiKey.includes('your-')) missing.push('Gemini');
  if (!anthropicKey || anthropicKey.length < 10 || anthropicKey.includes('your-')) missing.push('Claude');

  if (missing.length > 0) {
    await emitFeedEvent({
      tenant_id: tenantId,
      severity: 'info',
      category: 'system',
      action: 'api_keys_missing',
      summary: `API Keys não configuradas: ${missing.join(', ')}`,
      detail: 'O sistema usará mock local. Configure as chaves no .env para AI real.',
      is_autonomous: true,
      show_toast: false,
    });
  }
}

/**
 * Run all notification triggers
 */
export async function runNotificationTriggers(tenantId: string): Promise<void> {
  try {
    await Promise.allSettled([
      checkPendingFeedback(tenantId),
      checkLowScores(tenantId),
      checkEmptySchedule(tenantId),
      checkApiKeys(tenantId),
    ]);
  } catch (err) {
    console.error('[notificationTriggers] Error:', err);
  }
}

let triggerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic notification trigger checks (default: every 30 min)
 */
export function startNotificationTriggers(tenantId: string, intervalMs = 30 * 60 * 1000): void {
  if (triggerInterval) clearInterval(triggerInterval);

  // Run once after 60 seconds (give server time to stabilize)
  setTimeout(() => runNotificationTriggers(tenantId), 60000);

  // Then periodically
  triggerInterval = setInterval(() => runNotificationTriggers(tenantId), intervalMs);
  console.log(`[notificationTriggers] Started (every ${Math.round(intervalMs / 60000)}min)`);
}
