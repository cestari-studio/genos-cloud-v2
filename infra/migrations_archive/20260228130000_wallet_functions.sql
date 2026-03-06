-- Migration: Add debit_credits function
-- This RPC will be used by Edge Functions to safely update wallet balances.

CREATE OR REPLACE FUNCTION public.debit_credits(p_tenant_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE public.credit_wallets
    SET 
        prepaid_credits = CASE 
            WHEN prepaid_credits >= p_amount THEN prepaid_credits - p_amount 
            ELSE 0 
        END,
        overage_amount = CASE 
            WHEN prepaid_credits < p_amount THEN overage_amount + (p_amount - prepaid_credits)
            ELSE overage_amount
        END,
        updated_at = now()
    WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
