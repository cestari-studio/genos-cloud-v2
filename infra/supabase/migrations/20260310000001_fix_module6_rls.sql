-- Fix RLS Policies for Module 6, 8, 9 Tables

-- Matrix Assets
DROP POLICY IF EXISTS "Tenants can manage their own matrix assets" ON public.matrix_assets;

CREATE POLICY "Tenants can manage their own matrix assets" 
ON public.matrix_assets 
FOR ALL 
TO authenticated
USING (
    tenant_id IN (
        SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
    OR public.is_authorized_for_tenant(tenant_id)
) 
WITH CHECK (
    tenant_id IN (
        SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
    OR public.is_authorized_for_tenant(tenant_id)
);

-- FinOps Audit Trail
DROP POLICY IF EXISTS "Tenants can view their own finops logs" ON public.finops_audit_trail;

CREATE POLICY "Tenants can view their own finops logs" 
ON public.finops_audit_trail 
FOR SELECT 
TO authenticated
USING (
    tenant_id IN (
        SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
    OR public.is_authorized_for_tenant(tenant_id)
);

-- Social Posts Queue
DROP POLICY IF EXISTS "Tenants can manage their own social queue" ON public.social_posts_queue;

CREATE POLICY "Tenants can manage their own social queue" 
ON public.social_posts_queue 
FOR ALL 
TO authenticated
USING (
    tenant_id IN (
        SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
    OR public.is_authorized_for_tenant(tenant_id)
) 
WITH CHECK (
    tenant_id IN (
        SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
    OR public.is_authorized_for_tenant(tenant_id)
);
