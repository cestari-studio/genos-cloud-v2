export const stripeMetering = {
    /**
     * Dispatches a token usage event to Stripe.
     * genOS™ v5.0.0 FinOps Standard.
     */
    async logUsage(tenantId: string, tokens: number, stripeCustomerId: string | null) {
        if (!stripeCustomerId) {
            console.warn(`[FinOps] Missing Stripe Customer ID for tenant ${tenantId}. Skipping Stripe dispatch.`);
            return;
        }

        const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
        if (!STRIPE_SECRET) {
            console.error('[FinOps] STRIPE_SECRET_KEY not configured.');
            return;
        }

        try {
            console.log(`[FinOps] Dispatching ${tokens} tokens to Stripe for customer ${stripeCustomerId}`);

            // Real Stripe Metering API call
            // https://stripe.com/docs/api/billing/meter_events/create
            const response = await fetch('https://api.stripe.com/v1/billing/meter_events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${STRIPE_SECRET}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'event_name': 'ai_tokens',
                    'payload[value]': tokens.toString(),
                    'payload[stripe_customer]': stripeCustomerId,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[FinOps] Stripe Metering Error:', errorData);
            } else {
                console.log(`[FinOps] Successfully logged usage to Stripe for ${tenantId}`);
            }
        } catch (error) {
            console.error('[FinOps] Failed to log usage to Stripe:', error);
        }
    }
};
