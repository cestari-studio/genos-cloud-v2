import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateObject } from 'https://esm.sh/ai@3.3.37';
import { anthropic } from 'https://esm.sh/@ai-sdk/anthropic@0.0.39';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: any) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: { headers: { Authorization: req.headers.get('Authorization')! } }
            }
        );

        const { assetId, content, targetLanguage, brandRules } = await req.json();

        if (!assetId || !content) {
            throw new Error("Missing assetId or content");
        }

        // 1) Evaluate the content using Claude Haiku or Sonnet for quick compliance check
        const schema = z.object({
            compliant: z.boolean().describe("True if the content respects the brand rules and language without major hallucinations or toxicity."),
            q_score: z.number().min(0).max(100).describe("Quality score from 0 to 100 based on grammar, tone, and brand alignment."),
            violations: z.array(z.string()).describe("List of explicit violations of brand rules or major errors, empty if none."),
            suggested_edits: z.string().describe("Suggested diff or rewrites to fix any minor or major issues. Empty if perfect.")
        });

        const model = anthropic('claude-3-haiku-20240307');

        const res = await generateObject({
            model,
            schema,
            system: `You are the genOS™ QualityGate Auditor.
Your job is to act as a strict review heuristic.
Evaluate the provided content against the brand rules and target language.
Be ruthless with Q-Score. If it sounds repetitive, lower it. If it hallucinates facts, lower it heavily.
Rules:
- Must be in ${targetLanguage || 'the requested language'}
- Brand Rules: ${brandRules || 'Maintain a professional B2B tone'}
Respond ONLY with the requested JSON.`,
            prompt: `Evaluate this content:\n\n"${content}"`
        });

        const auditResult = res.object;

        // Se a nota for maior que 85 e não houver violações, aprovamos automaticamente se configurado (futuro).
        // Por enquanto, atualiza o status para "needs_review" (QualityGate manual)
        const newStatus = auditResult.compliant && auditResult.q_score >= 85 ? 'approved_by_ai' : 'needs_review';

        // Convert to standard status in UI (either needs_review or approved if fully autonomous)
        const finalStatus = auditResult.q_score >= 90 ? 'approved' : 'needs_review';

        const complianceNotes = auditResult.violations.length > 0
            ? `Violations: ${auditResult.violations.join('; ')}`
            : `Q-Score: ${auditResult.q_score}/100. ${auditResult.suggested_edits ? 'Notes: ' + auditResult.suggested_edits : 'LGTM.'}`;

        const { error: updateError } = await supabaseClient
            .from('matrix_assets')
            .update({
                status: finalStatus,
                compliance_notes: complianceNotes,
            })
            .eq('id', assetId);

        if (updateError) {
            console.error("Failed to update matrix_asset status", updateError);
        }

        return new Response(JSON.stringify({
            success: true,
            assetId,
            auditResult,
            finalStatus
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('Compliance Auditor failed:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
