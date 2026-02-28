---
name: genos-internal
description: "genOS Full data analysis skill for Cestari Studio. Provides context for querying Supabase PostgreSQL including entity definitions, metric calculations, CSV-Wix sync patterns, and multi-tenant content automation workflows. Use when analyzing genOS data for: (1) content performance and feedback analytics, (2) sync health and CSV-Wix consistency monitoring, (3) AI generation metrics and MasterCompliance scoring, or any data questions requiring genOS-specific context."
---

# genOS Internal — Data Analysis Context

> **Platform:** genOS Full v1.0.0 "Lumina" · Cestari Studio
> **Database:** Supabase PostgreSQL (cloud) + Local CSV filesystem
> **Architecture:** Hybrid — Supabase (auth/config/audit) + Node.js local (CSV/Wix/AI)
> **REGRA ZERO:** Toda query DEVE incluir `tenant_id` — sem exceções

---

## SQL Dialect: PostgreSQL (Supabase)

- **Table references**: `public.table_name` (lowercase convention)
- **Safe division**: `a / NULLIF(b, 0)` — returns NULL instead of error
- **Date functions**:
  - `DATE_TRUNC('month', date_col)`
  - `date_col - INTERVAL '1 day'`
  - `DATE_PART('day', end_date - start_date)`
- **Column selection**: No EXCEPT; must list columns explicitly
- **JSON**: `jsonb_col->>'field_name'` for text, `jsonb_col->'field_name'` for JSON object
- **Arrays**: `UNNEST(array_column)` to flatten, `ANY(array_column)` for membership
- **Timestamps**: All stored as `timestamptz` (UTC). Use `AT TIME ZONE 'Europe/London'` for UK clients
- **String matching**: `LIKE`, `col ~ 'pattern'` for regex, `ILIKE` for case-insensitive
- **Boolean**: Native BOOLEAN type; use `TRUE`/`FALSE`
- **RLS**: All queries through Supabase client are auto-filtered by Row Level Security. Admin queries use `supabaseAdmin` (service key) to bypass RLS.
- **UUIDs**: All primary keys are `uuid` via `gen_random_uuid()`

---

## Entity Disambiguation

When users mention these terms, clarify which entity they mean:

**"Client" / "Cliente" can mean:**
- **Tenant**: A workspace/account in genOS (`tenants`: `id`). Example: "Lets Travel with Us 360"
- **End Client**: The person who reviews content on Wix CMS (no direct DB record — interacts via Wix webhooks)
- **Contact Person**: Stored in `brand_dna.persona_name` or operations CSVs

**"User" / "Usuário" can mean:**
- **Cestari Team Member**: Someone with a Supabase auth account + entry in `tenant_members`
- **Octavio (sys_admin)**: Platform owner, has access to everything
- **Agency Admin**: Can manage multiple tenants

**"Content" / "Conteúdo" can mean:**
- **content_items** (Supabase): Canonical record of all generated content
- **CSV row** (local filesystem): Working copy of content in `/projects/{tenant}/content/*.csv`
- **Wix CMS item**: Published content visible to the end client

**"CSV" can mean:**
- **Physical file**: `*.csv` on the local filesystem
- **csv_registry entry**: Metadata record in Supabase about a CSV file
- **CSV category**: `content`, `feedback`, `insights`, or `operations`

**Relationships:**
- `tenants` → `tenant_members`: One-to-many (a tenant has multiple members)
- `tenant_members` → `auth.users`: Many-to-one (a user can be in multiple tenants with different roles)
- `tenants` → `brand_dna`: One-to-one (each tenant has one DNA)
- `tenants` → `csv_registry`: One-to-many (each tenant has multiple CSVs)
- `csv_registry` → `csv_sync_log`: One-to-many (each CSV has sync history)
- `csv_registry` → `feedback_queue`: One-to-many (feedback per CSV)
- `content_items` ↔ CSV row ↔ Wix item: Three-way link via `csv_source_slug` + `csv_row_id` + `wix_item_id`

---

## Business Terminology

