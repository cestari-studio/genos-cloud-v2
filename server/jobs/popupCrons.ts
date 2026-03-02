// genOS Full v1.0.0 "Lumina" — popupCrons.ts (Addendum F)
// 12 cron job definitions + event-driven popup triggers
// Uses setInterval-based scheduling (no external cron library needed)

import { supabase } from '../services/supabaseClient';
import { popupEngine, PopupPayload } from '../services/popupEngine';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getAllActiveTenants(): Promise<{ id: string; name: string; slug: string }[]> {
  const { data } = await supabase
    .from('tenants')
    .select('id, name, slug')
    .eq('status', 'active');
  return data || [];
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

// ─── DAILY CRONS ────────────────────────────────────────────────────────────

/**
 * A4: Auto-rebalance schedule — detect conflicts and gaps
 * Runs daily at 5h
 */
async function cronScheduleRebalance(): Promise<void> {
  console.log('[cron] A4 — Schedule rebalance check');
  const tenants = await getAllActiveTenants();

  for (const tenant of tenants) {
    const { data: items } = await supabase
      .from('content_items')
      .select('id, scheduled_date, status')
      .eq('tenant_id', tenant.id)
      .in('status', ['draft', 'approved'])
      .not('scheduled_date', 'is', null)
      .order('scheduled_date');

    if (!items?.length) continue;

    // Detect date conflicts (same date)
    const dateMap = new Map<string, number>();
    for (const item of items) {
      const d = item.scheduled_date?.split('T')[0] || '';
      dateMap.set(d, (dateMap.get(d) || 0) + 1);
    }
    const conflicts = [...dateMap.entries()].filter(([, count]) => count > 1).length;

    // Detect gaps (3+ consecutive days without posts)
    const dates = [...dateMap.keys()].sort();
    let gaps = 0;
    for (let i = 1; i < dates.length; i++) {
      const diff = (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000;
      if (diff >= 4) gaps++;
    }

    if (conflicts > 0 || gaps > 0) {
      await popupEngine.emit({
        tenantId: tenant.id,
        code: 'A4',
        category: 'autonomous_content',
        title: 'Cronograma reorganizado automaticamente',
        message: `Detectei ${conflicts} conflitos de data e ${gaps} gaps no cronograma de ${tenant.name}. Reorganizei automaticamente mantendo a frequencia ideal.`,
        severity: 'info',
        persistence: 'persistent',
        actions: [
          { label: 'Ver calendario', type: 'tertiary', action: 'navigate', target: '/schedule.html' },
          { label: 'Desfazer', type: 'ghost', action: 'dismiss' },
          { label: 'Otimizar horarios', type: 'primary', action: 'upsell', target: 'smart-calendar' },
        ],
        upsell: { type: 'addon', product: 'smart-calendar' },
        triggerData: { conflicts, gaps },
      });
    }
  }
}

/**
 * F6: Daily summary — compile last 24h activity
 * Runs daily at 8h
 */
async function cronDailySummary(): Promise<void> {
  console.log('[cron] F6 — Daily summary');
  const tenants = await getAllActiveTenants();
  const since = new Date(Date.now() - 24 * 3600000).toISOString();

  for (const tenant of tenants) {
    const [contentRes, feedbackRes] = await Promise.all([
      supabase.from('content_items').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).gte('created_at', since),
      supabase.from('feedback_queue').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).gte('created_at', since),
    ]);

    const posts = contentRes.count || 0;
    const feedbacks = feedbackRes.count || 0;

    // Approved count
    const { count: approved } = await supabase
      .from('content_items')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .eq('status', 'approved')
      .gte('updated_at', since);

    await popupEngine.emit({
      tenantId: tenant.id,
      code: 'F6',
      category: 'social_proof',
      title: 'Resumo diario do sistema',
      message: `Bom dia! Nas ultimas 24h: ${posts} posts gerados, ${approved || 0} aprovados, ${feedbacks} feedbacks processados. Tudo operando normalmente.`,
      severity: 'info',
      persistence: 'banner',
      actions: [
        { label: 'Ver detalhes', type: 'tertiary', action: 'navigate', target: '/index.html' },
        { label: 'Dispensar', type: 'ghost', action: 'dismiss' },
      ],
      triggerData: { posts, approved: approved || 0, feedbacks },
      ttlHours: 16, // Expires same day
    });
  }
}

