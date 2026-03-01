# genOS Entities & Relationships

## Core Entities

### Tenant (Workspace)
- **Definition**: An isolated workspace representing a client or project
- **Primary Table**: `tenants`
- **ID Field**: `id` (uuid)
- **Slug**: `slug` (kebab-case, unique) — used for filesystem paths
- **Examples**: `lets-travel-360`, `clareira-avalon`
- **Common Filters**: `status = 'active'`, `plan IN ('professional', 'enterprise')`

### User (Team Member)
- **Definition**: A Cestari Studio team member with Supabase auth
- **Primary Table**: `auth.users` (Supabase managed)
- **ID Field**: `id` (uuid, same as `auth.uid()`)
- **Linked via**: `tenant_members.user_id`
- **Note**: A user can belong to MULTIPLE tenants with DIFFERENT roles

### Tenant Member (Role Binding)
- **Definition**: The link between a user and a tenant, with a specific role
- **Primary Table**: `tenant_members`
- **Unique Constraint**: `(user_id, tenant_id)` — one role per user per tenant
- **ID Fields**: `user_id` + `tenant_id` (composite)
- **Role Values**: `sys_admin`, `agency_admin`, `tenant_admin`, `tenant_editor`, `tenant_viewer`
- **THIS IS THE SOURCE OF TRUTH for authorization** — not auth.users metadata

### Content Item
- **Definition**: A piece of content generated or managed by genOS (blog post, social post, trip, etc.)
- **Primary Table**: `content_items`
- **ID Field**: `id` (uuid)
- **Three-Way Link**:
  - CSV: `csv_source_slug` + `csv_row_id`
  - Wix: `wix_item_id` + `wix_collection`
  - Supabase: `id`
- **Content Types**: `travel_listing`, `blog_article`, `social_post`, `video_script`, `newsletter`, `course`, `meditation`, `general`

### CSV Registry Entry
- **Definition**: Metadata about a CSV file managed by genOS
- **Primary Table**: `csv_registry`
- **ID Field**: `id` (uuid)
- **Slug**: `csv_slug` (unique per tenant)
- **Categories**: `content` (syncs to Wix), `feedback` (from Wix), `insights` (local only), `operations` (varies)
- **Filesystem Path**: Resolved as `/projects/{tenant_slug}/{local_path}`

### Brand DNA
- **Definition**: Personality and style configuration for a tenant's content
- **Primary Table**: `brand_dna`
- **ID Field**: `id` (uuid), linked via `tenant_id`
- **One-to-one** with tenants
- **Key Fields**: `voice_tone`, `language`, `forbidden_words` (array), `hashtag_strategy` (jsonb), `persona_name`
- **Override System**: Local file `config/brand-dna-override.json` merges ON TOP of cloud values

### Feedback Queue Item
- **Definition**: A feedback event from a client via Wix webhook
- **Primary Table**: `feedback_queue`
- **ID Field**: `id` (uuid)
- **Lifecycle**: `pending` → `processing` → `applied` / `escalated` / `failed`
- **Linked to**: `csv_registry` (via `csv_registry_id`) and Wix item (via `wix_item_id`)

### AI Session
- **Definition**: A single AI generation or revision call
- **Primary Table**: `ai_sessions`
- **ID Field**: `id` (uuid)
- **Providers**: `gemini` (bulk), `claude` (strategic/revisions), `apple` (local)
- **Linked to**: `content_items` via the content being generated

---

## Entity Relationship Diagram (Text)

```
auth.users
    │
    ├──(1:N)──→ tenant_members ←──(N:1)──→ tenants
    │                                         │
    │                                         ├──(1:1)──→ brand_dna
    │                                         ├──(1:N)──→ system_prompts
    │                                         ├──(1:N)──→ compliance_rules
    │                                         ├──(1:N)──→ csv_registry
    │                                         │               │
    │                                         │               ├──(1:N)──→ csv_sync_log
    │                                         │               └──(1:N)──→ feedback_queue
    │                                         │
    │                                         ├──(1:N)──→ content_items
    │                                         │               │
    │                                         │               ├── csv_source_slug → csv_registry.csv_slug
    │                                         │               ├── wix_item_id → Wix CMS (external)
    │                                         │               └── csv_row_id → CSV file row (external)
    │                                         │
    │                                         ├──(1:N)──→ ai_sessions
    │                                         ├──(1:N)──→ connected_accounts
    │                                         ├──(1:N)──→ mcp_connections
    │                                         ├──(1:N)──→ activity_log
    │                                         └──(1:N)──→ write_retry_queue
    │
    └──(1:N)──→ marketplace_items (as creator)
                     │
                     └──(1:N)──→ marketplace_purchases (as buyer: tenant)
```

---

## Reference Tenants (Seed Data)

| Tenant | Slug | Plan | Locale | Timezone | Owner |
|--------|------|------|--------|----------|-------|
| Lets Travel with Us 360 | `lets-travel-360` | professional | en-GB | Europe/London | Débora Lazzaroto |
| Clareira de Avalon | `clareira-avalon` | professional | pt-BR | America/Sao_Paulo | — |

### Lets Travel 360 — CSV Map
| CSV Slug | Category | Wix Collection | Sync Direction |
|----------|----------|----------------|----------------|
| `trips` | content | Trips | bidirectional |
| `blog-posts` | content | BlogPosts | bidirectional |
| `social-posts` | content | SocialMedia | bidirectional |
| `video-scripts` | content | Videos | bidirectional |
| `newsletters` | content | Newsletters | bidirectional |
| `trips-feedback` | feedback | — | from_wix |
| `blog-feedback` | feedback | — | from_wix |
| `social-feedback` | feedback | — | from_wix |
| `content-performance` | insights | — | local_only |
| `monthly-report` | insights | — | local_only |
| `feedback-analysis` | insights | — | local_only |
| `contracts` | operations | — | local_only |
| `invoices` | operations | — | local_only |
| `task-board` | operations | — | local_only |
