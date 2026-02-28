# genOS Lumina v1.0.0 — API Reference

Base URL: `http://localhost:3001`
Header: `x-tenant-slug: cestari-studio` (optional, defaults to env)

---

## Health & System

### GET /api/health
Returns server status, version, and tenant connection.

### GET /api/tenant
Returns current tenant info (name, slug, plan).

---

## Dashboard

### GET /api/dashboard/stats
Aggregated stats: content counts by status/type, avg compliance score, CSV registries, AI session totals (tokens + cost), compliance rules, feedback queue.

### GET /api/dashboard/recent?limit=10
Recent content items, AI sessions, and activity log entries.

---

## Content CRUD

### GET /api/content
List content items with filters.

| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by status (draft, pending_review, approved, published, rejected) |
| content_type | string | Filter by type (social_post, post_carrossel, blog_post, blog_article, reels, stories, email_campaign, brief) |
| platform | string | Filter by platform (instagram, linkedin, blog, youtube, email) |
| pillar | string | Filter by content pillar |
| search | string | Text search in title and body (ilike) |
| sort | string | Sort column (default: created_at) |
| order | string | asc or desc (default: desc) |
| limit | number | Page size (default: 50) |
| offset | number | Pagination offset (default: 0) |

Response: `{ items: [], total: number, limit: number, offset: number }`

### GET /api/content/:id
Get single content item by UUID.

### POST /api/content
Create content item manually.

Body: `{ title, body, content_type, platform, status?, hashtags?, pillar?, extra_fields? }`

### PUT /api/content/:id
Update content item. Body: partial fields to update.

### DELETE /api/content/:id
Delete content item.

---

## AI Engine

### POST /api/ai/generate
Generate content via AI (raw, no save).

Body: `{ content_type, prompt, platform?, context? }`

Response: `{ content, provider, model, tokensUsed, costUsd, sessionId }`

### POST /api/ai/generate-and-save
Generate + compliance check + save to DB in one call.

Body: `{ content_type, platform, prompt, pillar?, context? }`

Response: `{ item: ContentItem, ai: { provider, model, tokensUsed, costUsd, sessionId }, compliance: { score, verdict, layers } }`

### POST /api/ai/batch-generate
Batch generate multiple items (max 20).

Body: `{ items: [{ content_type, platform, prompt, pillar?, context? }] }`

Response: `{ total, succeeded, failed, results: [{ index, status, contentItemId?, complianceScore?, complianceVerdict?, provider?, error? }] }`

### POST /api/ai/compliance-check
Run MasterCompliance on content.

Body: `{ content, content_type, platform? }`

Response: `{ score: 0-100, checks: { forbidden_words, tone_alignment, length_compliance, brand_consistency }, suggestions: [], verdict: 'approved'|'needs_revision'|'rejected' }`

### POST /api/ai/envelope
Preview the agent envelope (system prompt assembly).

Body: `{ content_type, platform?, context? }`

### GET /api/ai/sessions?limit=20
List AI sessions.

### GET /api/ai/sessions/:id
Get single AI session.

### POST /api/ai/process-feedback
Process pending feedback queue items (auto-revision via AI).

---

## Sync Pipeline

### POST /api/sync/full
Trigger full CSV ↔ Supabase sync for all registered CSVs.

### POST /api/sync/push/:slug
Push CSV data to Supabase for a specific collection.

### POST /api/sync/pull/:slug
Pull Supabase data to CSV for a specific collection.

---

## Brand & Config

### GET /api/brand-dna
Get Brand DNA configuration.

### PUT /api/brand-dna
Update Brand DNA configuration.

### GET /api/csv-registry
List all registered CSV collections.

### GET /api/compliance-rules
List active compliance rules.

### GET /api/system-prompts
List active system prompts.

---

## Webhooks

### POST /webhooks/wix
Wix CMS webhook receiver (content updates from client portal).

### POST /webhooks/feedback
Client feedback webhook (adds to feedback_queue).

---

## AI Provider Routing

The AI Router automatically selects providers based on content type:
- **Strategic** (blog_article, email_campaign): Anthropic Claude → Gemini fallback
- **Bulk** (social_post, reels, stories): Google Gemini → Claude fallback
- **Local Mock**: Always available as final fallback (genOS-local-v1)

Provider chain: `Gemini → Claude → Local Mock`
