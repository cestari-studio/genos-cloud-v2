# genOS™ Cloud Platform — Super Prompt #8: Credit Management & Billing Pipeline

**Version:** 2.0.0
**Date:** 2026-02-28
**Document ID:** SP-008

---

## 1. Credit Wallet System Overview

The genOS™ Cloud Platform employs a **hybrid prepaid + pay-per-use credit system** to manage AI operation costs and ensure financial accountability. Each tenant maintains a **Credit Wallet** containing:

- **Prepaid Credits**: Balance of purchased credits that operators prefer to consume first
- **Overage Amount**: Accumulated pay-per-use debt when prepaid balance is exhausted
- **Overage Limit**: Maximum debt threshold before service blocking occurs
- **Blocked Status**: Boolean flag indicating whether the tenant can perform new AI operations

### 2.1 Core Principles

1. **Prepaid-First Model**: Tenants are encouraged to purchase prepaid credits via Stripe or other payment gateways
2. **Flexible Overage**: Unpaid charges accumulate in the overage account, allowing continued service with debt tracking
3. **Hard Limits**: Once overage exceeds the configured limit, new AI operations are rejected to prevent runaway debt
4. **Automatic Unblocking**: Paying the overage immediately zeros the debt and restores service access

### 2.2 Wallet States

| State | Condition | Operation Status | Action Required |
|-------|-----------|------------------|-----------------|
| **Green** | prepaid_credits > 0 AND overage_amount = 0 | Fully Operational | None |
| **Yellow** | prepaid_credits > 0 AND overage_amount > 0 | Operational with Debt | Pay overage to clear |
| **Orange** | prepaid_credits = 0 AND overage_amount > 0 AND overage < limit | Operational (Overage Mode) | Monitor overage growth |
| **Red** | overage_amount >= overage_limit | BLOCKED | Immediate payment required |

---

## 2. credit_wallets Table Schema

### 2.1 Database Structure

```sql
CREATE TABLE credit_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prepaid_credits DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  overage_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  overage_limit DECIMAL(15, 2) NOT NULL DEFAULT 50.00,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_payment_at TIMESTAMP WITH TIME ZONE,
  plan_tier VARCHAR(20) NOT NULL DEFAULT 'starter',

  CONSTRAINT positive_prepaid CHECK (prepaid_credits >= 0),
  CONSTRAINT positive_overage CHECK (overage_amount >= 0),
  CONSTRAINT positive_limit CHECK (overage_limit > 0)
);

CREATE INDEX idx_credit_wallets_tenant_id ON credit_wallets(tenant_id);
CREATE INDEX idx_credit_wallets_is_blocked ON credit_wallets(is_blocked);
```

### 2.2 Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | UUID | Unique wallet identifier | `550e8400-e29b-41d4-a716-446655440000` |
| `tenant_id` | UUID | Associated tenant account | `660e8400-e29b-41d4-a716-446655440111` |
| `prepaid_credits` | DECIMAL(15,2) | Purchased balance in BRL | `500.00` |
| `overage_amount` | DECIMAL(15,2) | Accumulated debt in BRL | `45.75` |
| `overage_limit` | DECIMAL(15,2) | Maximum debt threshold | `200.00` |
| `is_blocked` | BOOLEAN | Operational block flag | `false` |
| `currency` | VARCHAR(3) | ISO 4217 currency code | `BRL` |
| `created_at` | TIMESTAMP | Wallet creation timestamp | `2025-09-15T10:30:00Z` |
| `updated_at` | TIMESTAMP | Last modification timestamp | `2026-02-28T14:22:15Z` |
| `last_payment_at` | TIMESTAMP | Most recent payment timestamp | `2026-02-20T09:15:00Z` |
| `plan_tier` | VARCHAR(20) | Associated pricing tier | `pro` |

### 2.3 Constraints & Business Rules

- **prepaid_credits** must be non-negative
- **overage_amount** must be non-negative
- **overage_limit** must be positive (never zero or negative)
- **is_blocked** is automatically set to `true` when `overage_amount >= overage_limit`
- **currency** defaults to BRL but supports multi-currency future expansion
- **plan_tier** determines initial credit allocation and overage limits

---

## 3. Credit Flow & Debit Logic

### 3.1 Complete Credit Debit Transaction Flow

Every AI operation follows this deterministic 5-step credit debit process:

#### **Step 1: Calculate Operation Cost**

The system calculates the cost in BRL based on:
- AI model selected (Gemini 2.0 Flash, Claude 3.5 Sonnet, etc.)
- Input tokens consumed
- Output tokens generated
- Tenant's pricing markup tier

```
operational_cost_brl = (model_input_cost + model_output_cost) × (1 + markup_pct/100) × usd_to_brl_rate
```

**Example:**
- Input: 1,000 tokens at $0.0001/1K (Gemini) = $0.0001
- Output: 500 tokens at $0.0004/1K (Gemini) = $0.0002
- Base cost: $0.0003
- Markup: 15% (pro tier)
- USD→BRL rate: 5.10
- Final cost: $0.0003 × 1.15 × 5.10 = BRL 0.00177

#### **Step 2: Check Prepaid Balance**

```
IF prepaid_credits >= operational_cost_brl:
  // Sufficient prepaid balance exists
  PROCEED TO STEP 4
ELSE:
  // Insufficient prepaid; will use overage
  PROCEED TO STEP 3
```

#### **Step 3: Debit Prepaid & Allocate Remainder to Overage**

```
IF prepaid_credits < operational_cost_brl:
  remainder = operational_cost_brl - prepaid_credits
  prepaid_credits = 0.00
  overage_amount += remainder
  // Proceed to Step 4 for overage limit check
```

