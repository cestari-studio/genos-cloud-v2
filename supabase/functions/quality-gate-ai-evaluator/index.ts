// genOS — quality-gate-ai-evaluator
// Analyzes post content against Brand DNA for tone adherence and brand voice scoring
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = "gemini-2.0-flash";

interface ToneAdherence {
    score: number;           // 0-100
    analysis: string;
    detected_tone: string;
    expected_tone: string;
    suggestions: string[];
}

interface BrandVoiceScore {
    score: number;           // 0-100
    keyword_usage: { keyword: string; found: boolean }[];
    pillar_alignment: { pillar: string; score: number }[];
}

interface AIEvaluationResult {
    tone_adherence: ToneAdherence;
    brand_voice_score: BrandVoiceScore;
    overall_ai_score: number;
    tokens_used: number;
}

async function callGemini(prompt: string): Promise<{ content: string; tokens_used: number }> {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1024,
                    responseMimeType: "application/json",
                },
            }),
        }
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error: ${err}`);
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const tokens_used = data.usageMetadata?.totalTokenCount ?? 0;
    return { content, tokens_used };
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Auth
        const authHeader = req.headers.get("Authorization") ?? "";
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { post_id, tenant_id } = await req.json();
        if (!post_id || !tenant_id) {
            return new Response(JSON.stringify({ error: "post_id and tenant_id are required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 1. Fetch post + Brand DNA
        const [{ data: post }, { data: brandDna }] = await Promise.all([
            supabase.from("posts")
                .select("id, title, description, hashtags, cta, format")
                .eq("id", post_id)
                .single(),
            supabase.from("brand_dnas")
                .select("persona_name, voice_tone, voice_description, target_audience, editorial_pillars, brand_values, forbidden_words")
                .eq("tenant_id", tenant_id)
                .maybeSingle(),
        ]);

        if (!post) {
            return new Response(JSON.stringify({ error: "Post not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 2. Build Gemini prompt
        const postContent = [
            post.title,
            post.description,
            post.hashtags,
            post.cta,
        ].filter(Boolean).join("\n\n");

        const dnaContext = brandDna ? `
Brand DNA Context:
- Persona: ${brandDna.persona_name || "Not defined"}
- Voice Tone: ${brandDna.voice_tone || "Not defined"}
- Voice Description: ${brandDna.voice_description || "Not defined"}
- Target Audience: ${brandDna.target_audience || "Not defined"}
- Editorial Pillars: ${(brandDna.editorial_pillars || []).join(", ") || "Not defined"}
- Brand Values: ${(brandDna.brand_values || []).join(", ") || "Not defined"}
- Forbidden Words: ${(brandDna.forbidden_words || []).join(", ") || "None"}
` : "Brand DNA: Not configured for this workspace.";

        const prompt = `You are a brand voice and content quality analyst for a Brazilian social media agency.

Analyze the following post content against the brand DNA and return a JSON evaluation.

POST CONTENT:
Format: ${post.format}
${postContent}

${dnaContext}

Return ONLY valid JSON (no markdown, no code fences) in this exact structure:
{
  "tone_adherence": {
    "score": <number 0-100>,
    "analysis": "<one paragraph explaining tone adherence>",
    "detected_tone": "<detected tone in post>",
    "expected_tone": "<expected tone from DNA>",
    "suggestions": ["<suggestion 1>", "<suggestion 2>"]
  },
  "brand_voice_score": {
    "score": <number 0-100>,
    "keyword_usage": [
      { "keyword": "<brand value or pillar>", "found": <true|false> }
    ],
    "pillar_alignment": [
      { "pillar": "<editorial pillar>", "score": <number 0-100> }
    ]
  }
}

Score 0 = completely misaligned, 100 = perfect alignment.
Be strict but fair. Consider language (pt-BR), tone, vocabulary, and brand values.`;

        // 3. Call Gemini
        const { content: rawJson, tokens_used } = await callGemini(prompt);

        let aiResult: Omit<AIEvaluationResult, "overall_ai_score" | "tokens_used">;
        try {
            aiResult = JSON.parse(rawJson);
        } catch {
            throw new Error(`Invalid JSON from Gemini: ${rawJson.substring(0, 200)}`);
        }

        const overall_ai_score = Math.round(
            (aiResult.tone_adherence.score * 0.5) + (aiResult.brand_voice_score.score * 0.5)
        );

        // 4. Get or create quality evaluation record
        const { data: existingEval } = await supabase
            .from("quality_evaluations")
            .select("id")
            .eq("post_id", post_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        let evaluationId = existingEval?.id;
        if (!evaluationId) {
            const { data: newEval } = await supabase
                .from("quality_evaluations")
                .insert({ post_id, tenant_id, overall_score: overall_ai_score, status: "pending", evaluated_by: user.id })
                .select("id")
                .single();
            evaluationId = newEval?.id;
        }

        // 5. Insert/upsert AI constraint results
        const aiConstraintResults = [
            {
                evaluation_id: evaluationId,
                rule_id: null,
                passed: aiResult.tone_adherence.score >= 60,
                rule_type: "tone_adherence",
                actual_value: aiResult.tone_adherence.detected_tone,
                expected_value: aiResult.tone_adherence.expected_tone,
                severity: aiResult.tone_adherence.score < 40 ? "violation" : aiResult.tone_adherence.score < 60 ? "warning" : "info",
                detail: aiResult.tone_adherence.analysis,
                ai_metadata: {
                    score: aiResult.tone_adherence.score,
                    suggestions: aiResult.tone_adherence.suggestions,
                },
            },
            {
                evaluation_id: evaluationId,
                rule_id: null,
                passed: aiResult.brand_voice_score.score >= 60,
                rule_type: "brand_voice_score",
                actual_value: `${aiResult.brand_voice_score.score}`,
                expected_value: ">=60",
                severity: aiResult.brand_voice_score.score < 40 ? "violation" : aiResult.brand_voice_score.score < 60 ? "warning" : "info",
                detail: `Brand voice alignment: ${aiResult.brand_voice_score.score}/100`,
                ai_metadata: {
                    keyword_usage: aiResult.brand_voice_score.keyword_usage,
                    pillar_alignment: aiResult.brand_voice_score.pillar_alignment,
                },
            },
        ];

        // Delete existing AI results for this evaluation before re-inserting
        if (evaluationId) {
            await supabase
                .from("constraint_results")
                .delete()
                .eq("evaluation_id", evaluationId)
                .in("rule_type", ["tone_adherence", "brand_voice_score"]);

            await supabase.from("constraint_results").insert(aiConstraintResults);
        }

        // 6. Log token usage
        await supabase.from("usage_logs").insert({
            tenant_id,
            operation: "quality_gate_ai",
            format: post.format,
            cost: Math.ceil(tokens_used / 100), // convert raw tokens to cost units
            metadata: { post_id, model: GEMINI_MODEL, raw_tokens: tokens_used },
        });

        const result: AIEvaluationResult = {
            ...aiResult,
            overall_ai_score,
            tokens_used,
        };

        return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("quality-gate-ai-evaluator error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
