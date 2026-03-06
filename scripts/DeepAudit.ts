import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAuditDump() {
    console.log("### DEEP TENANT AUDIT DUMP ###");

    const { data: tenants, error: tErr } = await supabase
        .from('tenants')
        .select('*');

    if (tErr) {
        console.error("Error fetching tenants:", tErr);
        return;
    }

    const { data: wallets } = await supabase
        .from('credit_wallets')
        .select('*');

    const { data: configs } = await supabase
        .from('tenant_config')
        .select('*');

    console.log("| ID (DB) | Wix Site ID | Nome | Slug | Email | Tokens | Status | Tier | Match? |");
    console.log("|---------|-------------|------|------|-------|--------|--------|------|--------|");

    tenants.forEach(t => {
        const wallet = wallets?.find(w => w.tenant_id === t.id);
        const config = configs?.find(c => c.tenant_id === t.id);

        const idMatch = t.id === t.wix_site_id ? "✅" : "❌";

        console.log(`| ${t.id} | ${t.wix_site_id || '---'} | ${t.name} | ${t.slug} | ${t.contact_email} | ${wallet?.prepaid_credits || 0} | ${t.status || 'active'} | ${t.plan || 'Free'} | ${idMatch} |`);
    });
}

runAuditDump();
