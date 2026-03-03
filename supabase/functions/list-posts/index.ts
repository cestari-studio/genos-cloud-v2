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

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
        const payload = await req.json();
        const { tenant_id, include_children } = payload;

        if (!tenant_id) throw new Error('tenant_id is required');

        let tenantIdsToQuery = [tenant_id];

        // Se a flag include_children estiver ativa (Opção "Todos" no DataTable)
        // precisamos buscar o próprio tenant e todos que são "filhos" dele.
        if (include_children) {
            const { data: childTenants, error: fetchTenantsError } = await supabaseAdmin
                .from('tenants')
                .select('id')
                .or(`id.eq.${tenant_id},parent_tenant_id.eq.${tenant_id}`);

            if (fetchTenantsError) {
                throw new Error('Erro ao resolver child_tenants: ' + fetchTenantsError.message);
            }

            if (childTenants && childTenants.length > 0) {
                tenantIdsToQuery = childTenants.map((t: any) => t.id);
            }
        }

        const { data: posts, error } = await supabaseAdmin
            .from('posts')
            .select('*, tenant:tenants(name), post_media(*)')
            .in('tenant_id', tenantIdsToQuery)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error('Falha ao buscar posts: ' + error.message);
        }

        // Remapear para que o front consiga ler post.tenant_name no nível mais alto
        const mappedPosts = (posts || []).map((p: any) => ({
            ...p,
            tenant_name: p.tenant ? p.tenant.name : null,
            tenant: undefined
        }));

        return new Response(JSON.stringify({ success: true, posts: mappedPosts }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
