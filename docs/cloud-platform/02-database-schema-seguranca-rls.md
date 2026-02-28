# genOS™ Cloud Platform — Super Prompt #2
# Database Schema & Segurança RLS

**Versão:** 2.0.0
**Data:** 2026-02-28
**Supabase Project ID:** `qyfjkvwlpgjlpveqnkax`

---

## 1. FILOSOFIA DO BANCO DE DADOS

### 1.1 Princípios

1. **Multi-Tenancy por RLS:** Toda tabela com dados de tenant TEM `tenant_id UUID NOT NULL` e política RLS que filtra por `auth.jwt() ->> 'tenant_id'`.
2. **Dados Imutáveis:** Registros de `activity_log`, `token_usage`, `usage_logs`, `ai_sessions` e `csv_sync_log` NUNCA são deletados ou atualizados. São append-only.
3. **Soft Delete:** Tabelas com ciclo de vida (tenants, content_items) usam `status` field ao invés de DELETE.
4. **UUID Everywhere:** Todas as primary keys são `UUID DEFAULT gen_random_uuid()`.
5. **Timestamps Padrão:** Toda tabela tem `created_at TIMESTAMPTZ DEFAULT now()` e `updated_at TIMESTAMPTZ DEFAULT now()`.

### 1.2 Hierarquia de Tenants

```
Cestari Studio (Root)          depth_level: 0    is_agency: false
  └── Cestari Studio (Agency)  depth_level: 1    is_agency: true
       ├── All Life Institute  depth_level: 2    is_agency: false
       ├── Clareira de Avalon  depth_level: 2    is_agency: false
       ├── Dads Love           depth_level: 2    is_agency: false
       ├── ... (10 outros)
       └── Theo Webert         depth_level: 2    is_agency: false
```

---

## 2. TABELAS EXISTENTES — SCHEMA COMPLETO

### 2.1 `tenants` (16 rows)

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID,
  plan TEXT DEFAULT 'free',           -- free, starter, pro, enterprise
  status TEXT DEFAULT 'active',       -- active, suspended, cancelled
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  wix_site_id TEXT,
  parent_tenant_id UUID REFERENCES tenants(id),
  is_agency BOOLEAN DEFAULT false,
  whitelabel_config JSONB DEFAULT '{}',
  billing_model TEXT DEFAULT 'markup', -- markup, flat, hybrid
  depth_level INTEGER DEFAULT 0,       -- 0=root, 1=agency, 2=client
  wix_member_id TEXT,
  contact_email TEXT
);
```

**Notas:** Esta tabela é o coração do sistema. Toda query filtra por `tenant_id`. O `depth_level` determina o nível hierárquico. Clientes sempre têm `depth_level = 2` e `parent_tenant_id` apontando para a agência.

### 2.2 `brand_dna` (11 rows)

```sql
CREATE TABLE brand_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  voice_tone TEXT,                     -- 'profissional', 'casual', 'inspirador'
  voice_description TEXT,
  language TEXT DEFAULT 'pt-BR',
  persona_name TEXT,
  regional_notes TEXT,
  content_rules JSONB DEFAULT '{}',
  forbidden_words JSONB DEFAULT '[]',  -- ["barato", "grátis", "promoção"]
  hashtag_strategy JSONB DEFAULT '{}',
  color_palette JSONB DEFAULT '{}',
  sample_posts JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  personality_traits JSONB DEFAULT '[]',
  typography JSONB DEFAULT '{}',
  target_audience TEXT,
  brand_values JSONB DEFAULT '[]',
  char_limits JSONB DEFAULT '{}',      -- {"reel_title": 60, "carousel_text": 200}
  editorial_pillars JSONB DEFAULT '[]',
  audience_profile JSONB DEFAULT '{}',
  references_and_benchmarks JSONB DEFAULT '[]',
  generation_notes TEXT,
  mandatory_terms JSONB DEFAULT '[]',
  strict_compliance BOOLEAN DEFAULT false
);
```

**Notas:** Cada tenant tem exatamente UM brand_dna (constraint UNIQUE em tenant_id). O Agent Envelope lê este registro inteiro para compor o contexto de cada geração de IA. Os campos `forbidden_words`, `char_limits`, e `editorial_pillars` alimentam diretamente o MasterCompliance.

### 2.3 `content_items` (20 rows)

```sql
CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  content_type TEXT NOT NULL,          -- 'reel', 'carousel', 'static', 'story', 'blog'
  title TEXT,
  body TEXT,
  media_urls JSONB DEFAULT '[]',
  platform TEXT DEFAULT 'instagram',
  status TEXT DEFAULT 'draft',         -- draft, generated, reviewing, approved, published, rejected
  compliance_score INTEGER,            -- 0-100 (output do MasterCompliance)
  compliance_notes JSONB DEFAULT '{}',
  ai_session_id UUID REFERENCES ai_sessions(id),
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  hashtags JSONB DEFAULT '[]',
  visual_direction TEXT,
  pillar TEXT,                         -- ex: 'educativo', 'promocional'
  csv_source_slug TEXT,                -- legado: referência ao CSV de origem
  csv_row_id TEXT,
  csv_row_hash TEXT,
  wix_item_id TEXT,
  wix_collection TEXT,
  wix_site_id TEXT,
  wix_last_sync TIMESTAMPTZ,
  extra_fields JSONB DEFAULT '{}',
  client_feedback TEXT,
  client_comment TEXT,
  client_rating INTEGER,               -- 1-5
  revision_count INTEGER DEFAULT 0,
  ai_provider_used TEXT,               -- 'gemini', 'claude', 'local'
  ai_model TEXT,
  scheduled_date DATE,
  time_slot TEXT,
  feedback_history JSONB DEFAULT '[]'
);
-- NOVA COLUNA (migração Cloud Platform):
-- ALTER TABLE content_items ADD COLUMN app_slug TEXT DEFAULT 'content-factory';
```

### 2.4 `ai_sessions` (24 rows)

```sql
CREATE TABLE ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id TEXT,
  session_type TEXT,                   -- 'generation', 'compliance', 'heuristic', 'support'
  model_used TEXT,                     -- 'gemini-2.0-flash', 'claude-3.5-sonnet'
  system_prompt_id UUID REFERENCES system_prompts(id),
  messages JSONB DEFAULT '[]',
  context JSONB DEFAULT '{}',
  tools_available JSONB DEFAULT '[]',
  tokens_used INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.5 `token_usage` (1 row)

