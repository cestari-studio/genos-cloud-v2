# Content Domain Tables

## content_items

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.content_items` |
| **Description** | Central content table. Every piece of content (posts, blogs, trips, videos, newsletters) created in genOS lives here. This is the Supabase mirror of CSV data via dual-write. |
| **Primary Key** | `id` (uuid) |
| **Update Frequency** | Real-time (every content creation/edit) |
| **RLS** | Enabled — tenant isolation via `tenant_members` |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | — | FK → tenants(id). **REGRA ZERO** |
| `content_type` | text | NO | — | Type: `social_post`, `blog_post`, `video_script`, `travel_listing`, `newsletter`, `course`, `meditation`, `general`, `insight` |
| `title` | text | YES | — | Content title/headline |
| `body` | text | YES | — | Main content body |
| `media_urls` | text[] | NO | `'{}'` | Array of media file URLs |
| `platform` | text | YES | — | Target platform: `instagram`, `tiktok`, `facebook`, `youtube`, `linkedin`, `blog`, `email`, `wix`, `multi` |
| `status` | text | NO | `'draft'` | Lifecycle: `draft`, `review`, `approved`, `published`, `archived` |
| `compliance_score` | integer | YES | — | MasterCompliance score (0-100) |
| `compliance_notes` | jsonb | YES | — | Detailed compliance validation results |
| `ai_session_id` | uuid | YES | — | FK → ai_sessions(id). Which AI session generated this |
| `scheduled_for` | timestamptz | YES | — | Scheduled publication time |
| `published_at` | timestamptz | YES | — | Actual publication timestamp |
| `created_by` | uuid | YES | — | FK → auth.users(id). Who created it |
| `approved_by` | uuid | YES | — | FK → auth.users(id). Who approved it |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |
| `hashtags` | text[] | YES | `'{}'` | Content hashtags |
| `visual_direction` | jsonb | YES | `'{}'` | Visual/creative direction instructions |
| `pillar` | text | YES | — | Content pillar classification |

#### CSV Linkage Columns (Dual-Write)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `csv_source_slug` | text | YES | — | Which CSV this row came from (e.g., `trips`) |
| `csv_row_id` | text | YES | — | Row ID in the CSV |
| `csv_row_hash` | text | YES | — | MD5 hash for drift detection |

#### Wix Linkage Columns (Dual-Write)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `wix_item_id` | text | YES | — | Wix CMS item ID |
| `wix_collection` | text | YES | — | Wix CMS collection name |
| `wix_site_id` | text | YES | — | Wix site identifier |
| `wix_last_sync` | timestamptz | YES | — | Last sync with Wix |

#### Flexible Extension

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `extra_fields` | jsonb | YES | `'{}'` | Content-type-specific fields not in base schema |

#### Feedback Tracking Columns (Dual-Write)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `client_feedback` | text | YES | — | Feedback status: `approved`, `rejected`, `revision_requested`, `pending` |
| `client_comment` | text | YES | — | Client's free-text comment |
| `client_rating` | integer | YES | — | Client rating (1-5) |
| `revision_count` | integer | YES | `0` | How many AI revisions this content has had |
| `ai_provider_used` | text | YES | — | Which AI model generated this content |

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_content_items_csv` | `(tenant_id, csv_source_slug, csv_row_id)` | CSV row lookup |
| `idx_content_items_wix` | `(tenant_id, wix_item_id)` | Wix item lookup |
| `idx_content_items_hash` | `(tenant_id, csv_row_hash)` | Drift detection |

### Sample Queries

```sql
-- Content by type and status
SELECT
    content_type, status,
    COUNT(*) AS total,
    AVG(compliance_score) AS avg_compliance
FROM content_items
WHERE tenant_id = :tenant_id
GROUP BY content_type, status;

-- Content needing revision (rejected by client)
SELECT id, title, content_type, client_feedback, client_comment, revision_count
FROM content_items
WHERE tenant_id = :tenant_id
  AND client_feedback = 'rejected'
ORDER BY updated_at DESC;

-- Drift detection: rows with hash mismatch
SELECT csv_source_slug, csv_row_id, csv_row_hash, updated_at
FROM content_items
WHERE tenant_id = :tenant_id
  AND csv_source_slug IS NOT NULL
  AND csv_row_hash IS NOT NULL;
```

### Gotchas
- `content_type` CHECK constraint includes: `social_post`, `blog_post`, `video_script`, `travel_listing`, `newsletter`, `course`, `meditation`, `general`, `insight`
- `platform` CHECK constraint includes: `instagram`, `tiktok`, `facebook`, `youtube`, `linkedin`, `blog`, `email`, `wix`, `multi`
- NULL `ai_session_id` means manual creation (not AI-generated)
- NULL `ai_provider_used` also means manual creation
- `csv_source_slug` links to `csv_registry.csv_slug` (text reference, not FK)
- `extra_fields` stores content-type-specific data (e.g., trip destination, duration, price for travel_listings)

