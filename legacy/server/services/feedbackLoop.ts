// genOS Full v1.0.0 "Lumina" — feedbackLoop.ts
// Wix feedback → DB → AI processes → DB → CSV → Wix (updated)

import { supabase } from './supabaseClient';
import { generateContent } from './aiRouter';
import { checkCompliance } from './masterCompliance';

interface FeedbackItem {
  id: string;
  tenant_id: string;
  csv_slug: string;
  csv_row_id: string;
  wix_item_id: string | null;
  feedback_type: string;
  client_comment: string | null;
  client_rating: number | null;
  processing_status: string;
  content_item_id?: string | null;
}

/**
 * Process pending feedback items from the queue
 */
export async function processFeedbackQueue(tenantId: string): Promise<{
  processed: number;
  failed: number;
  skipped: number;
  results: Array<{ id: string; status: string; feedbackType: string; error?: string }>;
}> {
  // Get pending items
  const { data: items, error } = await supabase
    .from('feedback_queue')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('processing_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error || !items) {
    return { processed: 0, failed: 0, skipped: 0, results: [] };
  }

  const results: Array<{ id: string; status: string; feedbackType: string; error?: string }> = [];
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of items as FeedbackItem[]) {
    try {
      // Mark as processing
      await supabase
        .from('feedback_queue')
        .update({ processing_status: 'processing' })
        .eq('id', item.id);

      // Handle based on feedback type
      switch (item.feedback_type) {
        case 'needs_revision':
        case 'rejected':
          await handleRevisionRequest(item);
          break;
        case 'approved':
          await handleApproval(item);
          break;
        case 'comment_only':
        case 'rating_only':
          await handleComment(item);
          break;
        default:
          skipped++;
          await supabase
            .from('feedback_queue')
            .update({ processing_status: 'skipped', processed_at: new Date().toISOString() })
            .eq('id', item.id);
          results.push({ id: item.id, status: 'skipped', feedbackType: item.feedback_type });
          continue;
      }

      // Mark as completed
      await supabase
        .from('feedback_queue')
        .update({
          processing_status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      processed++;
      results.push({ id: item.id, status: 'completed', feedbackType: item.feedback_type });
    } catch (err) {
      failed++;
      await supabase
        .from('feedback_queue')
        .update({
          processing_status: 'failed',
          error_message: String(err),
        })
        .eq('id', item.id);

      results.push({ id: item.id, status: 'failed', feedbackType: item.feedback_type, error: String(err) });
    }
  }

  return { processed, failed, skipped, results };
}

/**
 * Find the content item linked to a feedback item
 * Tries: content_item_id → csv_row_id → id match
 */
async function findContentItem(item: FeedbackItem): Promise<Record<string, any> | null> {
  // Try direct content_item_id first
  if (item.content_item_id) {
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .eq('id', item.content_item_id)
      .eq('tenant_id', item.tenant_id)
      .single();
    if (data) return data;
  }

  // Then try csv_row_id as the content item id
  if (item.csv_row_id) {
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .eq('id', item.csv_row_id)
      .eq('tenant_id', item.tenant_id)
      .single();
    if (data) return data;
  }

  return null;
}

/**
 * Handle revision request: AI revises the content based on feedback
 */
async function handleRevisionRequest(item: FeedbackItem): Promise<void> {
  const contentItem = await findContentItem(item);
  if (!contentItem) {
    console.warn(`[feedbackLoop] No content item found for feedback ${item.id} (csv_row_id: ${item.csv_row_id})`);
    // Store the feedback anyway even if we can't auto-revise
    return;
  }

  // Build revision prompt with context
  const revisionPrompt = `
REVISÃO SOLICITADA pelo cliente.

CONTEÚDO ORIGINAL:
${contentItem.body || contentItem.title || '(conteúdo vazio)'}

FEEDBACK DO CLIENTE:
${item.client_comment || 'Precisa de revisão (sem comentário específico)'}

TIPO DE FEEDBACK: ${item.feedback_type}
REVISÃO #${(contentItem.revision_count || 0) + 1}

Revise o conteúdo levando em conta o feedback do cliente.
Mantenha o tom e diretrizes do Brand DNA.
Se o feedback mencionar problemas específicos, corrija-os diretamente.
Retorne APENAS o conteúdo revisado, sem explicações extras.
`;

  try {
    const aiResponse = await generateContent({
      tenantId: item.tenant_id,
      contentType: contentItem.content_type || 'social_post',
      topic: revisionPrompt,
    });

    // Run compliance check on revised content
    const compliance = await checkCompliance(
      item.tenant_id,
      aiResponse.content,
      contentItem.content_type || 'social_post'
    );

    // Update content item with revised content
    await supabase
      .from('content_items')
      .update({
        body: aiResponse.content,
        status: compliance.verdict === 'approved' ? 'approved' : 'pending_review',
        compliance_score: compliance.score,
        compliance_notes: compliance as unknown as Record<string, unknown>,
        client_comment: item.client_comment,
        revision_count: (contentItem.revision_count || 0) + 1,
        ai_provider_used: aiResponse.provider,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentItem.id);

    console.log(`[feedbackLoop] Revised content ${contentItem.id} → score: ${compliance.score}, verdict: ${compliance.verdict}`);
  } catch (aiErr) {
    // If AI fails, still store the feedback — human can handle manually
    console.error(`[feedbackLoop] AI revision failed for ${contentItem.id}: ${aiErr}`);
    await supabase
      .from('content_items')
      .update({
        client_comment: item.client_comment,
        status: 'pending_review',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentItem.id);
  }
}

/**
 * Handle approval: mark content as approved
 */
async function handleApproval(item: FeedbackItem): Promise<void> {
  const contentItem = await findContentItem(item);
  const targetId = contentItem?.id || item.csv_row_id;

  if (!targetId) return;

  await supabase
    .from('content_items')
    .update({
      status: 'approved',
      client_feedback: 'approved',
      client_comment: item.client_comment || undefined,
      client_rating: item.client_rating,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetId)
    .eq('tenant_id', item.tenant_id);

  console.log(`[feedbackLoop] Approved content ${targetId}`);
}

/**
 * Handle comment: store feedback without revision
 */
async function handleComment(item: FeedbackItem): Promise<void> {
  const contentItem = await findContentItem(item);
  const targetId = contentItem?.id || item.csv_row_id;

  if (!targetId) return;

  await supabase
    .from('content_items')
    .update({
      client_comment: item.client_comment,
      client_rating: item.client_rating,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetId)
    .eq('tenant_id', item.tenant_id);

  console.log(`[feedbackLoop] Stored comment for ${targetId}`);
}