#### **Step 4: Check Overage Limit**

```
IF is_blocked = true:
  REJECT operation
  RETURN error: "Account blocked: overage limit exceeded"
ELSE IF overage_amount + additional_cost > overage_limit:
  REJECT operation
  RETURN error: "Overage limit would be exceeded"
  SET is_blocked = true
ELSE:
  // Safe to proceed
  PROCEED TO STEP 5
```

#### **Step 5: Record Transaction & Update Wallet**

```
1. Debit prepaid_credits or overage_amount
2. Create entry in usage_logs table
3. Update updated_at timestamp
4. Commit transaction atomically
5. Return operation result with credited_amount
```

### 3.2 Transaction State Machine

```
[Operation Received]
        ↓
[Calculate Cost] → cost_brl
        ↓
[Check Prepaid] → prepaid >= cost?
     /          \
   YES           NO
    ↓             ↓
 [Debit Prepaid] [Debit Prepaid + Overage]
    ↓             ↓
[Check Blocked?]
     /          \
   YES           NO
    ↓             ↓
[REJECT]     [Check Overage Limit]
    ↓             /         \
   FAIL        PASS         FAIL
               ↓              ↓
         [EXECUTE]      [BLOCK + REJECT]
               ↓              ↓
         [Log Usage]    [Set is_blocked=true]
               ↓              ↓
           [COMMIT]      [ROLLBACK]
               ↓              ↓
            [✓ SUCCESS]   [✗ REJECTED]
```

---

## 4. Cost Calculation Per AI Operation

### 4.1 Model Pricing Matrix

The following pricing is based on official model provider rates (as of February 2026):

#### **Gemini 2.0 Flash**
| Component | Rate | Notes |
|-----------|------|-------|
| Input Tokens | $0.0001 per 1K tokens | Cache hits: $0.00005 |
| Output Tokens | $0.0004 per 1K tokens | Standard generation |

**Example:** 5,000 input + 2,000 output tokens
```
input_cost = 5 × $0.0001 = $0.0005
output_cost = 2 × $0.0004 = $0.0008
base_cost = $0.0013
```

#### **Claude 3.5 Sonnet**
| Component | Rate | Notes |
|-----------|------|-------|
| Input Tokens | $0.003 per 1K tokens | Standard rate |
| Output Tokens | $0.015 per 1K tokens | Premium output cost |

**Example:** 5,000 input + 2,000 output tokens
```
input_cost = 5 × $0.003 = $0.015
output_cost = 2 × $0.015 = $0.030
base_cost = $0.045
```

### 4.2 Markup & Tenant Tier Application

The `pricing_config` table defines markup percentages per tenant tier:

```sql
CREATE TABLE pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plan_tier VARCHAR(20) NOT NULL,
  markup_pct DECIMAL(5, 2) NOT NULL,
  usd_to_brl_rate DECIMAL(8, 4) NOT NULL DEFAULT 5.10,
  effective_date DATE NOT NULL,

  PRIMARY KEY (tenant_id, plan_tier, effective_date),
  CONSTRAINT valid_markup CHECK (markup_pct >= 0 AND markup_pct <= 100)
);
```

**Markup Tiers:**

| Plan Tier | Markup % | Rationale |
|-----------|----------|-----------|
| free | 0% | Introductory tier, cost absorption by platform |
| starter | 5% | Entry-level business customers |
| pro | 15% | Mid-market, enhanced support costs |
| enterprise | 25% | Large-scale, dedicated infrastructure |

### 4.3 USD to BRL Conversion

The `usd_to_brl_rate` field in `pricing_config` tracks the daily exchange rate. This is updated via an Edge Function that pulls rates from a currency API.

```
final_cost_brl = base_cost_usd × (1 + markup_pct/100) × usd_to_brl_rate
```

**Example Calculation (Pro Tier, Claude 3.5 Sonnet):**
```
Base Cost: $0.045
Markup: 15% → × 1.15
Exchange: × 5.10 BRL/USD
Final Cost: $0.045 × 1.15 × 5.10 = BRL 0.264 (rounded)
```

### 4.4 Real-Time Rate Updates

```typescript
// Edge Function: update-exchange-rates/index.ts
export async function updateExchangeRates() {
  const rate = await fetchFromCurrencyAPI('USD', 'BRL');

  await supabase
    .from('pricing_config')
    .update({ usd_to_brl_rate: rate })
    .eq('effective_date', new Date().toISOString().split('T')[0]);
}

// Runs daily at 09:00 UTC via cron trigger
```

---

## 5. usage_logs Table & Audit Trail

### 5.1 Schema Definition

```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES credit_wallets(id) ON DELETE CASCADE,
  app_slug VARCHAR(100) NOT NULL,
  operation VARCHAR(255) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  cost_brl DECIMAL(15, 4) NOT NULL,
  cost_usd DECIMAL(15, 6) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  prepaid_used DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  overage_used DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  balance_before DECIMAL(15, 2) NOT NULL,
  balance_after DECIMAL(15, 2) NOT NULL,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT non_negative_cost CHECK (cost_brl >= 0 AND cost_usd >= 0)
);

CREATE INDEX idx_usage_logs_tenant_id ON usage_logs(tenant_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at DESC);
CREATE INDEX idx_usage_logs_status ON usage_logs(status);
CREATE INDEX idx_usage_logs_model ON usage_logs(model_name);
```

