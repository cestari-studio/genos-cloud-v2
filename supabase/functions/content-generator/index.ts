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
        const body = await req.json()
        const { topic, tenantId } = body

        // Validação clara dos campos obrigatórios
        if (!topic || !tenantId) {
            return new Response(JSON.stringify({
                error: 'missing_fields',
                message: 'topic and tenantId are required',
                required: ['topic', 'tenantId']
            }), {
                status: 400,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
            })
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get tenant info
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('name, slug')
            .eq('id', tenantId)
            .single()

        // 2. Get Brand DNA for this tenant (injects brand context into AI)
        const { data: dna } = await supabaseAdmin
            .from('brand_dna')
            .select('persona_name, voice_tone, voice_description, language, forbidden_words, mandatory_terms, editorial_pillars, target_audience, content_rules, personality_traits, char_limits')
            .eq('tenant_id', tenantId)
            .single()

        // 3. Build system prompt with Brand DNA context
        const brandContext = dna
            ? `
            IDENTIDADE DA MARCA:
            Persona: ${dna.persona_name || tenant?.name || 'Cestari Studio'}
            Tom de Voz: ${dna.voice_tone || 'profissional'}
            Descrição da Voz: ${dna.voice_description || ''}
            Idioma: ${dna.language || 'pt-BR'}
            Traços de Personalidade: ${(dna.personality_traits || []).join(', ') || 'inovador, futurista'}
            Público-alvo: ${typeof dna.target_audience === 'string' ? dna.target_audience : JSON.stringify(dna.target_audience || {})}
            Pilares Editoriais: ${(dna.editorial_pillars || []).join(', ') || ''}
            Regras de Conteúdo: ${typeof dna.content_rules === 'string' ? dna.content_rules : JSON.stringify(dna.content_rules || {})}
            Limites de Caracteres: ${typeof dna.char_limits === 'string' ? dna.char_limits : JSON.stringify(dna.char_limits || {})}

            RESTRIÇÕES OBRIGATÓRIAS:
            Palavras PROIBIDAS (nunca usar): ${(dna.forbidden_words || []).join(', ') || 'nenhuma'}
            Termos OBRIGATÓRIOS (incluir quando possível): ${(dna.mandatory_terms || []).join(', ') || 'nenhum'}
            `.trim()
            : `MARCA: ${tenant?.name || 'Cestari Studio'} (sem Brand DNA configurado — usar tom profissional e inovador)`

        const prompt = `
            Você é o genOS Creative Master, um especialista em marketing digital e branding.
            Gere um NOVO post de social media seguindo rigorosamente a identidade da marca.

            ${brandContext}

            TEMA sugerido pelo usuário: "${topic}"

            REQUISITOS:
            1. Defina um Nome interno curto para o post (ex: "Promoção Verão").
            2. Gere um Título de impacto que respeite o tom de voz da marca.
            3. Gere um Corpo persuasivo e otimizado para conversão.
            4. Retorne um quality_score (0-100) baseado na aderência ao Brand DNA.
            5. Retorne uma heurística explicativa curta sobre as decisões criativas.

            Responda APENAS em JSON válido:
            {"name": "...", "title": "...", "body": "...", "quality_score": ..., "heuristics": "..."}
        `

        // 4. Call Gemini API with error handling
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
        if (!GEMINI_API_KEY) {
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
            return new Response(JSON.stringify({
                error: 'gemini_invalid_response',
                message: 'Gemini returned an unexpected response format',
                raw: geminiData
            }), {
                status: 502,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
            })
        }

        const aiResult = JSON.parse(geminiData.candidates[0].content.parts[0].text)

        // 5. Insert into Database
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

        // 6. Debit Credit
        await supabaseAdmin.rpc('debit_credits', { p_tenant_id: tenantId, p_amount: 1 })

        return new Response(JSON.stringify({
            success: true,
            data: newItem,
            brand_dna_applied: !!dna
        }), {
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('content-generator error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
