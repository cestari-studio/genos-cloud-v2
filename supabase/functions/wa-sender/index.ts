// WHATSAPP READY — NÃO ATIVAR
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
    // TODO: Implementar envio via Meta Cloud API
    // 1. send_template
    // 2. send_interactive
    // 3. send_text
    return new Response(JSON.stringify({ status: "stub", message: "WhatsApp sender not active" }), {
        headers: { "Content-Type": "application/json" },
    });
});