```sql
CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ai_session_id UUID REFERENCES ai_sessions(id),
  provider TEXT NOT NULL,              -- 'google', 'anthropic', 'local'
  model TEXT NOT NULL,
  session_type TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  agency_cost_usd NUMERIC(10,6) DEFAULT 0,
  client_cost_usd NUMERIC(10,6) DEFAULT 0,
  margin_usd NUMERIC(10,6) DEFAULT 0,
  pricing_strategy TEXT,
  pricing_config_id UUID REFERENCES pricing_config(id),
  content_item_id UUID REFERENCES content_items(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.6 `compliance_rules` (9 rows)

```sql
CREATE TABLE compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  rule_type TEXT NOT NULL,             -- 'forbidden_words', 'tone', 'length', 'brand'
  rule_config JSONB NOT NULL,
  severity TEXT DEFAULT 'warning',     -- 'error', 'warning', 'info'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.7 `billing_accounts` (15 rows)

```sql
CREATE TABLE billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  billing_parent_id UUID REFERENCES tenants(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_email TEXT,
  billing_type TEXT DEFAULT 'postpaid', -- 'prepaid', 'postpaid', 'hybrid'
  monthly_base_brl NUMERIC(10,2) DEFAULT 0,
  markup_pct NUMERIC(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  next_invoice_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.8 Outras Tabelas Existentes (Resumo)

| Tabela | Colunas Chave | Função |
|--------|---------------|--------|
| `system_prompts` | tenant_id, name, content_type, prompt_text, model_target | Prompts de sistema reutilizáveis |
| `pricing_config` | tenant_id, strategy, tier, provider, model, markup_pct | Config de pricing por modelo/tier |
| `quality_scores` | tenant_id, content_item_id, weighted_total, passed, issues | Scores detalhados de qualidade |
| `feedback_queue` | tenant_id, csv_slug, feedback_type, client_comment, client_rating | Fila de feedback do Wix |
| `activity_log` | tenant_id, action, resource_type, severity, category, summary | Auditoria global (284 rows) |
| `csv_registry` | tenant_id, csv_slug, local_path, wix_collection, sync_direction | Mapeamento CSV (legado) |
| `csv_sync_log` | tenant_id, direction, rows_affected, status, duration_ms | Log de sync (203 rows, legado) |
| `popup_events` | tenant_id, popup_code, category, severity, status | Notificações e popups |
| `sentiment_analysis` | tenant_id, sentiment_score, trend, posts_analyzed | Análise de sentimento |
| `audience_analytics` | tenant_id, location, age_groups, genders, purchase_interests | Analytics de audiência |
| `addons_catalog` | slug, name, pricing_type, price_brl, feature_flag | Catálogo de addons (global) |
| `tenant_addons` | tenant_id, addon_id, status, usage_count | Addons ativados por tenant |
| `tenant_members` | tenant_id, user_id, role, status | RBAC de membros |
| `connected_accounts` | tenant_id, platform, credentials, status | Contas sociais |
| `marketplace_items` | seller_tenant_id, item_type, price_cents, status | Items marketplace |
| `marketplace_purchases` | buyer_tenant_id, item_id, amount_cents | Compras marketplace |
| `mcp_connections` | tenant_id, server_name, server_url, config_encrypted | Conexões MCP |
| `write_retry_queue` | tenant_id, csv_slug, operation, row_data, retry_count | Retry de escritas |

---

## 3. TABELAS NOVAS — CLOUD PLATFORM

### 3.1 `applications`

```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                  -- 'Content Factory'
  slug TEXT NOT NULL UNIQUE,           -- 'content-factory'
  description TEXT,
  icon TEXT,                           -- nome do ícone Carbon
  status TEXT DEFAULT 'active',        -- 'active', 'coming_soon', 'deprecated'
  is_default BOOLEAN DEFAULT false,    -- true = incluído em todos os planos
  min_plan TEXT DEFAULT 'free',        -- plano mínimo para acesso
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed:
INSERT INTO applications (name, slug, description, status, is_default) VALUES
  ('Content Factory', 'content-factory', 'Fábrica de conteúdo com IA, compliance e heurísticas', 'active', true),
  ('GEO Intelligence', 'geo-intelligence', 'Geomarketing e análise de audiência', 'coming_soon', false),
  ('Branding DNA Studio', 'branding-dna', 'Editor avançado de identidade de marca', 'coming_soon', false),
  ('Commerce Hub', 'commerce-hub', 'Marketplace e catálogo de ativos digitais', 'coming_soon', false);
