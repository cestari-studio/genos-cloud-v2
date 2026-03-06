import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
        // 1. SELECT slots WHERE status = 'queued' AND scheduled_at <= now()
        const { data: slots, error: fetchErr } = await supabaseAdmin
            .from('schedule_slots')
            .select('*')
            .eq('status', 'queued')
            .lte('scheduled_at', new Date().toISOString())
            .limit(10); // Process batch of 10

        if (fetchErr) throw fetchErr;
        if (!slots || slots.length === 0) {
            return new Response(JSON.stringify({ message: 'No slots to process' }), { status: 200 });
        }

        const results = [];

        for (const slot of slots) {
            try {
                // a) Atualizar status → 'processing'
                await supabaseAdmin.from('schedule_slots').update({ status: 'processing' }).eq('id', slot.id);

                // b) Simulação de publicação (Meta Integration Placeholder)
                // Em um cenário real, aqui chamaríamos a API do Facebook/Instagram
                console.log(`Processando slot ${slot.id} para plataforma ${slot.platform}...`);

                // MOCK SUCCESS
                const mockExternalId = `ext_${Math.random().toString(36).substr(2, 9)}`;

                // c) Atualizar status final
                const { error: finalUpdErr } = await supabaseAdmin.from('schedule_slots').update({
                    status: 'published',
                    published_at: new Date().toISOString(),
                    external_post_id: mockExternalId
                }).eq('id', slot.id);

                if (finalUpdErr) throw finalUpdErr;

                // d) Atualizar schedule_usage_log (published_count)
                const monthDate = new Date(slot.scheduled_at);
                monthDate.setDate(1);
                monthDate.setHours(0, 0, 0, 0);

                await supabaseAdmin.rpc('increment_published_count', {
                    p_tenant_id: slot.tenant_id,
                    p_month: monthDate.toISOString().split('T')[0]
                });

                // e) Log Activity
                await supabaseAdmin.from('activity_log').insert({
                    tenant_id: slot.tenant_id,
                    category: 'content',
                    summary: `Post publicado via agendamento (${slot.platform})`,
                    detail: `Slot ID: ${slot.id}, Externo: ${mockExternalId}`
                });

                results.push({ slotId: slot.id, success: true });

            } catch (slotError: any) {
                console.error(`Erro ao processar slot ${slot.id}:`, slotError.message);

                // Retry logic
                const newRetryCount = (slot.retry_count || 0) + 1;
                const finalStatus = newRetryCount >= 3 ? 'failed' : 'queued';

                await supabaseAdmin.from('schedule_slots').update({
                    status: finalStatus,
                    retry_count: newRetryCount,
                    last_error: slotError.message
                }).eq('id', slot.id);

                if (finalStatus === 'failed') {
                    // Update usage log for failure
                    const monthDate = new Date(slot.scheduled_at);
                    monthDate.setDate(1);
                    monthDate.setHours(0, 0, 0, 0);
                    await supabaseAdmin.rpc('increment_failed_count', {
                        p_tenant_id: slot.tenant_id,
                        p_month: monthDate.toISOString().split('T')[0]
                    });
                }

                results.push({ slotId: slot.id, success: false, error: slotError.message });
            }
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
