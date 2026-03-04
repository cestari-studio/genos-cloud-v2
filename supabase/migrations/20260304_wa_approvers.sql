-- ============================================================
-- genOS Migration: WhatsApp Approvers + Approval Events
-- Used by WhatsApprovalTab.tsx (Settings > WhatsApp)
-- ============================================================

-- 1. wa_approvers: humans who receive WA approval messages
CREATE TABLE IF NOT EXISTS wa_approvers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL, -- E.164 format without '+': 5511999999999
    role TEXT NOT NULL DEFAULT 'approver' CHECK (role IN ('approver', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, phone)
);

-- 2. wa_approval_events: audit trail of approval requests
CREATE TABLE IF NOT EXISTS wa_approval_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    approver_id UUID REFERENCES wa_approvers(id) ON DELETE SET NULL,
    approver_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'timeout')),
    message_sid TEXT, -- WhatsApp/Twilio message SID
    created_at TIMESTAMPTZ DEFAULT now(),
    decided_at TIMESTAMPTZ
);

-- 3. RLS
ALTER TABLE wa_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_approval_events ENABLE ROW LEVEL SECURITY;

-- wa_approvers: tenant members can manage their approvers
CREATE POLICY "Tenant wa_approvers access" ON wa_approvers
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM tenants WHERE id = wa_approvers.tenant_id AND depth_level = 0
        )
    );

-- wa_approval_events: audit, read-only for clients
CREATE POLICY "Tenant wa_approval_events access" ON wa_approval_events
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM tenants WHERE id = wa_approval_events.tenant_id AND depth_level = 0
        )
    );

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_wa_approvers_tenant ON wa_approvers(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_wa_events_tenant ON wa_approval_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_events_post ON wa_approval_events(post_id);

-- 5. tenant_config: WA config columns
ALTER TABLE tenant_config
    ADD COLUMN IF NOT EXISTS wa_approval_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS wa_double_approval BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS wa_approval_timeout_hours INTEGER DEFAULT 24;

COMMENT ON TABLE wa_approvers IS 'WhatsApp approval contacts per tenant';
COMMENT ON TABLE wa_approval_events IS 'Audit log of WA approval requests for post publishing';