| Term | Definition | Notes |
|------|------------|-------|
| REGRA ZERO | Every operation MUST be scoped to `user_id + tenant_id + role` | Non-negotiable. Never write unscoped queries. |
| Agent Envelope | JSON payload sent to every AI call with user_id, tenant_id, role, brand_dna, system_prompt, compliance_rules, permissions, plan_limits | Required for all AI routing |
| MasterCompliance | 4-layer content validation: Vocabulary (25%), Tone (25%), Structure (25%), Brand (25%). Score 0-100 | ≥70 = approved, 40-69 = pending_review, <40 = rejected |
| Dual-Write | Every write goes to CSV + Supabase + Wix simultaneously | Ensures zero-migration path to production |
| Three-Way Sync | CSV ↔ Supabase ↔ Wix CMS consistency | CSV is source of truth during local phase |
| Brand DNA | Personality configuration per tenant: voice_tone, language, forbidden_words, hashtag_strategy, persona_name | Supports local override that merges on top of cloud values |
| Dependency Graph | Rules defining which CSVs are affected when another CSV changes | E.g., trip published → generates blog post + video script |
| Content Factory | UI module where Octavio generates content with AI assistance | Main workflow entry point |
| Feedback Loop | Wix webhook → classify feedback → AI revise → update CSV → sync back to Wix | Core automation cycle |
| Wix Bridge | Service that syncs CSV data ↔ Wix CMS collections via Wix Data REST API | Uses ngrok tunnel for webhooks |
| _genOS_* fields | Hidden metadata fields added to every Wix CMS collection for feedback and tracking | _genOS_status, _genOS_comment, _genOS_rating, _genOS_version, etc. |

---

## Standard Filters

Always apply these filters unless explicitly told otherwise:

```sql
-- REGRA ZERO: Always scope to tenant
WHERE tenant_id = :tenant_id

-- Exclude soft-deleted content
  AND status != 'archived'

-- For content_items queries, exclude insight-type records unless analyzing insights
  AND content_type NOT IN ('insight', 'report')

-- For time-based queries, default to last 30 days
  AND created_at >= NOW() - INTERVAL '30 days'
```

**When to override:**
- **Cross-tenant analysis**: Only `sys_admin` role can query without tenant_id filter
- **Include archived**: When analyzing historical trends or audit trails
- **Include insights**: When specifically analyzing AI-generated insights
- **Custom time range**: When user specifies a different period

---

## Key Metrics

### MasterCompliance Score
- **Definition**: Quality score (0-100) measuring AI-generated content alignment with brand rules
- **Formula**: `(vocabulary_score * 0.25) + (tone_score * 0.25) + (structure_score * 0.25) + (brand_score * 0.25)`
- **Source**: `content_items.compliance_score` or CSV field `_genOS_compliance_score`
- **Time grain**: Per content item (not time-aggregated)
- **Caveats**: Score is calculated at generation time. Re-generations create new scores. Average across tenant for trend analysis.

### Approval Rate
- **Definition**: Percentage of content items approved on first review by the client
- **Formula**: `COUNT(CASE WHEN client_feedback = 'approved' AND revision_count <= 1 THEN 1 END) / NULLIF(COUNT(*), 0) * 100`
- **Source**: `content_items` filtered by `client_feedback IS NOT NULL`
- **Time grain**: Weekly or monthly
- **Caveats**: Items still in 'pending_review' should be excluded from denominator

### Average Revisions to Approval
- **Definition**: Mean number of AI revision cycles before client approves
- **Formula**: `AVG(revision_count) WHERE client_feedback = 'approved'`
- **Source**: `content_items`
- **Time grain**: Monthly
- **Caveats**: Lower is better. >3 revisions triggers escalation to Claude provider

### Sync Health Rate
- **Definition**: Percentage of sync operations that succeed without errors
- **Formula**: `COUNT(CASE WHEN status = 'success' THEN 1 END) / NULLIF(COUNT(*), 0) * 100`
- **Source**: `csv_sync_log`
- **Time grain**: Daily
- **Caveats**: 'partial' status counts as success with warnings

### Feedback Processing Time
- **Definition**: Time from feedback received to revision applied (in hours)
- **Formula**: `AVG(EXTRACT(EPOCH FROM (applied_at - created_at)) / 3600) WHERE processing_status = 'applied'`
- **Source**: `feedback_queue`
- **Time grain**: Weekly
- **Caveats**: 'urgent' priority items should be reported separately

### Content Volume
- **Definition**: Total content items generated per tenant per period
- **Formula**: `COUNT(*) GROUP BY tenant_id, DATE_TRUNC('month', created_at)`
- **Source**: `content_items`
- **Time grain**: Monthly

