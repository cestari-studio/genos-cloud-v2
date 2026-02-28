# genOS™ Cloud Platform — Super Prompt #6: AI Router & Orchestração Agêntica

**Version:** 2.0.0  
**Date:** 2026-02-28  
**Document:** Intelligent Content Generation Routing & Agentic Orchestration  

---

## Table of Contents

1. [AI Router Overview](#ai-router-overview)
2. [Routing Strategy](#routing-strategy)
3. [Agent Envelope Architecture](#agent-envelope-architecture)
4. [Edge Function Implementation](#edge-function-implementation)
5. [Prompt Engineering](#prompt-engineering)
6. [Structured Output Format](#structured-output-format)
7. [Batch Generation](#batch-generation)
8. [Token Tracking & Accounting](#token-tracking--accounting)
9. [Cost Calculation](#cost-calculation)
10. [Error Handling & Fallback Chain](#error-handling--fallback-chain)
11. [Local Mock Generator](#local-mock-generator)
12. [Compliance Integration](#compliance-integration)
13. [Performance Optimization](#performance-optimization)
14. [Monitoring & Observability](#monitoring--observability)

---

## AI Router Overview

The **AI Router** is the intelligent orchestration layer of the genOS™ Cloud Platform that handles all content generation requests. It intelligently distributes requests to specialized language models based on content characteristics, ensuring optimal balance between speed, quality, cost, and compliance.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│           genOS™ Content Generation Request              │
│         (Supabase RPC / REST API / Webhook)             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │   AI Router Edge Function  │
        │   (Deno Runtime)           │
        │   Supabase Edge Functions  │
        └────────┬───────────────────┘
                 │
        ┌────────┴──────────┬──────────────────┐
        │                   │                  │
        ▼                   ▼                  ▼
    ┌────────────┐  ┌────────────────┐  ┌─────────────┐
    │  Gemini    │  │  Claude 3.5    │  │ Local Mock  │
    │ 2.0 Flash  │  │    Sonnet      │  │  Generator  │
    │ (Bulk)     │  │ (Strategic)    │  │ (Fallback)  │
    └────┬───────┘  └────────┬───────┘  └────┬────────┘
         │                   │               │
         └───────────────────┴───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ Compliance Validation      │
        │ (MasterCompliance Rules)   │
        └────────┬───────────────────┘
                 │
                 ▼
        ┌────────────────────────────┐
        │ Save to content_items      │
        │ Debit Credits              │
        │ Log Token Usage            │
        └────────┬───────────────────┘
                 │
                 ▼
        ┌────────────────────────────┐
        │  Return Structured Result  │
        │  to Client/Caller          │
        └────────────────────────────┘
```

### Key Characteristics

- **Intelligent Routing**: Decision logic based on content type, tenant plan, and real-time capacity
- **Multi-Model Support**: Handles multiple LLM providers seamlessly
- **Stateless Design**: Runs as Supabase Edge Functions (autoscaling, no state management)
- **Built-in Resilience**: Automatic fallback chain (primary → secondary → local)
- **Compliance-First**: Every response validated against MasterCompliance rules before saving
- **Cost Optimization**: Routes to most cost-effective model for each content type
- **Token Tracking**: Complete accounting of input/output tokens per request

---

## Routing Strategy

### Routing Decision Matrix

| Content Type | Platform | Routing Decision | Rationale |
|---|---|---|---|
| Reels | Instagram, TikTok | **Gemini 2.0 Flash** | High volume, structured format, speed critical |
| Stories | Instagram, Snapchat | **Gemini 2.0 Flash** | Ephemeral content, simple structure, fast turnaround |
| Carousels | Instagram, LinkedIn | **Gemini 2.0 Flash** | Multi-slide, repetitive structure, bulk generation |
| Static Posts | Instagram, Facebook, X | **Gemini 2.0 Flash** | High volume daily, less strategic depth needed |
| Blog Posts | Website | **Claude 3.5 Sonnet** | Long-form, SEO-critical, narrative depth essential |
| Email Campaigns | Email Marketing | **Claude 3.5 Sonnet** | Strategic messaging, A/B testing variants required |
| Brand Manifestos | Website, Pitch | **Claude 3.5 Sonnet** | One-time, high-stakes, requires sophisticated voice |
| Product Descriptions | E-commerce | **Gemini 2.0 Flash** OR **Claude** | Depends: volume→Gemini, premium→Claude |
| Thought Leadership | LinkedIn Articles | **Claude 3.5 Sonnet** | Authority positioning, depth, original insights |
| Social Quick Posts | X, LinkedIn | **Gemini 2.0 Flash** | Time-sensitive, high volume, conversation starters |
| Video Scripts | YouTube | **Claude 3.5 Sonnet** | Long narrative, pacing, emotional arc required |
| Landing Pages | Website | **Claude 3.5 Sonnet** | High conversion impact, persuasive depth needed |


### Routing Logic Implementation

```typescript
function determineRouter(request: ContentGenerationRequest): 'gemini' | 'claude' | 'mock' {
  const contentType = request.content_type.toLowerCase();
  const plan = request.tenant_plan; // 'free', 'starter', 'pro', 'enterprise'
  
  // Plan-based access control
  if (plan === 'free') {
    return 'mock'; // Free tier gets local generator only
  }
  
  // Strategic content always goes to Claude
  const strategicTypes = ['blog_post', 'email_campaign', 'brand_manifesto', 'thought_leadership', 'video_script', 'landing_page'];
  if (strategicTypes.includes(contentType)) {
    return 'claude';
  }
  
  // Bulk content to Gemini
  const bulkTypes = ['reel', 'story', 'carousel', 'static_post', 'product_description', 'social_quick_post'];
  if (bulkTypes.includes(contentType)) {
    return 'gemini';
  }
  
  // Default fallback
  return 'gemini';
}
```

### Fallback Chain

The router implements a three-tier fallback system:

1. **Primary Router**: Based on content type analysis
   - Gemini 2.0 Flash for bulk content
   - Claude 3.5 Sonnet for strategic content

2. **Secondary Router**: If primary fails
   - Try opposite model (if Gemini failed, try Claude; if Claude failed, try Gemini)
   - Reduced quality expectations
   - May modify prompt for alternative model

3. **Tertiary Fallback**: Local Mock Generator
   - Template-based generation
   - No API calls required
   - Limited but functional output
   - Always succeeds (unless system error)

```typescript
async function routeWithFallback(envelope: AgentEnvelope): Promise<ContentResult> {
  let lastError: Error | null = null;
  
  // Attempt 1: Primary router
  try {
    const primaryRouter = determineRouter(envelope.post_context);
    const result = await callLLM(primaryRouter, envelope);
    if (result.success) return result;
    lastError = result.error;
  } catch (e) {
    lastError = e;
  }
  
  // Attempt 2: Secondary router
  const secondaryRouter = envelope.post_context.router === 'gemini' ? 'claude' : 'gemini';
  try {
    const result = await callLLM(secondaryRouter, envelope);
    if (result.success) {
      // Log fallback usage
      logFallback('secondary', secondaryRouter, lastError);
      return result;
    }
    lastError = result.error;
  } catch (e) {
    lastError = e;
  }
  
  // Attempt 3: Local mock generator
  try {
    const result = await generateFromTemplate(envelope);
    logFallback('tertiary', 'local_mock', lastError);
    return result;
  } catch (e) {
    logFallback('all_failed', 'none', e);
    throw new Error(`All routing attempts failed: ${e.message}`);
  }
}
```

---

## Agent Envelope Architecture

The **Agent Envelope** is the complete context package compiled before every AI call. It contains all information the LLM needs to generate compliant, on-brand content.

### Agent Envelope Structure

```typescript
interface AgentEnvelope {
  // Request Metadata
  request_id: string;                    // UUID for tracking
  timestamp: ISO8601;                    // When request created
  
  // Tenant Context
  tenant_id: string;                     // Customer account ID
  tenant_name: string;                   // Human-readable tenant name
  tenant_plan: 'free' | 'starter' | 'pro' | 'enterprise';
  tenant_language: 'pt-BR' | 'en-US' | 'es-ES' | ... ;
  tenant_timezone: string;               // For scheduling context
  
  // Brand DNA (Complete Brand Configuration)
  brand_dna: {
    brand_name: string;
    brand_description: string;
    target_audience: string;             // Demographic/psychographic profile
    
    // Voice & Tone
    voice_tone: {
      primary: string;                   // e.g., "professional", "playful", "authoritative"
      secondary: string[];               // Additional tone modifiers
      prohibited_tones: string[];        // Never use these
      example_voice: string;             // Sample text showing brand voice
    };
    
    // Content Restrictions
    forbidden_words: string[];           // Absolute no-use words
    forbidden_topics: string[];          // Content categories to avoid
    forbidden_hashtags: string[];        // Banned hashtags
    
    // Content Strategy
    hashtag_strategy: {
      primary_hashtags: string[];        // Always include
      campaign_hashtags: string[];       // For current campaigns
      max_hashtags_per_post: number;
      hashtag_prefix: string;            // Custom prefix like #YourBrand
    };
    
    // Editorial Pillars
    editorial_pillars: {
      pillar_id: string;
      pillar_name: string;               // e.g., "Thought Leadership"
      pillar_description: string;
      percent_of_content: number;        // e.g., 30% should be this pillar
      keywords: string[];                // Associated keywords
      content_examples: string[];        // Sample posts from this pillar
    }[];
    
    // Character Limits
    char_limits: {
      platform: string;                  // 'instagram', 'x', 'linkedin', etc.
      max_title: number;
      max_body: number;
      max_hashtags: number;
      optimal_length: number;            // "sweet spot" for engagement
    }[];
    
    // Visual Direction
    visual_direction: {
      color_palette: string[];           // Hex codes: ['#FF5733', '#33C3FF']
      style_description: string;         // e.g., "minimalist", "bold", "elegant"
      imagery_guidelines: string;        // What types of images to suggest
      typography_notes: string;          // Font/styling preferences
      visual_examples: string[];         // URLs to reference images
    };
    
    // Tone Examples
    tone_examples: {
      bad_example: string;               // What NOT to sound like
      good_example: string;              // What TO sound like
    }[];
  };
  
  // Compliance Rules (from MasterCompliance)
  master_compliance: {
    rules: {
      rule_id: string;
      rule_name: string;
      rule_description: string;
      rule_type: 'must_include' | 'must_exclude' | 'format' | 'legal' | 'brand';
      keywords: string[];                // Required or forbidden keywords
      active: boolean;
      priority: 'critical' | 'high' | 'medium' | 'low';
      enforcement_level: 'strict' | 'warning' | 'info';
    }[];
    legal_disclaimers: string[];         // FTC, GDPR, industry-specific
    brand_compliance_rules: string[];    // Brand-specific legal requirements
  };
  
  // Post Context (What content to generate)
  post_context: {
    content_type: string;                // 'blog_post', 'reel', 'email_campaign', etc.
    platform: string;                   // 'instagram', 'x', 'linkedin', 'website', 'email'
    content_pillar: string;              // Which editorial pillar this belongs to
    scheduled_date: ISO8601;             // When this should be published
    batch_context: {                     // If this is part of batch
      batch_id: string;
      batch_size: number;
      content_index: number;             // Which piece in the batch (0-indexed)
    } | null;
    content_theme: string;               // Optional: "Black Friday", "Product Launch", etc.
    primary_keyword: string;             // SEO keyword or topic focus
    cta: string;                         // Call-to-action if applicable
    reference_content: string;           // Optional: previous content to maintain consistency
  };
  
  // Credit & Usage Limits
  credit_restrictions: {
    remaining_credits: number;           // How many credits left
    credit_cost_this_request: number;    // How many this request will cost
    is_over_limit: boolean;              // Already exceeded quota
    usage_this_month: number;            // Posts created this month
    usage_limit_monthly: number;         // Plan limit
    overage_status: 'ok' | 'warning' | 'exceeded';
  };
  
  // Real-Time Context (Optional)
  conhecimentos_atualidade: {
    current_events: {
      title: string;
      summary: string;
      relevance_score: 0..1;            // How relevant to this brand
      suggested_angle: string;
    }[];
    trending_topics: string[];
    competitor_activity: string;        // Summary of what competitors are doing
    industry_news: string[];            // Relevant to this industry
    source_urls: string[];              // Where this info came from
    freshness_timestamp: ISO8601;
  } | null;
  
  // Execution Context
  execution: {
    router: 'gemini' | 'claude' | 'mock';
    attempt_number: number;             // Which attempt is this (1 for first)
    timeout_seconds: number;            // How long to wait for response
    temperature: number;                // 0.0-1.0 LLM temperature
    max_tokens: number;                 // Output token limit
    retry_count: number;                // How many retries if it fails
  };
}
```


### Building the Agent Envelope (Step by Step)

```typescript
async function buildAgentEnvelope(
  requestId: string,
  tenantId: string,
  contentRequest: ContentGenerationRequest,
  conhecimentosAtualidade?: CurrentEventsContext
): Promise<AgentEnvelope> {
  
  // 1. Fetch Tenant Configuration
  const tenant = await fetchTenantConfig(tenantId);
  
  // 2. Fetch Brand DNA (cached, TTL 5 minutes)
  const brandDna = await fetchBrandDNA(tenantId);
  
  // 3. Fetch Active Compliance Rules
  const complianceRules = await fetchMasterComplianceRules(tenantId, {
    active_only: true,
    include_legal: true,
    include_brand: true
  });
  
  // 4. Check Credits
  const credits = await creditManager.getAvailableCredits(tenantId);
  const costEstimate = estimateTokenCost(contentRequest.content_type, tenant.plan);
  
  // 5. Determine Router
  const router = determineRouter(contentRequest);
  
  // 6. Assemble Envelope
  const envelope: AgentEnvelope = {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    
    tenant_id: tenantId,
    tenant_name: tenant.name,
    tenant_plan: tenant.plan,
    tenant_language: tenant.language,
    tenant_timezone: tenant.timezone,
    
    brand_dna: brandDna,
    master_compliance: complianceRules,
    
    post_context: {
      content_type: contentRequest.content_type,
      platform: contentRequest.platform,
      content_pillar: contentRequest.pillar || 'general',
      scheduled_date: contentRequest.scheduled_date || new Date().toISOString(),
      batch_context: contentRequest.batch_id ? {
        batch_id: contentRequest.batch_id,
        batch_size: contentRequest.batch_size || 1,
        content_index: contentRequest.batch_index || 0
      } : null,
      content_theme: contentRequest.theme || null,
      primary_keyword: contentRequest.keyword || null,
      cta: contentRequest.cta || null,
      reference_content: contentRequest.reference_content || null
    },
    
    credit_restrictions: {
      remaining_credits: credits.remaining,
      credit_cost_this_request: costEstimate,
      is_over_limit: credits.remaining < costEstimate,
      usage_this_month: credits.usage_this_month,
      usage_limit_monthly: tenant.plan_limits.monthly_posts,
      overage_status: credits.remaining < costEstimate ? 'exceeded' : 'ok'
    },
    
    conhecimentos_atualidade: conhecimentosAtualidade || null,
    
    execution: {
      router,
      attempt_number: 1,
      timeout_seconds: 30,
      temperature: router === 'gemini' ? 0.7 : 0.8,
      max_tokens: router === 'gemini' ? 1500 : 2000,
      retry_count: 2
    }
  };
  
  return envelope;
}
```

---

## Edge Function Implementation

### File: `supabase/functions/ai-router/index.ts`

The Edge Function is the heart of the routing system. It handles:
1. JWT validation and tenant identification
2. Credit checking and cost estimation
3. Brand DNA and compliance rule loading
4. Agent Envelope compilation
5. LLM API calls with fallback chain
6. Compliance validation
7. Content persistence
8. Token tracking and credit debit

The complete 500+ line implementation includes:

- **Request validation**: JWT verification, input validation
- **Pre-generation checks**: Credit verification, Brand DNA presence
- **Envelope compilation**: All context loaded and assembled
- **Routing logic**: Intelligent model selection based on content type and plan
- **Fallback implementation**: Three-tier fallback with automatic retry
- **API integration**: Gemini 2.0 Flash and Claude 3.5 Sonnet calls
- **Response parsing**: JSON extraction and validation
- **Compliance checking**: Against MasterCompliance rules
- **Data persistence**: Saves to content_items table
- **Token accounting**: Logs all token usage for billing
- **Error handling**: Detailed error codes and recovery strategies

Key endpoints called:
- `POST /functions/v1/ai-router` - Main content generation
- Uses internal Supabase functions: `credit-manager`, Brand DNA fetch
- Calls external APIs: Google Gemini, Anthropic Claude

---

## Prompt Engineering

### System Prompt Template

The system prompt is the foundational context that frames the LLM's behavior:

```
You are a social media and content marketing expert creating content for [Brand].

## Brand Identity
[Brand description and positioning]

## Target Audience
[Demographic and psychographic profile]

## Voice & Tone
Primary tone: [e.g., professional]
Secondary tones: [e.g., playful, authoritative]
NEVER use: [prohibited tones]
Example: "[Sample text in correct tone]"

## Content Restrictions
- Forbidden words: [comma-separated list]
- Forbidden topics: [comma-separated list]
- Forbidden hashtags: [comma-separated list]

## Editorial Pillars
- [Pillar 1]: [Description]
- [Pillar 2]: [Description]
- [Pillar 3]: [Description]

## Visual Direction
Colors: [hex codes]
Style: [e.g., minimalist, bold]
Imagery: [guidelines]

## Compliance Requirements
- [Rule 1]: [Description]
- [Rule 2]: [Description]

## Platform Specifications
Maximum characters: [number]
Optimal length: [number]
```

### User Prompt Structure

```
Create [content_type] content for [platform][focused on [pillar]][with keyword: [keyword]][themed: [theme]][CTA: [cta]]

[reference content if provided]

[current events context if provided]

Return JSON format with: title, body, hashtags (array), visual_direction
```

### Tone Matching & Voice

The system ensures consistent brand voice through:

1. **Example-based learning**: Providing good/bad examples in prompt
2. **Constraint enforcement**: Forbidden words and prohibited tones listed
3. **Tone descriptors**: Detailed adjectives to guide LLM
4. **Reference content**: Previous posts showing successful voice
5. **Compliance checking**: Post-generation validation against voice guidelines

---

## Structured Output Format

All LLMs return standardized JSON:

```json
{
  "title": "Compelling headline (string, required)",
  "body": "Main content, 100-2000 chars (string, required)",
  "hashtags": ["tag1", "tag2"] (array, required),
  "visual_direction": "Designer instructions (string, optional)",
  "cta": "Call-to-action text (string, optional)",
  "confidence": 0.85 (0.0-1.0, optional),
  "metadata": {
    "word_count": 150,
    "character_count": 1200,
    "estimated_engagement": "high",
    "reading_time_minutes": 2
  }
}
```

### Platform-Specific Character Limits

| Platform | Max Body | Optimal | Max Hashtags |
|---|---|---|---|
| Instagram | 2,200 | 125 | 30 |
| X (Twitter) | 280 | 140 | 5 |
| LinkedIn | 3,000 | 400 | 5 |
| Email | 5,000 | 800 | 0 |
| Website | 10,000 | 1,500 | 0 |


---

## Batch Generation

### Generating Content Calendars

Batch generation creates 4-12 pieces of content in a single request:

```typescript
interface BatchGenerationRequest {
  batch_id: string;
  batch_size: number;              // 4-12
  content_type: string;
  platform: string;
  start_date: ISO8601;
  frequency: 'daily' | 'every_other_day' | 'weekly' | 'biweekly';
  themes?: string[];               // Different themes for variety
  keywords?: string[];             // Rotate keywords across batch
  pillars?: string[];              // Distribute across editorial pillars
}

async function generateBatch(
  envelope: AgentEnvelope,
  batchRequest: BatchGenerationRequest
): Promise<ContentResult[]> {
  const results: ContentResult[] = [];
  
  for (let i = 0; i < batchRequest.batch_size; i++) {
    const requestCopy = { ...envelope };
    
    // Rotate through themes if provided
    if (batchRequest.themes?.length > 0) {
      requestCopy.post_context.content_theme = 
        batchRequest.themes[i % batchRequest.themes.length];
    }
    
    // Rotate keywords
    if (batchRequest.keywords?.length > 0) {
      requestCopy.post_context.primary_keyword = 
        batchRequest.keywords[i % batchRequest.keywords.length];
    }
    
    // Distribute pillars
    if (batchRequest.pillars?.length > 0) {
      requestCopy.post_context.content_pillar = 
        batchRequest.pillars[i % batchRequest.pillars.length];
    }
    
    // Update scheduled date based on frequency
    const scheduledDate = new Date(batchRequest.start_date);
    switch (batchRequest.frequency) {
      case 'daily':
        scheduledDate.setDate(scheduledDate.getDate() + i);
        break;
      case 'every_other_day':
        scheduledDate.setDate(scheduledDate.getDate() + i * 2);
        break;
      case 'weekly':
        scheduledDate.setDate(scheduledDate.getDate() + i * 7);
        break;
      case 'biweekly':
        scheduledDate.setDate(scheduledDate.getDate() + i * 14);
        break;
    }
    
    requestCopy.post_context.scheduled_date = scheduledDate.toISOString();
    requestCopy.post_context.batch_context = {
      batch_id: batchRequest.batch_id,
      batch_size: batchRequest.batch_size,
      content_index: i
    };
    
    // Generate single item
    const result = await routeWithFallback(requestCopy, `${batchRequest.batch_id}-${i}`);
    results.push(result);
    
    // Small delay to avoid rate limiting
    if (i < batchRequest.batch_size - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}
```

### Batch Consistency

For batch generation, maintain consistency across pieces:

```typescript
async function ensureBatchConsistency(results: ContentResult[]): Promise<void> {
  // Ensure hashtags are consistent across batch
  const primaryHashtags = new Set<string>();
  
  results.forEach(result => {
    // Extract primary brand hashtags
    const brandHashtags = result.hashtags.filter(h => 
      h.toLowerCase().includes('brand') || 
      h.startsWith('#genOS')
    );
    brandHashtags.forEach(h => primaryHashtags.add(h));
  });
  
  // Reinsert primary hashtags into all pieces
  results.forEach(result => {
    const variantHashtags = result.hashtags.filter(h => 
      !primaryHashtags.has(h)
    );
    result.hashtags = Array.from(primaryHashtags).concat(variantHashtags);
  });
}
```

---

## Token Tracking & Accounting

### Token Counting Strategy

Tokens are counted at three levels:

1. **Input Tokens**: Text sent to the LLM (prompt + system instruction)
2. **Output Tokens**: Text generated by the LLM (response)
3. **Total Tokens**: Input + Output (for billing)

```typescript
interface TokenMetrics {
  request_id: string;
  tenant_id: string;
  timestamp: ISO8601;
  model: string;                  // 'gemini-2.0-flash' or 'claude-3-5-sonnet'
  content_type: string;
  platform: string;
  input_tokens: number;           // Counted by API
  output_tokens: number;          // Counted by API
  total_tokens: number;           // input + output
  estimated_cost_usd: number;
  execution_time_ms: number;
  success: boolean;
  fallback_used: boolean;         // Was fallback chain used?
  compliance_violations_fixed: number;
}

async function logTokenMetrics(metrics: TokenMetrics): Promise<void> {
  const { data, error } = await supabase
    .from('token_usage_log')
    .insert(metrics);
  
  if (error) {
    console.error('Failed to log tokens:', error);
  }
}

// Track per-model token usage for analytics
async function getTokenUsageByModel(tenantId: string, days: number = 30): Promise<any> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const { data, error } = await supabase
    .from('token_usage_log')
    .select('model, input_tokens, output_tokens, total_tokens, estimated_cost_usd')
    .eq('tenant_id', tenantId)
    .gte('timestamp', cutoffDate.toISOString())
    .order('timestamp', { ascending: false });
  
  if (error) return null;
  
  // Aggregate by model
  const byModel = {};
  data.forEach(row => {
    if (!byModel[row.model]) {
      byModel[row.model] = {
        total_input: 0,
        total_output: 0,
        total_tokens: 0,
        total_cost: 0,
        request_count: 0
      };
    }
    
    byModel[row.model].total_input += row.input_tokens;
    byModel[row.model].total_output += row.output_tokens;
    byModel[row.model].total_tokens += row.total_tokens;
    byModel[row.model].total_cost += row.estimated_cost_usd;
    byModel[row.model].request_count += 1;
  });
  
  return byModel;
}
```

### Token Limits per Model

| Model | Input Limit | Output Limit | Cost per 1M Input | Cost per 1M Output |
|-------|---|---|---|---|
| Gemini 2.0 Flash | 32k | 8k | $0.075 | $0.30 |
| Claude 3.5 Sonnet | 200k | 4k | $3.00 | $15.00 |
| Local Mock | N/A | N/A | $0 | $0 |

---

## Cost Calculation

### Pricing Model

```typescript
const PRICING = {
  'gemini-2.0-flash': {
    input_per_1m: 0.075,           // $0.075 per 1M input tokens
    output_per_1m: 0.30,           // $0.30 per 1M output tokens
    markup_multiplier: 1.2         // 20% markup for operations
  },
  'claude-3-5-sonnet': {
    input_per_1m: 3.0,             // $3 per 1M input tokens
    output_per_1m: 15.0,           // $15 per 1M output tokens
    markup_multiplier: 1.15        // 15% markup for operations
  }
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  
  const inputCost = (inputTokens / 1_000_000) * pricing.input_per_1m;
  const outputCost = (outputTokens / 1_000_000) * pricing.output_per_1m;
  const baseCost = inputCost + outputCost;
  
  // Apply platform markup
  const finalCost = baseCost * pricing.markup_multiplier;
  
  return parseFloat(finalCost.toFixed(4));
}

// Credit system (1 credit = $0.01 for simplicity)
function tokensToCreditCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const cost = calculateCost(model, inputTokens, outputTokens);
  const credits = Math.ceil(cost * 100); // $0.01 per credit
  return credits;
}
```

### Cost Estimation Before Request

```typescript
function estimateCost(
  contentType: string,
  platform: string,
  tenantPlan: string
): { estimated_tokens: number; estimated_cost_usd: number; credits_required: number } {
  
  // Estimate typical token usage by content type
  const tokenEstimates = {
    'reel': { input: 800, output: 150 },
    'story': { input: 500, output: 100 },
    'carousel': { input: 1200, output: 400 },
    'static_post': { input: 600, output: 120 },
    'blog_post': { input: 2000, output: 1200 },
    'email_campaign': { input: 1500, output: 800 },
    'brand_manifesto': { input: 2500, output: 1500 },
    'video_script': { input: 2200, output: 1400 },
    'default': { input: 1000, output: 500 }
  };
  
  const estimate = tokenEstimates[contentType] || tokenEstimates.default;
  
  // Choose model based on content type
  const model = isStrategicContent(contentType) ? 
    'claude-3-5-sonnet' : 'gemini-2.0-flash';
  
  const estimatedCost = calculateCost(model, estimate.input, estimate.output);
  const creditsRequired = tokensToCreditCost(model, estimate.input, estimate.output);
  
  return {
    estimated_tokens: estimate.input + estimate.output,
    estimated_cost_usd: parseFloat(estimatedCost.toFixed(4)),
    credits_required: creditsRequired
  };
}
```


---

## Error Handling & Fallback Chain

### Error Types & Recovery

```typescript
enum ErrorCode {
  // API Errors
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_TIMEOUT = 'API_TIMEOUT',
  API_UNAVAILABLE = 'API_UNAVAILABLE',
  
  // Validation Errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_TOKEN = 'INVALID_TOKEN',
  INVALID_BRAND_DNA = 'INVALID_BRAND_DNA',
  
  // Resource Errors
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  
  // Content Errors
  CONTENT_POLICY_VIOLATION = 'CONTENT_POLICY_VIOLATION',
  COMPLIANCE_CHECK_FAILED = 'COMPLIANCE_CHECK_FAILED',
  
  // System Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

class RouterError extends Error {
  code: ErrorCode;
  statusCode: number;
  recoverable: boolean;
  
  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    recoverable: boolean = false
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.recoverable = recoverable;
  }
}
```

### Retry Logic with Exponential Backoff

```typescript
async function callWithRetry(
  fn: () => Promise<any>,
  maxRetries: number = 2,
  backoffMs: number = 1000
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on non-recoverable errors
      if (error instanceof RouterError && !error.recoverable) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = backoffMs * Math.pow(2, attempt); // Exponential backoff
        console.log(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Usage
const result = await callWithRetry(
  () => callGemini(systemPrompt, userPrompt, envelope, requestId),
  2,
  1000
);
```

### Fallback Chain Execution

The router attempts generation in this order:

1. **Primary Model** (based on content type)
   - Timeout: 30 seconds
   - Retry: Up to 2 times with exponential backoff
   - If succeeds: Return content

2. **Secondary Model** (opposite of primary)
   - Timeout: 30 seconds
   - Single attempt (no retry to save time)
   - If succeeds: Log fallback usage, return content

3. **Local Mock Generator** (template-based)
   - Always succeeds (no external API calls)
   - Returns lower-confidence content
   - Logged as final fallback

4. **Total Failure** (all three attempts failed)
   - Return detailed error code and message
   - Log request for investigation
   - Advise user to retry or contact support

---

## Local Mock Generator

### Template-Based Fallback System

When both Gemini and Claude fail, the system falls back to template-based generation. This ensures 100% success rate.

```typescript
async function generateReelTemplate(envelope: AgentEnvelope): Promise<any> {
  const brand = envelope.brand_dna;
  const pillar = envelope.post_context.content_pillar;
  
  // Reel template: 15-30 second vertical video script
  const templates = [
    {
      structure: 'hook_value_cta',
      hook: `Hey ${brand.target_audience.split(',')[0]}! 👀`,
      value: `Here's ${envelope.post_context.primary_keyword || 'something'} you need to know...`,
      cta: envelope.post_context.cta || 'Save this!'
    },
    {
      structure: 'problem_solution_proof',
      hook: `Struggling with ${envelope.post_context.primary_keyword}?`,
      value: `Here's how we solved it in 3 steps...`,
      cta: envelope.post_context.cta || 'Try it now'
    }
  ];
  
  const templateIndex = pillar === 'educational' ? 1 : 0;
  const template = templates[templateIndex];
  
  return {
    title: template.hook,
    body: `${template.hook}\n${template.value}\n${template.cta}`,
    hashtags: brand.hashtag_strategy.primary_hashtags.slice(0, 3),
    visual_direction: `${brand.visual_direction.style_description} vertical video (9:16)`,
    confidence: 0.65,
    is_fallback: true
  };
}

async function generateBlogTemplate(envelope: AgentEnvelope): Promise<any> {
  const keyword = envelope.post_context.primary_keyword || 'Digital Marketing';
  
  return {
    title: `The Complete Guide to ${keyword} in 2026`,
    body: `# The Complete Guide to ${keyword} in 2026\n\n## What You'll Learn\n1. Essential concepts\n2. Best practices\n3. Common mistakes\n4. Implementation steps\n\n## Conclusion\n${keyword} is crucial for success.`,
    hashtags: [`#${keyword.replace(/\s+/g, '')}`],
    visual_direction: `Professional blog header image about ${keyword}`,
    confidence: 0.60,
    is_fallback: true
  };
}

async function generateEmailTemplate(envelope: AgentEnvelope): Promise<any> {
  const theme = envelope.post_context.content_theme || 'Product Update';
  
  return {
    title: `${theme} - What You Need to Know`,
    body: `Hello [Recipient],\n\n${theme}\n\n## Here's What Changed\n1. Update 1\n2. Update 2\n3. Update 3\n\nBest regards,\n${envelope.brand_dna.brand_name}`,
    hashtags: [],
    visual_direction: 'Professional email template with brand colors',
    confidence: 0.55,
    is_fallback: true
  };
}

async function generateDefaultTemplate(envelope: AgentEnvelope): Promise<any> {
  return {
    title: `${envelope.post_context.content_pillar}: ${envelope.post_context.primary_keyword || 'New Content'}`,
    body: `Discover ${envelope.post_context.primary_keyword || 'this'} with ${envelope.brand_dna.brand_name}.`,
    hashtags: envelope.brand_dna.hashtag_strategy.primary_hashtags.slice(0, 3),
    visual_direction: `${envelope.brand_dna.visual_direction.style_description}`,
    confidence: 0.40,
    is_fallback: true
  };
}
```

### When Templates Are Used

Templates are automatically used when:

- Both Gemini and Claude API calls fail
- API keys are not configured
- Rate limits are exceeded for all models
- Network connectivity issues prevent API calls
- Timeout occurs for both primary and secondary attempts

Templates ensure that users can always generate content, even if all external APIs are unavailable.

---

## Compliance Integration

### MasterCompliance Validation

Every generated piece of content is validated against active MasterCompliance rules:

```typescript
async function validateAgainstMasterCompliance(
  content: any,
  rules: ComplianceRule[]
): Promise<ComplianceCheckResult> {
  const violations: ComplianceViolation[] = [];
  const warnings: string[] = [];
  
  const fullText = `${content.title} ${content.body} ${(content.hashtags || []).join(' ')}`.toLowerCase();
  
  for (const rule of rules) {
    if (!rule.active) continue;
    
    if (rule.rule_type === 'must_include') {
      const hasKeyword = rule.keywords.some(k => 
        fullText.includes(k.toLowerCase())
      );
      
      if (!hasKeyword) {
        const violation: ComplianceViolation = {
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          violation_type: 'missing_required_keyword',
          message: `Must include one of: ${rule.keywords.join(', ')}`,
          severity: rule.enforcement_level === 'strict' ? 'error' : 'warning'
        };
        
        if (rule.enforcement_level === 'strict') {
          violations.push(violation);
        } else {
          warnings.push(violation.message);
        }
      }
    }
    
    if (rule.rule_type === 'must_exclude') {
      for (const keyword of rule.keywords) {
        if (fullText.includes(keyword.toLowerCase())) {
          violations.push({
            rule_id: rule.rule_id,
            rule_name: rule.rule_name,
            violation_type: 'forbidden_keyword',
            message: `Must not contain: "${keyword}"`,
            severity: rule.enforcement_level === 'strict' ? 'error' : 'warning'
          });
        }
      }
    }
    
    if (rule.rule_type === 'legal') {
      if (!fullText.includes(rule.keywords[0]?.toLowerCase())) {
        violations.push({
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          violation_type: 'missing_legal_disclaimer',
          message: `Missing required legal disclaimer`,
          severity: 'error'
        });
      }
    }
  }
  
  return {
    compliant: violations.length === 0,
    violations,
    warnings,
    compliance_score: ((rules.length - violations.length) / rules.length) * 100
  };
}
```

### Automatic Violation Fixing

If compliance violations are found, the system attempts to regenerate with a corrective prompt:

```typescript
async function fixComplianceViolations(
  content: any,
  violations: string[],
  envelope: AgentEnvelope
): Promise<any> {
  // If violations are minor (warnings only), approve automatically
  if (violations.every(v => !v.includes('Must'))) {
    return content;
  }
  
  // For strict violations, attempt regeneration
  const fixPrompt = `
The following content has compliance violations:
${violations.join('\n')}

Original content:
Title: ${content.title}
Body: ${content.body}

Please fix these violations while maintaining the message and brand voice.
Return JSON: { title, body, hashtags }
  `;
  
  // Regenerate through LLM
  // On success: return fixed content
  // On failure: return original with violations noted
  return content;
}
```

---

## Performance Optimization

### Caching Strategies

Reduce database calls and API overhead with multi-level caching:

```typescript
const CACHE_TTL = {
  BRAND_DNA: 5 * 60 * 1000,           // 5 minutes
  COMPLIANCE_RULES: 10 * 60 * 1000,   // 10 minutes
  TENANT_CONFIG: 30 * 60 * 1000,      // 30 minutes
  TRENDING_TOPICS: 1 * 60 * 1000      // 1 minute
};

class CacheManager {
  private cache = new Map<string, { value: any; expires: number }>();
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  set(key: string, value: any, ttl: number): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }
}

const cacheManager = new CacheManager();

async function loadBrandDNACached(tenantId: string): Promise<any> {
  const cacheKey = `brand_dna_${tenantId}`;
  
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;
  
  const brandDna = await loadBrandDNA(tenantId);
  cacheManager.set(cacheKey, brandDna, CACHE_TTL.BRAND_DNA);
  
  return brandDna;
}
```

### Batch Processing Optimization

For batch content generation, group by router to maximize efficiency:

```typescript
async function generateBatchOptimized(requests: ContentGenerationRequest[]): Promise<any[]> {
  // Group by router to maximize API call efficiency
  const byRouter = {
    'gemini': [] as ContentGenerationRequest[],
    'claude': [] as ContentGenerationRequest[]
  };
  
  requests.forEach(req => {
    const router = determineRouter(req, 'pro');
    byRouter[router].push(req);
  });
  
  // Process in parallel by router
  const results = await Promise.all([
    processBatch(byRouter.gemini, 'gemini'),
    processBatch(byRouter.claude, 'claude')
  ]);
  
  return results.flat();
}
```

---

## Monitoring & Observability

### Key Metrics Dashboard

Track these metrics for system health and performance:

- **Success Rate**: % of requests that completed successfully
- **Fallback Usage**: % using fallback models (should be < 5%)
- **Average Latency**: ms from request to response
- **Token Efficiency**: Average tokens per request
- **Cost per Request**: USD spent per content piece
- **Compliance Score**: % of generated content passing validation

### Logging & Debugging

Every request is logged with:

- request_id (UUID)
- tenant_id
- content_type, platform
- router_used (gemini/claude/mock)
- input_tokens, output_tokens
- execution_time_ms
- success/failure status
- compliance_violations (if any)
- fallback_chain_triggered

View logs via:
```
SELECT * FROM token_usage_log 
WHERE tenant_id = 'xyz' 
ORDER BY timestamp DESC 
LIMIT 50;
```

### Health Check Endpoint

Regular health checks verify system status:

```typescript
async function healthCheck(): Promise<HealthStatus> {
  const checks = {
    gemini_api: await checkGeminiAPI(),
    claude_api: await checkClaudeAPI(),
    database: await checkDatabase(),
    cache: true  // In-memory cache always works
  };
  
  return {
    status: Object.values(checks).every(v => v) ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  };
}
```

---

## Summary

The **AI Router** provides:

1. **Intelligent Routing** - Based on content type, plan, and real-time capacity
2. **Complete Context** - Agent Envelope with full Brand DNA, compliance rules
3. **Robust Fallback** - Primary → Secondary → Local (100% success rate)
4. **Compliance-First** - Every response validated against rules
5. **Token & Cost Tracking** - Precise accounting for billing
6. **Error Handling** - Detailed error codes and recovery strategies
7. **Performance** - Caching, batching, parallel processing
8. **Observability** - Comprehensive logging and metrics

This architecture ensures genOS™ generates consistent, on-brand, compliant content while optimizing cost and performance.

---

*Documento #6 de 10*