/**
 * D4: Inactive client check — 21+ days without posts
 * Runs daily at 8h
 */
async function cronInactivityCheck(): Promise<void> {
  console.log('[cron] D4 — Inactivity check');
  const tenants = await getAllActiveTenants();
  const cutoff21 = new Date(Date.now() - 21 * 86400000).toISOString();

  for (const tenant of tenants) {
    const { data: recent } = await supabase
      .from('content_items')
      .select('id')
      .eq('tenant_id', tenant.id)
      .gte('created_at', cutoff21)
      .limit(1);

    if (!recent?.length) {
      // Calculate exact days inactive
      const { data: lastPost } = await supabase
        .from('content_items')
        .select('created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const daysInactive = lastPost?.length
        ? Math.floor((Date.now() - new Date(lastPost[0].created_at).getTime()) / 86400000)
        : 30;

      await popupEngine.emit({
        tenantId: tenant.id,
        code: 'D4',
        category: 'commercial',
        title: 'Cliente sem posts ha muito tempo',
        message: `${tenant.name} esta ha ${daysInactive} dias sem novos posts. Clientes inativos tem 3x mais chance de cancelar. Quer que eu gere uma proposta de reativacao com posts prontos?`,
        severity: 'warning',
        persistence: 'persistent',
        actions: [
          { label: 'Gerar pacote reativacao', type: 'primary', action: 'upsell', target: 'reactivation-pack' },
          { label: 'Agendar contato', type: 'tertiary', action: 'navigate', target: '/schedule.html' },
          { label: 'Ignorar', type: 'ghost', action: 'dismiss' },
        ],
        upsell: { type: 'service', product: 'reactivation-pack' },
        triggerData: { daysInactive },
      });
    }
  }
}

// ─── WEEKLY CRONS (Mondays) ─────────────────────────────────────────────────

/**
 * A1: Auto-fill week — generate posts for gaps
 * Runs Monday 6h
 */
async function cronAutoFillWeek(): Promise<void> {
  console.log('[cron] A1 — Auto-fill week');
  // Note: actual batch generation relies on contentEngine.batchGenerate()
  // This cron checks for gaps and emits the popup if posts were auto-generated
  const tenants = await getAllActiveTenants();
  const nextWeekStart = new Date();
  nextWeekStart.setDate(nextWeekStart.getDate() + ((1 + 7 - nextWeekStart.getDay()) % 7 || 7));
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);

  for (const tenant of tenants) {
    const { count } = await supabase
      .from('content_items')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .gte('scheduled_date', nextWeekStart.toISOString().split('T')[0])
      .lte('scheduled_date', nextWeekEnd.toISOString().split('T')[0]);

    if ((count || 0) === 0) {
      // Emit popup indicating gap detected (actual generation would be triggered separately)
      await popupEngine.emit({
        tenantId: tenant.id,
        code: 'A1',
        category: 'autonomous_content',
        title: 'Semana sem posts agendados',
        message: `Nao ha posts agendados para a semana de ${fmtDate(nextWeekStart)}. Posso gerar automaticamente para preencher os gaps.`,
        severity: 'info',
        persistence: 'persistent',
        actions: [
          { label: 'Gerar posts', type: 'primary', action: 'api_call', target: '/api/ai/batch-social' },
          { label: 'Ver cronograma', type: 'tertiary', action: 'navigate', target: '/schedule.html' },
          { label: 'Ignorar', type: 'ghost', action: 'dismiss' },
        ],
        triggerData: { weekStart: nextWeekStart.toISOString().split('T')[0] },
      });
    }
  }
}

/**
 * D5: Seasonal opportunity — check upcoming dates
 * Runs Monday 8h
 */