### AI Provider Distribution
- **Definition**: Percentage of content generated by each AI provider
- **Formula**: `COUNT(*) GROUP BY ai_provider_used / NULLIF(total_count, 0) * 100`
- **Source**: `content_items.ai_provider_used` or `ai_sessions.provider`
- **Time grain**: Monthly
- **Caveats**: Null provider means manual creation

### Retry Queue Depth
- **Definition**: Number of failed writes waiting to be retried
- **Formula**: `COUNT(*) WHERE status = 'pending'`
- **Source**: `write_retry_queue`
- **Time grain**: Real-time / hourly check
- **Caveats**: >10 pending items indicates a systemic issue

---

## Data Freshness

| Table | Update Frequency | Typical Lag |
|-------|------------------|-------------|
| `content_items` | Real-time (dual-write) | <1 second |
| `csv_sync_log` | Every sync cycle (5 min default) | ~5 minutes |
| `feedback_queue` | On webhook receipt | <30 seconds |
| `ai_sessions` | On AI call completion | <5 seconds |
| `activity_log` | Real-time | <1 second |
| `write_retry_queue` | On failed write + retry worker (1 min) | ~1 minute |
| `csv_registry` | On schema/config change | Manual |
| `brand_dna` | On DNA edit | Manual |

To check data freshness:
```sql
SELECT MAX(created_at) as latest_data FROM content_items WHERE tenant_id = :tenant_id;
SELECT MAX(created_at) as latest_sync FROM csv_sync_log WHERE tenant_id = :tenant_id;
SELECT MAX(created_at) as latest_feedback FROM feedback_queue WHERE tenant_id = :tenant_id;
```

---

## 5 RBAC Roles

| Role | Level | Permissions |
|------|-------|-------------|
| `sys_admin` | Platform-wide | Everything. Cross-tenant queries allowed. |
| `agency_admin` | Multi-tenant | Manage multiple tenants. Config, DNA overrides, AI preferences. |
| `tenant_admin` | Single tenant | Full control of one tenant. Brand DNA, prompts, compliance rules. |
| `tenant_editor` | Single tenant | Create/edit content. Cannot change configs. |
| `tenant_viewer` | Single tenant | Read-only access. |

Role hierarchy: `sys_admin > agency_admin > tenant_admin > tenant_editor > tenant_viewer`. Higher roles inherit all lower permissions.

---

## Knowledge Base Navigation

Use these reference files for detailed table documentation:

| Domain | Reference File | Use For |
|--------|----------------|---------|
| Entities | `references/entities.md` | Entity definitions, relationships, ID fields |
| Metrics | `references/metrics.md` | All KPI calculations and formulas |
| Content | `references/tables/content.md` | content_items, system_prompts, brand_dna |
| Feedback | `references/tables/feedback.md` | feedback_queue, _genOS_* fields, feedback loop |
| Sync & CSV | `references/tables/sync.md` | csv_registry, csv_sync_log, write_retry_queue, dual-write |
| AI & Compliance | `references/tables/ai.md` | ai_sessions, compliance_rules, MasterCompliance, AI routing |
| Operations | `references/tables/operations.md` | contracts, invoices, task-board (CSV-based) |
| Multi-tenancy | `references/tables/multitenancy.md` | tenants, tenant_members, RLS policies, RBAC |
| Marketplace | `references/tables/marketplace.md` | marketplace_items, marketplace_purchases |
| Terminology | `references/terminology.md` | Full glossary of genOS terms |

---

## Common Query Patterns

### Content Performance per Tenant (Last 30 Days)
```sql
SELECT
    t.name AS tenant_name,
    ci.content_type,
    COUNT(*) AS total_items,
    AVG(ci.compliance_score) AS avg_compliance,
    COUNT(CASE WHEN ci.client_feedback = 'approved' THEN 1 END) AS approved,
    COUNT(CASE WHEN ci.client_feedback = 'needs_revision' THEN 1 END) AS needs_revision,
    COUNT(CASE WHEN ci.client_feedback = 'rejected' THEN 1 END) AS rejected,
    AVG(ci.revision_count) AS avg_revisions
FROM content_items ci
JOIN tenants t ON t.id = ci.tenant_id
WHERE ci.tenant_id = :tenant_id
  AND ci.created_at >= NOW() - INTERVAL '30 days'
  AND ci.status != 'archived'
GROUP BY t.name, ci.content_type
ORDER BY total_items DESC;
```

