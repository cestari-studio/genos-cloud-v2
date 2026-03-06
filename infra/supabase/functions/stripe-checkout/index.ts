// genOS — stripe-checkout edge function
// Creates Stripe Checkout sessions for addon packages or schedule subscriptions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // Allow all for now to unblock dev, or add specific domains
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://genos.cestari.studio";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2024-12-18.acacia" });

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const authHeader = req.headers.get("Authorization") ?? "";
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { action, tenant_id, package_id, price_id, tier } = await req.json();

        // Get or create Stripe customer for tenant
        const getOrCreateCustomer = async (): Promise<string> => {
            const { data: existing } = await supabase
                .from("stripe_customers")
                .select("stripe_customer_id")
                .eq("tenant_id", tenant_id)
                .maybeSingle();

            if (existing?.stripe_customer_id) return existing.stripe_customer_id;

            const { data: tenant } = await supabase.from("tenants").select("name, contact_email").eq("id", tenant_id).single();
            const customer = await stripe.customers.create({
                name: tenant?.name ?? "genOS Tenant",
                email: tenant?.contact_email ?? user.email,
                metadata: { tenant_id },
            });

            await supabase.from("stripe_customers").upsert({ tenant_id, stripe_customer_id: customer.id });
            return customer.id;
        };

        // ─── ACTION: create_addon_checkout ──────────────────────────────────
        if (action === "create_addon_checkout") {
            const { data: pkg } = await supabase.from("addon_packages").select("*").eq("id", package_id).single();
            if (!pkg?.stripe_price_id) {
                return new Response(JSON.stringify({ error: "Package has no Stripe price" }), {
                    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const customerId = await getOrCreateCustomer();
            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                customer: customerId,
                line_items: [{ price: pkg.stripe_price_id, quantity: 1 }],
                success_url: `${APP_URL}/content-factory/settings?checkout=success&pkg=${package_id}`,
                cancel_url: `${APP_URL}/content-factory/settings?checkout=cancelled`,
                metadata: { tenant_id, package_id, action: "addon_purchase" },
            });

            // Create pending purchase record
            await supabase.from("addon_purchases").insert({
                tenant_id,
                package_id,
                status: "pending",
                payment_reference: session.id,
            });

            return new Response(JSON.stringify({ success: true, data: { url: session.url } }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ─── ACTION: create_schedule_subscription ───────────────────────────
        if (action === "create_schedule_subscription") {
            if (!price_id) {
                return new Response(JSON.stringify({ error: "price_id required for subscription" }), {
                    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const customerId = await getOrCreateCustomer();
            const session = await stripe.checkout.sessions.create({
                mode: "subscription",
                customer: customerId,
                line_items: [{ price: price_id, quantity: 1 }],
                success_url: `${APP_URL}/content-factory/schedule?checkout=success`,
                cancel_url: `${APP_URL}/content-factory/schedule?checkout=cancelled`,
                metadata: { tenant_id, tier: tier ?? "starter", action: "schedule_subscription" },
                subscription_data: { metadata: { tenant_id, tier: tier ?? "starter" } },
            });

            return new Response(JSON.stringify({ success: true, data: { url: session.url } }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ─── ACTION: manage_subscription ────────────────────────────────────
        if (action === "manage_subscription") {
            const customerId = await getOrCreateCustomer();
            const portal = await stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: `${APP_URL}/content-factory/settings`,
            });

            return new Response(JSON.stringify({ success: true, data: { url: portal.url } }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