### 5.2 Field Reference

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Unique log entry identifier |
| `tenant_id` | UUID | Tenant performing the operation |
| `wallet_id` | UUID | Associated credit wallet |
| `app_slug` | VARCHAR | Application identifier (e.g., "document-analyzer") |
| `operation` | VARCHAR | Operation name (e.g., "generate-summary") |
| `input_tokens` | INTEGER | Tokens sent to model |
| `output_tokens` | INTEGER | Tokens generated by model |
| `total_tokens` | INTEGER | Generated column: input + output |
| `cost_brl` | DECIMAL | Cost charged in Brazilian Real |
| `cost_usd` | DECIMAL | Original cost in US Dollars |
| `model_name` | VARCHAR | Model identifier (e.g., "claude-3-5-sonnet") |
| `source_type` | VARCHAR | Origin ("api", "web", "batch") |
| `status` | VARCHAR | "completed", "failed", "rejected" |
| `prepaid_used` | DECIMAL | Amount debited from prepaid balance |
| `overage_used` | DECIMAL | Amount added to overage |
| `balance_before` | DECIMAL | Prepaid balance before transaction |
| `balance_after` | DECIMAL | Prepaid balance after transaction |
| `error_message` | TEXT | Error details if status = "failed" or "rejected" |
| `metadata` | JSONB | Additional data (session_id, user_agent, etc.) |
| `created_at` | TIMESTAMP | Transaction timestamp |

### 5.3 Sample Log Entries

```json
{
  "id": "771e8400-e29b-41d4-a716-446655440222",
  "tenant_id": "660e8400-e29b-41d4-a716-446655440111",
  "app_slug": "document-analyzer",
  "operation": "extract-entities",
  "input_tokens": 2500,
  "output_tokens": 1200,
  "cost_brl": 0.264,
  "cost_usd": 0.0518,
  "model_name": "claude-3-5-sonnet",
  "source_type": "api",
  "status": "completed",
  "prepaid_used": 0.264,
  "overage_used": 0.0,
  "balance_before": 150.50,
  "balance_after": 150.236,
  "created_at": "2026-02-28T14:22:15Z"
}
```

---

## 6. Edge Function: credit-manager/index.ts

### 6.1 Overview

The `credit-manager` Edge Function provides a unified API for credit operations. All tenant-facing credit interactions route through this function.

### 6.2 check_balance Endpoint

**Purpose:** Retrieve current wallet status without modifying state

**Request:**
```typescript
interface CheckBalanceRequest {
  tenant_id: string;
}
```

**Response:**
```typescript
interface CheckBalanceResponse {
  prepaid_credits: number;
  overage_amount: number;
  overage_limit: number;
  is_blocked: boolean;
  available_credits: number;
  wallet_status: 'green' | 'yellow' | 'orange' | 'red';
  plan_tier: string;
  last_payment_at: string | null;
}

// available_credits = prepaid_credits (overage doesn't count toward available)
// wallet_status computed from balances
```

**Implementation:**
```typescript
export async function checkBalance(
  supabase: SupabaseClient,
  tenantId: string
): Promise<CheckBalanceResponse> {
  const { data, error } = await supabase
    .from('credit_wallets')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw new Error(`Wallet not found: ${error.message}`);

  const wallet = data;
  const available = wallet.prepaid_credits;
  const overagePercent = wallet.overage_amount / wallet.overage_limit;

  let status: 'green' | 'yellow' | 'orange' | 'red';
  if (wallet.is_blocked) {
    status = 'red';
  } else if (overagePercent > 0.8) {
    status = 'orange';
  } else if (wallet.overage_amount > 0) {
    status = 'yellow';
  } else {
    status = 'green';
  }

  return {
    prepaid_credits: wallet.prepaid_credits,
    overage_amount: wallet.overage_amount,
    overage_limit: wallet.overage_limit,
    is_blocked: wallet.is_blocked,
    available_credits: available,
    wallet_status: status,
    plan_tier: wallet.plan_tier,
    last_payment_at: wallet.last_payment_at,
  };
}
```

### 6.3 debit_credits Endpoint

**Purpose:** Execute a credit debit transaction (Step 1-5 flow)

**Request:**
```typescript
interface DebitCreditsRequest {
  tenant_id: string;
  app_slug: string;
  operation: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  source_type: 'api' | 'web' | 'batch';
  metadata?: Record<string, unknown>;
}
```

**Response:**
```typescript
interface DebitCreditsResponse {
  success: boolean;
  cost_brl: number;
  cost_usd: number;
  prepaid_used: number;
  overage_used: number;
  new_balance: number;
  new_overage: number;
  is_blocked_after: boolean;
  log_id: string;
  error?: string;
}
```

