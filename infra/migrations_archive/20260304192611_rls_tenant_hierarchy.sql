-- ==============================================================================
-- genOS Cloud - Hierarchical Multi-Tenant RLS Policies
-- Enables Master > Agency > Client Visibility Overrides
-- ==============================================================================

-- 1. Create the Security Definer Function
-- This function allows Postgres to determine if the currently authenticated user
-- belongs to a tenant that is authorized to view/edit the TARGET tenant.
-- It bypasses standard RLS so it can lookup 'tenant_members' and 'tenants' safely.
CREATE OR REPLACE FUNCTION public.is_authorized_for_tenant(target_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
    user_tenant record;
BEGIN
    current_user_id := auth.uid();
    
    -- If no user is logged in, obviously false.
    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- Get the User's primary tenant membership
    -- (We assume ONE primary membership for simplification, taking the clearest match)
    SELECT t.id, t.depth_level INTO user_tenant
    FROM public.tenant_members tm
    JOIN public.tenants t ON tm.tenant_id = t.id
    WHERE tm.user_id = current_user_id
    LIMIT 1;

    -- Condition 0: The user doesn't belong to ANY tenant
    IF user_tenant IS NULL THEN
        RETURN false;
    END IF;

    -- Condition 1: Direct Ownership (The user is querying their own exact tenant)
    IF user_tenant.id = target_tenant_id THEN
        RETURN true;
    END IF;

    -- Condition 2: Master Access (Depth = 0)
    -- Master can access ALL tenants globally.
    IF user_tenant.depth_level = 0 THEN
        RETURN true;
    END IF;

    -- Condition 3: Agency Access (Depth = 1)
    -- Agency can access any tenant where parent_tenant_id = agency.id
    IF user_tenant.depth_level = 1 THEN
        PERFORM 1 FROM public.tenants 
        WHERE id = target_tenant_id 
          AND parent_tenant_id = user_tenant.id;
          
        IF FOUND THEN
            RETURN true;
        END IF;
    END IF;

    -- Condition 4: Client Access (Depth = 2)
    -- Clients can NEVER access records outside their own exact tenant.
    -- Since we already checked Condition 1 (Direct Ownership), we return false.
    RETURN false;
END;
$$;


-- ==============================================================================
-- 2. Apply Hierarchical Policies
-- ==============================================================================

-- Drop existing old policies to avoid collision (if any)
DROP POLICY IF EXISTS "Users can view their own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can view tenant members" ON public.tenant_members;
DROP POLICY IF EXISTS "Users can view own brand dna" ON public.brand_dna;
DROP POLICY IF EXISTS "Users can modify own brand dna" ON public.brand_dna;
DROP POLICY IF EXISTS "Users can view own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can create own posts" ON public.posts;


-- A. Tenants Table
CREATE POLICY "Hierarchical Tenant Visibility" ON public.tenants
    FOR SELECT
    USING (public.is_authorized_for_tenant(id));

CREATE POLICY "Hierarchical Tenant Modification" ON public.tenants
    FOR ALL
    USING (public.is_authorized_for_tenant(id));


-- B. Tenant Members Table
CREATE POLICY "Hierarchical Tenant Members Visibility" ON public.tenant_members
    FOR SELECT
    USING (public.is_authorized_for_tenant(tenant_id));


-- C. Brand DNA Table
CREATE POLICY "Hierarchical Brand DNA Visibility" ON public.brand_dna
    FOR SELECT
    USING (public.is_authorized_for_tenant(tenant_id));

CREATE POLICY "Hierarchical Brand DNA Modification" ON public.brand_dna
    FOR ALL
    USING (public.is_authorized_for_tenant(tenant_id));


-- D. Posts Table
CREATE POLICY "Hierarchical Posts Visibility" ON public.posts
    FOR SELECT
    USING (public.is_authorized_for_tenant(tenant_id));

CREATE POLICY "Hierarchical Posts Modification" ON public.posts
    FOR ALL
    USING (public.is_authorized_for_tenant(tenant_id));

-- E. Tenant Config / Billing Contracts
DROP POLICY IF EXISTS "Users can view own config" ON public.tenant_config;
CREATE POLICY "Hierarchical Config Visibility" ON public.tenant_config
    FOR ALL
    USING (public.is_authorized_for_tenant(tenant_id));

DROP POLICY IF EXISTS "Users can view own billing" ON public.billing_contracts;
CREATE POLICY "Hierarchical Billing Visibility" ON public.billing_contracts
    FOR ALL
    USING (public.is_authorized_for_tenant(tenant_id));
