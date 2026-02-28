# Feedback Domain Tables

## feedback_queue

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.feedback_queue` |
| **Description** | Queue of client feedback items received via Wix webhooks. Each entry represents a piece of feedback on a specific CSV row that needs processing (classification, AI revision, or manual review). |
| **Primary Key** | `id` (uuid) |
| **Update Frequency** | Real-time (Wix webhook → Edge Function) |
| **RLS** | Enabled — tenant isolation via `tenant_members` |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | — | FK → tenants(id). **REGRA ZERO** |
| `csv_slug` | text | NO | — | Which CSV this feedback is for (e.g., `trips`, `blog-posts`) |
| `csv_row_id` | text | NO | — | Row ID within the CSV that received feedback |
| `wix_item_id` | text | YES | — | Wix CMS item ID (for sync back) |
| `feedback_type` | text | NO | — | Classification: `approved`, `rejected`, `revision_requested`, `comment_only` |
| `client_comment` | text | YES | — | Free-text comment from the client |
| `client_rating` | integer | YES | — | Numeric rating (1-5) |
| `previous_status` | text | YES | — | Content status before this feedback |
| `priority` | text | YES | `'normal'` | Processing priority: `urgent`, `high`, `normal`, `low` |
| `processing_status` | text | YES | `'pending'` | Queue status: `pending`, `processing`, `ai_revising`, `completed`, `failed` |
| `ai_session_id` | uuid | YES | — | FK → ai_sessions(id). Linked AI revision session (if any) |
| `processed_at` | timestamptz | YES | — | When processing completed |
| `error_message` | text | YES | — | Error details if processing failed |
| `metadata` | jsonb | YES | `'{}'` | Additional context (webhook payload, etc.) |
| `created_at` | timestamptz | YES | `now()` | When the feedback was received |

### Processing Flow

```
Wix webhook received
  → Edge Function creates feedback_queue entry (processing_status = 'pending')
  → Feedback Processor picks up entry
  → Classifies feedback_type
  → If revision_requested → AI generates revision (processing_status = 'ai_revising')
  → AI session created → ai_session_id populated
  → Revised content written to CSV + Supabase + Wix (via dualWrite)
  → processing_status = 'completed', processed_at = now()
```

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_feedback_queue_tenant` | `(tenant_id)` | Tenant filtering |
| `idx_feedback_queue_pending` | `(tenant_id, processing_status)` WHERE `processing_status IN ('pending','processing','ai_revising')` | Partial index for active queue items |

### Sample Queries

```sql
-- Current feedback queue depth
SELECT
    processing_status,
    COUNT(*) AS count,
    MIN(created_at) AS oldest
FROM feedback_queue
WHERE tenant_id = :tenant_id
GROUP BY processing_status;

-- Feedback summary by CSV (last 30 days)
SELECT
    csv_slug,
    feedback_type,
    COUNT(*) AS total,
    AVG(client_rating) AS avg_rating
FROM feedback_queue
WHERE tenant_id = :tenant_id
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY csv_slug, feedback_type
ORDER BY csv_slug, total DESC;

-- Failed items needing manual attention
SELECT id, csv_slug, csv_row_id, feedback_type, error_message, created_at
FROM feedback_queue
WHERE tenant_id = :tenant_id
  AND processing_status = 'failed'
ORDER BY created_at DESC;
```

### Gotchas
- `csv_slug` is a text reference to `csv_registry.csv_slug`, NOT a FK to `csv_registry.id`
- `feedback_type` describes WHAT the feedback is; `processing_status` describes WHERE it is in the pipeline
- The partial index on `processing_status` means queries for active items are very fast
- `ai_session_id` is only populated when the feedback triggers an AI revision
- `priority` affects processing order — `urgent` items are processed first

---

## Feedback Fields in Content CSVs (Wix _genOS_* columns)

Content CSVs that sync with Wix include special feedback columns prefixed with `_genOS_`:

| Field | Type | Description |
|-------|------|-------------|
| `_genOS_feedback` | text | `approved`, `rejected`, `revision_requested`, `pending` |
| `_genOS_comment` | text | Client's free-text feedback |
| `_genOS_rating` | number | 1-5 star rating |
| `_genOS_feedbackDate` | date | When feedback was submitted |

These fields are configured per-CSV in `csv_registry.feedback_fields` and synced via `from_wix` direction. When a Wix webhook fires with updated feedback fields, the system creates a `feedback_queue` entry for processing.