**Implementation (Simplified):**
```typescript
export async function debitCredits(
  supabase: SupabaseClient,
  request: DebitCreditsRequest
): Promise<DebitCreditsResponse> {
  // Step 1: Calculate cost
  const costBrl = await calculateCost(
    supabase,
    request.tenant_id,
    request.model_name,
    request.input_tokens,
    request.output_tokens
  );

  // Fetch current wallet
  const { data: wallet } = await supabase
    .from('credit_wallets')
    .select('*')
    .eq('tenant_id', request.tenant_id)
    .single();

  // Step 4: Check if already blocked
  if (wallet.is_blocked) {
    return {
      success: false,
      cost_brl: costBrl,
      cost_usd: costBrl / wallet.pricing_config.usd_to_brl_rate,
      prepaid_used: 0,
      overage_used: 0,
      new_balance: wallet.prepaid_credits,
      new_overage: wallet.overage_amount,
      is_blocked_after: true,
      log_id: '',
      error: 'Account is blocked: overage limit exceeded',
    };
  }

  // Steps 2-3: Determine debit sources
  let prepaidUsed = 0;
  let overageUsed = 0;

  if (wallet.prepaid_credits >= costBrl) {
    // Step 2: Sufficient prepaid
    prepaidUsed = costBrl;
  } else {
    // Step 3: Prepaid insufficient
    prepaidUsed = wallet.prepaid_credits;
    overageUsed = costBrl - wallet.prepaid_credits;
  }

  const newPrepaid = wallet.prepaid_credits - prepaidUsed;
  const newOverage = wallet.overage_amount + overageUsed;

  // Step 4: Check overage limit
  if (newOverage > wallet.overage_limit) {
    return {
      success: false,
      cost_brl: costBrl,
      cost_usd: costBrl / wallet.pricing_config.usd_to_brl_rate,
      prepaid_used: 0,
      overage_used: 0,
      new_balance: wallet.prepaid_credits,
      new_overage: wallet.overage_amount,
      is_blocked_after: true,
      log_id: '',
      error: 'Overage limit would be exceeded',
    };
  }

  // Step 5: Commit transaction
  const { error: updateError } = await supabase
    .from('credit_wallets')
    .update({
      prepaid_credits: newPrepaid,
      overage_amount: newOverage,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', request.tenant_id);

  if (updateError) {
    throw new Error(`Failed to update wallet: ${updateError.message}`);
  }

  // Log the transaction
  const { data: logData } = await supabase
    .from('usage_logs')
    .insert([
      {
        tenant_id: request.tenant_id,
        wallet_id: wallet.id,
        app_slug: request.app_slug,
        operation: request.operation,
        input_tokens: request.input_tokens,
        output_tokens: request.output_tokens,
        cost_brl: costBrl,
        cost_usd: costBrl / wallet.pricing_config.usd_to_brl_rate,
        model_name: request.model_name,
        source_type: request.source_type,
        status: 'completed',
        prepaid_used: prepaidUsed,
        overage_used: overageUsed,
        balance_before: wallet.prepaid_credits,
        balance_after: newPrepaid,
        metadata: request.metadata || {},
      },
    ])
    .select('id')
    .single();

  return {
    success: true,
    cost_brl: costBrl,
    cost_usd: costBrl / wallet.pricing_config.usd_to_brl_rate,
    prepaid_used: prepaidUsed,
    overage_used: overageUsed,
    new_balance: newPrepaid,
    new_overage: newOverage,
    is_blocked_after: false,
    log_id: logData.id,
  };
}
```

### 6.4 topup_credits Endpoint

**Purpose:** Add prepaid credits after successful payment (zeros overage)

**Request:**
```typescript
interface TopupCreditsRequest {
  tenant_id: string;
  amount_brl: number;
  payment_id?: string;
  payment_method?: string;
}
```

**Response:**
```typescript
interface TopupCreditsResponse {
  success: boolean;
  new_prepaid_balance: number;
  overage_cleared: number;
  is_unblocked: boolean;
  transaction_id: string;
}
```

**Implementation:**
```typescript
export async function topupCredits(
  supabase: SupabaseClient,
  request: TopupCreditsRequest
): Promise<TopupCreditsResponse> {
  const { data: wallet } = await supabase
    .from('credit_wallets')
    .select('*')
    .eq('tenant_id', request.tenant_id)
    .single();

  const overageCleared = wallet.overage_amount;
  const newPrepaid = wallet.prepaid_credits + request.amount_brl;
  const wasBlocked = wallet.is_blocked;

  // Update wallet
  const { error } = await supabase
    .from('credit_wallets')
    .update({
      prepaid_credits: newPrepaid,
      overage_amount: 0,
      is_blocked: false,
      last_payment_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', request.tenant_id);

  if (error) throw new Error(`Topup failed: ${error.message}`);

  return {
    success: true,
    new_prepaid_balance: newPrepaid,
    overage_cleared: overageCleared,
    is_unblocked: wasBlocked,
    transaction_id: request.payment_id || generateTransactionId(),
  };
}
```

### 6.5 get_usage_summary Endpoint

**Purpose:** Retrieve aggregated usage metrics for a period

**Request:**
```typescript
interface GetUsageSummaryRequest {
  tenant_id: string;
  start_date: string; // ISO 8601
  end_date: string;   // ISO 8601
  group_by?: 'day' | 'model' | 'operation'; // default: 'day'
}
```

**Response:**
```typescript
interface UsageSummaryRow {
  period: string;
  total_cost_brl: number;
  total_cost_usd: number;
  total_tokens: number;
  operation_count: number;
  models_used: string[];
}

interface GetUsageSummaryResponse {
  tenant_id: string;
  start_date: string;
  end_date: string;
  summary: UsageSummaryRow[];
  grand_total_cost_brl: number;
  grand_total_cost_usd: number;
}
```

**Implementation (SQL Query):**
```sql
SELECT
  DATE(created_at)::TEXT AS period,
  SUM(cost_brl) AS total_cost_brl,
  SUM(cost_usd) AS total_cost_usd,
  SUM(total_tokens) AS total_tokens,
  COUNT(*) AS operation_count,
  ARRAY_AGG(DISTINCT model_name) AS models_used
FROM usage_logs
WHERE tenant_id = $1
  AND created_at >= $2::TIMESTAMP
  AND created_at < $3::TIMESTAMP
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;
```

---

## 7. Plans & Initial Credit Allocation

### 7.1 Default Plan Configuration

When a new tenant is created, the system automatically initializes a credit wallet based on the selected plan tier:

#### **Free Plan**
```json
{
  "plan_tier": "free",
  "prepaid_credits": 50.00,
  "overage_limit": 20.00,
  "overage_allowed": true,
  "markup_pct": 0,
  "features": [
    "5 free API calls/month",
    "Community support",
    "Basic usage dashboard"
  ]
}
```

**Use Case:** Evaluation, testing, light personal use

