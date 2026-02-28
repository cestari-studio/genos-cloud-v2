-- Create the audience_analytics table
CREATE TABLE IF NOT EXISTS public.audience_analytics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    location jsonb NOT NULL DEFAULT '[]',
    age_groups jsonb NOT NULL DEFAULT '[]',
    genders jsonb NOT NULL DEFAULT '[]',
    purchase_interests jsonb NOT NULL DEFAULT '[]',
    lifestyle_markers jsonb NOT NULL DEFAULT '[]',
    content_consumption jsonb NOT NULL DEFAULT '{}',
    sentiment_rules jsonb NOT NULL DEFAULT '{}', -- Define como a marca soa pra cada nicho
    dynamic_categories jsonb NOT NULL DEFAULT '[]', -- Sugestões de categorias do Granite
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT unique_tenant_audience UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE public.audience_analytics ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policy
CREATE POLICY "Tenant isolation for audience_analytics" ON public.audience_analytics
    FOR ALL USING (tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ));

-- Create an updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_audience_analytics_updated_at ON public.audience_analytics;
CREATE TRIGGER set_audience_analytics_updated_at
BEFORE UPDATE ON public.audience_analytics
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
