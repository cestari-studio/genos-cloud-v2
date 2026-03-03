import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) throw new Error('Unauthorized');

        const body = await req.json();
        const { action, tenantId, packageId, purchaseId, customTokens, customPosts, reason, status } = body;

        if (!action) throw new Error('Action is required');

        let result: any = null;

        switch (action) {
            case 'list_packages': {
                const { data, error } = await supabaseAdmin.from('addon_packages')
                    .select('*')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });
                if (error) throw error;
                result = data;
                break;
            }

            case 'request_purchase': {
                if (!tenantId) throw new Error('tenantId is required');

                let tokens = customTokens;
                let posts = customPosts;
                let price = 0;

                if (packageId) {
                    const { data: pkg, error: pkgErr } = await supabaseAdmin.from('addon_packages').select('*').eq('id', packageId).single();
                    if (pkgErr || !pkg) throw new Error('Package not found');
                    tokens = pkg.tokens;
                    posts = pkg.posts;
                    price = pkg.price_cents;
                } else {
                    // Verify if user is master to allow custom requests
                    const { data: member } = await supabaseAdmin.from('tenant_members').select('role').eq('user_id', user.id).eq('tenant_id', tenantId).maybeSingle();
                    if (member?.role !== 'master') throw new Error('Only Master can request custom packages');
                }

                const { data: purchase, error: insertErr } = await supabaseAdmin.from('addon_purchases').insert({
                    tenant_id: tenantId,
                    package_id: packageId || null,
                    tokens_purchased: tokens,
                    posts_purchased: posts,
                    price_paid_cents: price,
                    purchased_by: user.id,
                    status: 'pending'
                }).select().single();

                if (insertErr) throw insertErr;

                await supabaseAdmin.from('popup_events').insert({
                    tenant_id: tenantId, popup_code: 'purchase_requested', category: 'billing', title: 'Pedido de Pacote',
                    message: `O pedido do pacote de ${tokens} tokens foi enviado para aprovação.`,
                    severity: 'info', persistence: 'toast'
                });

                result = purchase;
                break;
            }

            case 'approve_purchase': {
                if (!purchaseId) throw new Error('purchaseId is required');

                // Ensure user is master or agency for this tenant
                const { data: purchase } = await supabaseAdmin.from('addon_purchases').select('tenant_id, status').eq('id', purchaseId).single();
                if (!purchase) throw new Error('Purchase not found');
                if (purchase.status !== 'pending') throw new Error(`Purchase is already ${purchase.status}`);

                const { data: member } = await supabaseAdmin.from('tenant_members').select('role').eq('user_id', user.id).eq('tenant_id', purchase.tenant_id).maybeSingle();
                if (member?.role !== 'master' && member?.role !== 'agency') throw new Error('Unauthorized to approve');

                // Approve
                const { error: updErr } = await supabaseAdmin.from('addon_purchases').update({
                    status: 'approved', approved_by: user.id
                }).eq('id', purchaseId);

                if (updErr) throw updErr;

                // Apply
                const { error: rpcErr } = await supabaseAdmin.rpc('apply_addon_package', { p_purchase_id: purchaseId });
                if (rpcErr) throw rpcErr;

                await supabaseAdmin.from('popup_events').insert({
                    tenant_id: purchase.tenant_id, popup_code: 'purchase_approved', category: 'billing', title: 'Pacote Aprovado!',
                    message: 'Os tokens e posts do pacote foram creditados.',
                    severity: 'success', persistence: 'persistent'
                });

                result = { success: true, purchaseId };
                break;
            }

            case 'reject_purchase': {
                if (!purchaseId) throw new Error('purchaseId is required');

                const { data: purchase } = await supabaseAdmin.from('addon_purchases').select('tenant_id, status').eq('id', purchaseId).single();
                if (!purchase) throw new Error('Purchase not found');

                const { data: member } = await supabaseAdmin.from('tenant_members').select('role').eq('user_id', user.id).eq('tenant_id', purchase.tenant_id).maybeSingle();
                if (member?.role !== 'master' && member?.role !== 'agency') throw new Error('Unauthorized to reject');

                const { error: updErr } = await supabaseAdmin.from('addon_purchases').update({
                    status: 'rejected', approved_by: user.id
                }).eq('id', purchaseId);

                if (updErr) throw updErr;

                await supabaseAdmin.from('popup_events').insert({
                    tenant_id: purchase.tenant_id, popup_code: 'purchase_rejected', category: 'billing', title: 'Pedido Rejeitado',
                    message: `Seu pedido de pacote foi rejeitado. Motivo: ${reason || 'Não informado'}`,
                    severity: 'error', persistence: 'toast'
                });

                result = { success: true, purchaseId };
                break;
            }

            case 'get_purchases': {
                if (!tenantId) throw new Error('tenantId is required');
                let query = supabaseAdmin.from('addon_purchases').select('*, addon_packages(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false });
                if (status) query = query.eq('status', status);
                const { data, error } = await query;
                if (error) throw error;
                result = data;
                break;
            }

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error: any) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
