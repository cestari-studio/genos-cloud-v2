import { Router } from 'express';
import { getSupabase } from '../services/supabaseClient';
import { createClient as createWixClient, ApiKeyStrategy } from '@wix/sdk';
import { members } from '@wix/members';

export const authRouter = Router();

// 1. Instância do Cliente Wix (Headless Strategy)
let wix: any = null;
if (process.env.WIX_API_KEY && process.env.WIX_SITE_ID) {
    wix = createWixClient({
        modules: { members },
        auth: ApiKeyStrategy({
            apiKey: process.env.WIX_API_KEY,
            siteId: process.env.WIX_SITE_ID
        })
    });
}

// 2. Rota do Wix Bridge
authRouter.post('/wix-bridge', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    try {
        if (!wix) {
            // Modo de fallback (Dev Local / Stub) caso o Wix SDK não tenha sido completamente provido
            console.warn('[auth] WIX_API_KEY não localizada. Simulando validação Wix Bridge para Onboarding...');
            if (!email.includes('@')) {
                return res.status(401).json({ error: 'Credenciais Wix Inválidas. Inclua um "@"' });
            }
        } else {
            // PASSO A: Validar credenciais no Wix
            const wixMember = await wix.members.login(email, password);

            if (!wixMember || !wixMember.member) {
                return res.status(401).json({ error: 'Credenciais Wix Inválidas' });
            }
        }

        // PASSO B: Buscar o Tenant ID associado a este e-mail no genOS
        const supabaseAdmin = getSupabase(); // Usa Service Role Key, Bypass RLS
        const { data: tenantMap, error: tenantError } = await supabaseAdmin
            .from('tenants_mapping')
            .select('tenant_id, role')
            .eq('email', email)
            .single();

        if (tenantError || !tenantMap) {
            console.warn(`[auth] Tenant mapping not found for ${email}. Error:`, tenantError?.message);

            // Retorna sucesso em desenvolvimento local (permitindo fallback login)
            return res.status(200).json({
                message: 'Autenticação temporária (dev) via Wix Bridge concluída.',
                user: { email, source: 'wix-stub' },
            });
        }

        // Retorna o Auth State. 
        // O Next.js snippet usava JWT do Supabase, mas nossa autenticação Express (identity.ts) 
        // valida via Header x-user-email. Ao retornar success 200, a UI atualiza as credenciais.
        return res.status(200).json({
            message: 'Autenticação Wix via genOS concluída.',
            user: {
                email: email,
                tenant_id: tenantMap.tenant_id,
                role: tenantMap.role
            }
        });

    } catch (error: any) {
        console.error('Auth Bridge Error:', error);
        // Tratar erro do Wix API especificamente
        if (error?.message?.includes('invalid credentials')) {
            return res.status(401).json({ error: 'Credenciais Wix Inválidas' });
        }
        return res.status(500).json({ error: 'Erro na ponte de autenticação Wix.' });
    }
});
