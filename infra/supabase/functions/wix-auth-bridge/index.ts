import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Enforce Edge Runtime
export const runtime = 'edge';

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': 'https://app.cestari.studio',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bridge-secret',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: getCorsHeaders() })
    }

    try {
        const bridgeSecret = req.headers.get('x-bridge-secret')
        if (!bridgeSecret || bridgeSecret !== Deno.env.get('BRIDGE_SECRET')) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid bridge secret' }), {
                headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        const { email, password, token, source } = await req.json()

        // If it's a callback and we have a token, we handle Wix JWT validation here
        // For v5.0.0, if token is provided, we'll use it to resolve email if email is missing
        let targetEmail = email;

        if (token && !targetEmail) {
            console.log(`genOS Wix Bridge: Processing token from ${source || 'unknown'}`)
            // TODO: Implement actual JWKS validation using https://www.wixapis.com/oauth/jwks
            // For now, we expect the bridge secret to authorize the request and email to be provided
        }

        if (!targetEmail) {
            throw new Error('Email is required for synchronization')
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
        // Public client for signInWithPassword (doesn't bypass RLS)
        const supabasePublic = createClient(supabaseUrl, anonKey)

        // 1. Ensure Tenant exists
        let { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('id, slug, name, plan')
            .eq('contact_email', email)
            .single()

        if (tenantError || !tenant) {
            const newSlug = email.split('@')[0].replace(/[^a-z0-9]/g, '-') + '-studio'
            const { data: newTenant, error: createTenantError } = await supabaseAdmin
                .from('tenants')
                .insert({
                    name: `${email.split('@')[0]} Studio`,
                    slug: newSlug,
                    contact_email: email,
                    plan: 'enterprise',
                    status: 'active'
                })
                .select()
                .single()

            if (createTenantError) throw createTenantError
            tenant = newTenant

            const { data: appData } = await supabaseAdmin.from('applications').select('id').eq('slug', 'content-factory').single()
            if (appData) {
                await supabaseAdmin.from('subscriptions').insert({ tenant_id: tenant.id, app_id: appData.id, status: 'active' })
            }
            // 1.1 Seeding de carteira
            await supabaseAdmin.from('credit_wallets').insert({ tenant_id: tenant.id, prepaid_credits: 5000 })

            // 1.2 Criação do config e bloqueio no Onboarding
            await supabaseAdmin.from('tenant_config').insert({
                tenant_id: tenant.id,
                post_limit: 24,
                token_balance: 5000,
                onboarding_completed: false,
                contract_signed: false
            })

            // 1.3 Setup inicial do DNA
            await supabaseAdmin.from('brand_dna').insert({
                tenant_id: tenant.id,
                industry: 'Aguardando Briefing',
                brand_story: '',
                char_limits: { "reels_title": 60, "reels_caption": 2200, "static_title": 60, "static_caption": 2200, "carousel_card_text": 150 }
            })

            // 1.4 Provisionamento do Contrato
            await supabaseAdmin.from('billing_contracts').insert({
                tenant_id: tenant.id,
                contract_url: 'internal_genos_SaaS_term_v5.pdf',
                metadata: { "plan": "enterprise", "source": "wix_auto_provisioning" }
            })
        }

        // 2. Determine Role beforehand
        const { count } = await supabaseAdmin
            .from('tenant_members')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)

        const isFirst = !count || count === 0
        const memberRole = isFirst ? 'super_admin' : 'client_user'

        // 3. Upsert auth user with the REAL password and app_metadata
        const { data: userRecord, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            tenant.id,
            {
                password,
                email_confirm: true,
                app_metadata: { tenant_id: tenant.id, role: memberRole },
                user_metadata: { tenant_id: tenant.id, slug: tenant.slug }
            }
        )

        let authUserId = tenant.id

        if (updateError) {
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                id: tenant.id,
                email,
                password,
                email_confirm: true,
                app_metadata: { tenant_id: tenant.id, role: memberRole },
                user_metadata: { tenant_id: tenant.id, slug: tenant.slug }
            })
            if (createError) {
                console.error('Create user error:', createError.message)
            } else {
                authUserId = newUser?.user?.id || tenant.id
            }
        }

        // 4. Ensure tenant_members record exists
        let { data: existingMember } = await supabaseAdmin
            .from('tenant_members')
            .select('role')
            .eq('tenant_id', tenant.id)
            .eq('user_id', authUserId)
            .maybeSingle()

        if (!existingMember) {
            const { data: newMember, error: memErr } = await supabaseAdmin.from('tenant_members').insert({
                tenant_id: tenant.id,
                user_id: authUserId,
                role: memberRole
            }).select('role').single()

            if (!memErr) existingMember = newMember
        }

        const finalRole = existingMember?.role || memberRole

        // 5. Sign in
        let signInData;
        if (password) {
            const { data, error: signInError } = await supabasePublic.auth.signInWithPassword({ email: targetEmail, password })
            if (signInError) throw new Error(`Authentication failed: ${signInError.message}`)
            signInData = data
        } else {
            // Callback mode without password: generating a temporary session or using admin magic link
            // For now, we REQUIRE password or a valid Wix trust.
            // In a real OAuth flow, we'd exchange Wix Token for Supabase Token.
            throw new Error('Password required for secure Supabase handshake in this version.')
        }

        // 6. Fetch wallet & config
        const { data: wallet } = await supabaseAdmin
            .from('credit_wallets')
            .select('prepaid_credits, overage_amount')
            .eq('tenant_id', tenant.id)
            .single()

        const { data: config } = await supabaseAdmin
            .from('tenant_config')
            .select('onboarding_completed')
            .eq('tenant_id', tenant.id)
            .single()

        return new Response(JSON.stringify({
            user: {
                id: authUserId,
                email,
                role: finalRole,
                tenantContext: { id: tenant.id, slug: tenant.slug },
            },
            session: signInData.session,
            tenant,
            wallet: wallet || { prepaid_credits: 0, overage_amount: 0 },
            onboarding_completed: config?.onboarding_completed ?? true,
            isPayPerUse: (wallet?.prepaid_credits || 0) <= 0
        }), {
            headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error('wix-auth-bridge error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
