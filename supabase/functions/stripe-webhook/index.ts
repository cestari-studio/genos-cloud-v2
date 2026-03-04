// genOS — stripe-webhook edge function
// Handles Stripe events: payment completion, subscription changes, etc.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2024-12-18.acacia" });
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    try {
        const signature = req.headers.get("stripe-signature") ?? "";
        const body = await req.text();

        // Verify webhook signature
        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
        } catch (err: any) {
            console.error("Webhook signature verification failed:", err.message);
            return new Response(JSON.stringify({ error: "Invalid signature" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log(`Stripe webhook: ${event.type}`);

        // ─── checkout.session.completed ─────────────────────────────────────
        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const { tenant_id, package_id, action: metaAction, tier } = session.metadata ?? {};

            if (metaAction === "addon_purchase" && package_id) {
                // Approve the purchase
                await supabase.from("addon_purchases")
                    .update({ status: "approved" })
                    .eq("payment_reference", session.id);

                // Fetch package details and credit tenant
                const { data: pkg } = await supabase.from("addon_packages").select("token_amount, post_amount").eq("id", package_id).single();
                if (pkg && tenant_id) {
                    await supabase.rpc("credit_wallet", {
                        p_tenant_id: tenant_id,
                        p_tokens: pkg.token_amount,
                        p_posts: pkg.post_amount,
                        p_reference: session.id,
                    });
                }
            }

            if (metaAction === "schedule_subscription" && tenant_id && tier) {
                const tierLimits: Record<string, number> = { starter: 12, growth: 24, scale: 50, enterprise: 100 };
                await supabase.from("tenant_config").update({
                    schedule_enabled: true,
                    schedule_tier: tier,
                    schedule_post_limit: tierLimits[tier] ?? 12,
                    schedule_billing_start: new Date().toISOString(),
                }).eq("tenant_id", tenant_id);
            }
        }

        // ─── invoice.payment_succeeded ───────────────────────────────────────
        if (event.type === "invoice.payment_succeeded") {
            const invoice = event.data.object as Stripe.Invoice;
            const subscriptionId = (invoice as any).subscription as string;
            if (subscriptionId && invoice.customer) {
                // Renew subscription record
                const sub = await stripe.subscriptions.retrieve(subscriptionId);
                const tenant_id = sub.metadata?.tenant_id;
                if (tenant_id) {
                    await supabase.from("stripe_subscriptions").upsert({
                        tenant_id,
                        stripe_subscription_id: subscriptionId,
                        stripe_customer_id: invoice.customer as string,
                        status: sub.status,
                        current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
                        tier: sub.metadata?.tier ?? "starter",
                    });
                }
            }
        }

        // ─── invoice.payment_failed ──────────────────────────────────────────
        if (event.type === "invoice.payment_failed") {
            const invoice = event.data.object as Stripe.Invoice;
            const subscriptionId = (invoice as any).subscription as string;
            if (subscriptionId) {
                const sub = await stripe.subscriptions.retrieve(subscriptionId);
                const tenant_id = sub.metadata?.tenant_id;
                if (tenant_id) {
                    await supabase.from("stripe_subscriptions").update({
                        status: "past_due",
                    }).eq("stripe_subscription_id", subscriptionId);
                }
            }
        }

        // ─── customer.subscription.deleted ───────────────────────────────────
        if (event.type === "customer.subscription.deleted") {
            const sub = event.data.object as Stripe.Subscription;
            const tenant_id = sub.metadata?.tenant_id;
            if (tenant_id) {
                await supabase.from("tenant_config").update({
                    schedule_enabled: false,
                    schedule_tier: null,
                }).eq("tenant_id", tenant_id);

                await supabase.from("stripe_subscriptions").update({ status: "cancelled" })
                    .eq("stripe_subscription_id", sub.id);
            }
        }

        // ─── customer.subscription.updated ───────────────────────────────────
        if (event.type === "customer.subscription.updated") {
            const sub = event.data.object as Stripe.Subscription;
            const tenant_id = sub.metadata?.tenant_id;
            if (tenant_id) {
                await supabase.from("stripe_subscriptions").update({
                    status: sub.status,
                    current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
                }).eq("stripe_subscription_id", sub.id);
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("Stripe webhook error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
