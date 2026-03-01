# genOS Metrics — Complete Reference

## Content Metrics

### MasterCompliance Score
- **Definition**: Quality score measuring AI content alignment with brand rules
- **Formula**: `(vocabulary_score * 0.25) + (tone_score * 0.25) + (structure_score * 0.25) + (brand_score * 0.25)`
- **Source**: `content_items.compliance_score`
- **Range**: 0–100
- **Thresholds**: ≥70 approved | 40–69 pending_review | <40 rejected
- **Caveats**: Calculated at generation time. Edits don't auto-recalculate.

```sql
-- Average compliance per content type
SELECT content_type,
       AVG(compliance_score) AS avg_score,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY compliance_score) AS median_score,
       MIN(compliance_score) AS min_score,
       MAX(compliance_score) AS max_score
FROM content_items
WHERE tenant_id = :tenant_id
  AND compliance_score IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY content_type;
```

### Approval Rate (First Pass)
- **Definition**: % of content approved by client without revisions
- **Formula**: `COUNT(client_feedback = 'approved' AND revision_count <= 1) / COUNT(client_feedback IS NOT NULL) * 100`
- **Source**: `content_items`
- **Target**: >70% is healthy
- **Caveats**: Exclude items still in pending_review

```sql
SELECT
    COUNT(CASE WHEN client_feedback = 'approved' AND revision_count <= 1 THEN 1 END) * 100.0
    / NULLIF(COUNT(CASE WHEN client_feedback IS NOT NULL THEN 1 END), 0) AS first_pass_approval_rate
FROM content_items
WHERE tenant_id = :tenant_id
  AND created_at >= NOW() - INTERVAL '30 days';
```

### Average Revisions to Approval
- **Definition**: Mean revision cycles before client approves
- **Formula**: `AVG(revision_count) WHERE client_feedback = 'approved'`
- **Source**: `content_items`
- **Target**: <2.0 is healthy
- **Caveats**: >3 revisions triggers escalation to Claude

```sql
SELECT
    content_type,
    AVG(revision_count) AS avg_revisions,
    MAX(revision_count) AS max_revisions,
    COUNT(*) AS approved_count
FROM content_items
WHERE tenant_id = :tenant_id
  AND client_feedback = 'approved'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY content_type;
```

### Content Volume
- **Definition**: Total items generated per period
- **Formula**: `COUNT(*) GROUP BY month`
- **Source**: `content_items`

```sql
SELECT
    DATE_TRUNC('month', created_at) AS month,
    content_type,
    COUNT(*) AS generated,
    COUNT(CASE WHEN client_feedback = 'approved' THEN 1 END) AS approved
FROM content_items
WHERE tenant_id = :tenant_id
  AND created_at >= NOW() - INTERVAL '6 months'
GROUP BY month, content_type
ORDER BY month DESC;
```

---

## Feedback Metrics

### Feedback Processing Time
- **Definition**: Hours from feedback receipt to revision applied
- **Formula**: `AVG(EXTRACT(EPOCH FROM (applied_at - created_at)) / 3600)`
- **Source**: `feedback_queue WHERE processing_status = 'applied'`
- **Target**: <4 hours for normal, <1 hour for urgent

```sql
SELECT
    feedback_priority,
    AVG(EXTRACT(EPOCH FROM (applied_at - created_at)) / 3600) AS avg_hours,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (applied_at - created_at)) / 3600) AS p95_hours,
    COUNT(*) AS total
FROM feedback_queue
WHERE tenant_id = :tenant_id
  AND processing_status = 'applied'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY feedback_priority;
```

### Feedback Distribution
- **Definition**: Breakdown of feedback types
- **Formula**: `COUNT(*) GROUP BY feedback_status`
- **Source**: `feedback_queue`

```sql
SELECT
    feedback_status,
    feedback_priority,
    COUNT(*) AS count,
    AVG(client_rating) AS avg_rating
FROM feedback_queue
WHERE tenant_id = :tenant_id
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY feedback_status, feedback_priority;
```

### Client Satisfaction
- **Definition**: Average client rating (1-5 stars)
- **Formula**: `AVG(client_rating) WHERE client_rating IS NOT NULL`
- **Source**: `feedback_queue.client_rating` or `content_items.client_rating`
- **Target**: >4.0

---

## Sync Metrics

### Sync Health Rate
- **Definition**: % of sync operations succeeding
- **Formula**: `COUNT(status = 'success') / COUNT(*) * 100`
- **Source**: `csv_sync_log`
- **Target**: >98%

```sql
SELECT
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*) AS total_syncs,
    COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) AS success_rate,
    SUM(rows_affected) AS total_rows,
    AVG(duration_ms) AS avg_duration_ms
FROM csv_sync_log
WHERE tenant_id = :tenant_id
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day DESC;
```

### Retry Queue Depth
- **Definition**: Pending failed writes awaiting retry
- **Formula**: `COUNT(*) WHERE status = 'pending'`
- **Source**: `write_retry_queue`
- **Alert**: >10 pending = systemic issue

```sql
SELECT
    target,
    COUNT(*) AS pending,
    MIN(created_at) AS oldest_pending,
    AVG(retry_count) AS avg_retries
FROM write_retry_queue
WHERE tenant_id = :tenant_id
  AND status = 'pending'
GROUP BY target;
```

### Three-Way Consistency
- **Definition**: % of items where CSV, Supabase, and Wix are in sync
- **Source**: Computed by consistency-check service
- **Target**: 100%

---

## AI Metrics

### AI Provider Distribution
- **Definition**: Usage split across providers
- **Source**: `ai_sessions.provider`

```sql
SELECT
    provider,
    model,
    COUNT(*) AS sessions,
    SUM(total_tokens) AS total_tokens,
    AVG(duration_ms) AS avg_latency_ms,
    COUNT(CASE WHEN status = 'error' THEN 1 END) AS errors
FROM ai_sessions
WHERE tenant_id = :tenant_id
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY provider, model;
```

### AI Error Rate
- **Definition**: % of AI calls that fail
- **Formula**: `COUNT(status = 'error') / COUNT(*) * 100`
- **Source**: `ai_sessions`
- **Target**: <5%

### Token Usage
- **Definition**: Total tokens consumed by AI generation
- **Formula**: `SUM(total_tokens)`
- **Source**: `ai_sessions`
- **Cost mapping**: Gemini ≈ $0.10/1M tokens, Claude ≈ $3.00/1M tokens (input)