```

### 3.2 `subscriptions`

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  app_id UUID NOT NULL REFERENCES applications(id),
  status TEXT DEFAULT 'active',        -- 'active', 'trial', 'suspended', 'cancelled'
  trial_ends_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',         -- config específica do app para este tenant
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, app_id)            -- um tenant só pode ter UMA subscription por app
);
```

### 3.3 `credit_wallets`

```sql
CREATE TABLE credit_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  prepaid_credits NUMERIC(12,2) DEFAULT 0,   -- créditos pré-pagos (comprados)
  overage_amount NUMERIC(12,2) DEFAULT 0,    -- dívida de uso excedente (pay-per-use)
  currency TEXT DEFAULT 'BRL',
  overage_limit NUMERIC(12,2) DEFAULT 100,   -- limite máximo de overage antes de bloqueio
  last_topup_at TIMESTAMPTZ,
  last_debit_at TIMESTAMPTZ,
  is_blocked BOOLEAN DEFAULT false,           -- true quando overage > overage_limit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lógica de créditos:
-- 1. Toda chamada de IA calcula custo em BRL
-- 2. Se prepaid_credits >= custo: debita prepaid_credits
-- 3. Se prepaid_credits < custo: zera prepaid_credits, restante vai para overage_amount
-- 4. Se overage_amount + custo > overage_limit: BLOQUEIA (is_blocked = true)
-- 5. Quando cliente paga overage: zera overage_amount, is_blocked = false
```

### 3.4 `usage_logs`

