// genOS Full v1.0.0 "Lumina" — server/routes/dna.ts
import { Router } from 'express';
import { requireAuthenticated, requireRole } from '../middleware/identity';
import { generateBrandDNAWithGranite } from '../services/graniteService';
import { supabase } from '../services/supabaseClient';

export const dnaRouter = Router();

// Endpoint for the Intelligence Pipeline (DNA Wizard)
dnaRouter.post('/wizard/generate', requireAuthenticated, requireRole('super_admin', 'agency_operator'), async (req, res) => {
    const tenant = (req as any).tenant;
    if (!tenant) return res.status(404).json({ error: 'Tenant not found context required.' });

    const { industry, targetDescription, brandValues } = req.body;

    if (!industry || !targetDescription || !brandValues) {
        return res.status(400).json({ error: 'Faltam dados essenciais: industry, targetDescription, brandValues' });
    }

    try {
        // 1. Ingest context and orchestrate through IBM Granite
        const generatedDna = await generateBrandDNAWithGranite({
            tenantName: tenant.name,
            industry,
            targetDescription,
            brandValues,
        });

        // 2. Persist the deeply structured Audience Analytics payload (RLS isolates by tenant_id)
        const { error: audienceError } = await supabase
            .from('audience_analytics')
            .upsert(
                {
                    tenant_id: tenant.id,
                    location: generatedDna.audience_analytics.location,
                    age_groups: generatedDna.audience_analytics.age_groups,
                    genders: generatedDna.audience_analytics.genders,
                    purchase_interests: generatedDna.audience_analytics.purchase_interests,
                    lifestyle_markers: generatedDna.audience_analytics.lifestyle_markers,
                    content_consumption: generatedDna.audience_analytics.content_consumption,
                    sentiment_rules: generatedDna.sentiment_rules,
                    dynamic_categories: generatedDna.dynamic_categories,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'tenant_id' }
            );

        if (audienceError) {
            console.error('[DNA] Failed to persist audience analytics:', audienceError);
            return res.status(500).json({ error: 'Erro ao salvar inteligência de audiência' });
        }

        // 3. Formulate the Constraint Kernel updates for brand_dna
        const dnaUpdate = {
            content_rules: {
                limits: generatedDna.recommended_limits,
                fixed_elements: {
                    footer_snippet: req.body.footer_snippet || 'Acesse o link na bio para saber mais.',
                    hashtags: req.body.hashtags || []
                },
                sequence: ['reels', 'static_post', 'carousel']
            },
            target_audience: generatedDna.audience_analytics, // Sync raw demographics mapping locally into DNA target
            updated_at: new Date().toISOString()
        };

        // 4. Upsert Brand DNA
        const { error: dnaError } = await supabase
            .from('brand_dna')
            .update(dnaUpdate)
            .eq('tenant_id', tenant.id);

        if (dnaError) {
            console.error('[DNA] Failed to persist brand_dna constraints:', dnaError);
            return res.status(500).json({ error: 'Erro ao assar Restrições do Kernel de DNA' });
        }

        res.json({
            status: 'success',
            message: 'DNA Brand Factory Intelligence concluído via IBM Granite e salvo.',
            generatedProfile: generatedDna
        });

    } catch (error) {
        console.error('[DNA Wizard] Generation failed:', error);
        res.status(500).json({ error: String(error) });
    }
});
