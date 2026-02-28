# Sync & CSV Domain Tables

## csv_registry

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.csv_registry` |
| **Description** | Master index of all CSV files managed by genOS per tenant. Stores metadata, field mappings, sync configuration, and dependency graph edges. |
| **Primary Key** | `id` (uuid) |
| **Update Frequency** | Manual (on schema/config change) |
| **RLS** | Enabled — tenant isolation via `tenant_members` |

### Key Columns

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Primary key | |
| `tenant_id` | uuid | FK → tenants(id) | **REGRA ZERO** |
| `csv_slug` | text | Kebab-case identifier | `trips`, `blog-posts`, `social-posts`. Unique per tenant. |
| `csv_category` | text | Classification | `content` (syncs to Wix), `feedback` (from_wix), `insights` (local_only), `operations` (varies) |
| `display_name` | text | Human-readable name | "Trips", "Blog Posts" |
| `description` | text | What this CSV contains | |
| `local_path` | text | Relative path from tenant root | `content/trips.csv` |
| `wix_collection` | text | Wix CMS collection name | `Trips`, `BlogPosts`, NULL for local_only |
| `wix_site_id` | text | Wix site identifier | |
| `sync_direction` | text | Sync behavior | `to_wix`, `from_wix`, `bidirectional`, `local_only` |
| `sync_enabled` | boolean | Whether sync is active | Default true |
| `sync_interval_s` | integer | Seconds between syncs | Default 300 (5 min) |
| `last_sync_at` | timestamptz | Last successful sync | |
| `last_sync_hash` | text | Hash of CSV at last sync | For change detection |
| `row_count` | integer | Current row count | Updated on sync |
| `column_schema` | jsonb | Array of column definitions | `[{"name": "title", "type": "text", "required": true}]` |
| `field_mapping` | jsonb | CSV → Wix field map | `{"title": "Title", "body": "Body", "status": "_genOS_status"}` |
| `feedback_fields` | jsonb | Which _genOS_* fields are enabled | |
| `depends_on` | text[] | CSV slugs this depends on | `["trips"]` |
| `triggers_update` | text[] | CSV slugs this triggers | `["social-posts", "content-performance"]` |
| `auto_generate` | boolean | AI can auto-generate rows | For insights CSVs |
| `created_at` | timestamptz | | |
| `updated_at` | timestamptz | | |

### Constraints
- `UNIQUE(tenant_id, csv_slug)` — one slug per tenant

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_csv_registry_tenant` | `(tenant_id)` | Tenant listing |
| `idx_csv_registry_slug` | `(tenant_id, csv_slug)` | Slug lookup |

### CSV Categories Explained

| Category | Sync Direction | Examples |
|----------|---------------|---------|
| `content` | `bidirectional` | trips, blog-posts, social-posts, video-scripts, newsletters |
| `feedback` | `from_wix` | trips-feedback, blog-feedback, social-feedback |
| `insights` | `local_only` | content-performance, monthly-report, feedback-analysis |
| `operations` | `local_only` or varies | contracts, invoices, task-board |

### Sample Queries

```sql
-- All CSVs for a tenant with sync status
SELECT
    csv_slug, display_name, csv_category, sync_direction,
    sync_enabled, last_sync_at, row_count,
    CASE
        WHEN last_sync_at < NOW() - INTERVAL '15 minutes' AND sync_enabled THEN 'stale'
        WHEN NOT sync_enabled THEN 'disabled'
        ELSE 'healthy'
    END AS health
FROM csv_registry
WHERE tenant_id = :tenant_id
ORDER BY csv_category, csv_slug;

-- Dependency graph for a tenant
SELECT
    csv_slug AS source,
    UNNEST(triggers_update) AS triggers
FROM csv_registry
WHERE tenant_id = :tenant_id
  AND array_length(triggers_update, 1) > 0;
```

### Gotchas
- `csv_slug` is the kebab-case identifier (e.g., `blog-posts`); `display_name` is human-readable (`Blog Posts`) — don't confuse them
- `local_path` is relative to `/projects/{tenant-slug}/` — resolve as `/projects/{tenant_slug}/{local_path}`
- `depends_on` and `triggers_update` define the dependency graph edges — they're arrays of other csv_slugs
- `field_mapping` maps CSV column names to Wix field names — not all columns may have a Wix equivalent

---

