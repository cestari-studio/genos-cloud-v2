-- ============================================================
-- genOS Migration: Social Connections & Publishing Queue
-- Meta Integration (Instagram + Facebook) + WhatsApp ready
-- ============================================================

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- 2. CREATE TABLE: social_connections
CREATE TABLE IF NOT EXISTS social_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'whatsapp')),
    platform_user_id TEXT NOT NULL,
    platform_username TEXT,
    platform_profile_pic TEXT,
    access_token_encrypted_id UUID REFERENCES vault.secrets(id), -- Reference to Vault secret
    token_expires_at TIMESTAMPTZ,
    token_type TEXT DEFAULT 'long_lived',
    scopes TEXT[],
    ig_account_id TEXT, -- For IG via Facebook Login
    fb_page_id TEXT,    -- For FB publishing
    wa_phone_number_id TEXT, -- WHATSAPP READY
    wa_business_id TEXT,     -- WHATSAPP READY
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
    connected_by UUID REFERENCES auth.users(id),
    connected_at TIMESTAMPTZ DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    UNIQUE(tenant_id, platform, platform_user_id)
);

-- 3. CREATE TABLE: publish_queue
CREATE TABLE IF NOT EXISTS publish_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'container_created', 'published', 'failed')),
    container_id TEXT, -- Meta container ID
    external_post_id TEXT, -- Published ID
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CREATE TABLE: publish_log
CREATE TABLE IF NOT EXISTS publish_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publish_queue_id UUID NOT NULL REFERENCES publish_queue(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- container_created, status_check, published, error, retry
    detail JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. WHATSAPP READY: wa_contacts
CREATE TABLE IF NOT EXISTS wa_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    wa_id TEXT NOT NULL, -- WhatsApp ID
    phone_number TEXT,
    display_name TEXT,
    role TEXT DEFAULT 'approver' CHECK (role IN ('approver', 'viewer', 'admin')),
    opted_in BOOLEAN DEFAULT false,
    opted_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, wa_id)
);

-- 6. WHATSAPP READY: wa_events
CREATE TABLE IF NOT EXISTS wa_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    wa_contact_id UUID REFERENCES wa_contacts(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- message_sent, message_received, button_clicked, template_sent
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. RLS POLICIES

ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_events ENABLE ROW LEVEL SECURITY;

-- social_connections: Hierarchy-based RLS
CREATE POLICY "Master social_connections access" ON social_connections
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM tenants WHERE id = social_connections.tenant_id AND depth_level = 0)
    );

CREATE POLICY "Agency social_connections access" ON social_connections
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM tenants t 
            JOIN tenant_members tm ON t.id = tm.tenant_id 
            WHERE tm.user_id = auth.uid() 
            AND (t.id = social_connections.tenant_id OR t.parent_id = social_connections.tenant_id)
        )
    );

CREATE POLICY "Client social_connections access" ON social_connections
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM tenant_members WHERE user_id = auth.uid() AND tenant_id = social_connections.tenant_id)
    );

-- Similar policies for other tables
-- (Shortened version for brevity, applying standard genOS multi-tenant patterns)

CREATE POLICY "Multi-tenant publish_queue" ON publish_queue
    FOR ALL TO authenticated USING (
        tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM tenants WHERE id = publish_queue.tenant_id AND depth_level = 0)
    );

CREATE POLICY "Multi-tenant publish_log" ON publish_log
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM publish_queue pq WHERE pq.id = publish_log.publish_queue_id AND pq.tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
    );

CREATE POLICY "Multi-tenant wa_contacts" ON wa_contacts
    FOR ALL TO authenticated USING (
        tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Multi-tenant wa_events" ON wa_events
    FOR ALL TO authenticated USING (
        tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
    );

-- 8. HELPER FUNCTIONS (Vault integration)

-- store_social_token: Encrypts and saves to Vault
CREATE OR REPLACE FUNCTION store_social_token(p_tenant_id UUID, p_platform TEXT, p_token TEXT)
RETURNS UUID AS $$
DECLARE
    v_secret_id UUID;
BEGIN
    INSERT INTO vault.secrets (name, description, secret)
    VALUES ('social_token_' || p_platform || '_' || p_tenant_id, 'OAuth token for ' || p_platform, p_token)
    RETURNING id INTO v_secret_id;
    
    RETURN v_secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_social_token: Decrypts from Vault
CREATE OR REPLACE FUNCTION get_social_token(p_connection_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
BEGIN
    SELECT s.secret INTO v_token
    FROM social_connections c
    JOIN vault.secrets s ON c.access_token_encrypted_id = s.id
    WHERE c.id = p_connection_id;
    
    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. FEATURE FLAG: wa_enabled
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS wa_enabled BOOLEAN DEFAULT false;

-- 10. INDEXES
CREATE INDEX IF NOT EXISTS idx_social_conn_tenant ON social_connections(tenant_id, platform, status);
CREATE INDEX IF NOT EXISTS idx_publish_queue_process ON publish_queue(tenant_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_publish_queue_pending ON publish_queue(status) WHERE status IN ('pending', 'processing');
