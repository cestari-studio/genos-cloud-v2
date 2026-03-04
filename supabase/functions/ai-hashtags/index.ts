import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GOOGLE_AI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

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

    const { tenant_id, content_id, caption, pillar } = await req.json();

    if (!tenant_id || !caption) {
      return new Response(JSON.stringify({ error: "tenant_id and caption required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: dna, error: dnaError } = await supabase
      .from("brand_dna")
      .select("hashtag_strategy")
      .eq("tenant_id", tenant_id)
      .single();

    if (dnaError) {
      return new Response(JSON.stringify({ error: "Brand DNA not found" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const hs = dna.hashtag_strategy || {};
    const maxHashtags = hs.max_total || hs.max_per_post || 8;
    const fixedHashtags = (hs.fixed_hashtags || hs.always_use || []).join(" ");
    const primaryPool = (hs.rotate_primary || []).join(", ");
    const secondaryPool = (hs.rotate_secondary || []).join(", ");
    const neverUse = (hs.never_use || []).join(", ");

    const systemPrompt = `You are a hashtag generator. Generate up to ${maxHashtags} hashtags for the given social media caption.

RULES:
- ALWAYS include these fixed hashtags at the beginning: ${fixedHashtags}
- Choose relevant tags from this primary pool: ${primaryPool}
- Choose relevant tags from this secondary pool: ${secondaryPool}
- NEVER use any of these: ${neverUse}
- Total count (including fixed) must not exceed ${maxHashtags}
- Output ONLY hashtags separated by spaces. Nothing else. No explanation.
- Pillar context: ${pillar || "general"}`;

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
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: `Caption:\n${caption}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
        }),
      }
    );

    const geminiData = await geminiResponse.json();
    const rawHashtags = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    const hashtags = rawHashtags.split(/\s+/).filter((h: string) => h.startsWith("#"));

    if (content_id) {
      await supabase
        .from("content_items")
        .update({ hashtags })
        .eq("id", content_id)
        .eq("tenant_id", tenant_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        hashtags,
        hashtags_text: hashtags.join(" "),
        count: hashtags.length,
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
    console.error("ai-hashtags error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
