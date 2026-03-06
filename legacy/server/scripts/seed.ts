import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
    console.log("Seeding database...");

    // 1. Create a Master/Enterprise Tenant
    const { data: enterpriseTenant, error: t1Err } = await supabase
        .from('tenants')
        .upsert({
            name: 'Cestari Studio Master',
            slug: 'cestari-studio',
            plan: 'enterprise',
            status: 'active'
        }, { onConflict: 'slug' })
        .select()
        .single();

    if (t1Err) {
        console.error("Failed to seed Enterprise tenant:", t1Err);
        return;
    }

    // 2. Create a Client Tenant
    const { data: clientTenant, error: t2Err } = await supabase
        .from('tenants')
        .upsert({
            name: 'Polo Ar Condicionado',
            slug: 'polo-ar',
            plan: 'enterprise',
            status: 'active',
            parent_tenant_id: enterpriseTenant.id
        }, { onConflict: 'slug' })
        .select()
        .single();

    if (t2Err) {
        console.error("Failed to seed Client tenant:", t2Err);
        return;
    }

    console.log("Successfully seeded tenants:", enterpriseTenant.name, "and", clientTenant.name);

    // 3. Insert DNA to test if the strict constraints column was created
    const { error: dnaErr } = await supabase
        .from('brand_dna')
        .upsert({
            tenant_id: enterpriseTenant.id,
            strict_compliance: true,
            content_rules: {
                limits: { description: { min: 600, max: 700 } },
                sequence: ['reels', 'carousel']
            }
        }, { onConflict: 'tenant_id' });

    if (dnaErr) {
        console.error("Failed to seed brand DNA (Did you run the 02_ migration?):", dnaErr);
    } else {
        console.log("Successfully seeded brand DNA settings.");
    }

    console.log("Seed complete.");
}

seedDatabase();
