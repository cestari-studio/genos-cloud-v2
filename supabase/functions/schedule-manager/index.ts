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

        // JWT Validation
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) throw new Error('Unauthorized');

        const body = await req.json();
        const { action, slotId, tenantId, postId, platform, scheduledAt, filters, pagination } = body;

        if (!action) throw new Error('Action is required');

        // Resolve Tenant and Role
        const { data: membership } = await supabaseAdmin
            .from('tenant_members')
            .select('tenant_id, role, tenants(depth_level)')
            .eq('user_id', user.id)
            .maybeSingle();

        if (!membership) throw new Error('User has no tenant membership');

        const userTenantId = membership.tenant_id;
        const userDepth = (membership.tenants as any)?.depth_level;
        const isMaster = userDepth === 0;
        const isAgency = userDepth === 1;

        let result: any = null;

        switch (action) {
            case 'create_slot': {
                if (!tenantId || !postId || !platform || !scheduledAt) throw new Error('Missing required fields');

                // Security: Ensure user can manage this tenant
                if (!isMaster && userTenantId !== tenantId) {
                    const { data: targetTenant } = await supabaseAdmin.from('tenants').select('parent_tenant_id').eq('id', tenantId).single();
                    if (!isAgency || targetTenant?.parent_tenant_id !== userTenantId) {
                        throw new Error('Permission denied for this tenant');
                    }
                }

                // 1. Validar schedule_enabled
                const { data: config } = await supabaseAdmin.from('tenant_config').select('schedule_enabled').eq('tenant_id', tenantId).single();
                if (!config?.schedule_enabled) throw new Error('Scheduling not enabled for this tenant');

                // 2. Validar check_schedule_limit
                const { data: limitAllowed } = await supabaseAdmin.rpc('check_schedule_limit', { p_tenant_id: tenantId });
                if (!limitAllowed) throw new Error('Monthly schedule limit reached');

                // 3. Validar tempo futuro (min 15 min)
                const schedDate = new Date(scheduledAt);
                const minDate = new Date(Date.now() + 15 * 60 * 1000);
                if (schedDate < minDate) throw new Error('Scheduled date must be at least 15 minutes in the future');

                // 4. Inserir slot
                const { data: slot, error: slotErr } = await supabaseAdmin.from('schedule_slots').insert({
                    tenant_id: tenantId,
                    post_id: postId,
                    platform,
                    scheduled_at: scheduledAt,
                    status: 'queued',
                    created_by: user.id
                }).select().single();

                if (slotErr) throw slotErr;

                // 5. Incrementar usage log
                const monthStart = new Date();
                monthStart.setDate(1);
                monthStart.setHours(0, 0, 0, 0);

                await supabaseAdmin.from('schedule_usage_log').upsert({
                    tenant_id: tenantId,
                    billing_month: monthStart.toISOString().split('T')[0],
                }, { onConflict: 'tenant_id, billing_month' });

                await supabaseAdmin.rpc('increment_schedule_count', { p_tenant_id: tenantId, p_month: monthStart.toISOString().split('T')[0] });

                result = slot;
                break;
            }

            case 'update_slot': {
                if (!slotId || !scheduledAt) throw new Error('slotId and scheduledAt are required');

                const { data: existingSlot } = await supabaseAdmin.from('schedule_slots').select('tenant_id').eq('id', slotId).single();
                if (!existingSlot) throw new Error('Slot not found');

                if (!isMaster && !isAgency) throw new Error('Only Master or Agency can update schedule slots');

                const { error: updErr } = await supabaseAdmin.from('schedule_slots').update({
                    scheduled_at: scheduledAt,
                    status: 'queued'
                }).eq('id', slotId);

                if (updErr) throw updErr;
                result = { success: true };
                break;
            }

            case 'cancel_slot': {
                if (!slotId) throw new Error('slotId is required');
                if (!isMaster && !isAgency) throw new Error('Only Master or Agency can cancel slots');

                const { error: cancelErr } = await supabaseAdmin.from('schedule_slots').update({
                    status: 'cancelled'
                }).eq('id', slotId);

                if (cancelErr) throw cancelErr;
                result = { success: true };
                break;
            }

            case 'list_slots': {
                let query = supabaseAdmin.from('schedule_slots').select('*, posts(title, format)').order('scheduled_at', { ascending: true });

                if (filters?.tenant_id) query = query.eq('tenant_id', filters.tenant_id);
                if (filters?.status) query = query.eq('status', filters.status);
                if (filters?.platform) query = query.eq('platform', filters.platform);

                // Pagination
                const from = pagination?.offset ?? 0;
                const to = from + (pagination?.limit ?? 50) - 1;
                query = query.range(from, to);

                const { data, error } = await query;
                if (error) throw error;
                result = data;
                break;
            }

            case 'get_usage': {
                const targetId = tenantId || userTenantId;
                const monthStart = new Date();
                monthStart.setDate(1);
                monthStart.setHours(0, 0, 0, 0);

                const { data: usage } = await supabaseAdmin.from('schedule_usage_log')
                    .select('*')
                    .eq('tenant_id', targetId)
                    .eq('billing_month', monthStart.toISOString().split('T')[0])
                    .maybeSingle();

                const { data: config } = await supabaseAdmin.from('tenant_config').select('schedule_post_limit').eq('tenant_id', targetId).single();

                result = {
                    used: usage?.scheduled_count || 0,
                    limit: config?.schedule_post_limit || 0,
                    remaining: Math.max(0, (config?.schedule_post_limit || 0) - (usage?.scheduled_count || 0))
                };
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
