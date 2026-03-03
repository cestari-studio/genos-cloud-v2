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
        const { action, tenantId, packageId, purchaseId, customTokens, customPosts, reason, status, sub_action, package_data, payment_reference } = body;

        if (!action) throw new Error('Action is required');

        let result: any = null;

        switch (action) {
            case 'list_packages': {
                const { data, error } = await supabaseAdmin.from('addon_packages').select('*').order('price_brl', { ascending: true });
                if (error) throw error;
                result = data;
                break;
            }

            case 'manage_packages': {
                // Ensure only Master can manage packages
                const { data: member } = await supabaseAdmin.from('tenant_members').select('tenants(depth_level)').eq('user_id', user.id).eq('tenants.depth_level', 0).maybeSingle();
                if (!member) throw new Error('Only Master can manage packages');

                if (sub_action === 'create') {
                    const { data, error } = await supabaseAdmin.from('addon_packages').insert({
                        name: package_data.name,
                        description: package_data.description,
                        token_amount: package_data.token_amount,
                        post_amount: package_data.post_amount,
                        price_brl: package_data.price_brl,
                        stripe_price_id: package_data.stripe_price_id,
                        is_active: package_data.is_active
                    }).select().single();
                    if (error) throw error;
                    result = data;
                } else if (sub_action === 'update') {
                    if (!package_data.id) throw new Error('Package ID is required');
                    const { data, error } = await supabaseAdmin.from('addon_packages').update({
                        name: package_data.name,
                        description: package_data.description,
                        token_amount: package_data.token_amount,
                        post_amount: package_data.post_amount,
                        price_brl: package_data.price_brl,
                        stripe_price_id: package_data.stripe_price_id,
                        is_active: package_data.is_active
                    }).eq('id', package_data.id).select().single();
                    if (error) throw error;
                    result = data;
                }
                break;
            }

            case 'request_purchase': {
                if (!tenantId || !packageId) throw new Error('tenantId and packageId are required');

                const { data: purchase, error: insertErr } = await supabaseAdmin.from('addon_purchases').insert({
                    tenant_id: tenantId,
                    package_id: packageId,
                    status: 'pending'
                }).select().single();

                if (insertErr) throw insertErr;
                result = purchase;
                break;
            }

            case 'approve_purchase': {
                if (!purchaseId) throw new Error('purchaseId is required');

                const { data: purchase } = await supabaseAdmin.from('addon_purchases').select('tenant_id, status, package_id').eq('id', purchaseId).single();
                if (!purchase) throw new Error('Purchase not found');
                if (purchase.status !== 'pending') throw new Error(`Purchase is already ${purchase.status}`);

                // Approve
                const { error: updErr } = await supabaseAdmin.from('addon_purchases').update({
                    status: 'approved', payment_reference: payment_reference || null
                }).eq('id', purchaseId);

                if (updErr) throw updErr;

                // Apply Package Credits
                const { data: pkg } = await supabaseAdmin.from('addon_packages').select('*').eq('id', purchase.package_id).single();
                if (pkg) {
                    await supabaseAdmin.rpc('apply_addon_manual', { p_tenant_id: purchase.tenant_id, p_tokens: pkg.token_amount, p_posts: pkg.post_amount });
                }

                result = { success: true, purchaseId };
                break;
            }

            case 'reject_purchase': {
                if (!purchaseId) throw new Error('purchaseId is required');

                const { error: updErr } = await supabaseAdmin.from('addon_purchases').update({
                    status: 'rejected'
                }).eq('id', purchaseId);

                if (updErr) throw updErr;
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
