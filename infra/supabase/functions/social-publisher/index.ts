import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Interface esperada para o disparo
interface PublishRequest {
    queue_ids?: string[]; // Para forçar disparo manual
    run_all_pending?: boolean; // Para o pg_cron disparar tudo que tá na hora
}

serve(async (req: any) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Precisa de service_role para ler a fila toda no cron
        );

        const body: PublishRequest = await req.json().catch(() => ({}));
        let query = supabaseAdmin.from('social_posts_queue').select('*, matrix_assets(content, title)').eq('status', 'scheduled');

        // Se vem do cron, pegamos apenas os que a data de agendamento já passou
        if (body.run_all_pending) {
            query = query.lte('scheduled_for', new Date().toISOString());
        } else if (body.queue_ids && body.queue_ids.length > 0) {
            query = query.in('id', body.queue_ids);
        } else {
            return new Response(JSON.stringify({ message: "No execution target provided." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        const { data: queueItems, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        if (!queueItems || queueItems.length === 0) {
            return new Response(JSON.stringify({ message: "No items ready to publish." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const results = [];

        // Processamento da fila
        for (const item of queueItems) {
            try {
                // Marca como publicando para lock otimista (caso rodem múltiplas functions simultâneas)
                await supabaseAdmin.from('social_posts_queue').update({ status: 'publishing' }).eq('id', item.id);

                const platform = item.platform; // 'linkedin', 'instagram', 'twitter'
                const contentBody = item.matrix_assets?.content || 'Empty Content Fallback';

                // --- 🔒 Vault Credentials ---
                // Aqui buscaríamos o Token mapeado do tenant no Supabase Vault. 
                // Ex: supabaseAdmin.rpc('get_decrypted_secret', { secret_name: `linkedin_token_${item.tenant_id}` })

                // Simulando delay de API das redes sociais
                await new Promise(r => setTimeout(r, 1500));

                // Mock API Response
                const externalId = `mock_${platform}_${Date.now()}`;
                const externalUrl = `https://${platform}.com/post/${externalId}`;

                // Atualiza fila como publicado
                await supabaseAdmin.from('social_posts_queue').update({
                    status: 'published',
                    published_at: new Date().toISOString(),
                    external_post_id: externalId,
                    external_post_url: externalUrl
                }).eq('id', item.id);

                // Atualiza o Ativo na Matrix para Final Asset
                await supabaseAdmin.from('matrix_assets').update({
                    status: 'final_asset'
                }).eq('id', item.asset_id);

                results.push({ id: item.id, status: 'success', externalUrl });

            } catch (err: any) {
                console.error(`Failed to publish item ${item.id}:`, err);
                // Falha: devolve pra fila ou marca com erro
                await supabaseAdmin.from('social_posts_queue').update({
                    status: 'failed',
                    error_log: err.message
                }).eq('id', item.id);

                results.push({ id: item.id, status: 'error', reason: err.message });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            processed: results.length,
            results
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('Social Publisher failed:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