```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  app_slug TEXT NOT NULL,              -- 'content-factory'
  operation TEXT NOT NULL,             -- 'ai_generation', 'compliance_check', 'heuristic_report'
  tokens_used INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  cost_brl NUMERIC(10,4) DEFAULT 0,
  credits_debited NUMERIC(10,4) DEFAULT 0,
  source_type TEXT,                    -- 'prepaid', 'overage'
  ai_provider TEXT,                    -- 'gemini', 'claude'
  ai_model TEXT,
  content_item_id UUID REFERENCES content_items(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. POLÍTICAS RLS (Row Level Security)

### 4.1 Padrão RLS para Tabelas com tenant_id

Toda tabela com `tenant_id` segue o mesmo padrão:

```sql
-- Habilitar RLS
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant só vê seus próprios dados
CREATE POLICY "tenant_isolation_select" ON {table_name}
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- INSERT: tenant só insere em seus próprios dados
CREATE POLICY "tenant_isolation_insert" ON {table_name}
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- UPDATE: tenant só atualiza seus próprios dados
CREATE POLICY "tenant_isolation_update" ON {table_name}
  FOR UPDATE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- DELETE: tenant só deleta seus próprios dados
CREATE POLICY "tenant_isolation_delete" ON {table_name}
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### 4.2 Exceção: Agência pode ver dados de seus clientes

```sql
-- A agência (is_agency = true) pode ver dados de todos os tenants filhos
CREATE POLICY "agency_read_children" ON {table_name}
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR
    tenant_id IN (
      SELECT id FROM tenants
      WHERE parent_tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );
```

### 4.3 Tabelas sem RLS

- `addons_catalog`: Catálogo global, leitura pública
- `applications`: Catálogo de apps, leitura pública

### 4.4 Service Role Bypass

Edge Functions que operam como "sistema" (ex: `billing-sync`, `wix-webhook`) usam a `SUPABASE_SERVICE_ROLE_KEY` que bypassa RLS. Estas funções NUNCA são expostas ao frontend.

---

## 5. INDEXES DE PERFORMANCE

```sql
-- Indexes críticos para queries frequentes
CREATE INDEX idx_content_items_tenant_status ON content_items(tenant_id, status);
CREATE INDEX idx_content_items_tenant_type ON content_items(tenant_id, content_type);
CREATE INDEX idx_content_items_app_slug ON content_items(app_slug);
CREATE INDEX idx_ai_sessions_tenant ON ai_sessions(tenant_id);
CREATE INDEX idx_token_usage_tenant ON token_usage(tenant_id);
CREATE INDEX idx_activity_log_tenant ON activity_log(tenant_id, created_at DESC);
CREATE INDEX idx_usage_logs_tenant ON usage_logs(tenant_id, created_at DESC);
CREATE INDEX idx_usage_logs_app ON usage_logs(app_slug, tenant_id);
CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_app ON subscriptions(app_id);
CREATE INDEX idx_credit_wallets_tenant ON credit_wallets(tenant_id);
CREATE INDEX idx_tenants_parent ON tenants(parent_tenant_id);
CREATE INDEX idx_tenants_depth ON tenants(depth_level);
```

---

## 6. DIAGRAMA ENTIDADE-RELACIONAMENTO

```
                    ┌─────────────────┐
                    │   applications  │
                    │   (4 records)   │
                    └────────┬────────┘
                             │ 1:N
                    ┌────────▼────────┐
                    │  subscriptions  │
                    │  (tenant↔app)   │
                    └────────┬────────┘
                             │ N:1
┌──────────────┐    ┌────────▼────────┐    ┌─────────────────┐
│  brand_dna   │◄───│    tenants      │───►│ credit_wallets  │
│  (1:1)       │    │   (16 records)  │    │  (1:1)          │
└──────────────┘    └────────┬────────┘    └─────────────────┘
                             │ 1:N
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───┐  ┌──────▼──────┐  ┌───▼──────────┐
     │content_items│  │ ai_sessions │  │ usage_logs   │
     │ (20 rows)   │  │ (24 rows)   │  │ (new table)  │
     └─────────────┘  └─────────────┘  └──────────────┘
              │
     ┌────────▼────────┐
     │  quality_scores  │
     │  (9 rows)        │
     └─────────────────┘
```

---

## 7. SCRIPTS DE MIGRAÇÃO COMPLETOS

### 7.1 Migration: Criar Tabelas Cloud Platform

