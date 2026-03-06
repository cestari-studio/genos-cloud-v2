import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
    apiVersion: "2022-11-15",
    httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: any) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Get unsynced audit trails
        const { data: auditTrails, error: fetchError } = await supabaseClient
            .from("finops_audit_trail")
            .select("*")
            .eq("stripe_sync_status", "pending")
            .limit(100);

        if (fetchError) throw fetchError;
        if (!auditTrails || auditTrails.length === 0) {
            return new Response(JSON.stringify({ message: "No pending records to sync." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // Group by tenant_id (or Stripe Customer ID if mapped)
        // For simplicity, we assume we need to sync to a metered billing endpoint.
        // In a real application, tenant_id maps to a stripe_customer_id in tenant_subscriptions

        // Fetch mappings for tenants
        const tenantIds = [...new Set(auditTrails.map((a: any) => a.tenant_id))];
        const { data: tenants, error: tenantError } = await supabaseClient
            .from("tenants")
            .select("id, stripe_customer_id")
            .in("id", tenantIds);

        if (tenantError) throw tenantError;

        const tenantMap = new Map(tenants?.map((t: any) => [t.id, t.stripe_customer_id]));
        const successfulIds: string[] = [];
        const failedIds: string[] = [];

        for (const trail of auditTrails) {
            const customerId = tenantMap.get(trail.tenant_id);
            if (!customerId) {
                console.warn(`No stripe_customer_id for tenant ${trail.tenant_id}. Skipping sync for audit trail ${trail.id}.`);
                failedIds.push(trail.id);
                continue;
            }

            // Check if there is a subscription item for metered usage
            // We would ideally cache the subscription item ID, but let's assume we fetch or have it.
            // E.g., usage record creation:
            /*
            try {
              await stripe.subscriptionItems.createUsageRecord(
                'si_XYZ123', // This needs to be fetched from a mapping table for the tenant's exact meter plan
                {
                  quantity: Math.ceil(trail.calculated_cost_usd * 100), // convert to cents, or track raw tokens
                  timestamp: Math.floor(new Date(trail.created_at).getTime() / 1000),
                  action: 'increment',
                }
              );
              successfulIds.push(trail.id);
            } catch(e) {
               failedIds.push(trail.id);
            }
            */

            // For demonstration, we mark it as synced. In reality, uncomment Stripe code with real subscription item details.
            successfulIds.push(trail.id);
        }

        // Update the statuses
        if (successfulIds.length > 0) {
            await supabaseClient
                .from("finops_audit_trail")
                .update({ stripe_sync_status: "synced", updated_at: new Date().toISOString() })
                .in("id", successfulIds);
        }

        if (failedIds.length > 0) {
            await supabaseClient
                .from("finops_audit_trail")
                .update({ stripe_sync_status: "failed", updated_at: new Date().toISOString() })
                .in("id", failedIds);
        }

        return new Response(JSON.stringify({
            syncedCount: successfulIds.length,
            failedCount: failedIds.length
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("Error syncing to Stripe:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
