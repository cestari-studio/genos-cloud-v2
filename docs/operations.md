# Operations Domain (CSV-Based)

> **Note**: Operations data is stored in CSV files on the local filesystem, NOT in Supabase tables. These CSVs are indexed in `csv_registry` with `csv_category = 'operations'` and typically have `sync_direction = 'local_only'`.

## contracts.csv

### Overview
| Property | Value |
|----------|-------|
| **Location** | `/projects/{tenant-slug}/operations/contracts.csv` |
| **Registry** | `csv_registry` where `csv_slug = 'contracts'` |
| **Sync Direction** | `local_only` (or Wix: Contracts, future) |
| **Description** | Client service contracts managed by Cestari Studio |

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Unique identifier |
| `client_name` | text | Client/tenant name |
| `service_type` | text | What services are provided |
| `start_date` | date | Contract start |
| `end_date` | date | Contract end |
| `value_brl` | number | Contract value in BRL |
| `status` | text | `draft`, `sent`, `signed`, `active`, `completed`, `cancelled` |
| `payment_terms` | text | Payment schedule |
| `deliverables` | text | What's included |

### Dependency Rules
- When `status` changes to `signed` → auto-generates row in `invoices.csv`
- Contracts do NOT affect content CSVs (trips, blog, social, etc.)

---

## invoices.csv

### Overview
| Property | Value |
|----------|-------|
| **Location** | `/projects/{tenant-slug}/operations/invoices.csv` |
| **Registry** | `csv_registry` where `csv_slug = 'invoices'` |
| **Sync Direction** | `local_only` (Stripe sync in future v2.0.0) |
| **Description** | Invoices generated from contracts |

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Unique identifier |
| `contract_id` | text | FK → contracts.csv id |
| `amount_brl` | number | Invoice amount in BRL |
| `due_date` | date | Payment due date |
| `paid_date` | date | When payment was received (null if unpaid) |
| `status` | text | `pending`, `sent`, `paid`, `overdue`, `cancelled` |
| `stripe_invoice_id` | text | Future: Stripe invoice ID |

### Dependency Rules
- Generated automatically when a contract is signed
- Does NOT affect any content CSVs

---

## task-board.csv

### Overview
| Property | Value |
|----------|-------|
| **Location** | `/projects/{tenant-slug}/operations/task-board.csv` |
| **Registry** | `csv_registry` where `csv_slug = 'task-board'` |
| **Sync Direction** | `local_only` |
| **Description** | Manual tasks and action items for Cestari team |

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Unique identifier |
| `title` | text | Task description |
| `description` | text | Detailed notes |
| `assigned_to` | text | Team member name |
| `status` | text | `todo`, `in_progress`, `done`, `cancelled` |
| `priority` | text | `urgent`, `high`, `normal`, `low` |
| `due_date` | date | Deadline |
| `linked_csv` | text | Related CSV slug (e.g., `trips`) |
| `linked_row_id` | text | Related row ID |

### Dependency Rules
- Auto-created when feedback is `rejected` (Dependency Engine: `create_task`)
- Can link to any content CSV via `linked_csv` + `linked_row_id`

---

## Dual-Write for Operations CSVs

Operations CSVs also participate in dual-write when Supabase mirroring is enabled:
- **CSV**: Always written (filesystem)
- **Supabase**: Written to `content_items` with `content_type` derived from csv_slug
- **Wix**: Typically NOT synced (`local_only`), but configurable

When querying operations data from Supabase:
```sql
SELECT * FROM content_items
WHERE tenant_id = :tenant_id
  AND csv_source_slug IN ('contracts', 'invoices', 'task-board');
```

### Operations ↔ Content Isolation

**Critical rule**: Operations CSVs and Content CSVs are isolated in the dependency graph:
- ⛔ `trips` does NOT affect `contracts`
- ⛔ `blog-posts` does NOT affect `invoices`
- ⛔ `contracts` does NOT affect `social-posts`
- ✅ `contracts` → `invoices` (when signed)
- ✅ Content rejection → `task-board` (creates task)
