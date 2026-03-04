import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const GOOGLE_AI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface GenerateRequest {
  tenant_id: string;
  prompt_name?: string;
  content_type: string;
  pillar?: string;
  user_input: string;
  platform?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "https://app.cestari.studio",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: GenerateRequest = await req.json();
    const { tenant_id, prompt_name, content_type, pillar, user_input, platform } = body;

    if (!tenant_id || !user_input) {
      return new Response(JSON.stringify({ error: "tenant_id and user_input are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: envelope, error: envError } = await supabase
      .rpc("build_agent_envelope", {
        p_tenant_id: tenant_id,
        p_prompt_name: prompt_name || null,
      });

    if (envError) {
      console.error("Envelope error:", envError);
      return new Response(JSON.stringify({ error: "Access denied or tenant not found", details: envError.message }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const model = envelope.system_prompt?.model || "claude";
    const temperature = envelope.system_prompt?.temperature || 0.7;
    const systemPrompt = envelope.system_prompt?.content || "You are a helpful content creation assistant.";

    const brandContext = buildBrandContext(envelope.brand_dna);
    const complianceContext = buildComplianceContext(envelope.compliance_rules);
    const fullSystemPrompt = `${systemPrompt}\n\n## Brand DNA (Injetado pelo Agent Envelope)\n${brandContext}\n\n## Compliance Rules\n${complianceContext}`;

    let aiResponse: string;
    let tokensUsed = 0;
    let modelUsed: string;

    if (model === "gemini" || model === "gemini-2.0-flash") {
      const geminiKey = Deno.env.get("GOOGLE_AI_API_KEY");
      if (!geminiKey) {
        return new Response(JSON.stringify({ error: "Gemini API key not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const geminiResponse = await fetch(
        `${GOOGLE_AI_URL}/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: fullSystemPrompt }] },
            contents: [{ parts: [{ text: user_input }] }],
            generationConfig: { temperature, maxOutputTokens: 2048 },
          }),
        }
      );

      const geminiData = await geminiResponse.json();
      aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      tokensUsed = geminiData.usageMetadata?.totalTokenCount || 0;
      modelUsed = "gemini-2.0-flash";

    } else {
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicKey) {
        return new Response(JSON.stringify({ error: "Anthropic API key not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const claudeResponse = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 2048,
          temperature,
          system: fullSystemPrompt,
          messages: [{ role: "user", content: user_input }],
        }),
      });

      const claudeData = await claudeResponse.json();
      aiResponse = claudeData.content?.[0]?.text || "";
      tokensUsed = (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);
      modelUsed = "claude-sonnet-4-5-20250929";
    }

    // Append fixed_description_footer if present in Brand DNA
    const footer = envelope.brand_dna?.content_rules?.fixed_description_footer;
    if (footer && !aiResponse.includes(footer)) {
      aiResponse = `${aiResponse}\n\n${footer}`.trim();
    }

    const { data: session, error: sessionError } = await supabase
      .from("ai_sessions")
      .insert({
        tenant_id,
        user_id: user.id,
        session_type: "content_generation",
        model_used: modelUsed,
        system_prompt_id: envelope.system_prompt?.id || null,
        messages: [
          { role: "user", content: user_input },
          { role: "assistant", content: aiResponse },
        ],
        context: { pillar, platform, content_type },
        tokens_used: tokensUsed,
        status: "completed",
      })
      .select("id")
      .single();

    const { data: contentItem, error: contentError } = await supabase
      .from("content_items")
      .insert({
        tenant_id,
        content_type: content_type || "social_post",
        body: aiResponse,
        platform: platform || "instagram",
        pillar: pillar || null,
        status: "draft",
        ai_session_id: session?.id || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    await supabase.from("activity_log").insert({
      tenant_id,
      user_id: user.id,
      action: "content.generated",
      resource_type: "content_items",
      resource_id: contentItem?.id || null,
      metadata: {
        model: modelUsed,
        tokens: tokensUsed,
        pillar,
        content_type,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        content: aiResponse,
        content_id: contentItem?.id,
        session_id: session?.id,
        model_used: modelUsed,
        tokens_used: tokensUsed,
        status: "draft",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "https://app.cestari.studio",
        },
      }
    );

  } catch (error) {
    console.error("ai-generate error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

function buildBrandContext(dna: any): string {
  if (!dna) return "No brand DNA configured.";
  const sections: string[] = [];

  if (dna.industry) sections.push(`### Industria\n${dna.industry}`);
  if (dna.brand_story) sections.push(`### Brand Story\n${dna.brand_story}`);

  if (dna.voice_tone) {
    const vt = dna.voice_tone;
    sections.push(`### Tom de Voz\n- Primario: ${vt.primary || "N/A"}\n- Secundario: ${vt.secondary || "N/A"}\n- Terciario: ${vt.tertiary || "N/A"}`);
    if (dna.voice_description) sections.push(`- Descricao: ${dna.voice_description}`);
  }

  if (dna.personality_traits && Array.isArray(dna.personality_traits)) {
    sections.push(`### Personalidade\n${dna.personality_traits.map((t: string) => `- ${t}`).join("\n")}`);
  }

  if (dna.forbidden_words && Array.isArray(dna.forbidden_words) && dna.forbidden_words.length > 0) {
    sections.push(`### Palavras Proibidas (NUNCA USE)\n${dna.forbidden_words.join(", ")}`);
  }

  if (dna.brand_values && Array.isArray(dna.brand_values)) {
    sections.push(`### Valores da Marca\n${dna.brand_values.map((v: string) => `- ${v}`).join("\n")}`);
  }

  if (dna.hashtag_strategy) {
    const hs = dna.hashtag_strategy;
    sections.push(`### Hashtags\n- Maximo: ${hs.max_total || 8}\n- Sempre usar: ${(hs.fixed_hashtags || []).join(", ")}`);
  }

  if (dna.char_limits) {
    sections.push(`### Limites de Caracteres (Use apenas como referencia maxima)\n${JSON.stringify(dna.char_limits)}`);
  }

  if (dna.target_audience_v2) {
    sections.push(`### Publico-alvo\n${JSON.stringify(dna.target_audience_v2)}`);
  }

  return sections.join("\n\n");
}

function buildComplianceContext(rules: any[]): string {
  if (!rules || rules.length === 0) return "No compliance rules configured.";
  const sections: string[] = ["Valide o conteudo gerado contra estas regras:"];
  for (const rule of rules) {
    const config = rule.rule_config || {};
    sections.push(`- [${rule.severity?.toUpperCase() || "WARNING"}] ${rule.rule_type}: ${JSON.stringify(config)}`);
  }
  return sections.join("\n");
}