#### **Starter Plan**
```json
{
  "plan_tier": "starter",
  "prepaid_credits": 200.00,
  "overage_limit": 50.00,
  "overage_allowed": true,
  "markup_pct": 5,
  "features": [
    "50 API calls/month",
    "Email support",
    "Advanced dashboard",
    "Usage analytics"
  ]
}
```

**Use Case:** Small businesses, development environments

#### **Pro Plan**
```json
{
  "plan_tier": "pro",
  "prepaid_credits": 500.00,
  "overage_limit": 200.00,
  "overage_allowed": true,
  "markup_pct": 15,
  "features": [
    "500 API calls/month",
    "Priority support (24h)",
    "Custom integrations",
    "Advanced analytics",
    "Overage reporting"
  ]
}
```

**Use Case:** Medium businesses, production environments

#### **Enterprise Plan**
```json
{
  "plan_tier": "enterprise",
  "prepaid_credits": 2000.00,
  "overage_limit": 1000.00,
  "overage_allowed": true,
  "markup_pct": 25,
  "features": [
    "Unlimited API calls",
    "Dedicated support (1h SLA)",
    "Custom pricing",
    "SLA guarantee",
    "Advanced security",
    "Overage credits for overages"
  ]
}
```

**Use Case:** Large enterprises, high-volume operations

### 7.2 Plan Upgrade Flow

When a tenant upgrades their plan:

```sql
-- Preserve existing balance and add difference
UPDATE credit_wallets
SET
  prepaid_credits = prepaid_credits + (new_plan_credits - old_plan_credits),
  overage_limit = new_plan_limit,
  plan_tier = $1,
  updated_at = NOW()
WHERE tenant_id = $2;
```

**Example:** Upgrading from Starter (200 BRL) to Pro (500 BRL)
- Old balance: 100 BRL prepaid
- New balance: 100 + (500 - 200) = 400 BRL prepaid
- Overage limit: 50 BRL → 200 BRL

---

## 8. Billing Pipeline & Stripe Integration

### 8.1 Architecture Overview

The billing pipeline integrates with Stripe to:
1. Manage subscription billing
2. Process credit top-ups via payment methods
3. Generate monthly invoices
4. Track payment history

### 8.2 billing_accounts Table

```sql
CREATE TABLE billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_subscription_id VARCHAR(255),
  payment_method VARCHAR(50) NOT NULL, -- 'card', 'pix', 'wire_transfer'
  billing_email VARCHAR(255) NOT NULL,
  billing_address JSONB,
  company_name VARCHAR(255),
  tax_id VARCHAR(50),
  plan_tier VARCHAR(20) NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  next_billing_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (subscription_status IN (
    'active', 'past_due', 'canceled', 'incomplete'
  ))
);

CREATE INDEX idx_billing_accounts_tenant_id ON billing_accounts(tenant_id);
CREATE INDEX idx_billing_accounts_stripe_customer ON billing_accounts(stripe_customer_id);
```

**Current State:** 15 test billing accounts exist for testing payment flows.

### 8.3 Monthly Invoice Generation

#### **Scheduled Job (runs on 1st of each month at 00:00 UTC)**

```typescript
// Edge Function: generate-monthly-invoices/index.ts
export async function generateMonthlyInvoices(
  supabase: SupabaseClient
) {
  const previousMonth = getPreviousMonth();

  // Fetch all active billing accounts
  const { data: accounts } = await supabase
    .from('billing_accounts')
    .select('*')
    .eq('subscription_status', 'active');

  for (const account of accounts) {
    // Aggregate usage logs for the period
    const { data: usage } = await supabase
      .from('usage_logs')
      .select('cost_brl')
      .eq('tenant_id', account.tenant_id)
      .gte('created_at', `${previousMonth.start}T00:00:00Z`)
      .lt('created_at', `${previousMonth.end}T00:00:00Z`);

    const totalCost = usage.reduce((sum, log) => sum + log.cost_brl, 0);

    // Fetch wallet for overage settlement
    const { data: wallet } = await supabase
      .from('credit_wallets')
      .select('*')
      .eq('tenant_id', account.tenant_id)
      .single();

    // Create invoice in Stripe
    const invoice = await createStripeInvoice({
      customerId: account.stripe_customer_id,
      description: `Monthly AI Usage - ${previousMonth.month}`,
      line_items: [
        {
          description: 'Prepaid Credits (Plan)',
          amount: getPlanAmount(account.plan_tier),
          quantity: 1,
        },
        {
          description: 'Usage Overage',
          amount: Math.max(0, wallet.overage_amount),
          quantity: 1,
        },
      ],
    });

    // Store invoice reference
    await supabase
      .from('invoices')
      .insert([
        {
          tenant_id: account.tenant_id,
          billing_account_id: account.id,
          stripe_invoice_id: invoice.id,
          period_start: previousMonth.start,
          period_end: previousMonth.end,
          usage_cost_brl: totalCost,
          overage_cost_brl: wallet.overage_amount,
          plan_cost_brl: getPlanAmount(account.plan_tier),
          total_brl: totalCost + wallet.overage_amount + getPlanAmount(account.plan_tier),
          status: 'draft',
        },
      ]);
  }
}
```

### 8.4 Payment Processing Flow

```
[Payment Received from Stripe Webhook]
        ↓
[Verify Webhook Signature]
        ↓
[Identify Tenant]
        ↓
[Call topup_credits with amount]
        ↓
[Update billing_accounts.subscription_status]
        ↓
[Emit tenant.credits.topup event]
        ↓
[Mark invoice as paid]
```

#### **Webhook Handler (Stripe Event: charge.succeeded)**

