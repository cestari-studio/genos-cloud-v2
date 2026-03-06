import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
        console.log("Iniciando processamento de billing mensal de agendamento...");

        // 1. Buscar todos os tenants com agendamento habilitado
        const { data: tenants, error: fetchErr } = await supabaseAdmin
            .from('tenant_config')
            .select('tenant_id, schedule_tier, schedule_price_cents, schedule_post_limit')
            .eq('schedule_enabled', true);

        if (fetchErr) throw fetchErr;

        const results = [];
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const isoMonth = monthStart.toISOString().split('T')[0];

        for (const config of tenants) {
            try {
                // a) Criar novo registro em schedule_usage_log para o novo mês
                await supabaseAdmin.from('schedule_usage_log').upsert({
                    tenant_id: config.tenant_id,
                    billing_month: isoMonth,
                    scheduled_count: 0,
                    published_count: 0,
                    failed_count: 0
                }, { onConflict: 'tenant_id, billing_month' });

                // b) Gerar evento de faturamento (billing_events)
                const { error: billErr } = await supabaseAdmin.from('billing_events').insert({
                    tenant_id: config.tenant_id,
                    event_type: 'schedule_monthly',
                    amount_cents: config.schedule_price_cents || 29000,
                    billing_month: isoMonth,
                    status: 'pending'
                });

                if (billErr) throw billErr;

                // c) Log Activity
                await supabaseAdmin.from('activity_log').insert({
                    tenant_id: config.tenant_id,
                    category: 'commercial',
                    summary: `Ciclo mensal de agendamento iniciado (${config.schedule_tier})`,
                    detail: `Valor: R$ ${(config.schedule_price_cents / 100).toFixed(2)}, Limite: ${config.schedule_post_limit} posts`
                });

                results.push({ tenantId: config.tenant_id, success: true });

            } catch (tenantErr: any) {
                console.error(`Erro no billing do tenant ${config.tenant_id}:`, tenantErr.message);
                results.push({ tenantId: config.tenant_id, success: false, error: tenantErr.message });
            }
        }

        return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
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