```sql
-- Migration: 008_cloud_platform_tables.sql
-- Descrição: Cria tabelas do Cloud Platform (applications, subscriptions, credit_wallets, usage_logs)
-- IMPORTANTE: Esta migração é ADITIVA — não altera tabelas existentes

-- 1. Applications
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  status TEXT DEFAULT 'active',
  is_default BOOLEAN DEFAULT false,
  min_plan TEXT DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  trial_ends_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, app_id)
);

-- 3. Credit Wallets
CREATE TABLE IF NOT EXISTS credit_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  prepaid_credits NUMERIC(12,2) DEFAULT 0,
  overage_amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  overage_limit NUMERIC(12,2) DEFAULT 100,
  last_topup_at TIMESTAMPTZ,
  last_debit_at TIMESTAMPTZ,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Usage Logs
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_slug TEXT NOT NULL,
  operation TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  cost_brl NUMERIC(10,4) DEFAULT 0,
  credits_debited NUMERIC(10,4) DEFAULT 0,
  source_type TEXT,
  ai_provider TEXT,
  ai_model TEXT,
  content_item_id UUID REFERENCES content_items(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Adicionar app_slug em content_items
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS app_slug TEXT DEFAULT 'content-factory';
```

### 7.2 Migration: Seed de Applications e Subscriptions

```sql
-- Migration: 009_seed_cloud_platform.sql
-- Descrição: Popula applications e cria subscriptions para todos os tenants existentes

-- Seed Applications
INSERT INTO applications (name, slug, description, status, is_default, icon) VALUES
  ('Content Factory', 'content-factory', 'Fábrica de conteúdo com IA, compliance e heurísticas', 'active', true, 'Chemistry'),
  ('GEO Intelligence', 'geo-intelligence', 'Geomarketing e análise de audiência por localização', 'coming_soon', false, 'Earth'),
  ('Branding DNA Studio', 'branding-dna', 'Editor avançado de identidade visual e verbal', 'coming_soon', false, 'ColorPalette'),
  ('Commerce Hub', 'commerce-hub', 'Marketplace e catálogo de ativos digitais', 'coming_soon', false, 'ShoppingCart')
ON CONFLICT (slug) DO NOTHING;

-- Criar subscriptions para todos os tenants de depth_level = 2 → content-factory
INSERT INTO subscriptions (tenant_id, app_id, status)
SELECT t.id, a.id, 'active'
FROM tenants t
CROSS JOIN applications a
WHERE t.depth_level = 2
  AND a.slug = 'content-factory'
ON CONFLICT (tenant_id, app_id) DO NOTHING;

-- Criar credit_wallets para todos os tenants de depth_level = 2
INSERT INTO credit_wallets (tenant_id, prepaid_credits, overage_limit)
SELECT t.id,
  CASE t.plan
    WHEN 'free' THEN 50
    WHEN 'starter' THEN 200
    WHEN 'pro' THEN 500
    WHEN 'enterprise' THEN 2000
    ELSE 50
  END,
  CASE t.plan
    WHEN 'free' THEN 20
    WHEN 'starter' THEN 50
    WHEN 'pro' THEN 200
    WHEN 'enterprise' THEN 1000
    ELSE 20
  END
FROM tenants t
WHERE t.depth_level = 2
ON CONFLICT (tenant_id) DO NOTHING;
```

### 7.3 Migration: RLS para Novas Tabelas

```sql
-- Migration: 010_rls_cloud_platform.sql

-- Applications: leitura pública, sem RLS restritivo
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_can_read_applications" ON applications FOR SELECT USING (true);

-- Subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_read_own_subscriptions" ON subscriptions
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "agency_read_children_subscriptions" ON subscriptions
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE parent_tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- Credit Wallets
ALTER TABLE credit_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_read_own_wallet" ON credit_wallets
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "agency_read_children_wallets" ON credit_wallets
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE parent_tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- Usage Logs
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_read_own_usage" ON usage_logs
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "agency_read_children_usage" ON usage_logs
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE parent_tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );
```

---

## 8. PLANOS E LIMITES POR TIER

| Plano | Posts/mês | Tokens/mês | Créditos Iniciais (BRL) | Overage Limit (BRL) |
|-------|-----------|------------|------------------------|---------------------|
| free | 10 | 50.000 | 50 | 20 |
| starter | 30 | 200.000 | 200 | 50 |
| pro | 100 | 500.000 | 500 | 200 |
| enterprise | ilimitado | 2.000.000 | 2.000 | 1.000 |

---

*Documento #2 de 10 — Super Prompts de Documentação Exaustiva.*
