// WHATSAPP READY — NÃO ATIVAR
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
    try {
        const { to, templateName, components, languageCode = "pt_BR" } = await req.json();

        const PHONE_NUMBER_ID = Deno.env.get("WA_PHONE_NUMBER_ID");
        const ACCESS_TOKEN = Deno.env.get("WA_ACCESS_TOKEN");

        if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
            throw new Error("WhatsApp credentials not found");
        }

        const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "template",
                template: {
                    name: templateName,
                    language: { code: languageCode },
                    components: components || []
                }
            }),
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" },
            status: response.status
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
            headers: { "Content-Type": "application/json" },
            status: 500
        });
    }
});