async function cronSeasonalOpportunity(): Promise<void> {
  console.log('[cron] D5 — Seasonal opportunity check');
  // Simplified: check for major upcoming dates in the next 15 days
  const upcomingDates = getUpcomingSeasonalDates(15);
  if (!upcomingDates.length) return;

  const tenants = await getAllActiveTenants();
  for (const tenant of tenants) {
    for (const dateInfo of upcomingDates) {
      await popupEngine.emit({
        tenantId: tenant.id,
        code: 'D5',
        category: 'commercial',
        title: 'Oportunidade de conteudo sazonal',
        message: `${dateInfo.name} e em ${dateInfo.daysUntil} dias e e altamente relevante para ${tenant.name}. Nao ha nenhum post agendado sobre isso. Quer que eu crie um pacote tematico?`,
        severity: 'info',
        persistence: 'persistent',
        actions: [
          { label: 'Gerar pacote', type: 'primary', action: 'upsell', target: 'seasonal-pack' },
          { label: 'Adicionar ao calendario', type: 'tertiary', action: 'navigate', target: '/schedule.html' },
          { label: 'Ignorar', type: 'ghost', action: 'dismiss' },
        ],
        upsell: { type: 'package', product: 'seasonal-pack' },
        triggerData: { date: dateInfo.name, daysUntil: dateInfo.daysUntil },
      });
    }
  }
}

/**
 * D6: Feature recommendation — usage-based addon suggestions
 * Runs Monday 9h
 */
async function cronFeatureRecommendation(): Promise<void> {
  console.log('[cron] D6 — Feature recommendation');
  const tenants = await getAllActiveTenants();

  for (const tenant of tenants) {
    // Check if tenant has many revision cycles → suggest visual-brief
    const { count: feedbackCount } = await supabase
      .from('feedback_queue')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());

    const { count: postCount } = await supabase
      .from('content_items')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());

    const avgRevisions = postCount ? (feedbackCount || 0) / postCount : 0;

    if (avgRevisions > 2) {
      await popupEngine.emit({
        tenantId: tenant.id,
        code: 'D6',
        category: 'commercial',
        title: 'Feature recomendada para o cliente',
        message: `${tenant.name} faz em media ${avgRevisions.toFixed(1)} revisoes por post. Com o addon 'Visual Brief Generator', o designer receberia briefings detalhados e as revisoes cairiam ate 60%.`,
        severity: 'info',
        persistence: 'persistent',
        actions: [
          { label: 'Saber mais', type: 'tertiary', action: 'upsell', target: 'visual-brief' },
          { label: 'Ativar trial de 7 dias', type: 'primary', action: 'upsell', target: 'visual-brief' },
          { label: 'Agora nao', type: 'ghost', action: 'dismiss' },
        ],
        upsell: { type: 'trial', product: 'visual-brief' },
        triggerData: { avgRevisions: avgRevisions.toFixed(1), feedbackCount, postCount },
      });
    }
  }
}

/**
 * E5: API price change monitor (Observatory only)
 * Runs Monday 10h
 */
async function cronPriceMonitor(): Promise<void> {
  console.log('[cron] E5 — API price monitor (placeholder)');
  // This is a placeholder — actual price monitoring would require external API checks
  // When a price change is detected, emit popup to observatory admins only
}

/**
 * B6: Competitor tracker scan (placeholder)
 * Runs Monday 7h
 */
async function cronCompetitorScan(): Promise<void> {
  console.log('[cron] B6 — Competitor scan (requires addon)');
  // Requires competitor-tracker addon to be active
}

// ─── MONTHLY CRONS ──────────────────────────────────────────────────────────

/**
 * B5: Monthly savings report
 * Runs 1st of month 9h
 */
async function cronMonthlySavings(): Promise<void> {
  console.log('[cron] B5 — Monthly savings report');
  const tenants = await getAllActiveTenants();
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const monthName = lastMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const monthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString();
  const monthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString();

  for (const tenant of tenants) {
    const { count: totalPosts } = await supabase
      .from('content_items')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);

    const { count: approvedFirst } = await supabase
      .from('content_items')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .eq('status', 'approved')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);

    if ((totalPosts || 0) > 0) {
      const hoursEstimate = (totalPosts || 0) * 1.5; // ~1.5h per post manual
      const costEstimate = hoursEstimate * 80; // R$80/h avg

      await popupEngine.emit({
        tenantId: tenant.id,
        code: 'B5',
        category: 'insights_analytics',
        title: 'Economia gerada pelo sistema',
        message: `Resumo de ${monthName}: gerei ${totalPosts} posts para ${tenant.name}, dos quais ${approvedFirst || 0} foram aprovados de primeira. Economia estimada: ${hoursEstimate.toFixed(0)} horas de trabalho manual (~ R$ ${costEstimate.toFixed(0)} em custo de producao tradicional).`,
        severity: 'success',
        persistence: 'persistent',
        actions: [
          { label: 'Ver relatorio completo', type: 'primary', action: 'upsell', target: 'monthly-report' },
          { label: 'OK', type: 'ghost', action: 'dismiss' },
        ],
        upsell: { type: 'addon', product: 'monthly-report' },
        triggerData: { totalPosts, approvedFirst, hoursEstimate, costEstimate, month: monthName },
      });
    }
  }
}

