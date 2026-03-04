import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': 'https://app.cestari.studio',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bridge-secret',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
}

serve(async (req) => {
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

        const { email, password } = await req.json()
        if (!email || !password) {
            throw new Error('Email and password are required')
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

        // 2. Upsert auth user with the REAL password (so signInWithPassword works)
        // First try to update existing user's password
        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            tenant.id,
            { password, email_confirm: true }
        )

        let authUserId = tenant.id

        if (updateError) {
            // User may not exist — create it with id=tenant.id and the real password
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                id: tenant.id,
                email,
                password,
                email_confirm: true,
                user_metadata: { tenant_id: tenant.id, slug: tenant.slug }
            })
            if (createError) {
                console.error('Create user error:', createError.message)
                // If creation fails due to existing user with different slug, try update by email lookup
            } else {
                authUserId = newUser?.user?.id || tenant.id
            }
        }

        // 3. Ensure tenant_members record exists
        let { data: existingMember } = await supabaseAdmin
            .from('tenant_members')
            .select('role')
            .eq('tenant_id', tenant.id)
            .eq('user_id', authUserId)
            .maybeSingle()

        if (!existingMember) {
            // Check if this is the first member (owner/provisioner)
            const { count } = await supabaseAdmin
                .from('tenant_members')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)

            const isFirst = !count || count === 0
            const memberRole = isFirst ? 'super_admin' : 'viewer'

            const { data: newMember, error: memErr } = await supabaseAdmin.from('tenant_members').insert({
                tenant_id: tenant.id,
                user_id: authUserId,
                role: memberRole
            }).select('role').single()

            if (!memErr) existingMember = newMember
        }

        const finalRole = existingMember?.role || 'client_user'

        // 4. Sign in with the real password to get a proper JWT session
        const { data: signInData, error: signInError } = await supabasePublic.auth.signInWithPassword({ email, password })

        if (signInError) {
            throw new Error(`Authentication failed: ${signInError.message}`)
        }

        // 5. Fetch wallet
        const { data: wallet } = await supabaseAdmin
            .from('credit_wallets')
            .select('prepaid_credits, overage_amount')
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
            isPayPerUse: (wallet?.prepaid_credits || 0) <= 0
        }), {
            headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('wix-auth-bridge error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