### Sync Health Dashboard
```sql
SELECT
    DATE_TRUNC('day', csl.created_at) AS sync_date,
    cr.csv_slug,
    csl.direction,
    COUNT(*) AS total_syncs,
    COUNT(CASE WHEN csl.status = 'success' THEN 1 END) AS successful,
    COUNT(CASE WHEN csl.status = 'error' THEN 1 END) AS failed,
    AVG(csl.duration_ms) AS avg_duration_ms,
    SUM(csl.rows_affected) AS total_rows
FROM csv_sync_log csl
JOIN csv_registry cr ON cr.id = csl.csv_registry_id
WHERE csl.tenant_id = :tenant_id
  AND csl.created_at >= NOW() - INTERVAL '7 days'
GROUP BY sync_date, cr.csv_slug, csl.direction
ORDER BY sync_date DESC, cr.csv_slug;
```

### Feedback Pipeline Status
```sql
SELECT
    fq.processing_status,
    fq.feedback_status,
    fq.feedback_priority,
    COUNT(*) AS count,
    AVG(EXTRACT(EPOCH FROM (fq.processed_at - fq.created_at)) / 3600) AS avg_processing_hours,
    AVG(fq.client_rating) AS avg_rating
FROM feedback_queue fq
WHERE fq.tenant_id = :tenant_id
  AND fq.created_at >= NOW() - INTERVAL '30 days'
GROUP BY fq.processing_status, fq.feedback_status, fq.feedback_priority
ORDER BY fq.feedback_priority, fq.processing_status;
```

### AI Provider Usage & Cost
```sql
SELECT
    ai.provider,
    ai.model,
    COUNT(*) AS total_sessions,
    SUM(ai.total_tokens) AS total_tokens,
    AVG(ai.total_tokens) AS avg_tokens_per_session,
    AVG(ai.duration_ms) AS avg_duration_ms,
    COUNT(CASE WHEN ai.status = 'completed' THEN 1 END) AS completed,
    COUNT(CASE WHEN ai.status = 'error' THEN 1 END) AS errors
FROM ai_sessions ai
WHERE ai.tenant_id = :tenant_id
  AND ai.created_at >= NOW() - INTERVAL '30 days'
GROUP BY ai.provider, ai.model
ORDER BY total_sessions DESC;
```

### Three-Way Consistency Check
```sql
-- Find content_items that might be out of sync
SELECT
    ci.id,
    ci.title,
    ci.csv_source_slug,
    ci.csv_row_hash,
    ci.wix_item_id,
    ci.wix_last_sync,
    ci.updated_at AS supabase_updated,
    CASE
        WHEN ci.wix_item_id IS NULL THEN 'missing_wix_link'
        WHEN ci.wix_last_sync < ci.updated_at - INTERVAL '10 minutes' THEN 'wix_stale'
        ELSE 'synced'
    END AS sync_status
FROM content_items ci
WHERE ci.tenant_id = :tenant_id
  AND ci.status NOT IN ('archived', 'draft')
ORDER BY sync_status, ci.updated_at DESC;
```

---

## Troubleshooting

### Common Mistakes
- **Forgetting tenant_id**: NEVER query without `WHERE tenant_id = :id`. RLS will silently return empty results if the user doesn't have access.
- **Confusing CSV slug vs display name**: `csv_slug` is the kebab-case identifier (e.g., 'blog-posts'), `display_name` is human-readable ('Blog Posts').
- **Using content_type for CSV filtering**: Use `csv_source_slug` to filter by CSV origin. `content_type` is a semantic classification.
- **Timezone assumptions**: All timestamps are UTC in Supabase. Lets Travel 360 operates in `Europe/London`, Clareira Avalon in `America/Sao_Paulo`.
- **Counting revisions wrong**: `revision_count` starts at 0. A value of 1 means one revision was made (2 total versions).

### Access Issues
- Queries via Supabase JS client are automatically filtered by RLS — you only see data for tenants where you have a `tenant_members` entry
- For cross-tenant analytics, use `supabaseAdmin` (service role key) — only available server-side
- `activity_log` is append-only — no UPDATE or DELETE policies

### Performance Tips
- Filter by `tenant_id` first — it's indexed on every table
- For `csv_sync_log` and `feedback_queue`, filter by `created_at DESC` — these tables grow fast
- Use `content_items.csv_source_slug` index for CSV-specific queries
- Avoid `SELECT *` on `content_items` — `extra_fields` (JSONB) can be large
- For dashboards, pre-aggregate into `insights/*.csv` files rather than querying raw data