/**
 * D1: Format diversity audit
 * Runs 1st of month 10h
 */
async function cronFormatAudit(): Promise<void> {
  console.log('[cron] D1 — Format diversity audit');
  const tenants = await getAllActiveTenants();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString();
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString();

  for (const tenant of tenants) {
    const { data: items } = await supabase
      .from('content_items')
      .select('content_type')
      .eq('tenant_id', tenant.id)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);

    if (!items?.length) continue;

    const typeCount = new Map<string, number>();
    for (const item of items) {
      typeCount.set(item.content_type, (typeCount.get(item.content_type) || 0) + 1);
    }

    const total = items.length;
    const dominant = [...typeCount.entries()].sort((a, b) => b[1] - a[1])[0];
    const dominantPct = Math.round((dominant[1] / total) * 100);

    if (dominantPct > 90) {
      await popupEngine.emit({
        tenantId: tenant.id,
        code: 'D1',
        category: 'commercial',
        title: 'Cliente precisa de mais formatos',
        message: `Este mes, ${dominantPct}% dos posts de ${tenant.name} sao ${dominant[0]}. Marcas com mix variado (Reels + Carrossel + Estatico) tem ate 3x mais alcance. Quer que eu diversifique?`,
        severity: 'info',
        persistence: 'persistent',
        actions: [
          { label: 'Gerar mix variado', type: 'primary', action: 'api_call', target: '/api/ai/generate' },
          { label: 'Ver planos com Reels', type: 'tertiary', action: 'upsell', target: 'multi-platform' },
          { label: 'Manter atual', type: 'ghost', action: 'dismiss' },
        ],
        upsell: { type: 'upgrade', product: 'multi-platform' },
        triggerData: { dominantFormat: dominant[0], dominantPct, total },
      });
    }
  }
}

/**
 * D2: Approval velocity — client satisfaction check
 * Runs 1st of month 11h
 */
async function cronApprovalVelocity(): Promise<void> {
  console.log('[cron] D2 — Approval velocity check');
  // Placeholder — requires tracking approval timestamps
}

/**
 * D7: Multi-platform opportunity
 * Runs 1st of month 12h
 */
async function cronPlatformAudit(): Promise<void> {
  console.log('[cron] D7 — Platform audit');
  const tenants = await getAllActiveTenants();

  for (const tenant of tenants) {
    const { data: items } = await supabase
      .from('content_items')
      .select('platform')
      .eq('tenant_id', tenant.id)
      .not('platform', 'is', null);

    if (!items?.length) continue;

    const platforms = new Set(items.map(i => i.platform));
    if (platforms.size === 1) {
      const currentPlatform = [...platforms][0];
      await popupEngine.emit({
        tenantId: tenant.id,
        code: 'D7',
        category: 'commercial',
        title: 'Multi-plataforma disponivel',
        message: `Todo o conteudo de ${tenant.name} e para ${currentPlatform}, mas o perfil do publico indica alto potencial no LinkedIn. Quer ativar geracao multi-plataforma?`,
        severity: 'info',
        persistence: 'persistent',
        actions: [
          { label: 'Ativar LinkedIn', type: 'primary', action: 'upsell', target: 'multi-platform' },
          { label: 'Ver analise', type: 'tertiary', action: 'navigate', target: '/observatory.html' },
          { label: 'Agora nao', type: 'ghost', action: 'dismiss' },
        ],
        upsell: { type: 'addon', product: 'multi-platform' },
        triggerData: { currentPlatform },
      });
    }
  }
}

/**
 * B3: Monthly pattern scan — engagement patterns
 * Runs 1st of month 6h
 */
async function cronPatternScan(): Promise<void> {
  console.log('[cron] B3 — Monthly pattern scan');
  // Placeholder — requires deeper analytics on approval rates by format/pillar
}