## csv_sync_log

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.csv_sync_log` |
| **Description** | Audit trail of every sync operation between CSV, Supabase, and Wix |
| **Primary Key** | `id` (uuid) |
| **Update Frequency** | Every sync cycle (~5 minutes) |
| **RLS** | Enabled — tenant isolation |

### Key Columns

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Primary key | |
| `tenant_id` | uuid | FK → tenants(id) | **REGRA ZERO** |
| `csv_registry_id` | uuid | FK → csv_registry(id) | Which CSV was synced |
| `direction` | text | Sync direction | `to_wix`, `from_wix`, `feedback_received`, `dependency_cascade` |
| `rows_affected` | integer | Total rows processed | |
| `rows_created` | integer | New rows created | |
| `rows_updated` | integer | Existing rows updated | |
| `rows_failed` | integer | Rows that failed to sync | |
| `status` | text | Sync result | `success`, `partial`, `error` |
| `error_message` | text | Error details if failed | |
| `triggered_by` | text | What initiated the sync | `auto`, `manual`, `webhook`, `dependency`, `watcher`, `schedule` |
| `duration_ms` | integer | Time taken in milliseconds | |
| `metadata` | jsonb | Additional sync details | |
| `created_at` | timestamptz | When the sync ran | |

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_csv_sync_log_tenant` | `(tenant_id, created_at DESC)` | Chronological tenant queries |
| `idx_csv_sync_log_registry` | `(csv_registry_id, created_at DESC)` | Per-CSV sync history |

### Sample Queries

```sql
-- Sync health dashboard (last 7 days)
SELECT
    DATE_TRUNC('day', csl.created_at) AS day,
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
GROUP BY day, cr.csv_slug, csl.direction
ORDER BY day DESC;
```

### Gotchas
- This table grows fast — always include `created_at DESC` in queries
- `partial` status means some rows succeeded, some failed — counts are split across rows_updated/rows_failed
- Use `triggered_by` to distinguish manual syncs from automated ones

---

## write_retry_queue

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.write_retry_queue` |
| **Description** | Failed writes awaiting retry. When any of the three targets (CSV, Supabase, Wix) fails in a dual-write operation, the failed write is queued here for automatic retry with exponential backoff. |
| **Primary Key** | `id` (uuid) |
| **Update Frequency** | On failed write + retry worker every 1 minute |
| **RLS** | Enabled — tenant isolation |

### Key Columns

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | uuid | Primary key | |
| `tenant_id` | uuid | FK → tenants(id) | **REGRA ZERO** |
| `csv_slug` | text | Which CSV the write was for | |
| `operation` | text | Write type | `insert`, `update`, `delete` |
| `target` | text | Which target failed | `csv`, `supabase`, `wix` |
| `row_data` | jsonb | Complete row data for retry | |
| `error_msg` | text | Last error message | |
| `retry_count` | integer | Times retried so far | Default 0 |
| `max_retries` | integer | Maximum retry attempts | Default 5 |
| `next_retry` | timestamptz | When to retry next | Exponential backoff: 1, 2, 4, 8, 16 min |
| `status` | text | Queue item status | `pending`, `success`, `exhausted` |
| `created_at` | timestamptz | When the failure occurred | |

### Retry Backoff Schedule

| Attempt | Delay | Cumulative |
|---------|-------|-----------|
| 1 | 1 min | 1 min |
| 2 | 2 min | 3 min |
| 3 | 4 min | 7 min |
| 4 | 8 min | 15 min |
| 5 | 16 min | 31 min |
| 6+ | `exhausted` | Notify Octavio |

### Alert Threshold
- **>10 pending items** = systemic issue. Investigate immediately.

### Sample Queries

```sql
-- Current retry queue depth by target
SELECT
    target,
    COUNT(*) AS pending,
    MIN(created_at) AS oldest_pending,
    AVG(retry_count) AS avg_retries
FROM write_retry_queue
WHERE tenant_id = :tenant_id
  AND status = 'pending'
GROUP BY target;

-- Exhausted retries (need manual intervention)
SELECT id, csv_slug, operation, target, error_msg, retry_count, created_at
FROM write_retry_queue
WHERE tenant_id = :tenant_id
  AND status = 'exhausted'
ORDER BY created_at DESC;
```

---

## Dual-Write Flow

Every data write in genOS goes through the `dualWrite()` service which writes to all three targets simultaneously:

```
dualWrite(params)
  │
  ├── WRITE 1: CSV local (filesystem)
  │     └── csvEngine.appendRow / updateRow / deleteRow
  │
  ├── WRITE 2: Supabase (always)
  │     └── supabaseAdmin.from('content_items').insert/update
  │     └── Maps CSV row → content_items via mapCsvRowToContentItem()
  │
  └── WRITE 3: Wix (if configured + approved/published)
        └── wixCms.insertItem / updateItem / deleteItem
        └── Uses field_mapping from csv_registry

If any write fails → write_retry_queue entry created
All writes → activity_log entry created
```

### Source of Truth by Phase

| Phase | Source of Truth | CSV | Supabase | Wix |
|-------|----------------|-----|----------|-----|
| Local (current) | CSV | authoritative | mirror (via dual-write) | mirror |
| Production (future) | Supabase | backup/export | authoritative | mirror |

### Drift Detection
- Runs every 15 minutes via `consistency-check` service
- Compares CSV rows vs Supabase `content_items` via `csv_row_hash`
- Resolution strategy during local phase: `csv_wins` (CSV is authoritative)
