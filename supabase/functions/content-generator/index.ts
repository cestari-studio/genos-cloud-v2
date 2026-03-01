import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { topic, tenantId } = await req.json()

        if (!topic || !tenantId) {
            throw new Error('topic and tenantId are required')
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get tenant info for context
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('name, slug')
            .eq('id', tenantId)
            .single()

        // 2. Call Gemini for Initial Generation
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
        const model = "gemini-1.5-flash"
        const prompt = `
            Você é o genOS Creative Master. Gere um NOVO post de social media para a marca "${tenant?.name || 'Cestari Studio'}".
            TEMA sugerido pelo usuário: "${topic}"
            
            REQUISITOS:
            1. Defina um Nome interno curto para o post (ex: "Promoção Verão").
            2. Gere um Título de impacto.
            3. Gere um Corpo persuasivo.
            4. Retorne um quality_score (0-100).
            5. Retorne uma heurística explicativa curta.
            
            Responda APENAS em JSON:
            {"name": "...", "title": "...", "body": "...", "quality_score": ..., "heuristics": "..."}
        `

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        })

        const geminiData = await geminiResponse.json()
        const aiResult = JSON.parse(geminiData.candidates[0].content.parts[0].text)

        // 3. Insert into Database
        const { data: newItem, error: insertError } = await supabaseAdmin
            .from('content_items')
            .insert({
                tenant_id: tenantId,
                name: aiResult.name || topic,
                title: aiResult.title,
                body: aiResult.body,
                status: 'Approved',
                quality_score: aiResult.quality_score || 85,
                heuristics: aiResult.heuristics || 'Nova ideia gerada pela IA.',
                type: 'Social Post',
                app_slug: 'content-factory'
            })
            .select()
            .single()

        if (insertError) throw insertError

        // 4. Debit Credit
        await supabaseAdmin.rpc('debit_credits', { p_tenant_id: tenantId, p_amount: 1 })

        return new Response(JSON.stringify({ success: true, data: newItem }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