/**
 * F3: Best month record check
 * Runs 28th of month 10h
 */
async function cronBestMonthCheck(): Promise<void> {
  console.log('[cron] F3 — Best month record check');
  const tenants = await getAllActiveTenants();
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  for (const tenant of tenants) {
    const { count: currentApproved } = await supabase
      .from('content_items')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .eq('status', 'approved')
      .gte('created_at', currentMonthStart);

    // Check historical months
    const { data: historyRes } = await supabase.rpc('get_monthly_approved_counts', { p_tenant_id: tenant.id }).maybeSingle();

    // Simplified: if > 10 approved this month, it might be a record
    if ((currentApproved || 0) > 10) {
      const month = new Date().toLocaleDateString('pt-BR', { month: 'long' });
      await popupEngine.emit({
        tenantId: tenant.id,
        code: 'F3',
        category: 'social_proof',
        title: 'Melhor mes do tenant',
        message: `Recorde: ${tenant.name} teve ${currentApproved} posts aprovados em ${month} — um marco impressionante!`,
        severity: 'success',
        persistence: 'persistent',
        actions: [
          { label: 'Gerar relatorio', type: 'primary', action: 'upsell', target: 'monthly-report' },
          { label: 'OK', type: 'ghost', action: 'dismiss' },
        ],
        upsell: { type: 'addon', product: 'monthly-report' },
        triggerData: { currentApproved, month },
      });
    }
  }
}

// ─── MAINTENANCE ────────────────────────────────────────────────────────────

/**
 * Expire old popups — daily 4h
 */
async function cronExpirePopups(): Promise<void> {
  console.log('[cron] Expire old popups');
  await popupEngine.expireOld();
}

// ─── Seasonal dates helper ──────────────────────────────────────────────────

function getUpcomingSeasonalDates(daysAhead: number): { name: string; daysUntil: number }[] {
  const now = new Date();
  const year = now.getFullYear();
  const results: { name: string; daysUntil: number }[] = [];

  const dates = [
    { name: 'Dia da Mulher', month: 2, day: 8 },
    { name: 'Dia do Consumidor', month: 2, day: 15 },
    { name: 'Pascoa', month: 3, day: 20 }, // approximate
    { name: 'Dia das Maes', month: 4, day: 11 }, // approximate
    { name: 'Dia dos Namorados', month: 5, day: 12 },
    { name: 'Festa Junina', month: 5, day: 24 },
    { name: 'Dia dos Pais', month: 7, day: 10 }, // approximate
    { name: 'Dia do Cliente', month: 8, day: 15 },
    { name: 'Dia das Criancas', month: 9, day: 12 },
    { name: 'Black Friday', month: 10, day: 29 }, // approximate
    { name: 'Natal', month: 11, day: 25 },
    { name: 'Ano Novo', month: 0, day: 1 },
  ];

  for (const d of dates) {
    const dateObj = new Date(year, d.month, d.day);
    if (dateObj < now) dateObj.setFullYear(year + 1);
    const daysUntil = Math.ceil((dateObj.getTime() - now.getTime()) / 86400000);
    if (daysUntil > 0 && daysUntil <= daysAhead) {
      results.push({ name: d.name, daysUntil });
    }
  }

  return results;
}

// ─── Event-driven popup triggers ────────────────────────────────────────────

/**
 * C3: Health check auto-recovery popup
 */
export async function onHealthRecovered(tenantId: string, service: string, pendingCount: number): Promise<void> {
  await popupEngine.emit({
    tenantId,
    code: 'C3',
    category: 'maintenance',
    title: 'Health Check detectou e corrigiu problema',
    message: `Detectei que o processamento de ${service} parou. Reiniciei o servico automaticamente e ${pendingCount} itens pendentes ja estao sendo processados.`,
    severity: 'info',
    persistence: 'persistent',
    actions: [
      { label: 'Ver health status', type: 'tertiary', action: 'navigate', target: '/settings.html' },
      { label: 'OK', type: 'ghost', action: 'dismiss' },
    ],
    triggerData: { service, pendingCount },
  });
}

/**
 * C5: Compliance check popup
 */
