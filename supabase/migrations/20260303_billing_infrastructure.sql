-- ============================================================
-- genOS Cloud Platform v2 — Billing Infrastructure Migration
-- Run this in Supabase SQL Editor
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. token_cost_config
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_cost_config (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         REFERENCES tenants(id) ON DELETE CASCADE,
  format              TEXT         NOT NULL CHECK (format IN ('feed','carrossel','stories','reels')),
  operation           TEXT         NOT NULL CHECK (operation IN ('generate','revise','format','regenerate')),
  base_cost           INTEGER      NOT NULL,
  per_slide_cost      NUMERIC      DEFAULT 0,
  ai_model_multiplier JSONB        DEFAULT '{"gemini-2.0-flash": 1.0, "gemini-2.5-pro": 3.5}'::jsonb,
  created_at          TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (tenant_id, format, operation)
);

-- Seed: global defaults (tenant_id = NULL)
INSERT INTO token_cost_config (tenant_id, format, operation, base_cost, per_slide_cost) VALUES
  -- Feed
  (NULL, 'feed', 'generate',    4, 0),
  (NULL, 'feed', 'revise',      2, 0),
  (NULL, 'feed', 'format',      1, 0),
  (NULL, 'feed', 'regenerate',  4, 0),
  -- Carrossel
  (NULL, 'carrossel', 'generate',   3, 1),
  (NULL, 'carrossel', 'revise',     2, 0.5),
  (NULL, 'carrossel', 'format',     1, 0.2),
  (NULL, 'carrossel', 'regenerate', 3, 1),
  -- Stories
  (NULL, 'stories', 'generate',   3, 0),
  (NULL, 'stories', 'revise',     2, 0),
  (NULL, 'stories', 'format',     1, 0),
  (NULL, 'stories', 'regenerate', 3, 0),
  -- Reels
  (NULL, 'reels', 'generate',   5, 0),
  (NULL, 'reels', 'revise',     3, 0),
  (NULL, 'reels', 'format',     2, 0),
  (NULL, 'reels', 'regenerate', 5, 0)
ON CONFLICT (tenant_id, format, operation) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 2. addon_packages
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addon_packages (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT         NOT NULL,
  tokens       INTEGER      NOT NULL,
  posts        INTEGER      NOT NULL,
  price_cents  INTEGER      NOT NULL,
  currency     TEXT         DEFAULT 'BRL',
  is_active    BOOLEAN      DEFAULT true,
  sort_order   INTEGER      DEFAULT 0,
  created_at   TIMESTAMPTZ  DEFAULT now()
);