```typescript
export async function handleChargeSucceeded(
  supabase: SupabaseClient,
  event: Stripe.Event
) {
  const charge = event.data.object as Stripe.Charge;
  const customerId = charge.customer as string;

  // Find billing account
  const { data: account } = await supabase
    .from('billing_accounts')
    .select('tenant_id')
    .eq('stripe_customer_id', customerId)
    .single();

  // Topup credits
  await debitCredits(supabase, {
    tenant_id: account.tenant_id,
    amount_brl: charge.amount / 100 * getUsdToBrlRate(),
    payment_id: charge.id,
    payment_method: 'stripe',
  });
}
```

### 8.5 Overage Settlement

Overage charges are settled at the end of each billing cycle. Tenants can:

1. **Pay Immediately**: Call `topup_credits` to clear overage
2. **Automatic Settlement**: Stripe invoice includes overage in next billing cycle
3. **Credit Rollover**: Enterprise tenants may receive monthly overage credits

---

## 9. Dashboard Widgets & Visualization

### 9.1 Credit Balance Widget

**Purpose:** Provide at-a-glance wallet status

**Display:**
```
┌─────────────────────────────────────┐
│  CREDIT BALANCE                     │
├─────────────────────────────────────┤
│  Prepaid:     BRL 250.00  [████░░] │
│  Overage:     BRL  45.75  [██░░░░] │
│  Available:   BRL 250.00            │
│  Status:      YELLOW (Monitor)      │
│  Limit:       BRL 200.00            │
└─────────────────────────────────────┘
```

**Data Source:**
```sql
SELECT
  prepaid_credits,
  overage_amount,
  overage_limit,
  is_blocked,
  plan_tier
FROM credit_wallets
WHERE tenant_id = $1;
```

**Color States:**
- 🟢 Green: prepaid > 0, no overage
- 🟡 Yellow: overage > 0 but < limit
- 🟠 Orange: overage > 80% of limit
- 🔴 Red: is_blocked = true

### 9.2 Usage Chart Widget

**Purpose:** Visualize spending patterns over time

**Chart Type:** Line + Bar combo
- X-axis: Date (daily aggregation)
- Y-axis (Left): Cost in BRL
- Y-axis (Right): Operation count
- Line: Daily cost trend (7-day MA)
- Bars: Daily operations

**SQL Query:**
```sql
SELECT
  DATE(created_at)::TEXT AS date,
  SUM(cost_brl)::DECIMAL(10,2) AS cost_brl,
  COUNT(*) AS operations,
  AVG(cost_brl) OVER (
    ORDER BY DATE(created_at)
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS moving_avg_7d
FROM usage_logs
WHERE tenant_id = $1
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;
```

### 9.3 Overage Warning Widget

**Purpose:** Alert tenant when approaching limit

**Threshold Logic:**
```
if is_blocked:
  severity = CRITICAL
  message = "Account blocked. Pay overage to restore service."
elif overage > (overage_limit * 0.8):
  severity = HIGH
  message = "Overage at 80% of limit. Consider topping up."
elif overage > (overage_limit * 0.5):
  severity = MEDIUM
  message = "Overage growing. Review usage patterns."
elif overage > 0:
  severity = LOW
  message = "Currently using overage. Prepaid balance depleted."
else:
  severity = NONE
  message = null
```

**Display (When severity >= MEDIUM):**
```
┌─────────────────────────────────────┐
│ ⚠️  OVERAGE WARNING                 │
├─────────────────────────────────────┤
│ Currently using overage budget      │
│ BRL 45.75 / BRL 200.00 (22.9%)      │
│ [██░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   │
│                                     │
│ Days until limit: 12 (estimated)    │
│ [Pay Now] [View Usage]              │
└─────────────────────────────────────┘
```

---

## 10. Notifications & Alerts

### 10.1 Notification Types

#### **Type 1: Low Balance Warning**

**Trigger:** prepaid_credits < (plan_initial_credits × 0.2)

**Message:**
```
Subject: Low prepaid balance — Action may be required

Your genOS account has less than 20% prepaid balance remaining.

Current balance: BRL 35.00
Recommended action: Top up credits to continue uninterrupted service.

[Top Up Now]
```

**Delivery:** Email (on check_balance if threshold met)

**Frequency:** Once per 24 hours

#### **Type 2: Overage Warning**

**Trigger:** overage_amount > 0

**Message:**
```
Subject: Overage charges now active on your account

Your prepaid balance has been exhausted. New charges are being added to your overage account.

Overage balance: BRL 12.50
Overage limit: BRL 200.00

Actions you can take:
1. Top up prepaid credits (recommended)
2. Review usage in the dashboard
3. Set up usage alerts

[Top Up Now] [View Dashboard]
```

**Delivery:** Email (on first occurrence, then daily if active)

**Frequency:** Daily digest while overage > 0

#### **Type 3: Blocked Notification**

**Trigger:** is_blocked = true

**Message:**
```
Subject: URGENT: Your account is blocked

Your overage charges have exceeded the maximum limit. AI operations have been halted.

Current situation:
- Overage balance: BRL 245.00
- Limit: BRL 200.00
- Blocked since: 2026-02-25

To restore service immediately:
1. Pay the full overage amount (BRL 245.00)
2. Service will resume within 5 minutes of payment

No operations can proceed until this is resolved.

[Pay Now] [Contact Support]
```

**Delivery:** Email + SMS (if phone configured) + Dashboard Alert

**Frequency:** Immediate + every 12 hours until resolved

#### **Type 4: Successful Payment Confirmation**

**Trigger:** Payment processed successfully

