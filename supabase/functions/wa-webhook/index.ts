// WHATSAPP READY — NÃO ATIVAR
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
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
        const payload = await req.json();
        console.log("WA Webhook received:", payload);

        // TODO: Parsea payload, valida assinatura HMAC, log em wa_events
        // return new Response("OK", { status: 200 });
    } catch (e) {
        return new Response("Error", { status: 400 });
    }

    return new Response("Method not allowed", { status: 405 });
});
