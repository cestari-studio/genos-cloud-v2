-- 1. Ensure we have a secure way to find or create auth users for seed
DO $$
DECLARE
    master_uid UUID;
    agency_uid UUID;
    master_tenant_id UUID := '056fbab6-3d03-4ceb-94a4-d91338f514b8';
    agency_tenant_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN
    -- Check for Master Admin
    SELECT id INTO master_uid FROM auth.users WHERE email = 'mail@cestari.studio';
    IF master_uid IS NOT NULL THEN
        -- Link Master Admin to Master and Agency tenants
        INSERT INTO public.tenant_members (tenant_id, user_id, role)
        VALUES (master_tenant_id, master_uid, 'super_admin')
        ON CONFLICT (tenant_id, user_id) DO NOTHING;
        
        INSERT INTO public.tenant_members (tenant_id, user_id, role)
        VALUES (agency_tenant_id, master_uid, 'super_admin')
        ON CONFLICT (tenant_id, user_id) DO NOTHING;
    END IF;

    -- Check for Agency Operator
    SELECT id INTO agency_uid FROM auth.users WHERE email = 'ocestari89@gmail.com';
    IF agency_uid IS NOT NULL THEN
        -- Link Agency Operator to Agency tenant
        INSERT INTO public.tenant_members (tenant_id, user_id, role)
        VALUES (agency_tenant_id, agency_uid, 'agency_operator')
        ON CONFLICT (tenant_id, user_id) DO NOTHING;
    END IF;
END $$;

-- 2. Create helper function for auto-provisioning in Edge Functions if not exists
CREATE OR REPLACE FUNCTION public.provision_tenant_member(p_tenant_id UUID, p_user_id UUID, p_role TEXT DEFAULT 'client_user')
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (p_tenant_id, p_user_id, p_role)
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
