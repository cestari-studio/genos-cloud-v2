import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    const url = new URL(req.url);

    // Webhook verification (GET)
    if (req.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
            return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
    }

    // Webhook events (POST)
    try {
        const body = await req.json();
        console.log("WA Webhook received:", JSON.stringify(body, null, 2));

        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        if (message?.type === "interactive") {
            const buttonReply = message.interactive?.button_reply;
            const [action, postId] = buttonReply?.id?.split(":") || [];

            if (postId && (action === "APPROVE" || action === "REJECT")) {
                const supabaseClient = createClient(
                    Deno.env.get("SUPABASE_URL") ?? "",
                    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
                );

                const status = action === "APPROVE" ? "approved" : "rejected";
                await supabaseClient.from("posts").update({ status }).eq("id", postId);
                console.log(`[WA-WEBHOOK] Post ${postId} set to ${status}`);
            }
        }

        return new Response("OK", { status: 200 });
    } catch (e: any) {
        console.error("WA Webhook Error:", e.message);
        return new Response("Error", { status: 400 });
    }
});
