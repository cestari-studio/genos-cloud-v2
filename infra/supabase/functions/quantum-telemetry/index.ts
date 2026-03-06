import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const payload = await req.json()
        const { job_id, status, qpu_id, seconds_consumed, tenant_id } = payload

        console.log(`[QUANTUM TELEMETRY] Job ${job_id} on ${qpu_id}: ${status}`)

        if (status === 'completed') {
            // 1. Record in Audit Trail if not already there (or update)
            const { data: existing } = await supabaseAdmin
                .from('finops_audit_trail')
                .select('id')
                .eq('metadata->>quantum_job_id', job_id)
                .single()

            if (!existing) {
                const UNIT_PRICE_PER_SECOND = 0.05
                const costValue = (seconds_consumed || 0) * UNIT_PRICE_PER_SECOND

                await supabaseAdmin.from('finops_audit_trail').insert({
                    tenant_id,
                    event_type: 'QUANTUM_EXECUTION',
                    calculated_cost_usd: costValue,
                    metadata: {
                        quantum_job_id: job_id,
                        qpu: qpu_id,
                        seconds_consumed: seconds_consumed,
                        status: 'completed',
                        processed_at: new Date().toISOString()
                    }
                })
            }

            // 2. Subtract from global quota
            await supabaseAdmin.rpc('increment_quantum_usage', {
                p_seconds: seconds_consumed || 0
            })

            // 3. Trigger Master Heartbeat Notification
            await supabaseAdmin.from('system_notifications').insert({
                tenant_id,
                type: 'QUANTUM_PULSE_SUCCESS',
                priority: 'info',
                message: `Primeiro pulso quântico capturado via ${qpu_id || 'ibm_fez'}: Score QHE gerado com sucesso.`,
                quantum_job_id: job_id,
                qpu_id: qpu_id || 'ibm_fez'
            })
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error: any) {
        console.error('[QUANTUM TELEMETRY] Error:', error)
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