---

## brand_dna

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.brand_dna` |
| **Description** | Brand identity configuration for each tenant. Controls voice, tone, visual direction, and content rules for AI generation. One row per tenant. |
| **Primary Key** | `id` (uuid) |
| **Relationship** | 1:1 with `tenants` |
| **Update Frequency** | Rare (brand config changes) |
| **RLS** | Enabled — tenant isolation |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | — | FK → tenants(id). Unique per tenant |
| `voice_tone` | jsonb | NO | `'{}'` | Tone parameters: formality, energy, humor, etc. |
| `voice_description` | text | YES | — | Free-text description of brand voice |
| `language` | text | NO | `'pt-BR'` | Primary content language |
| `persona_name` | text | YES | — | Brand persona name (e.g., "The Adventurous Guide") |
| `regional_notes` | text | YES | — | Region-specific language/culture notes |
| `content_rules` | jsonb | NO | `'{}'` | Content creation rules (length, format, etc.) |
| `forbidden_words` | text[] | NO | `'{}'` | Words/phrases that must never appear |
| `hashtag_strategy` | jsonb | NO | `'{}'` | Hashtag usage rules and templates |
| `color_palette` | jsonb | NO | `'{}'` | Brand colors for visual content |
| `sample_posts` | jsonb | NO | `'[]'` | Example posts for AI few-shot learning |
| `personality_traits` | jsonb | NO | `'{}'` | Brand personality dimensions |
| `typography` | jsonb | NO | `'{}'` | Font/typography preferences |
| `target_audience` | jsonb | NO | `'{}'` | Audience demographics and psychographics |
| `brand_values` | jsonb | NO | `'{}'` | Core brand values |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

### Brand DNA Override System

```
Priority (highest → lowest):
1. Local JSON file: /projects/{tenant-slug}/config/brand-dna.local.json
2. Supabase cloud: brand_dna table row
3. System defaults: hardcoded fallbacks
```

The local JSON override allows tenants to fine-tune AI behavior without cloud roundtrips.

### Sample Queries

```sql
-- Full brand DNA for a tenant
SELECT *
FROM brand_dna
WHERE tenant_id = :tenant_id;

-- All tenants and their primary language
SELECT t.name, t.slug, bd.language, bd.persona_name
FROM brand_dna bd
JOIN tenants t ON t.id = bd.tenant_id;
```

---

## system_prompts

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.system_prompts` |
| **Description** | Versioned system prompt templates used by AI agents. Each prompt targets a specific content type and AI model. |
| **Primary Key** | `id` (uuid) |
| **Update Frequency** | Manual (prompt engineering iterations) |
| **RLS** | Enabled — tenant isolation |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | — | FK → tenants(id) |
| `name` | text | NO | — | Human-readable prompt name |
| `content_type` | text | YES | — | Which content type this prompt is for |
| `model_target` | text | NO | `'claude'` | Which AI model to use: `claude`, `gemini`, `apple` |
| `prompt_text` | text | NO | — | The actual system prompt template |
| `temperature` | numeric | YES | `0.7` | AI temperature setting |
| `version` | integer | NO | `1` | Prompt version number |
| `is_active` | boolean | NO | `true` | Whether this version is active |
| `description` | text | YES | — | Notes about this prompt version |
| `created_by` | uuid | YES | — | FK → auth.users(id) |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

### Key Differences from Specs
- **`content_type`** (not `prompt_type`): Aligned with content_items.content_type
- **`prompt_text`** (not `template`): The actual prompt content
- **`model_target`**: Specifies which AI model this prompt is designed for
- **`temperature`**: AI temperature parameter stored per prompt

### Sample Queries

```sql
-- Active prompts for a tenant by content type
SELECT name, content_type, model_target, version, temperature
FROM system_prompts
WHERE tenant_id = :tenant_id
  AND is_active = true
ORDER BY content_type, version DESC;

-- Find the latest active prompt for a specific content type
SELECT id, name, prompt_text, model_target, temperature
FROM system_prompts
WHERE tenant_id = :tenant_id
  AND content_type = :content_type
  AND is_active = true
ORDER BY version DESC
LIMIT 1;
```

### Gotchas
- Multiple versions of the same prompt can exist — always filter by `is_active = true` and `ORDER BY version DESC LIMIT 1`
- `model_target` helps route to the right AI provider — prompts may be optimized for specific models
- `temperature` overrides the model's default — lower for factual content, higher for creative
