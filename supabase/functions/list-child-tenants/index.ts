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
    const { parent_tenant_id } = payload;
    if (!parent_tenant_id) throw new Error('parent_tenant_id is required');

    // Verify the requesting parent's depth level
    const { data: parentTenant, error: parentErr } = await supabaseAdmin
      .from('tenants')
      .select('depth_level')
      .eq('id', parent_tenant_id)
      .single();

    if (parentErr || !parentTenant) throw new Error('Falha ao verificar tenant pai.');

    let query = supabaseAdmin
      .from('tenants')
      .select('id, name, slug')
      .eq('status', 'active');

    // Master (0) vê todos os ativos, Agency (1) vê os seus filhos diretos
    if (parentTenant.depth_level === 1) {
      query = query.eq('parent_tenant_id', parent_tenant_id);
    } else if (parentTenant.depth_level > 1) {
      throw new Error('Tenant não possui permissão para listar clientes.');
    }

    const { data: tenants, error } = await query.order('name');
    if (error) throw new Error('Falha ao buscar tenants: ' + error.message);

    return new Response(JSON.stringify({ success: true, tenants: tenants || [] }), {
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
