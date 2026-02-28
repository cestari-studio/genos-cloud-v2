# Multi-tenancy Domain Tables

## tenants

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.tenants` |
| **Description** | Isolated workspaces representing clients or projects. Every piece of data in genOS belongs to exactly one tenant. |
| **Primary Key** | `id` (uuid) |
| **Update Frequency** | Rare (new client onboarding) |
| **RLS** | Enabled — tenant isolation via `tenant_members` |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `name` | text | NO | — | Display name (e.g., "Lets Travel with Us 360") |
| `slug` | text | NO | — | Kebab-case identifier, UNIQUE. Used for filesystem paths |
| `owner_id` | uuid | NO | — | FK → auth.users(id). Primary owner of the tenant |
| `plan` | text | NO | `'starter'` | Subscription tier: `starter`, `professional`, `enterprise` |
| `status` | text | NO | `'active'` | Tenant status: `active`, `suspended`, `archived` |
| `settings` | jsonb | NO | `'{}'` | Tenant-level configurations (locale, timezone, etc.) |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

### Key Differences from Specs
- **`owner_id`**: Real column — links to the primary owner user
- **No `locale` column**: Locale is stored in `settings` jsonb
- **No `timezone` column**: Timezone is stored in `settings` jsonb
- **`plan` default is `'starter'`** (not `free`)

### Reference Tenants (Seed Data)

| Tenant | Slug | Plan | Notes |
|--------|------|------|-------|
| Lets Travel with Us 360 | `lets-travel-360` | professional | UK-based travel agency, en-GB |
| Clareira de Avalon | `clareira-avalon` | professional | Brazilian wellness brand, pt-BR |

### Relationships
- `tenants` → `tenant_members` (1:N)
- `tenants` → `brand_dna` (1:1)
- `tenants` → `system_prompts` (1:N)
- `tenants` → `compliance_rules` (1:N)
- `tenants` → `csv_registry` (1:N)
- `tenants` → `content_items` (1:N)
- `tenants` → `ai_sessions` (1:N)
- `tenants` → `connected_accounts` (1:N)
- `tenants` → `mcp_connections` (1:N)
- `tenants` → `activity_log` (1:N)
- `tenants` → `write_retry_queue` (1:N)
- `tenants` → `feedback_queue` (1:N)

### Gotchas
- `slug` is used for filesystem paths: `/projects/{slug}/`. Always use slug, not name, for path resolution
- Timezone and locale are inside `settings` jsonb — access as `settings->>'timezone'` and `settings->>'locale'`
- `owner_id` is the billing/admin owner — actual access control is via `tenant_members`

---

## tenant_members

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.tenant_members` |
| **Description** | **SOURCE OF TRUTH for authorization.** Links users to tenants with a specific role. A user can belong to multiple tenants with different roles. |
| **Primary Key** | `id` (uuid) — with UNIQUE constraint on `(user_id, tenant_id)` |
| **Update Frequency** | Rare (team changes) |
| **RLS** | Enabled |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | — | FK → tenants(id) |
| `user_id` | uuid | NO | — | FK → auth.users(id) |
| `role` | text | NO | — | Role in this tenant |
| `invited_by` | uuid | YES | — | FK → auth.users(id). Who invited this member |
| `status` | text | NO | `'active'` | Member status: `active`, `invited`, `suspended` |
| `created_at` | timestamptz | NO | `now()` | When user was added |

### 5 RBAC Roles (Hierarchy)

```
sys_admin > agency_admin > tenant_admin > tenant_editor > tenant_viewer
```

| Role | Level | Can Do |
|------|-------|--------|
| `sys_admin` | Platform-wide | Everything. Cross-tenant queries. Only Cestari Studio. |
| `agency_admin` | Multi-tenant | Manage multiple tenants. Config, DNA overrides, AI preferences. |
| `tenant_admin` | Single tenant | Full control of one tenant. Brand DNA, prompts, compliance rules. |
| `tenant_editor` | Single tenant | Create/edit content. Cannot change configs. |
| `tenant_viewer` | Single tenant | Read-only. View content and analytics. |

Higher roles inherit all permissions of lower roles.

### RLS Policy Pattern

Every table with `tenant_id` uses this RLS pattern:

```sql
CREATE POLICY tenant_isolation ON [table_name] FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));
```

### Sample Queries

