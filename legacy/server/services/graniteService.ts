// genOS Full v1.0.0 "Lumina" — server/services/graniteService.ts
import fetch from 'node-fetch';

export interface DNAGenerationContext {
    tenantName: string;
    industry: string;
    targetDescription: string;
    brandValues: string;
}

export interface GeneratedDNAProfile {
    audience_analytics: {
        location: string[];
        age_groups: string[];
        genders: string[];
        purchase_interests: string[];
        lifestyle_markers: string[];
        content_consumption: Record<string, string>;
    };
    sentiment_rules: Record<string, string>;
    dynamic_categories: string[];
    recommended_limits: {
        description: { min: number; max: number };
        carousel: { title_max_words: number; paragraph_max_words: number; max_cards: number };
        reels: { title_max_words: number; max_frames: number };
        static_post: { title_max_words: number; paragraph_max_words: number };
    };
}

const GRANITE_SYSTEM_PROMPT = `Você atua como um Chief AI Architect mapeando a identidade corporativa para ingestão no sistema genOS.
O usuário fornecerá dados brutos de um cliente. Sua tarefa é extrair e gerar um JSON determinístico contendo:
- audience_analytics: demographics, psychographics, e consumption_patterns.
- sentiment_rules: Mapeamento de 'tom de voz' versus 'nicho de audiência'.
- dynamic_categories: Sugira exatamente 5 categorias estratégicas (ex: Educacional, ROI Case).
- recommended_limits: Recomende os top limits para os parâmetros abaixo, mas DEVEM respeitar as seguintes constraints inflexíveis de baseline do genOS:

REGRAS RÍGIDAS (Constraint Kernel):
Quando instruir a formatação de conteúdo, você OBRIGATORIAMENTE instanciará as seguintes constraints:
- DESCRIÇÕES: min 600 max 700 caracteres.
- CARROSSÉIS (1-10 cards): Títulos <= 5 palavras. Parágrafos <= 20 palavras.
- REELS (1-5 frames): Títulos <= 8 palavras.
- POSTS ESTÁTICOS: Título <= 5 palavras, Parágrafo <= 5 palavras.

Devolva APENAS um objeto JSON estruturado aderindo à RFC 8259, sem blocos de código markdown ou texto adicional.`;

export async function generateBrandDNAWithGranite(context: DNAGenerationContext): Promise<GeneratedDNAProfile> {
    // In a real production scenario, this connects to the actual IBM Watsonx endpoint
    const WATSONX_URL = process.env.WATSONX_API_URL || 'https://us-south.ml.cloud.ibm.com/ml/v1-beta/generation/text?version=2023-05-29';
    const WATSONX_KEY = process.env.WATSONX_API_KEY;
    const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID;

    const promptInput = `
Contexto do Cliente:
Nome: ${context.tenantName}
Indústria: ${context.industry}
Descrição do Público Alvo: ${context.targetDescription}
Valores da Marca: ${context.brandValues}

Por favor, analise e gere o DNA estruturado usando a formatação JSON exigida pelo sistema.`;

    // MOCK implementation fallback if keys are missing to keep the UI development unblocked
    if (!WATSONX_KEY || !WATSONX_PROJECT_ID) {
        console.log('[graniteService] Watsonx keys missing, falling back to deterministic mock DNA generation.');
        return mockGraniteResponse(context);
    }

    try {
        const response = await fetch(WATSONX_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WATSONX_KEY}`
            },
            body: JSON.stringify({
                model_id: 'ibm/granite-13b-chat-v2',
                input: `[INST] <<SYS>>\n${GRANITE_SYSTEM_PROMPT}\n<</SYS>>\n\n${promptInput} [/INST]`,
                project_id: WATSONX_PROJECT_ID,
                parameters: {
                    decoding_method: 'greedy',
                    max_new_tokens: 2000,
                    stop_sequences: [],
                    repetition_penalty: 1,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Watsonx API error: ${response.statusText}`);
        }

        const data = await response.json() as any;
        const jsonOutput = data.results?.[0]?.generated_text || '{}';
        // Clean potential markdown blocks
        const cleanJson = jsonOutput.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error('[graniteService] Error calling Watsonx:', error);
        throw error;
    }
}

function mockGraniteResponse(context: DNAGenerationContext): GeneratedDNAProfile {
    return {
        audience_analytics: {
            location: ['São Paulo', 'Rio de Janeiro', 'Capitais Brasileiras'],
            age_groups: ['25-34', '35-44'],
            genders: ['Masculino', 'Feminino'],
            purchase_interests: ['Tecnologia', 'Investimentos', 'Inovação', context.industry],
            lifestyle_markers: ['Workaholics', 'Early Adopters', 'Data-driven readers'],
            content_consumption: {
                'Manhã': 'Newsletters curtas e artigos LinkedIn',
                'Tarde': 'Vídeos curtos (Reels)',
                'Noite': 'Textos longos, Artigos profundos'
            }
        },
        sentiment_rules: {
            'C-Level Executives': 'Autoridade, pragmático, foco em ROI e métricas claras.',
            'Analistas / Gerentes': 'Educativo, hands-on, foco em como implementar.'
        },
        dynamic_categories: [
            'ROI & Business Cases',
            'Educação Técnica',
            'Cultura & Bastidores',
            'News & Tendências',
            'Liderança & Opinião'
        ],
        recommended_limits: {
            description: { min: 600, max: 700 },
            carousel: { title_max_words: 5, paragraph_max_words: 20, max_cards: 10 },
            reels: { title_max_words: 8, max_frames: 5 },
            static_post: { title_max_words: 5, paragraph_max_words: 5 }
        }
    };
}
