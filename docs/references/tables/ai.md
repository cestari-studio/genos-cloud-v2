# AI & Compliance Domain Tables

## ai_sessions

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.ai_sessions` |
| **Description** | Record of every AI conversation/generation session. Tracks model, messages, tokens, cost, and result status. Each session represents a full interaction context. |
| **Primary Key** | `id` (uuid) |
| **Update Frequency** | On AI call completion |
| **RLS** | Enabled — tenant isolation via `tenant_members` |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | — | FK → tenants(id). **REGRA ZERO** |
| `user_id` | uuid | NO | — | FK → auth.users(id). Who initiated |
| `session_type` | text | NO | `'content_generation'` | Task type: `content_generation`, `revision`, `analysis`, `compliance_check` |
| `model_used` | text | NO | `'claude-sonnet-4-5-20250929'` | Specific model string used |
| `system_prompt_id` | uuid | YES | — | FK → system_prompts(id). Which prompt template was used |
| `messages` | jsonb | NO | `'[]'` | Full conversation messages array `[{role, content}]` |
| `context` | jsonb | NO | `'{}'` | Agent Envelope context: brand_dna, compliance_rules, etc. |
| `tools_available` | text[] | NO | `'{}'` | MCP tools available to the agent during this session |
| `tokens_used` | integer | NO | `0` | Total tokens consumed (input + output) |
| `cost_usd` | numeric | NO | `0` | Estimated cost in USD |
| `status` | text | NO | `'active'` | Session status: `active`, `completed`, `error`, `timeout` |
| `created_at` | timestamptz | NO | `now()` | When the session started |
| `updated_at` | timestamptz | NO | `now()` | Last activity timestamp |

### Key Differences from Specs
- **`model_used`** (not `provider` + `model`): Single field for the full model string
- **`tokens_used`** (not `input_tokens` + `output_tokens` + `total_tokens`): Single aggregate field
- **`cost_usd`** (not calculated): Pre-calculated cost field
- **`messages`** jsonb: Full conversation history stored (not just prompt/response)
- **`context`** jsonb: Agent Envelope data stored as context
- **`tools_available`**: Tracks which MCP tools were available
- No `duration_ms` or `error_message` columns — errors stored in `status` and `messages`

### AI Routing Rules

| Task Type | Primary Model | Fallback | Reason |
|-----------|--------------|----------|--------|
| Bulk generation (new content) | Gemini 2.0 Flash | Claude | High throughput, low cost |
| Strategic content (complex) | Claude Agent SDK V2 | Gemini | Better reasoning, brand alignment |
| Content revision (from feedback) | Claude (urgent) / Gemini (normal) | — | Precision for revisions |
| Compliance validation | Claude | Gemini | Rules-based reasoning |
| Local lightweight tasks | Apple Intelligence (future) | Gemini | Zero-cost, low-latency |

### Cost Reference

| Model | Approx. Cost (input) | Approx. Cost (output) |
|-------|---------------------|----------------------|
| Gemini 2.0 Flash | ~$0.10 / 1M tokens | ~$0.30 / 1M tokens |
| Claude Sonnet | ~$3.00 / 1M tokens | ~$15.00 / 1M tokens |
| Apple Intelligence | $0 (local) | $0 (local) |

### Sample Queries

```sql
-- Model usage distribution (last 30 days)
SELECT
    model_used,
    session_type,
    COUNT(*) AS sessions,
    SUM(tokens_used) AS total_tokens,
    SUM(cost_usd) AS total_cost,
    COUNT(CASE WHEN status = 'error' THEN 1 END) AS errors
FROM ai_sessions
WHERE tenant_id = :tenant_id
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY model_used, session_type;

-- AI cost report (last 30 days)
SELECT
    DATE_TRUNC('week', created_at) AS week,
    model_used,
    SUM(cost_usd) AS weekly_cost,
    SUM(tokens_used) AS weekly_tokens,
    COUNT(*) AS session_count
