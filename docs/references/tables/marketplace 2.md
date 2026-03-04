# Marketplace Domain Tables

> **Note**: Marketplace is planned for v1.2.0 "Nexus" and v2.0.0 "Quantum". Tables exist in schema but may not have production data yet.

## marketplace_items

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.marketplace_items` |
| **Description** | Templates, prompt packs, brand DNA presets, and other sellable assets created by tenants |
| **Primary Key** | `id` (uuid) |
| **RLS** | Enabled — public read for published items, seller-only write |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `seller_tenant_id` | uuid | NO | — | FK → tenants(id). The tenant selling this item |
| `item_type` | text | NO | — | Asset type: `prompt_template`, `brand_dna_preset`, `compliance_pack`, `content_template`, `workflow` |
| `title` | text | NO | — | Display name of the item |
| `description` | text | YES | — | Item description |
| `price_cents` | integer | NO | — | Price in minor currency units (cents). 0 for free items |
| `currency` | text | NO | `'BRL'` | ISO currency code. Default BRL |
| `stripe_price_id` | text | YES | — | Stripe Price object ID (for checkout) |
| `stripe_product_id` | text | YES | — | Stripe Product object ID |
| `storage_path` | text | YES | — | Supabase Storage path for the asset file |
| `preview_url` | text | YES | — | Public URL for preview/thumbnail |
| `downloads` | integer | NO | `0` | Times downloaded/purchased |
| `rating` | double precision | YES | — | Average user rating |
| `total_ratings` | integer | NO | `0` | Number of ratings received |
| `tags` | text[] | NO | `'{}'` | Searchable tags array |
| `status` | text | NO | `'draft'` | Lifecycle status: `draft`, `published`, `archived`, `rejected` |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

### Key Differences from Specs
- **`seller_tenant_id`** (not `creator_id`): Items are owned by tenants, not individual users
- **`price_cents`** (not `price_usd`): Stored in minor currency units with separate `currency` column
- **`status`** (not `is_published`): Full lifecycle status field instead of boolean
- **`title`** (not `name`): Column is called `title`
- **`preview_url`** (not `preview` jsonb): Simple text URL, not a JSON object
- No `content` jsonb column — asset data lives in Supabase Storage via `storage_path`

### RLS Notes
- **Read**: Published items (`status = 'published'`) are publicly readable
- **Write**: Only the seller tenant can edit/delete their items
- This is the ONE exception to the standard tenant isolation pattern

### Sample Queries

```sql
-- Published marketplace items by type
SELECT
    item_type,
    COUNT(*) AS total,
    AVG(price_cents) / 100.0 AS avg_price,
    AVG(rating) AS avg_rating
FROM marketplace_items
WHERE status = 'published'
GROUP BY item_type;

-- My tenant's items
SELECT id, title, item_type, price_cents, currency, downloads, rating, status
FROM marketplace_items
WHERE seller_tenant_id = :tenant_id
ORDER BY created_at DESC;
```

---

## marketplace_purchases

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.marketplace_purchases` |
| **Description** | Purchase records linking buyer tenants to marketplace items, with revenue share tracking |
| **Primary Key** | `id` (uuid) |
| **RLS** | Enabled — buyer tenant can see their purchases |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `buyer_tenant_id` | uuid | NO | — | FK → tenants(id). Who purchased |
| `item_id` | uuid | NO | — | FK → marketplace_items(id). What was purchased |
| `stripe_payment_id` | text | YES | — | Stripe PaymentIntent ID |
| `stripe_checkout_session_id` | text | YES | — | Stripe Checkout Session ID |
| `amount_cents` | integer | NO | — | Total amount paid in minor currency units |
| `currency` | text | NO | `'BRL'` | ISO currency code |
| `revenue_share_seller_cents` | integer | YES | — | Seller's share in cents |
| `revenue_share_platform_cents` | integer | YES | — | Platform (Cestari) share in cents |
| `status` | text | NO | `'pending'` | Purchase status: `pending`, `completed`, `refunded` |
| `purchased_at` | timestamptz | NO | `now()` | Purchase timestamp |

### Key Differences from Specs
- **No `buyer_user_id`**: Purchases are tenant-level, not user-level
- **`amount_cents`** (not `price_paid_usd`): Minor currency units with separate `currency`
- **`purchased_at`** (not `created_at`): Timestamp column named differently
- **Revenue share columns**: `revenue_share_seller_cents` and `revenue_share_platform_cents` for Stripe Connect split
- **`stripe_checkout_session_id`**: Additional Stripe tracking field

### Relationships
- `marketplace_purchases.item_id` → `marketplace_items.id` (N:1)
- `marketplace_purchases.buyer_tenant_id` → `tenants.id` (N:1)
- Revenue share model: configured via Stripe Connect

### Sample Queries

```sql
-- Purchase history for a tenant
SELECT
    mp.purchased_at, mi.title, mi.item_type,
    mp.amount_cents / 100.0 AS amount, mp.currency, mp.status
FROM marketplace_purchases mp
JOIN marketplace_items mi ON mi.id = mp.item_id
WHERE mp.buyer_tenant_id = :tenant_id
ORDER BY mp.purchased_at DESC;

-- Revenue report for a seller tenant
SELECT
    DATE_TRUNC('month', mp.purchased_at) AS month,
    COUNT(*) AS sales,
    SUM(mp.revenue_share_seller_cents) / 100.0 AS seller_revenue,
    SUM(mp.revenue_share_platform_cents) / 100.0 AS platform_revenue
FROM marketplace_purchases mp
JOIN marketplace_items mi ON mi.id = mp.item_id
WHERE mi.seller_tenant_id = :tenant_id
  AND mp.status = 'completed'
GROUP BY month
ORDER BY month DESC;
```
