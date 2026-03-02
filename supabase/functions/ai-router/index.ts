import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = [
    'https://genos-cloud-v2.vercel.app',
    'http://localhost:5173',
    'http://localhost:3001',
]

function getCorsHeaders(req: Request) {
    const origin = req.headers.get('origin') || ''
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
    return {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: getCorsHeaders(req) })
    }

    try {
        const { postId, action, feedback } = await req.json()

        if (!postId) {
            return new Response(JSON.stringify({
                error: 'missing_fields',
                message: 'postId is required',
                required: ['postId']
            }), {
                status: 400,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
            })
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

        if (postError || !post) {
            return new Response(JSON.stringify({
                error: 'post_not_found',
                message: `Post ${postId} not found`
            }), {
                status: 404,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
            })
        }

        // 2. Get Brand DNA for this tenant
        const { data: dna } = await supabaseAdmin
            .from('brand_dna')
            .select('*')
            .eq('tenant_id', post.tenant_id)
            .single()

        // 3. Set status to "Generating..."
        await supabaseAdmin
            .from('content_items')
            .update({ status: 'Generating...' })
            .eq('id', postId)

        // 4. Build prompt with Brand DNA context
        const brandContext = dna
            ? `
            IDENTIDADE DA MARCA:
            Persona: ${dna.persona_name || post.tenants?.name || 'Cestari Studio'}
            Tom de Voz: ${dna.voice_tone || 'profissional'}
            Descrição da Voz: ${dna.voice_description || ''}
            Idioma: ${dna.language || 'pt-BR'}
            Traços de Personalidade: ${(dna.personality_traits || []).join(', ') || 'inovador, futurista'}
            Público-alvo: ${typeof dna.target_audience === 'string' ? dna.target_audience : JSON.stringify(dna.target_audience || {})}
            Pilares Editoriais: ${(dna.editorial_pillars || []).map((p: any) => `${p.name}: ${p.description}`).join(' | ') || ''}
            Regras de Conteúdo: ${typeof dna.content_rules === 'string' ? dna.content_rules : JSON.stringify(dna.content_rules || {})}
            Limites de Caracteres: ${JSON.stringify(dna.char_limits || {})}

            RESTRIÇÕES OBRIGATÓRIAS:
            Palavras PROIBIDAS (nunca usar): ${(dna.forbidden_words || []).join(', ') || 'nenhuma'}
            Termos OBRIGATÓRIOS (incluir quando possível): ${(dna.mandatory_terms || []).join(', ') || 'nenhum'}
            
            HASHTAGS:
            Fixas: ${(dna.hashtag_strategy?.fixed_hashtags || []).join(' ')}
            Maximo total: ${dna.hashtag_strategy?.max_total || 5}
            `.trim()
            : `MARCA: ${post.tenants?.name || 'Cestari Studio'} (sem Brand DNA configurado — usar tom profissional e inovador)`

        const prompt = `
            Você é o genOS Creative Master, um especialista em marketing digital e branding.
            Sua tarefa é ${action === 'regenerate' ? 'REGENERAR' : 'REFINAR'} um post de social media
            seguindo rigorosamente a identidade da marca.

            ${brandContext}

            POST ATUAL:
            Nome: ${post.name}
            Título: ${post.title || 'Sem título'}
            Conteúdo: ${post.body || 'Vazio'}

            FEEDBACK/INSTRUÇÕES DO USUÁRIO:
            "${feedback || 'Melhore o conteúdo mantendo a essência da marca.'}"

            REQUISITOS:
            1. O título deve ser curto e impactante, respeitando o tom de voz da marca.
            2. O corpo deve ser persuasivo e otimizado para conversão.
            3. Forneça um "quality_score" de 0 a 100 baseado na aderência ao Brand DNA.
            4. Forneça uma "heuristics" (análise de ~100 palavras) explicando as decisões criativas.
            5. Retorne um campo "hashtags" como um array de strings.

            Responda APENAS em formato JSON válido com as seguintes chaves:
            "title", "body", "quality_score", "heuristics", "hashtags"
        `

        // 5. Call Gemini API with error handling
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
        if (!GEMINI_API_KEY) {
            // Revert status
            await supabaseAdmin.from('content_items').update({ status: 'Draft' }).eq('id', postId)
            return new Response(JSON.stringify({
                error: 'config_error',
                message: 'GEMINI_API_KEY not configured in Edge Function secrets'
            }), {
                status: 503,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
            })
        }

        const model = "gemini-2.0-flash"
        let geminiResponse: Response

        try {
            geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { response_mime_type: "application/json" }
                    })
                }
            )
        } catch (fetchErr) {
            console.error('Gemini connection failed:', fetchErr)
            await supabaseAdmin.from('content_items').update({ status: 'Draft' }).eq('id', postId)
            return new Response(JSON.stringify({
                error: 'gemini_connection_failed',
                message: 'Could not connect to Gemini API'
            }), {
                status: 503,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
            })
        }

        if (!geminiResponse.ok) {
            const errText = await geminiResponse.text()
            console.error('Gemini API error:', geminiResponse.status, errText)
            await supabaseAdmin.from('content_items').update({ status: 'Draft' }).eq('id', postId)
            return new Response(JSON.stringify({
                error: 'gemini_failed',
                status: geminiResponse.status,
                detail: errText
            }), {
                status: 502,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
            })
        }

        const geminiData = await geminiResponse.json()

        if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error('Gemini returned unexpected format:', JSON.stringify(geminiData))
            await supabaseAdmin.from('content_items').update({ status: 'Draft' }).eq('id', postId)
            return new Response(JSON.stringify({
                error: 'gemini_invalid_response',
                message: 'Gemini returned an unexpected response format'
            }), {
                status: 502,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
            })
        }

        const aiResult = JSON.parse(geminiData.candidates[0].content.parts[0].text)

        // Concatenate fixed_description_footer
        let bodyContent = aiResult.body || post.body || "";
        const footer = dna?.content_rules?.fixed_description_footer;
        if (footer) {
            if (!bodyContent.includes(footer)) {
                bodyContent = `${bodyContent}\n\n${footer}`.trim();
            }
        }

        // 6. Update Database
        const { error: updateError } = await supabaseAdmin
            .from('content_items')
            .update({
                status: 'Approved',
                quality_score: aiResult.quality_score || 90,
                heuristics: aiResult.heuristics || 'Análise gerada automaticamente.',
                title: aiResult.title,
                body: bodyContent,
                hashtags: aiResult.hashtags || post.hashtags || [],
                updated_at: new Date().toISOString()
            })
            .eq('id', postId)

        if (updateError) throw updateError

        // 7. Debit Credits
        await supabaseAdmin.rpc('debit_credits', { p_tenant_id: post.tenant_id, p_amount: 1 })

        return new Response(JSON.stringify({
            success: true,
            data: aiResult,
            brand_dna_applied: !!dna
        }), {
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('ai-router error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