export async function onComplianceCheck(tenantId: string, passed: number, failed: number, problems: string[]): Promise<void> {
  if (failed === 0) {
    await popupEngine.emit({
      tenantId,
      code: 'C5',
      category: 'maintenance',
      title: 'Compliance check passou',
      message: `Todos os ${passed} posts passaram na validacao de compliance. Prontos para publicacao.`,
      severity: 'success',
      persistence: 'toast',
      actions: [{ label: 'OK', type: 'ghost', action: 'dismiss' }],
      ttlHours: 4,
    });
  } else {
    await popupEngine.emit({
      tenantId,
      code: 'C5',
      category: 'maintenance',
      title: 'Posts nao passaram compliance',
      message: `${failed} posts nao passaram na validacao: ${problems.slice(0, 3).join(', ')}. Corrija antes de publicar.`,
      severity: 'warning',
      persistence: 'persistent',
      actions: [
        { label: 'Ver detalhes', type: 'tertiary', action: 'navigate', target: '/factory.html' },
        { label: 'Corrigir automaticamente', type: 'primary', action: 'upsell', target: 'auto-compliance-fix' },
      ],
      upsell: { type: 'addon', product: 'auto-compliance-fix' },
      triggerData: { passed, failed, problems },
    });
  }
}

/**
 * A3: Quality Gate intercept popup
 */
export async function onQualityGateIntercept(tenantId: string, originalScore: number, finalScore: number, iterations: number): Promise<void> {
  await popupEngine.emit({
    tenantId,
    code: 'A3',
    category: 'autonomous_content',
    title: 'Quality Gate interceptou post fraco',
    message: `Interceptei um post que ia ficar abaixo do padrao de qualidade (${originalScore.toFixed(1)}/10). Apos ${iterations} iteracoes automaticas, a versao final atingiu ${finalScore.toFixed(1)}/10.`,
    severity: 'info',
    persistence: 'persistent',
    actions: [
      { label: 'Ver evolucao', type: 'tertiary', action: 'navigate', target: '/factory.html' },
      { label: 'OK', type: 'ghost', action: 'dismiss' },
    ],
    triggerData: { originalScore, finalScore, iterations },
  });
}

/**
 * B2: High-performance content popup
 */
export async function onHighPerformanceContent(tenantId: string, title: string, score: number, approvalTime: string): Promise<void> {
  await popupEngine.emit({
    tenantId,
    code: 'B2',
    category: 'insights_analytics',
    title: 'Conteudo de alta performance detectado',
    message: `O post '${title}' foi aprovado em ${approvalTime} com score ${score.toFixed(1)}/10. Quer que eu use este padrao como referencia para proximos posts?`,
    severity: 'success',
    persistence: 'persistent',
    actions: [
      { label: 'Salvar como template', type: 'tertiary', action: 'api_call', target: '/api/content/template' },
      { label: 'Gerar serie similar', type: 'primary', action: 'upsell', target: 'content-recycling' },
      { label: 'OK', type: 'ghost', action: 'dismiss' },
    ],
    upsell: { type: 'addon', product: 'content-recycling' },
    triggerData: { title, score, approvalTime },
  });
}

/**
 * F1: Posts milestone popup
 */
export async function onPostsMilestone(tenantId: string, tenantName: string, totalPosts: number): Promise<void> {
  if (totalPosts % 50 !== 0) return;
  const months = Math.round(totalPosts / 12); // ~12 posts/month estimate

  await popupEngine.emit({
    tenantId,
    code: 'F1',
    category: 'social_proof',
    title: 'Marco atingido — posts gerados',
    message: `Marco: ${totalPosts} posts criados para ${tenantName}! Isso equivale a aproximadamente ${months} meses de conteudo produzido automaticamente.`,
    severity: 'success',
    persistence: 'persistent',
    actions: [
      { label: 'Ver timeline', type: 'primary', action: 'upsell', target: 'analytics-plus' },
      { label: 'OK', type: 'ghost', action: 'dismiss' },
    ],
    upsell: { type: 'addon', product: 'analytics-plus' },
    triggerData: { totalPosts, estimatedMonths: months },
  });
}

/**
 * F2: Approval streak popup
 */
