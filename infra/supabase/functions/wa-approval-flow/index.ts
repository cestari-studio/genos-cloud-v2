// WHATSAPP READY — NÃO ATIVAR
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
    // TODO: Fluxo de aprovação via botões de mensagem WhatsApp
    // 1. Recebe gatilho de post criado
    // 2. Envia template para aprovador
    // 3. Aguarda clique no botão via webhook
    return new Response(JSON.stringify({ status: "stub" }), {
        headers: { "Content-Type": "application/json" },
    });
});