**Message:**
```
Subject: Payment received — Credits restored

Thank you! We've received your payment.

Payment details:
- Amount: BRL 300.00
- Date: 2026-02-28 14:22:15 UTC
- Transaction ID: stripe_ch_1234...

Your account status:
- New prepaid balance: BRL 450.25
- Overage cleared: Yes
- Status: ACTIVE

Operations can resume immediately.

[View Dashboard]
```

**Delivery:** Email + In-app notification

**Frequency:** Once per payment

### 10.2 Email Template Structure

All notifications use HTML template with:
- genOS branding header
- Action buttons (CTA links)
- Account summary section
- Footer with support contact

**Template Variables:**
```
{tenant_name}
{notification_type}
{current_balance}
{recommended_action}
{support_url}
{dashboard_url}
{account_status_summary}
```

### 10.3 In-App Notification Dashboard

**Location:** Account settings → Notifications → Credit alerts

**Configuration Options:**
```
□ Email notifications (enabled by default)
  - Low balance warning threshold: [20 ▼] %
  - Send daily digest: [Yes ▼]

□ SMS alerts (optional, requires phone)
  - Blocked notification only: [Yes ▼]

□ Webhook notifications (for integrations)
  - Endpoint: [________________]
  - Events: [Block ✓] [Payment ✓] [Overage ✓]
  - Retry policy: Exponential backoff
```

---

## 11. Security & Compliance

### 11.1 Data Protection

- **PII Masking**: Stripe customer IDs not exposed in logs
- **Audit Trail**: All credit operations logged with source and timestamp
- **Transaction Atomicity**: Credit updates use database transactions
- **Rate Limiting**: 100 credit check requests per minute per tenant

### 11.2 Fraud Prevention

- **Webhook Signature Verification**: All Stripe webhooks cryptographically verified
- **Idempotency Keys**: Payment processing uses idempotency to prevent duplicates
- **Velocity Checks**: Detect unusual spending patterns

### 11.3 Compliance

- **PCI-DSS**: No credit card data stored (Stripe handles)
- **GDPR**: Tenant data can be exported or deleted
- **Brazilian Regulations**: Compliance with LGPD for Brazilian tenants
- **Tax Documentation**: Invoices include appropriate tax fields

---

## 12. Troubleshooting Guide

### 12.1 Common Issues

| Issue | Cause | Resolution |
|-------|-------|-----------|
| "Account blocked" | overage_amount >= overage_limit | Call topup_credits to settle overage |
| Operation rejected | is_blocked = true | Pay overage immediately |
| Wrong cost calculated | Exchange rate stale | Edge Function will update on next run |
| Missing usage log | Concurrent write conflict | Log will appear on retry |
| Prepaid stuck at 0 | Balance already depleted | Check usage_logs for recent transactions |

### 12.2 Debugging Endpoints

```bash
# Check wallet state
curl -X POST https://api.genOS.app/credit-manager \
  -H "Content-Type: application/json" \
  -d '{
    "action": "check_balance",
    "tenant_id": "660e8400-..."
  }'

# View recent usage
curl -X POST https://api.genOS.app/credit-manager \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_usage_summary",
    "tenant_id": "660e8400-...",
    "start_date": "2026-02-01",
    "end_date": "2026-02-28"
  }'
```

### 12.3 Admin Override Commands

**Reset wallet (admin only):**
```sql
UPDATE credit_wallets
SET
  prepaid_credits = 500.00,
  overage_amount = 0.00,
  is_blocked = false,
  updated_at = NOW()
WHERE tenant_id = $1;
```

**Clear overage without payment (admin only):**
```sql
UPDATE credit_wallets
SET
  overage_amount = 0.00,
  is_blocked = false,
  updated_at = NOW()
WHERE tenant_id = $1;
```

---

## 13. Future Roadmap

### 13.1 Planned Enhancements

- **Usage-Based Pricing**: Per-minute/hour billing for long-running operations
- **Volume Discounts**: Automatic rate reductions for high-volume tenants
- **Commitment Discounts**: Pre-purchase annual plans at discounted rates
- **Multi-Currency Support**: Direct billing in EUR, GBP, AUD
- **Cost Allocation**: Department/project-level credit tracking
- **Predictive Alerts**: ML-based spending forecasts
- **Budget Caps**: Tenant-defined hard spending limits
- **Cost Optimization Reports**: Recommendations to reduce spending

### 13.2 Integration Roadmap

- **POS Systems**: Direct wallet integration for retail
- **ERP Systems**: SAP, Oracle billing synchronization
- **Accounting Software**: QuickBooks, Xero exports
- **Analytics**: Datadog, Splunk metrics export

---

## 14. Examples & Walkthroughs

### 14.1 Scenario: Tenant Exhausts Prepaid & Enters Overage

**Initial State:**
```
prepaid_credits: 10.00 BRL
overage_amount: 0.00 BRL
overage_limit: 50.00 BRL
is_blocked: false
```

**Operation:** Claude 3.5 Sonnet, 3,000 input + 1,000 output tokens

**Cost Calculation:**
```
Input: 3 × $0.003 = $0.009
Output: 1 × $0.015 = $0.015
Base: $0.024
Markup (pro tier, 15%): × 1.15 = $0.0276
Exchange (5.10): × 5.10 = BRL 0.1408 ≈ BRL 0.14
```

