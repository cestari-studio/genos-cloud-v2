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

        // We use the service_role key to bypass RLS, but we extract the user from the JWT
        // to ensure they only query their own tenant.
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Get user from the JWT
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) throw new Error('Unauthorized');

        // For genOS ecosystem, we expect the client to post the active tenant context
        // because a user can belong to multiple tenants.
        // However, if not provided, just pick their first active tenant as default fallback.
        const body = await req.json();
        const { tenantId, format, operation, slide_count, ai_model } = body;

        let targetTenantId = tenantId;
        if (!targetTenantId) {
            const { data: member } = await supabaseAdmin.from('tenant_members').select('tenant_id').eq('user_id', user.id).limit(1).maybeSingle();
            targetTenantId = member?.tenant_id;
            if (!targetTenantId) throw new Error('No tenant found for user');
        }

        // Pre-check for affordance
        const { data: billCheck, error: billErr } = await supabaseAdmin.rpc('check_can_generate', { p_tenant_id: targetTenantId });
        if (billErr) throw new Error(`check error: ${billErr.message}`);

        // Calculate detailed token costs
        // The RPC currently returns a single integer, so let's fetch the config manually to build the breakdown
        const { data: config } = await supabaseAdmin
            .from('token_cost_config')
            .select('*')
            .or(`tenant_id.eq.${targetTenantId},tenant_id.is.null`)
            .eq('format', format)
            .eq('operation', operation)
            .order('tenant_id', { ascending: false, nullsFirst: false }) // tenant specific first
            .limit(1)
            .maybeSingle();

        const slideCount = slide_count || 1;
        const model = ai_model || 'gemini-2.0-flash';

        let baseCost = 1;
        let slideTotal = 0;
        let multiplier = 1.0;

        if (config) {
            baseCost = config.base_cost;
            slideTotal = (config.per_slide_cost || 0) * Math.max(slideCount - 1, 0);
            multiplier = Number(config.ai_model_multiplier?.[model]) || 1.0;
        }

        const estimated_cost = Math.ceil((baseCost + slideTotal) * multiplier);
        const balance = billCheck.tokens_remaining || 0;

        return new Response(JSON.stringify({
            success: true,
            data: {
                estimated_cost: estimated_cost,
                current_balance: balance,
                after_balance: Math.max(balance - estimated_cost, 0),
                can_afford: billCheck.allowed,
                breakdown: {
                    base_cost: baseCost,
                    slide_cost: slideTotal,
                    model_multiplier: multiplier,
                    total: estimated_cost
                }
            }
        }), {
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
