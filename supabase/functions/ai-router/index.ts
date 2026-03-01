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
        const { postId, action, feedback } = await req.json()

        if (!postId) {
            throw new Error('postId is required')
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get current post & tenant info
        const { data: post, error: postError } = await supabaseAdmin
            .from('content_items')
            .select('*, tenants(name, slug, plan)')
            .eq('id', postId)
            .single()

        if (postError || !post) throw new Error('Post not found')

        // 2. Set status to "Generating..."
        const { error: initialUpdateError } = await supabaseAdmin
            .from('content_items')
            .update({ status: 'Generating...' })
            .eq('id', postId)

        if (initialUpdateError) throw initialUpdateError;

        // 3. Call Gemini API
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
        const model = "gemini-1.5-flash"
        const prompt = `
            Você é o genOS Creative Master, um especialista em marketing digital e branding.
            Sua tarefa é ${action === 'regenerate' ? 'REGENERAR' : 'GERAR'} um post de social media.
            
            CONTEXTO DA MARCA:
            Nome: ${post.tenants?.name || 'Cestari Studio'}
            Plano: ${post.tenants?.plan || 'Enterprise'}
            Nome do Post Atual: ${post.name}
            Conteúdo Atual: ${post.body || 'Vazio'}
            
            FEEDBACK/INSTRUÇÕES ADICIONAIS:
            "${feedback || 'Siga o tom de voz padrão da marca: profissional, inovador e futurista.'}"
            
            REQUISITOS:
            1. O título deve ser curto e impactante.
            2. O corpo deve ser persuasivo e otimizado para conversão.
            3. Forneça um "quality_score" de 0 a 100 baseado na aderência ao briefing.
            4. Forneça uma "heuristics" (análise de ~100 palavras) explicando as decisões criativas.
            
            Responda APENAS em formato JSON válido com as seguintes chaves:
            "title", "body", "quality_score", "heuristics"
        `

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    response_mime_type: "application/json",
                }
            })
        })

        const geminiData = await geminiResponse.json()
        const aiResult = JSON.parse(geminiData.candidates[0].content.parts[0].text)

        // 4. Update Database
        const { error: updateError } = await supabaseAdmin
            .from('content_items')
            .update({
                status: 'Approved',
                quality_score: aiResult.quality_score || 90,
                heuristics: aiResult.heuristics || 'Análise gerada automaticamente.',
                title: aiResult.title,
                body: aiResult.body,
                updated_at: new Date().toISOString()
            })
            .eq('id', postId)

        if (updateError) throw updateError

        // 5. Debit Credits (Simple Logic for MVP)
        await supabaseAdmin.rpc('debit_credits', { p_tenant_id: post.tenant_id, p_amount: 1 })

        return new Response(JSON.stringify({ success: true, data: aiResult }), {
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