```sql
-- All tenants a user belongs to with their roles
SELECT
    t.name, t.slug, t.plan, tm.role, tm.status
FROM tenant_members tm
JOIN tenants t ON t.id = tm.tenant_id
WHERE tm.user_id = auth.uid()
  AND tm.status = 'active';

-- All members of a tenant
SELECT
    u.email, tm.role, tm.status, tm.created_at
FROM tenant_members tm
JOIN auth.users u ON u.id = tm.user_id
WHERE tm.tenant_id = :tenant_id;
```

### Gotchas
- **This table is the source of truth** — NOT `auth.users` metadata
- A user CAN have different roles in different tenants
- `status` field allows for invite flow — `invited` → `active`
- `invited_by` tracks the invite chain for audit purposes

---

## activity_log

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.activity_log` |
| **Description** | Append-only audit trail of all significant actions in genOS |
| **Primary Key** | `id` (uuid) |
| **Update Frequency** | Real-time (<1 second) |
| **RLS** | Enabled. **Append-only** — no UPDATE or DELETE policies. |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | — | FK → tenants(id) |
| `user_id` | uuid | NO | — | FK → auth.users(id). Who performed the action |
| `action` | text | NO | — | Action identifier: `content.insert`, `content.update`, `feedback.process`, `sync.complete`, etc. |
| `resource_type` | text | YES | — | What was affected: `content_item`, `csv_registry`, `brand_dna`, etc. |
| `resource_id` | uuid | YES | — | ID of the affected resource |
| `metadata` | jsonb | NO | `'{}'` | Action details (varies by action type) |
| `ip_address` | inet | YES | — | Client IP for security audit |
| `created_at` | timestamptz | NO | `now()` | When it happened |

### Gotchas
- **Append-only**: No UPDATE or DELETE policies. By design for audit integrity.
- `ip_address` field is `inet` type — specific to PostgreSQL
- Use for debugging and compliance — not for real-time analytics

---

## connected_accounts

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.connected_accounts` |
| **Description** | Social media and platform accounts connected to a tenant |
| **Primary Key** | `id` (uuid) |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | — | FK → tenants(id) |
| `platform` | text | NO | — | Platform: `instagram`, `tiktok`, `facebook`, `youtube`, `wix` |
| `account_name` | text | YES | — | Display name of the connected account |
| `account_id` | text | YES | — | Platform-specific account ID |
| `credentials` | text | YES | — | Encrypted OAuth token / credentials |
| `status` | text | NO | `'active'` | Connection status: `active`, `expired`, `revoked` |
| `last_synced_at` | timestamptz | YES | — | Last successful sync with this platform |
| `metadata` | jsonb | YES | `'{}'` | Platform-specific metadata |
| `connected_by` | uuid | YES | — | FK → auth.users(id). Who connected this account |
| `created_at` | timestamptz | NO | `now()` | |

### Key Differences from Specs
- **`credentials`** (not `access_token`): Encrypted credentials field
- **`account_name`**: Display name for the connected account
- **`last_synced_at`**: Tracks last sync time
- **`metadata`**: Platform-specific extra data
- **`connected_by`**: Audit trail for who connected the account

---

## mcp_connections

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.mcp_connections` |
| **Description** | MCP (Model Context Protocol) server configurations per tenant |
| **Primary Key** | `id` (uuid) |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | — | FK → tenants(id) |
| `server_name` | text | NO | — | MCP server identifier (e.g., `wix-cms`, `stripe-billing`) |
| `server_url` | text | NO | — | MCP server endpoint URL |
| `config_encrypted` | text | NO | — | Encrypted connection configuration |
| `status` | text | NO | `'inactive'` | Connection status: `active`, `inactive`, `error` |
| `last_health_check` | timestamptz | YES | — | Last health check timestamp |
| `error_message` | text | YES | — | Last error message if status is `error` |
| `created_by` | uuid | NO | — | FK → auth.users(id). Who configured this connection |
| `created_at` | timestamptz | NO | `now()` | |

### Key Differences from Specs
- **`server_name`** (not `connector_type`): Uses the MCP server name as identifier
- **`server_url`**: Explicit URL field for the MCP endpoint
- **`config_encrypted`** (not `config` jsonb): Encrypted text, not plain jsonb
- **`last_health_check`**: Monitors connection health
- **`error_message`**: Stores last error for debugging
- **`created_by`**: Audit trail
