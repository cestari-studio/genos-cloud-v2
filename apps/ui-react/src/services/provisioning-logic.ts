import { supabase } from './supabase';

export interface ProjectTemplate {
    name: string;
    type: 'social_media' | 'ads' | 'internal';
    config: {
        posts_limit: number;
        reels_limit: number;
        features: string[];
    };
}

export const PROVISIONING_TEMPLATES: Record<string, ProjectTemplate> = {
    starter: {
        name: 'Social Media Starter',
        type: 'social_media',
        config: {
            posts_limit: 12,
            reels_limit: 0,
            features: ['scheduling']
        }
    },
    growth: {
        name: 'Growth Engine',
        type: 'social_media',
        config: {
            posts_limit: 24,
            reels_limit: 4,
            features: ['scheduling', 'quantum_scoring', 'sentiment_analysis']
        }
    },
    scale: {
        name: 'Industrial Scale',
        type: 'social_media',
        config: {
            posts_limit: 50,
            reels_limit: 12,
            features: ['scheduling', 'quantum_scoring', 'sentiment_analysis', 'api_access', 'master_isolation']
        }
    }
};

/**
 * provisionTenantResources - Industrial logic to initialize tenant assets
 * based on their Stripe Tier. Creates initial projects and syncs config.
 */
export async function provisionTenantResources(tenantId: string, tier: string) {
    console.log(`[Provisioning] Initializing resources for Tenant ${tenantId} [Tier: ${tier}]`);

    const template = PROVISIONING_TEMPLATES[tier as keyof typeof PROVISIONING_TEMPLATES] || PROVISIONING_TEMPLATES.starter;

    // 1. Create Default Project (Content Pack)
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
            tenant_id: tenantId,
            name: template.name,
            type: template.type,
            config: template.config,
            status: 'active'
        })
        .select()
        .single();

    if (projectError) {
        console.error('[Provisioning] Project creation failed:', projectError);
        throw projectError;
    }

    // 2. Initialize or Update Tenant Config with Tier-specific limits
    const { error: configError } = await supabase
        .from('tenant_config')
        .upsert({
            tenant_id: tenantId,
            post_limit: template.config.posts_limit,
            token_balance: tier === 'scale' ? 50000 : (tier === 'growth' ? 15000 : 5000),
            ai_model: tier === 'scale' ? 'claude-3-5-sonnet' : 'gemini-2.0-flash',
            schedule_tier: tier as any,
            onboarding_completed: false, // Onboarding still in progress until final wizard step
            updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id' });

    if (configError) {
        console.error('[Provisioning] Tenant config initialization failed:', configError);
        throw configError;
    }

    console.info(`[Provisioning] Successfully provisioned Project ${project.id} for ${tenantId}`);
    return project;
}