INSERT INTO addon_packages (name, tokens, posts, price_cents, sort_order) VALUES
  ('Pacote Essencial',     500,   6,   9900,   1),
  ('Pacote Profissional', 1500,  18,  24900,   2),
  ('Pacote Business',     5000,  50,  69900,   3),
  ('Pacote Enterprise',  15000, 150, 149900,   4)
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 3. addon_purchases
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addon_purchases (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  package_id          UUID         REFERENCES addon_packages(id),
  tokens_purchased    INTEGER      NOT NULL,
  posts_purchased     INTEGER      NOT NULL,
  price_paid_cents    INTEGER      NOT NULL,
  payment_method      TEXT         DEFAULT 'manual' CHECK (payment_method IN ('manual','stripe','pix','boleto')),
  payment_reference   TEXT,
  purchased_by        UUID         REFERENCES auth.users(id),
  approved_by         UUID,
  status              TEXT         DEFAULT 'pending' CHECK (status IN ('pending','approved','applied','rejected','refunded')),
  applied_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- 4. ALTER usage_logs: add billing columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE usage_logs
  ADD COLUMN IF NOT EXISTS format               TEXT,
  ADD COLUMN IF NOT EXISTS slide_count          INTEGER     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ai_model             TEXT,
  ADD COLUMN IF NOT EXISTS actual_api_tokens    INTEGER,
  ADD COLUMN IF NOT EXISTS genos_tokens_debited INTEGER;


-- ────────────────────────────────────────────────────────────
-- 5. ALTER tenant_config: add billing controls
-- ────────────────────────────────────────────────────────────
ALTER TABLE tenant_config
  ADD COLUMN IF NOT EXISTS hard_block_enabled   BOOLEAN  DEFAULT true,
  ADD COLUMN IF NOT EXISTS overage_allowed      BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS low_balance_threshold INTEGER  DEFAULT 50,
  ADD COLUMN IF NOT EXISTS zero_balance_message TEXT     DEFAULT 'Seu saldo de tokens foi esgotado. Adquira um pacote adicional para continuar gerando conteúdo.';


-- ────────────────────────────────────────────────────────────
-- 6. FUNCTION: calculate_token_cost
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION calculate_token_cost(
  p_tenant_id   UUID,
  p_format      TEXT,
  p_operation   TEXT,
  p_slide_count INTEGER  DEFAULT 1,
  p_ai_model    TEXT     DEFAULT 'gemini-2.0-flash'
)
RETURNS INTEGER
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_config     token_cost_config%ROWTYPE;
  v_base       INTEGER;
  v_slide      NUMERIC;
  v_multiplier NUMERIC;
  v_total      INTEGER;
BEGIN
  -- Tenant-specific config first, fall back to global (tenant_id IS NULL)
  SELECT * INTO v_config
  FROM token_cost_config
  WHERE (tenant_id = p_tenant_id OR tenant_id IS NULL)
    AND format    = p_format
    AND operation = p_operation
  ORDER BY tenant_id NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 1; -- safe fallback
  END IF;

  v_base       := v_config.base_cost;
  v_slide      := COALESCE(v_config.per_slide_cost, 0) * GREATEST(p_slide_count - 1, 0);
  v_multiplier := COALESCE((v_config.ai_model_multiplier ->> p_ai_model)::NUMERIC, 1.0);
  v_total      := CEIL((v_base + v_slide) * v_multiplier);

  RETURN GREATEST(v_total, 1);
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 7. FUNCTION: check_can_generate
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_can_generate(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_config           RECORD;
  v_wallet           RECORD;
  v_posts_this_month BIGINT;
  v_tokens_remaining NUMERIC;
  v_post_limit       INTEGER;
BEGIN
  SELECT * INTO v_config FROM tenant_config   WHERE tenant_id = p_tenant_id;
  SELECT * INTO v_wallet FROM credit_wallets  WHERE tenant_id = p_tenant_id;

  SELECT COUNT(*) INTO v_posts_this_month
  FROM posts
  WHERE tenant_id = p_tenant_id
    AND created_at >= date_trunc('month', now());

  v_tokens_remaining := COALESCE(v_wallet.prepaid_credits, 0);
  v_post_limit       := COALESCE(v_config.post_limit, 24);

  -- Hard-block checks
  IF COALESCE(v_config.hard_block_enabled, true) THEN
    IF v_tokens_remaining <= 0 THEN
      RETURN jsonb_build_object(
        'allowed',         false,
        'reason',          'tokens_exhausted',
        'message',         COALESCE(v_config.zero_balance_message, 'Saldo de tokens esgotado.'),
        'tokens_remaining', 0,
        'posts_remaining', GREATEST(v_post_limit - v_posts_this_month, 0)
      );
    END IF;

    IF v_posts_this_month >= v_post_limit THEN
      RETURN jsonb_build_object(
        'allowed',          false,
        'reason',           'posts_exhausted',
        'message',          'Limite de posts do mês atingido.',
        'tokens_remaining', v_tokens_remaining,
        'posts_remaining',  0
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed',          true,
    'tokens_remaining', v_tokens_remaining,
    'posts_remaining',  GREATEST(v_post_limit - v_posts_this_month, 0),
    'posts_used',       v_posts_this_month,
    'posts_limit',      v_post_limit,
    'low_balance',      (v_tokens_remaining <= COALESCE(v_config.low_balance_threshold, 50))
  );
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 8. FUNCTION: apply_addon_package
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION apply_addon_package(p_purchase_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_purchase addon_purchases%ROWTYPE;
BEGIN
  SELECT * INTO v_purchase
  FROM addon_purchases
  WHERE id = p_purchase_id AND status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase % not found or not in approved status', p_purchase_id;
  END IF;

  -- Credit tokens to wallet
  UPDATE credit_wallets
  SET prepaid_credits = prepaid_credits + v_purchase.tokens_purchased,
      updated_at = now()
  WHERE tenant_id = v_purchase.tenant_id;

  -- Credit posts to tenant_config
  UPDATE tenant_config
  SET post_limit = post_limit + v_purchase.posts_purchased
  WHERE tenant_id = v_purchase.tenant_id;

  -- Mark purchase as applied
  UPDATE addon_purchases
  SET status = 'applied', applied_at = now()
  WHERE id = p_purchase_id;

  -- Activity log entry
  INSERT INTO activity_log (tenant_id, category, summary, detail)
  VALUES (
    v_purchase.tenant_id,
    'commercial',
    'Pacote adicional aplicado',
    format('+ %s tokens, + %s posts (compra #%s)',
      v_purchase.tokens_purchased,
      v_purchase.posts_purchased,
      p_purchase_id)
  );
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 9. RLS POLICIES
-- ────────────────────────────────────────────────────────────

-- Enable RLS
ALTER TABLE token_cost_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_packages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_purchases    ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
-- (assumes JWT claim 'user_role' is set via trigger or auth hook)
-- Fallback: look up in tenant_members

-- token_cost_config: everyone can read; only master can write
CREATE POLICY "token_cost_config_select_all" ON token_cost_config
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "token_cost_config_master_write" ON token_cost_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

-- addon_packages: everyone can read; only master can write
CREATE POLICY "addon_packages_select_all" ON addon_packages
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "addon_packages_master_write" ON addon_packages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

-- addon_purchases:
--   Master: all operations on all rows
--   Agency: CUD on their own tenant tree
--   Client: SELECT own + INSERT (to request)
CREATE POLICY "addon_purchases_master_all" ON addon_purchases
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_members WHERE user_id = auth.uid() AND role = 'master')
  );

CREATE POLICY "addon_purchases_agency_own" ON addon_purchases
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT t.id FROM tenants t
      JOIN tenant_members tm ON tm.tenant_id = t.id
      WHERE tm.user_id = auth.uid() AND tm.role = 'agency'
      UNION
      SELECT id FROM tenants WHERE parent_tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm
        WHERE tm.user_id = auth.uid() AND tm.role = 'agency'
      )
    )
  );

CREATE POLICY "addon_purchases_client_select" ON addon_purchases
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "addon_purchases_client_insert" ON addon_purchases
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- 10. INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_token_cost_config_lookup
  ON token_cost_config (tenant_id, format, operation);

CREATE INDEX IF NOT EXISTS idx_addon_purchases_tenant_status
  ON addon_purchases (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_date_format
  ON usage_logs (tenant_id, created_at DESC, format);