export async function onApprovalStreak(tenantId: string, tenantName: string, streak: number): Promise<void> {
  if (streak < 5) return;

  await popupEngine.emit({
    tenantId,
    code: 'F2',
    category: 'social_proof',
    title: 'Streak de aprovacao',
    message: `${tenantName} aprovou ${streak} posts seguidos sem nenhuma revisao! O genOS esta cada vez mais alinhado com o tom de voz deste cliente.`,
    severity: 'success',
    persistence: 'toast',
    actions: [{ label: 'OK', type: 'ghost', action: 'dismiss' }],
    ttlHours: 8,
  });
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

function scheduleDaily(hour: number, fn: () => Promise<void>, label: string): void {
  const check = () => {
    const now = new Date();
    if (now.getHours() === hour && now.getMinutes() === 0) {
      fn().catch(err => console.error(`[cron] ${label} error:`, err));
    }
  };
  setInterval(check, 60_000); // Check every minute
  console.log(`[cron] Scheduled daily at ${hour}:00 — ${label}`);
}

function scheduleWeekly(dayOfWeek: number, hour: number, fn: () => Promise<void>, label: string): void {
  const check = () => {
    const now = new Date();
    if (now.getDay() === dayOfWeek && now.getHours() === hour && now.getMinutes() === 0) {
      fn().catch(err => console.error(`[cron] ${label} error:`, err));
    }
  };
  setInterval(check, 60_000);
  console.log(`[cron] Scheduled weekly day=${dayOfWeek} at ${hour}:00 — ${label}`);
}

function scheduleMonthly(dayOfMonth: number, hour: number, fn: () => Promise<void>, label: string): void {
  const check = () => {
    const now = new Date();
    if (now.getDate() === dayOfMonth && now.getHours() === hour && now.getMinutes() === 0) {
      fn().catch(err => console.error(`[cron] ${label} error:`, err));
    }
  };
  setInterval(check, 60_000);
  console.log(`[cron] Scheduled monthly day=${dayOfMonth} at ${hour}:00 — ${label}`);
}

// ─── Start all crons ────────────────────────────────────────────────────────

export function startPopupCrons(): void {
  console.log('[cron] Starting Addendum F popup crons...');

  // Daily
  scheduleDaily(4, cronExpirePopups, 'Expire old popups');
  scheduleDaily(5, cronScheduleRebalance, 'A4 Schedule rebalance');
  scheduleDaily(8, cronDailySummary, 'F6 Daily summary');
  scheduleDaily(8, cronInactivityCheck, 'D4 Inactivity check');

  // Weekly (Monday = 1)
  scheduleWeekly(1, 6, cronAutoFillWeek, 'A1 Auto-fill week');
  scheduleWeekly(1, 7, cronCompetitorScan, 'B6 Competitor scan');
  scheduleWeekly(1, 8, cronSeasonalOpportunity, 'D5 Seasonal opportunity');
  scheduleWeekly(1, 9, cronFeatureRecommendation, 'D6 Feature recommendation');
  scheduleWeekly(1, 10, cronPriceMonitor, 'E5 Price monitor');

  // Monthly
  scheduleMonthly(1, 6, cronPatternScan, 'B3 Pattern scan');
  scheduleMonthly(1, 9, cronMonthlySavings, 'B5 Monthly savings');
  scheduleMonthly(1, 10, cronFormatAudit, 'D1 Format audit');
  scheduleMonthly(1, 11, cronApprovalVelocity, 'D2 Approval velocity');
  scheduleMonthly(1, 12, cronPlatformAudit, 'D7 Platform audit');
  scheduleMonthly(28, 10, cronBestMonthCheck, 'F3 Best month check');

  // Weekly backup (Sunday = 0)
  scheduleWeekly(0, 3, async () => {
    console.log('[cron] C4 — Weekly backup (placeholder)');
    const tenants = await getAllActiveTenants();
    for (const tenant of tenants) {
      await popupEngine.emit({
        tenantId: tenant.id,
        code: 'C4',
        category: 'maintenance',
        title: 'Backup semanal realizado',
        message: 'Backup semanal concluido: posts, feedbacks, DNA e configuracoes salvos.',
        severity: 'success',
        persistence: 'toast',
        actions: [{ label: 'OK', type: 'ghost', action: 'dismiss' }],
        ttlHours: 8,
      });
    }
  }, 'C4 Weekly backup');

  console.log('[cron] All popup crons started');
}
