-- Migration: Unify Roles and Sync to JWT
-- Standardizes roles: super_admin, agency_operator, client_user

-- 1. Sync Trigger Function
CREATE OR REPLACE FUNCTION public.sync_user_role_to_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_metadata = 
    coalesce(raw_app_metadata, '{}'::jsonb) || 
    jsonb_strip_nulls(jsonb_build_object('genOS_role', NEW.role))
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach Trigger
DROP TRIGGER IF EXISTS on_tenant_member_upsert ON public.tenant_members;
CREATE TRIGGER on_tenant_member_upsert
  AFTER INSERT OR UPDATE ON public.tenant_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_to_metadata();

-- 3. Update Existing Metadata
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT user_id, role FROM public.tenant_members LOOP
        UPDATE auth.users
        SET raw_app_metadata = 
            coalesce(raw_app_metadata, '{}'::jsonb) || 
            jsonb_build_object('genOS_role', r.role)
        WHERE id = r.user_id;
    END LOOP;
END;
$$;

-- 4. Update RLS Policies to use unified roles
-- Brand DNA
DROP POLICY IF EXISTS "DNA: Enable write access for agency operators" ON public.brand_dna;
CREATE POLICY "DNA: Enable write access for agency operators" ON public.brand_dna
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()) 
        AND (
            (auth.jwt() -> 'app_metadata' ->> 'genOS_role') IN ('super_admin', 'agency_operator')
            OR (auth.jwt() -> 'user_metadata' ->> 'genOS_role') IN ('super_admin', 'agency_operator')
        )
    );

-- Audience
DROP POLICY IF EXISTS "Audience: Enable write access for agency operators" ON public.audience_analytics;
CREATE POLICY "Audience: Enable write access for agency operators" ON public.audience_analytics
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()) 
        AND (
            (auth.jwt() -> 'app_metadata' ->> 'genOS_role') IN ('super_admin', 'agency_operator')
            OR (auth.jwt() -> 'user_metadata' ->> 'genOS_role') IN ('super_admin', 'agency_operator')
        )
    );