**Debit Logic:**
```
Step 2: prepaid_credits (10.00) >= cost (0.14)? NO
Step 3: prepaid_used = 10.00, overage = 0.14 - 10.00 = -9.86...
        Wait, this is wrong. Let me recalculate.

Actually:
prepaid_used = 10.00
overage_used = 0.14 - 10.00 = ???
This doesn't make sense because cost is less than prepaid.

Let me restart with realistic numbers.

Operation: Claude 3.5 Sonnet, 100,000 input + 50,000 output tokens
Input: 100 × $0.003 = $0.30
Output: 50 × $0.015 = $0.75
Base: $1.05
Markup (15%): × 1.15 = $1.2075
Exchange: × 5.10 = BRL 6.16

Step 2: prepaid (10.00) >= cost (6.16)? YES → prepaid_used = 6.16

New state:
prepaid_credits: 3.84 BRL
overage_amount: 0.00 BRL
status: green
```

**Continued Operations** (several more calls deplete prepaid):

```
After 5 more operations, prepaid drops to 0.50 BRL
Next operation costs 1.20 BRL

Step 2: prepaid (0.50) >= cost (1.20)? NO
Step 3: prepaid_used = 0.50
        overage_used = 1.20 - 0.50 = 0.70

New state:
prepaid_credits: 0.00 BRL
overage_amount: 0.70 BRL
status: yellow (overage detected)
notification sent: "Overage warning"
```

**Further Operations** (overage accumulates):

```
Next 50 operations, each 0.50 BRL
Total overage after 50 ops: 0.70 + (50 × 0.50) = 25.70 BRL

Status: orange (approaching 50.00 limit)
notification sent: "High overage warning"
```

**Eventually** (overage limit reached):

```
Operation 67 would add 0.50, bringing overage to 26.20
prepaid_credits: 0.00 BRL
overage_amount: 26.20 BRL
overage_limit: 50.00 BRL
status: orange (52% of limit)

Continue operations...

Operation 85 would add 0.50, bringing overage to 42.70 BRL
Status: orange (85% of limit)

Operation 86 would add 0.50, bringing overage to 43.20 BRL
Step 4: is_blocked? NO
        Check: 43.20 > 50.00? NO → proceed

Operation 100 would add 0.50, bringing overage to 50.20 BRL
Step 4: is_blocked? NO
        Check: 50.20 > 50.00? YES → REJECT
        SET is_blocked = true
        Return error: "Overage limit would be exceeded"

New state:
prepaid_credits: 0.00 BRL
overage_amount: 50.00 BRL
is_blocked: true
status: red
notification sent: "CRITICAL - Account blocked"
```

**Payment Recovery:**

```
Tenant pays BRL 60.00 via Stripe
topup_credits(tenant_id, amount_brl=60.00)

New state:
prepaid_credits: 60.00 BRL (60.00 added + 0.00 prepaid before)
overage_amount: 0.00 BRL (cleared)
is_blocked: false
status: green
notification sent: "Payment received - service restored"
```

### 14.2 Scenario: Monitoring Enterprise Account

**Initial State (Enterprise Plan):**
```
prepaid_credits: 2000.00 BRL
overage_amount: 0.00 BRL
overage_limit: 1000.00 BRL
is_blocked: false
plan_tier: enterprise
```

**Dashboard Summary (Last 30 days):**
```
Total Usage Cost: BRL 1,850.25
- Operations: 12,500
- Models: Claude (8,000 ops), Gemini (4,500 ops)
- Daily average: BRL 61.68

Breakdown by operation:
- document-analyzer: BRL 950.12 (51%)
- text-generator: BRL 650.08 (35%)
- code-assistant: BRL 250.05 (14%)

Prepaid burn rate:
- Current: BRL 1,850.25 consumed in 30 days
- Projected monthly run rate: BRL 1,850.25 (stable)
- Prepaid runway: 30.6 months
```

**Cost Optimization Recommendations:**
```
1. Shift 30% of queries to Gemini 2.0 Flash
   Potential savings: ~BRL 200/month

2. Implement response caching
   Estimated reduction: ~15% of token usage
   Potential savings: ~BRL 277/month

3. Batch processing for non-urgent operations
   Estimated reduction: ~5% of token usage
   Potential savings: ~BRL 93/month
```

---

## 15. Appendix: API Reference

### 15.1 Complete Method Signatures

**All methods are accessed via Edge Function `credit-manager`**

```typescript
// Namespace: genOS.credits

interface CreditManager {
  // Check current wallet state
  checkBalance(request: CheckBalanceRequest): Promise<CheckBalanceResponse>;

  // Debit credits for an operation
  debitCredits(request: DebitCreditsRequest): Promise<DebitCreditsResponse>;

  // Add prepaid credits (after payment)
  topupCredits(request: TopupCreditsRequest): Promise<TopupCreditsResponse>;

  // Get usage metrics for a date range
  getUsageSummary(request: GetUsageSummaryRequest): Promise<GetUsageSummaryResponse>;

  // (Future) Get billing forecast
  getForecast(request: GetForecastRequest): Promise<GetForecastResponse>;
}
```

### 15.2 HTTP Endpoints

```
POST /functions/v1/credit-manager
Content-Type: application/json
Authorization: Bearer <user_jwt_token>

Request body determines action:
{
  "action": "check_balance" | "debit_credits" | "topup_credits" | "get_usage_summary",
  // ... action-specific fields
}
```

### 15.3 Error Codes

| Code | Message | Resolution |
|------|---------|-----------|
| `INSUFFICIENT_PREPAID` | Operation would exceed overage limit | topup_credits or reduce usage |
| `ACCOUNT_BLOCKED` | Account blocked due to overage | topup_credits to clear overage |
| `WALLET_NOT_FOUND` | Tenant has no credit wallet | Create wallet (should be automatic) |
| `INVALID_TENANT` | Tenant ID not found | Verify tenant_id |
| `RATE_LIMITED` | Too many requests | Retry after 60 seconds |
| `PAYMENT_FAILED` | Stripe transaction failed | Retry or contact support |

---

*Documento #8 de 10*
