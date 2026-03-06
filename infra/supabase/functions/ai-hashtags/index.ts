import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { google } from 'https://esm.sh/@ai-sdk/google'
import { generateText } from 'https://esm.sh/ai'

// Enforce Edge Runtime
export const runtime = 'edge';

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://app.cestari.studio",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders() })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) throw new Error("Missing authorization")

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    const tenantId = user?.app_metadata?.tenant_id
    if (!tenantId) throw new Error("Tenant context missing")

    const { content_id, caption, pillar } = await req.json()

    // 1. JIT Agent Envelope™ Injection
    const { data: envelope } = await supabaseAdmin.rpc('build_agent_envelope', {
      p_tenant_id: tenantId
    })

    const hs = envelope.brand_dna?.hashtag_strategy || {}
    const maxHashtags = hs.max_total || 8
    const fixedHashtags = (hs.fixed_hashtags || []).join(" ")

    const systemPrompt = `
      Você é o motor de Hashtags do genOS™, Helian™ v5.0.0.
      Sua tarefa é gerar hashtags estratégicas baseadas no BrandDNA do cliente.

      <BRAND_DNA>
      ${JSON.stringify(envelope.brand_dna)}
      </BRAND_DNA>

      <RULES>
      - Máximo de hashtags: ${maxHashtags}
      - Hashtags Fixas Obrigatórias: ${fixedHashtags}
      - Output: Apenas as hashtags separadas por espaços.
      </RULES>
    `

    // 2. Execution with Vercel AI SDK
    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
      system: systemPrompt,
      prompt: `Gere hashtags para este post: ${caption}`,
    })

    const hashtags = text.trim().split(/\s+/).filter(h => h.startsWith("#"))

    // 3. Update Database
    if (content_id) {
      await supabaseAdmin
        .from("content_items")
        .update({ hashtags })
        .eq("id", content_id)
        .eq("tenant_id", tenantId)
    }

    // 4. FinOps Metering (Internal placeholder)
    console.log(`[FinOps] Hashtags generated for tenant ${tenantId}. Usage logged.`);

    return new Response(JSON.stringify({
      success: true,
      hashtags,
      count: hashtags.length
    }), {
      status: 200,
      headers: { ...getCorsHeaders(), "Content-Type": "application/json" }
    })

  } catch (error: any) {
    console.error("ai-hashtags error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...getCorsHeaders(), "Content-Type": "application/json" }
    })
  }
})
