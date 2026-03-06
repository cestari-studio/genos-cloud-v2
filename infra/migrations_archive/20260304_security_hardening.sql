-- 1. addon_purchases (isolation policies)
ALTER TABLE addon_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_select" ON addon_purchases;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON addon_purchases;
DROP POLICY IF EXISTS "tenant_isolation_update" ON addon_purchases;

CREATE POLICY "tenant_isolation_select" ON addon_purchases FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation_insert" ON addon_purchases FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation_update" ON addon_purchases FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));

-- 2. Corrigir INSERT permissivos
-- ai_sessions: adicionar check de tenant
DROP POLICY IF EXISTS "ai_sessions_insert" ON ai_sessions;
CREATE POLICY "ai_sessions_insert" ON ai_sessions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));

-- 3. Remover INSERT anon de csv_sync_log e feedback_queue
DROP POLICY IF EXISTS "anon_insert" ON csv_sync_log;
DROP POLICY IF EXISTS "anon_insert" ON feedback_queue;

-- Recriar para authenticated only
CREATE POLICY "auth_insert_csv" ON csv_sync_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert_feedback" ON feedback_queue FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Corrigir a view v_user_tenant_roles para não expor auth.users ao anon.
DROP VIEW IF EXISTS v_user_tenant_roles;
CREATE VIEW v_user_tenant_roles WITH (security_invoker = true) AS
SELECT tm.user_id, tm.tenant_id, tm.role, u.email
FROM tenant_members tm
JOIN auth.users u ON u.id = tm.user_id;