FROM ai_sessions
WHERE tenant_id = :tenant_id
  AND status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY week, model_used
ORDER BY week DESC;
```

### Gotchas
- `model_used` stores the full model string (e.g., `claude-sonnet-4-5-20250929`, `gemini-2.0-flash`) — not split into provider/model
- `tokens_used` is a single aggregate — no input/output breakdown
- `cost_usd` is pre-calculated at write time — don't recalculate from tokens
- `messages` stores the full conversation as jsonb array — can be large
- NULL `system_prompt_id` means an ad-hoc prompt was used (not a stored template)

---

## compliance_rules

### Overview
| Property | Value |
|----------|-------|
| **Location** | `public.compliance_rules` |
| **Description** | MasterCompliance rules per tenant. Four validation layers each weighted 25%. |
| **Primary Key** | `id` (uuid) |
| **Update Frequency** | Manual (when rules are edited) |

### Key Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `tenant_id` | uuid | NO | — | FK → tenants(id) |
| `rule_type` | text | NO | — | Compliance layer: `vocabulary`, `tone`, `structure`, `brand` |
| `rule_config` | jsonb | NO | — | Rule logic and parameters (varies by type) |
| `severity` | text | NO | `'warning'` | How violations are treated: `error`, `warning`, `info` |
| `is_active` | boolean | NO | `true` | Whether rule is currently enforced |
| `description` | text | YES | — | Human-readable rule description |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

### Key Differences from Specs
- **`rule_config`** (not `rule_definition`): Column name is `rule_config`
- **`severity`** (not `weight`): Instead of numeric weights, uses severity levels
- **`description`** (not `rule_name`): Human-readable text is in `description`, no `rule_name` column
- No `weight` column — MasterCompliance scoring uses equal 25% weights per layer by default

### MasterCompliance Scoring

```
Final Score = (vocabulary_score × 0.25)
            + (tone_score × 0.25)
            + (structure_score × 0.25)
            + (brand_score × 0.25)

Range: 0–100
```

| Score Range | Result | Action |
|-------------|--------|--------|
| ≥ 70 | Approved | Content passes validation |
| 40–69 | Pending Review | Flagged for human review |
| < 40 | Rejected | AI must regenerate |

### Four Layers

| Layer | What It Checks | Example Rules |
|-------|---------------|---------------|
| **Vocabulary** (25%) | Forbidden words, required terminology, reading level | No slang, must include destination name |
| **Tone** (25%) | Voice alignment, formality, emotion | "friendly and adventurous", not "corporate" |
| **Structure** (25%) | Format, length, sections, headings | Blog must have intro + 3 sections + CTA |
| **Brand** (25%) | Brand DNA compliance, persona consistency | Matches voice_tone, respects forbidden_words |

### Sample Queries

```sql
-- All active rules for a tenant
SELECT rule_type, description, severity, rule_config
FROM compliance_rules
WHERE tenant_id = :tenant_id
  AND is_active = true
ORDER BY rule_type;

-- Rule count by type and severity
SELECT
    rule_type,
    severity,
    COUNT(*) AS rule_count
FROM compliance_rules
WHERE tenant_id = :tenant_id
  AND is_active = true
GROUP BY rule_type, severity;
```

---

## Agent Envelope (Required for Every AI Call)

Not a table but a required JSON payload structure:

```typescript
interface AgentEnvelope {
  user_id: string;         // Who is making the request
  tenant_id: string;       // Which workspace
  role: string;            // User's role in this tenant
  brand_dna: BrandDNA;     // From brand_dna table
  system_prompt: string;   // From system_prompts table
  compliance_rules: Rule[];// From compliance_rules table
  permissions: string[];   // Derived from role
  plan_limits: PlanLimits; // Token/generation limits
}
```

Every AI call MUST include this envelope. Never call an AI model without it.
