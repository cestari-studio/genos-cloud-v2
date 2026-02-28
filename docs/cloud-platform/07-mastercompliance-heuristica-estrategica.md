# genOS™ Cloud Platform — Super Prompt #7
## MasterCompliance Engine & Heuristic Report System
**Version 2.0.0 | Date: 2026-02-28**

---

## Table of Contents
1. [MasterCompliance Engine Overview](#mastercompliance-engine-overview)
2. [The 4 Validation Layers](#the-4-validation-layers)
3. [Constraint Kernel](#constraint-kernel)
4. [Score Verdicts](#score-verdicts)
5. [Auto-Revision Loop](#auto-revision-loop)
6. [Compliance Rules Schema](#compliance-rules-schema)
7. [Edge Function: Compliance Engine](#edge-function-compliance-engine)
8. [Heuristic Report System](#heuristic-report-system)
9. [Edge Function: Heuristic Report](#edge-function-heuristic-report)
10. [Quality Scores Integration](#quality-scores-integration)
11. [Integration with Content Factory](#integration-with-content-factory)

---

## MasterCompliance Engine Overview

The **MasterCompliance Engine** is the gatekeeper of all AI-generated content within the genOS™ Cloud Platform. It is a mandatory, non-negotiable validation system that ensures NO content reaches "Approved" status without passing rigorous compliance checks.

### Core Philosophy
- **Content Quality Assurance**: Every piece of generated content must align with brand guidelines, legal requirements, and platform standards.
- **Automated Governance**: Eliminates manual review bottlenecks while ensuring consistency.
- **Scoring System**: Uses a 0–100 scale to objectively measure compliance.
- **Iterative Improvement**: Automatically retries non-compliant content up to 3 times with targeted improvement instructions.

### Mandatory Compliance Flow
```
AI-Generated Content
        ↓
   [MasterCompliance Engine]
        ↓
   Pass all 4 layers + constraints?
        ↙           ↓           ↘
     YES        NEEDS_REV      NO
      ↓             ↓            ↓
  APPROVED    AUTO-RETRY     REJECTED
      ↓        (up to 3x)       ↓
  SCHEDULE    If passes→       LOG FAIL
             SCHEDULE
```

### Scoring Architecture
- **Base Score**: 0 points (starting point)
- **Per-Layer Contribution**: 25 points each (layers 1–4)
- **Constraint Penalties**: Applied as absolute deductions
- **Final Score**: Sum of layer scores minus constraint penalties
- **Verdict Determination**: Score determines approval status

---

## The 4 Validation Layers

Each validation layer contributes **25 points** to the final compliance score. All 4 layers must be evaluated for every piece of content.

### Layer 1: Forbidden Words Check

**Purpose**: Scan generated content for terms, phrases, or expressions explicitly prohibited in the Brand DNA.

**Mechanism**:
- System retrieves `brand_dna.forbidden_words` array from the Brand DNA configuration.
- Performs case-insensitive substring matching on the entire content.
- Checks both visible text and hashtags for forbidden terms.
- Accounts for partial matches (e.g., "scam" detected within "discount" if configured).

**Scoring**:
- **No forbidden words detected**: +25 points
- **One or more forbidden words found**: 0 points (automatic failure of this layer)

**Example Forbidden Words**:
```json
{
  "brand_id": "brand_123",
  "forbidden_words": [
    "crisis",
    "broken",
    "unreliable",
    "fake",
    "spam",
    "clickbait",
    "scareware",
    "guaranteed",
    "100% effective"
  ]
}
```

**Detection Logic**:
```
FOR each word in forbidden_words:
  IF word appears in content (case-insensitive):
    Layer1_Score = 0
    Break loop
IF no forbidden words found:
  Layer1_Score = 25
```

**Real-World Scenario**:
- Generated post: "Our solution is guaranteed to increase your sales by 50%."
- Forbidden word detected: "guaranteed"
- Layer 1 score: **0 points**
- Outcome: Content fails this layer, proceeding to Layer 2 (not a barrier to final verdict, but contributes to overall score).

---

### Layer 2: Tone Alignment Check

**Purpose**: Verify that the generated content matches the intended tone and formality level specified in Brand DNA.

**Mechanism**:
- Compares the content's linguistic characteristics against `brand_dna.tone_parameters`.
- Analyzes three dimensions:
  1. **Energy Level**: Enthusiastic vs. Calm, Energetic vs. Neutral
  2. **Formality**: Professional vs. Casual, Formal vs. Conversational
  3. **Punctuation Dynamics**: Exclamation marks, ellipsis, emoji usage

**Scoring Criteria**:
- **Perfect tone alignment**: +25 points
- **Minor tone mismatches** (e.g., slightly more casual than intended): +15 points (penalty of 10)
- **Significant tone mismatches** (e.g., professional tone but excessive slang): +5 points (penalty of 20)
- **Complete tone misalignment**: 0 points

**Tone Parameters Example**:
```json
{
  "brand_id": "brand_123",
  "tone_parameters": {
    "energy_level": "enthusiastic",
    "formality": "professional",
    "emoji_usage": "sparingly",
    "exclamation_count_max": 3,
    "slang_tolerance": "low",
    "punctuation_style": "controlled"
  }
}
```

**Detection Logic for Formality Violations**:
```
slang_terms = ["gonna", "wanna", "kinda", "sorta", "ain't", "u", "r"]
IF brand_tone.formality == "professional":
  FOR each slang_term in slang_terms:
    IF slang_term found in content:
      penalize by 5 points per instance
```

**Punctuation Analysis**:
```
exclamation_count = count('!' in content)
IF brand_tone.energy_level == "calm":
  IF exclamation_count > 1:
    penalize by 3 points per excess exclamation
```

**Real-World Scenario**:
- Brand tone: Professional, moderate energy
- Generated content: "We're gonna help u crush your goals!!! 🚀🎉"
- Issues detected:
  - Slang: "gonna", "u" (2 violations × 5 = -10 points)
  - Excess exclamation marks: 3 (1 excess × 3 = -3 points)
  - Emoji overuse: 2 emojis (expected 1) = -2 points
- Layer 2 score: 25 - 15 = **10 points**

---

### Layer 3: Length Compliance Check

**Purpose**: Enforce character and word limits defined in Brand DNA to ensure content fits platform specifications and user preferences.

**Mechanism**:
- Retrieves `brand_dna.char_limits` and `brand_dna.word_limits` for the content type.
- Counts total characters (including spaces) and total words.
- Applies hard fail logic if content exceeds maximum limits.
- Applies penalties for content significantly below minimum (if applicable).

**Scoring Criteria**:
- **Within min-max range**: +25 points
- **Below minimum**: +10 points (penalty of 15, content may be too thin)
- **Exceeds maximum**: 0 points (hard fail, automatic rejection)
- **Significantly below minimum** (< 50% of min): 0 points

**Character Limits Example**:
```json
{
  "brand_id": "brand_123",
  "content_types": {
    "instagram_caption": {
      "char_limits": {
        "min": 20,
        "max": 2200
      },
      "word_limits": {
        "min": 5,
        "max": 350
      }
    },
    "tweet": {
      "char_limits": {
        "min": 10,
        "max": 280
      },
      "word_limits": {
        "min": 2,
        "max": 50
      }
    },
    "linkedin_post": {
      "char_limits": {
        "min": 50,
        "max": 3000
      },
      "word_limits": {
        "min": 10,
        "max": 500
      }
    }
  }
}
```

**Detection Logic**:
```
content_length = count(characters in content)
content_words = count(words in content)
limits = char_limits[content_type]

IF content_length > limits.max:
  Layer3_Score = 0  // Hard fail
  Return
IF content_length < limits.min * 0.5:
  Layer3_Score = 0  // Hard fail (too sparse)
  Return
IF content_length < limits.min:
  Layer3_Score = 10  // Below minimum (warning)
  Return
IF content_words > limits.max_words:
  Layer3_Score = 0  // Hard fail
  Return

Layer3_Score = 25  // Within bounds
```

**Real-World Scenario**:
- Content type: Twitter/Tweet
- Max length: 280 characters
- Generated tweet: "Discover the revolutionary approach to digital marketing that will transform your business, increase ROI by 300%, optimize customer engagement across all channels, and provide unmatched value to your organization in ways you never imagined possible before."
- Character count: 286 (exceeds max of 280)
- Layer 3 score: **0 points (hard fail)**

---

### Layer 4: Brand Consistency Check

**Purpose**: Ensure the generated content aligns with brand identity through mandatory terms usage, hashtag compliance, and editorial pillar alignment.

**Mechanism**:
- Verifies presence of mandatory brand terms specified in Brand DNA.
- Validates hashtag usage against the approved hashtag list.
- Confirms content aligns with one of the defined editorial pillars.
- Checks for brand voice consistency indicators.

**Scoring Criteria**:
- **All checks pass**: +25 points
- **Missing 1 mandatory term**: +15 points (penalty of 10)
- **Missing 2+ mandatory terms**: +5 points (penalty of 20)
- **Hashtag mismatch** (e.g., unapproved hashtags only): +10 points (penalty of 15)
- **No editorial pillar alignment**: 0 points (hard fail)
- **Multiple failures**: 0 points

**Brand Consistency Parameters**:
```json
{
  "brand_id": "brand_123",
  "mandatory_terms": [
    "innovative",
    "customer-centric",
    "solutions"
  ],
  "approved_hashtags": [
    "#Innovation",
    "#CustomerFirst",
    "#Solutions",
    "#TechLeadership",
    "#DigitalTransformation"
  ],
  "editorial_pillars": [
    "thought_leadership",
    "product_features",
    "customer_success",
    "industry_insights",
    "company_culture"
  ],
  "brand_voice_indicators": [
    "action_oriented",
    "data_driven",
    "authentic"
  ]
}
```

**Detection Logic**:
```
mandatory_found = 0
FOR each term in mandatory_terms:
  IF term appears in content (case-insensitive):
    mandatory_found += 1

penalties = 0

IF mandatory_found == 0:
  penalties += 20
ELSE IF mandatory_found == 1:
  penalties += 10
ELSE IF mandatory_found == 2:
  penalties += 5
ELSE IF mandatory_found == 3:
  penalties += 0

// Hashtag check
hashtags_in_content = extract_hashtags(content)
valid_hashtags = 0
FOR each hashtag in hashtags_in_content:
  IF hashtag in approved_hashtags:
    valid_hashtags += 1

IF hashtags_in_content.length > 0 AND valid_hashtags == 0:
  penalties += 15
ELSE IF valid_hashtags < hashtags_in_content.length * 0.5:
  penalties += 10

// Editorial pillar check
detected_pillar = match_content_to_pillar(content, editorial_pillars)
IF detected_pillar == null:
  Layer4_Score = 0  // Hard fail
  Return

Layer4_Score = max(0, 25 - penalties)
```

**Real-World Scenario**:
- Generated content: "Join us for an amazing webinar on transformative technology!"
- Mandatory terms required: ["innovative", "customer-centric", "solutions"]
- Mandatory terms found: 0 (uses "transformative" instead of "innovative", no "customer-centric" or "solutions")
- Hashtags used: #webinar, #tech
- Approved hashtags: None of the used hashtags are in the approved list
- Editorial pillar: "thought_leadership" detected ✓
- Penalties applied:
  - Missing all mandatory terms: -20 points
  - Hashtag mismatch: -15 points
- Layer 4 score: 25 - 35 = **0 points** (capped at minimum)
- Verdict: Layer 4 fails

---

## Constraint Kernel

The **Constraint Kernel** operates as an overlay on top of the 4 validation layers, applying absolute penalties for critical compliance failures. These penalties are applied **after** calculating layer scores and **override** normal scoring logic in certain cases.

### Constraint Penalties

#### Constraint 1: Missing Call-to-Action (CTA)
**Penalty**: **-30 points**

**Purpose**: Every piece of content must guide users toward a desired action. Content without a CTA lacks conversion intent.

**Definition of CTA**:
- Explicit action phrases: "Click here", "Learn more", "Sign up", "Download now", "Register", "Get started", "Shop now", "Book a demo"
- Implicit CTAs: "Visit our website", "Check out our latest post", "Swipe up", "DM us", "Reply below"
- Emoji CTAs: "👉 [action]", "🔗 [link]"

**Detection Logic**:
```
cta_phrases = ["click", "learn more", "sign up", "download", "register", "get started", 
               "shop", "book", "visit", "check out", "swipe", "dm", "reply", "reply below"]

cta_found = false
FOR each phrase in cta_phrases:
  IF phrase found in content (case-insensitive):
    cta_found = true
    Break

IF NOT cta_found:
  final_score -= 30
  flag_for_revision("Missing CTA: Add an action phrase to guide users")
```

**Real-World Scenario**:
- Generated post: "Our new product line features cutting-edge technology and exceptional quality."
- CTA check: No action phrase found (not even "Learn more" or "Shop now")
- Penalty applied: **-30 points**
- If base score was 60 (2.4 layers × 25), final score becomes 30 → **rejected**

#### Constraint 2: Missing Hashtags
**Penalty**: **-15 points**

**Purpose**: Hashtags increase discoverability and platform engagement. Platform strategy requires their use.

**Definition**:
- Minimum 1 hashtag required for most content types
- Hashtags must be from the `approved_hashtags` list in Brand DNA
- Hashtags should be relevant to content context

**Detection Logic**:
```
hashtags = extract_hashtags(content)
IF hashtags.length == 0:
  final_score -= 15
  flag_for_revision("Missing hashtags: Add relevant approved hashtags")
```

**Real-World Scenario**:
- Generated tweet: "Just launched our new AI-powered analytics dashboard. Transform your data insights today."
- Hashtags present: 0
- Penalty applied: **-15 points**

#### Constraint 3: Content in Wrong Language
**Penalty**: **Score = 0 (Automatic Rejection)**

**Purpose**: Content must be generated in the specified language. Wrong language content cannot be published.

**Mechanism**:
- System detects the language of generated content using language identification algorithms.
- Compares detected language against the target language specified in the content request.
- If mismatch is detected, content is immediately rejected.

**Detection Logic**:
```
target_language = request.language  // e.g., "en", "pt", "es"
detected_language = detect_language(content)

IF detected_language != target_language:
  final_score = 0  // Automatic rejection
  status = "rejected"
  Return  // Do not proceed with auto-retry
```

**Real-World Scenario**:
- Content request: Generate English LinkedIn post
- Generated content: "Temos o prazer de anunciar... [Portuguese content]"
- Language detection: Portuguese (pt) detected, English (en) expected
- Constraint penalty: **Score = 0 (automatic rejection)**
- Content not sent to revision loop

#### Constraint 4: Explicit or Offensive Content
**Penalty**: **Score = 0 (Automatic Rejection)**

**Purpose**: The platform maintains a safe, professional environment. Explicit, hateful, or offensive content is never acceptable.

**Mechanism**:
- System uses content moderation AI to scan for:
  - Explicit/adult content
  - Hateful speech or discrimination
  - Abusive language
  - Violence or graphic content
  - Spam or misleading information
- Flag any detected issues for immediate rejection

**Detection Logic**:
```
moderation_score = run_content_moderation(content)

IF moderation_score.explicit_content > 0.7:
  final_score = 0
  status = "rejected"
  reason = "Explicit or offensive content detected"
  Return

IF moderation_score.hate_speech > 0.6:
  final_score = 0
  status = "rejected"
  reason = "Hateful or discriminatory language detected"
  Return

IF moderation_score.abusive_language > 0.65:
  final_score = 0
  status = "rejected"
  reason = "Abusive language detected"
  Return
```

**Real-World Scenario**:
- Generated post contains offensive language or discriminatory remarks
- Content moderation score: Triggers hate_speech threshold
- Constraint penalty: **Score = 0 (automatic rejection)**

### Summary Table: Constraint Kernel

| Constraint | Trigger | Penalty | Recovery |
|-----------|---------|---------|----------|
| Missing CTA | No action phrase detected | -30 pts | Auto-retry with CTA instruction |
| Missing Hashtags | 0 hashtags found | -15 pts | Auto-retry with hashtag instruction |
| Wrong Language | Detected language ≠ target language | Score = 0 | REJECTED (no retry) |
| Explicit/Offensive | Moderation flags > threshold | Score = 0 | REJECTED (no retry) |

---

## Score Verdicts

The final compliance score (after all 4 layers + constraint penalties) determines the verdict, which dictates the content's path forward.

### Verdict Framework

#### Verdict: `approved` (Score ≥ 75)

**Status**: Content passes all critical compliance checks and proceeds to scheduling.

**Criteria**:
- No hard fails in any layer
- No critical constraint violations (CTA, language, explicit content)
- Score remains ≥ 75 after all penalties

**Actions**:
- Content marked as "approved" in the database
- Scheduled for publication per campaign settings
- Stored in `content_items` table with `compliance_status = "approved"`
- Quality score recorded in `quality_scores` table
- Ready for publishing via the Content Scheduler

**Example Breakdown**:
```
Layer 1 (Forbidden Words): +25
Layer 2 (Tone Alignment): +25
Layer 3 (Length Compliance): +25
Layer 4 (Brand Consistency): +18 (missing 1 mandatory term)
Subtotal: 93

Constraints:
- CTA present: 0 penalty
- Hashtags present: 0 penalty
- Language correct: 0 penalty
- Clean moderation: 0 penalty

Final Score: 93 → APPROVED ✓
```

#### Verdict: `needs_revision` (Score 40–74)

**Status**: Content has fixable issues. Automatically retried up to 3 times with targeted improvement instructions.

**Criteria**:
- Moderate compliance gaps
- No automatic rejection triggers (language, explicit content)
- Score between 40 and 74 (inclusive)

**Actions**:
- Content marked as "needs_revision" in the database
- Improvement instructions generated based on failing layers
- Sent to auto-revision loop (retry counter incremented)
- Original content preserved for reference
- If all retries exhaust, content moved to "rejected" status

**Auto-Retry Instructions** (Generated Dynamically):

```json
{
  "revision_attempt": 2,
  "max_retries": 3,
  "score": 58,
  "failed_layers": ["Layer 2", "Layer 4"],
  "instructions": [
    "Layer 2 (Tone Alignment): Your content is too casual. Professional tone required. Reduce exclamation marks, remove slang terms like 'gonna' and 'kinda'.",
    "Layer 4 (Brand Consistency): Missing mandatory terms 'customer-centric' and 'solutions'. Incorporate these terms naturally.",
    "Constraint: Ensure at least one clear CTA is present. Add 'Learn more at [link]' or similar."
  ],
  "previous_score": 52,
  "current_score": 58,
  "improvement": "+6 points"
}
```

**Example Scenario**:
```
Initial Score: 55 → needs_revision
Attempt 1: Score improves to 62 (still needs_revision)
Attempt 2: Score improves to 78 (APPROVED) ✓
Content scheduled and published
```

#### Verdict: `rejected` (Score < 40)

**Status**: Content fails critical compliance requirements and is discarded. Not eligible for revision.

**Criteria**:
- Score below 40
- **OR** triggered automatic rejection constraints:
  - Wrong language
  - Explicit/offensive content
- **OR** exhausted all 3 auto-retry attempts without reaching ≥ 40 score

**Actions**:
- Content marked as "rejected" in the database
- Logged as a failed attempt with detailed reason
- Stored in audit table for compliance review
- NOT scheduled for publication
- Admin/user notified of failure
- Campaign may pause or flag for manual intervention

**Failed Attempt Log Example**:
```json
{
  "content_id": "content_456",
  "campaign_id": "campaign_789",
  "status": "rejected",
  "final_score": 35,
  "reason": "Score below threshold (< 40) after 3 auto-retry attempts",
  "attempt_history": [
    {"attempt": 1, "score": 42, "status": "needs_revision"},
    {"attempt": 2, "score": 39, "status": "needs_revision"},
    {"attempt": 3, "score": 36, "status": "needs_revision"}
  ],
  "last_failure": "Missing multiple mandatory terms and CTA",
  "timestamp": "2026-02-28T14:32:10Z"
}
```

### Verdict Decision Tree

```
Final Score Calculated?
│
├─ Score ≥ 75 → APPROVED ✓
│   └─ Schedule content
│
├─ 40 ≤ Score < 75 → NEEDS_REVISION
│   ├─ Retry < 3? → Auto-retry with instructions
│   │   ├─ New Score ≥ 75? → APPROVED ✓
│   │   └─ New Score < 40? → REJECTED ✗
│   └─ Retry = 3? → REJECTED ✗
│
└─ Score < 40 → REJECTED ✗
    ├─ Language mismatch? → REJECTED ✗ (no retry)
    ├─ Explicit content? → REJECTED ✗ (no retry)
    └─ Other? → REJECTED ✗
```

---

## Auto-Revision Loop

The **Auto-Revision Loop** is an intelligent retry mechanism that automatically improves non-compliant content without human intervention, maximizing the use of AI generation capacity.

### Loop Mechanics

**Trigger Condition**:
- Content receives `needs_revision` verdict (40 ≤ score < 75)
- AND retry counter < 3
- AND no automatic rejection triggers detected

**Loop Flow**:
```
Content Failed Compliance
    ↓
Score in 40-74 range?
    ├─ YES: Enter Auto-Revision Loop
    │   ├─ Increment retry counter
    │   ├─ Generate improvement instructions
    │   ├─ Call Claude API with enhanced prompt
    │   ├─ Re-run MasterCompliance Engine
    │   ├─ Score ≥ 75? 
    │   │   ├─ YES: APPROVED ✓
    │   │   └─ NO: Check retry counter
    │   └─ Retry < 3? → Loop again | Retry = 3? → REJECTED ✗
    └─ NO: Move to rejected status
```

### Improvement Instruction Generation

The system generates targeted instructions based on which layers/constraints failed:

**Layer-Based Instructions**:

| Failed Layer | Instruction Template |
|--------------|---------------------|
| Layer 1: Forbidden Words | "Remove or replace forbidden word(s): [list]. Consider using: [alternatives]." |
| Layer 2: Tone Alignment | "Adjust tone: [specific issue]. Remove [problematic elements], add [recommended elements]." |
| Layer 3: Length | "Content exceeds/falls short of limits. Currently [X] chars, target [min-max] range. [Adjust by trimming/expanding]." |
| Layer 4: Brand Consistency | "Add mandatory terms: [list]. Ensure hashtags are from approved list: [list]. Align with pillar: [pillar]." |

**Constraint-Based Instructions**:

| Failed Constraint | Instruction |
|------------------|-------------|
| Missing CTA | "Add a clear call-to-action. Examples: 'Learn more', 'Sign up', 'Get started', 'Shop now'." |
| Missing Hashtags | "Add at least [N] relevant hashtags from: [approved_hashtags_list]." |

### Revised Prompt Construction

When calling Claude for auto-revision, the system constructs an enhanced prompt:

```
[Original Brand Instructions]

PREVIOUS GENERATION FEEDBACK:
Your previous content scored {previous_score}/100 in compliance.

REQUIRED IMPROVEMENTS:
{layer_failures_and_constraints}

SPECIFIC FIXES NEEDED:
{detailed_instructions_list}

IMPORTANT: 
- All improvements must be natural and maintain readability
- Do not sacrifice brand voice for compliance
- Only one revision round will be performed after this attempt
- Compliance is mandatory for publication

Generate the revised content:
```

### Retry Counter Management

**Initial State**:
```json
{
  "content_id": "content_123",
  "retry_count": 0,
  "max_retries": 3,
  "status": "pending"
}
```

**Attempt Flow**:
```
Attempt 1:
  - retry_count: 0 → 1
  - Score: 58 → needs_revision
  
Attempt 2:
  - retry_count: 1 → 2
  - Score: 71 → needs_revision
  
Attempt 3:
  - retry_count: 2 → 3
  - Score: 68 → needs_revision
  - No more retries available
  - Status: rejected
```

### Example Auto-Revision Scenario

**Initial Generation**:
```
Generated Content: "Our new product is AMAZING! You gotta try it!!!"
Initial Score: 52 (Tone misalignment, missing CTA, missing mandatory terms)
Status: needs_revision | Attempt: 1/3
```

**Improvement Instructions**:
```
- Layer 2: Remove excessive exclamation marks, reduce casual language ("gotta")
- Layer 4: Add mandatory terms "innovative" and "customer-centric"
- Constraint 1: Add clear CTA such as "Learn more" or "Shop now"
- Constraint 2: Include hashtags from approved list
```

**Revised Generation (Attempt 2)**:
```
Generated Content: "Our innovative, customer-centric product delivers exceptional value. 
Discover how we're transforming industries. Learn more at [link]. 
#Innovation #Solutions #CustomerFirst"
Revised Score: 78
Status: approved
```

### Failure Path

If content fails to improve sufficiently after 3 attempts:

```json
{
  "content_id": "content_123",
  "final_status": "rejected",
  "total_attempts": 3,
  "attempt_scores": [52, 58, 64],
  "reason": "Unable to reach compliance threshold (≥ 75) within 3 revision attempts",
  "last_feedback": "Missing critical brand voice alignment. Consider manual review.",
  "timestamp": "2026-02-28T15:45:00Z"
}
```

---

## Compliance Rules Schema

The **Compliance Rules** schema defines the data structure and validation constraints stored in the database, enabling the MasterCompliance Engine to validate content against a rules database.

### Database Table: `compliance_rules`

```sql
CREATE TABLE compliance_rules (
  rule_id SERIAL PRIMARY KEY,
  brand_id UUID NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50) NOT NULL,
  layer INT NOT NULL,
  condition TEXT NOT NULL,
  weight INT DEFAULT 25,
  penalty INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);
```

### Schema Fields

| Field | Type | Description |
|-------|------|-------------|
| `rule_id` | SERIAL | Unique identifier for the rule |
| `brand_id` | UUID | Reference to the brand this rule applies to |
| `rule_name` | VARCHAR(255) | Human-readable name of the rule |
| `rule_type` | VARCHAR(50) | Category: `forbidden_word`, `tone_check`, `length_check`, `brand_consistency`, `constraint` |
| `layer` | INT | Validation layer: 1, 2, 3, 4, or 99 (for constraints) |
| `condition` | TEXT | The rule condition (JSON or pattern) |
| `weight` | INT | Points awarded if rule passes (default 25 per layer) |
| `penalty` | INT | Points deducted if rule fails |
| `enabled` | BOOLEAN | Whether this rule is active |
| `created_at` | TIMESTAMP | When the rule was created |
| `updated_at` | TIMESTAMP | When the rule was last modified |

### Example Compliance Rules Entries

#### Rule 1: Layer 1 - Forbidden Word Check
```json
{
  "rule_id": 1,
  "brand_id": "550e8400-e29b-41d4-a716-446655440000",
  "rule_name": "Prohibited Terminology",
  "rule_type": "forbidden_word",
  "layer": 1,
  "condition": {
    "forbidden_words": [
      "crisis",
      "broken",
      "unreliable",
      "fake",
      "spam",
      "guaranteed",
      "100% effective"
    ]
  },
  "weight": 25,
  "penalty": 25,
  "enabled": true
}
```

#### Rule 2: Layer 2 - Tone Alignment
```json
{
  "rule_id": 2,
  "brand_id": "550e8400-e29b-41d4-a716-446655440000",
  "rule_name": "Professional Tone Enforcement",
  "rule_type": "tone_check",
  "layer": 2,
  "condition": {
    "energy_level": "professional",
    "formality": "formal",
    "slang_tolerance": "none",
    "max_exclamation_marks": 1,
    "max_emojis": 0,
    "restricted_slang": ["gonna", "wanna", "kinda", "u", "r", "ur"]
  },
  "weight": 25,
  "penalty": -10,
  "enabled": true
}
```

#### Rule 3: Layer 3 - Length Compliance
```json
{
  "rule_id": 3,
  "brand_id": "550e8400-e29b-41d4-a716-446655440000",
  "rule_name": "Tweet Length Limits",
  "rule_type": "length_check",
  "layer": 3,
  "condition": {
    "content_type": "tweet",
    "min_chars": 10,
    "max_chars": 280,
    "min_words": 2,
    "max_words": 50
  },
  "weight": 25,
  "penalty": 0,
  "enabled": true
}
```

#### Rule 4: Layer 4 - Brand Consistency
```json
{
  "rule_id": 4,
  "brand_id": "550e8400-e29b-41d4-a716-446655440000",
  "rule_name": "Mandatory Terms Inclusion",
  "rule_type": "brand_consistency",
  "layer": 4,
  "condition": {
    "mandatory_terms": ["innovative", "customer-centric", "solutions"],
    "min_mandatory_terms": 2,
    "approved_hashtags": ["#Innovation", "#Solutions", "#CustomerFirst"],
    "editorial_pillars": ["thought_leadership", "product_features"]
  },
  "weight": 25,
  "penalty": -10,
  "enabled": true
}
```

#### Rule 5: Constraint - Missing CTA
```json
{
  "rule_id": 5,
  "brand_id": "550e8400-e29b-41d4-a716-446655440000",
  "rule_name": "Call-to-Action Requirement",
  "rule_type": "constraint",
  "layer": 99,
  "condition": {
    "required": true,
    "cta_phrases": [
      "click here",
      "learn more",
      "sign up",
      "get started",
      "shop now",
      "register",
      "download"
    ]
  },
  "weight": 0,
  "penalty": -30,
  "enabled": true
}
```

#### Rule 6: Constraint - Hashtag Requirement
```json
{
  "rule_id": 6,
  "brand_id": "550e8400-e29b-41d4-a716-446655440000",
  "rule_name": "Hashtag Inclusion",
  "rule_type": "constraint",
  "layer": 99,
  "condition": {
    "required": true,
    "min_hashtags": 1,
    "approved_hashtags": ["#Innovation", "#Solutions", "#CustomerFirst", "#TechLeadership"]
  },
  "weight": 0,
  "penalty": -15,
  "enabled": true
}
```

### Querying Compliance Rules

**Retrieve Rules for a Brand**:
```sql
SELECT * FROM compliance_rules 
WHERE brand_id = '550e8400-e29b-41d4-a716-446655440000' 
  AND enabled = true
ORDER BY layer ASC, rule_id ASC;
```

**Retrieve Rules for a Specific Layer**:
```sql
SELECT * FROM compliance_rules 
WHERE brand_id = '550e8400-e29b-41d4-a716-446655440000' 
  AND layer = 2 
  AND enabled = true;
```

**Retrieve All Constraints**:
```sql
SELECT * FROM compliance_rules 
WHERE brand_id = '550e8400-e29b-41d4-a716-446655440000' 
  AND layer = 99 
  AND enabled = true;
```

---

## Edge Function: Compliance Engine

The **Compliance Engine Edge Function** (`compliance-engine/index.ts`) runs on Supabase Edge Functions, executing the MasterCompliance validation logic in real-time.

### Function: `compliance-engine/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Claude API configuration
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY")!;

interface ComplianceRequest {
  content_id: string;
  brand_id: string;
  content: string;
  content_type: string;
  language: string;
  campaign_id: string;
  retry_attempt?: number;
}

interface ComplianceScore {
  layer1_forbidden_words: number;
  layer2_tone_alignment: number;
  layer3_length_compliance: number;
  layer4_brand_consistency: number;
  constraint_penalties: number;
  final_score: number;
  verdict: "approved" | "needs_revision" | "rejected";
  details: string[];
}

// Layer 1: Forbidden Words Check
async function checkForbiddenWords(
  content: string,
  brandId: string
): Promise<{ score: number; details: string[] }> {
  const { data: rules } = await supabase
    .from("compliance_rules")
    .select("condition")
    .eq("brand_id", brandId)
    .eq("rule_type", "forbidden_word")
    .eq("enabled", true)
    .single();

  if (!rules) {
    return { score: 25, details: [] };
  }

  const forbiddenWords = rules.condition.forbidden_words || [];
  const contentLower = content.toLowerCase();
  const foundWords: string[] = [];

  for (const word of forbiddenWords) {
    if (contentLower.includes(word.toLowerCase())) {
      foundWords.push(word);
    }
  }

  if (foundWords.length > 0) {
    return {
      score: 0,
      details: [
        `Forbidden words detected: ${foundWords.join(", ")}`,
      ],
    };
  }

  return {
    score: 25,
    details: ["No forbidden words detected"],
  };
}

// Layer 2: Tone Alignment Check
async function checkToneAlignment(
  content: string,
  brandId: string
): Promise<{ score: number; details: string[] }> {
  const { data: rules } = await supabase
    .from("compliance_rules")
    .select("condition")
    .eq("brand_id", brandId)
    .eq("rule_type", "tone_check")
    .eq("enabled", true)
    .single();

  if (!rules) {
    return { score: 25, details: [] };
  }

  const toneParams = rules.condition;
  let penalties = 0;
  const details: string[] = [];

  // Check for restricted slang
  if (toneParams.restricted_slang) {
    for (const slang of toneParams.restricted_slang) {
      const count = (content.match(new RegExp(`\\b${slang}\\b`, "gi")) || [])
        .length;
      if (count > 0) {
        penalties += count * 5;
        details.push(`Slang term "${slang}" found ${count} time(s)`);
      }
    }
  }

  // Check exclamation marks
  if (toneParams.max_exclamation_marks !== undefined) {
    const exclamationCount = (content.match(/!/g) || []).length;
    if (exclamationCount > toneParams.max_exclamation_marks) {
      const excess = exclamationCount - toneParams.max_exclamation_marks;
      penalties += excess * 3;
      details.push(
        `Excess exclamation marks: ${excess} over limit`
      );
    }
  }

  // Check emojis
  if (toneParams.max_emojis !== undefined) {
    const emojiCount = (
      content.match(
        /(\u00d7[\u0080-\uFFFF]|[\u2600-\u27BF]|[\uD800-\uDBFF][\uDC00-\uDFFF])/g
      ) || []
    ).length;
    if (emojiCount > toneParams.max_emojis) {
      const excess = emojiCount - toneParams.max_emojis;
      penalties += excess * 2;
      details.push(`Excess emojis: ${excess} over limit`);
    }
  }

  const score = Math.max(0, 25 - penalties);
  if (score === 25) {
    details.push("Tone alignment verified");
  }

  return { score, details };
}

// Layer 3: Length Compliance Check
async function checkLengthCompliance(
  content: string,
  brandId: string,
  contentType: string
): Promise<{ score: number; details: string[] }> {
  const { data: rules } = await supabase
    .from("compliance_rules")
    .select("condition")
    .eq("brand_id", brandId)
    .eq("rule_type", "length_check")
    .eq("enabled", true)
    .single();

  if (!rules) {
    return { score: 25, details: [] };
  }

  const limits = rules.condition;
  const charCount = content.length;
  const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;

  const details: string[] = [];

  if (limits.max_chars && charCount > limits.max_chars) {
    details.push(
      `Content exceeds maximum length: ${charCount}/${limits.max_chars} chars`
    );
    return { score: 0, details };
  }

  if (limits.min_chars && charCount < limits.min_chars * 0.5) {
    details.push(
      `Content too sparse: ${charCount}/${limits.min_chars} chars (minimum)`
    );
    return { score: 0, details };
  }

  if (limits.min_chars && charCount < limits.min_chars) {
    details.push(
      `Content below minimum length: ${charCount}/${limits.min_chars} chars`
    );
    return { score: 10, details };
  }

  details.push(
    `Content length within bounds: ${charCount} chars`
  );
  return { score: 25, details };
}

// Layer 4: Brand Consistency Check
async function checkBrandConsistency(
  content: string,
  brandId: string
): Promise<{ score: number; details: string[] }> {
  const { data: rules } = await supabase
    .from("compliance_rules")
    .select("condition")
    .eq("brand_id", brandId)
    .eq("rule_type", "brand_consistency")
    .eq("enabled", true)
    .single();

  if (!rules) {
    return { score: 25, details: [] };
  }

  const brandParams = rules.condition;
  let penalties = 0;
  const details: string[] = [];

  // Check mandatory terms
  if (brandParams.mandatory_terms) {
    let mandatoryFound = 0;
    for (const term of brandParams.mandatory_terms) {
      if (content.toLowerCase().includes(term.toLowerCase())) {
        mandatoryFound++;
      }
    }

    const minRequired = brandParams.min_mandatory_terms || 1;
    if (mandatoryFound < minRequired) {
      penalties += (minRequired - mandatoryFound) * 10;
      details.push(
        `Missing mandatory terms: ${minRequired - mandatoryFound} of ${minRequired}`
      );
    }
  }

  // Check hashtags
  if (brandParams.approved_hashtags) {
    const hashtags = content.match(/#[\w]+/g) || [];
    const validHashtags = hashtags.filter((h) =>
      brandParams.approved_hashtags.some(
        (ah) => ah.toLowerCase() === h.toLowerCase()
      )
    );

    if (hashtags.length > 0 && validHashtags.length === 0) {
      penalties += 15;
      details.push(`Invalid hashtags detected`);
    } else if (validHashtags.length < hashtags.length * 0.5) {
      penalties += 10;
      details.push(`Some hashtags not approved`);
    }
  }

  const score = Math.max(0, 25 - penalties);
  if (score === 25) {
    details.push("Brand consistency verified");
  }

  return { score, details };
}

// Constraint Checks
async function checkConstraints(
  content: string,
  brandId: string,
  language: string
): Promise<{ penalties: number; details: string[] }> {
  const details: string[] = [];
  let penalties = 0;

  // Check language
  if (language !== "en" && language !== "pt" && language !== "es") {
    // Simplified language detection
    return { penalties: 100, details: ["Content in wrong language"] };
  }

  // Check for CTA
  const ctaPhrases = [
    "click",
    "learn more",
    "sign up",
    "get started",
    "shop",
    "download",
    "register",
  ];
  const hasCtA = ctaPhrases.some((cta) =>
    content.toLowerCase().includes(cta)
  );
  if (!hasCtA) {
    penalties += 30;
    details.push("Missing call-to-action");
  }

  // Check for hashtags
  const hashtags = content.match(/#[\w]+/g) || [];
  if (hashtags.length === 0) {
    penalties += 15;
    details.push("Missing hashtags");
  }

  return { penalties, details };
}

// Main compliance check function
async function validateContent(
  request: ComplianceRequest
): Promise<ComplianceScore> {
  const layer1 = await checkForbiddenWords(request.content, request.brand_id);
  const layer2 = await checkToneAlignment(request.content, request.brand_id);
  const layer3 = await checkLengthCompliance(
    request.content,
    request.brand_id,
    request.content_type
  );
  const layer4 = await checkBrandConsistency(request.content, request.brand_id);
  const constraints = await checkConstraints(
    request.content,
    request.brand_id,
    request.language
  );

  const layerTotal = layer1.score + layer2.score + layer3.score + layer4.score;
  const finalScore = Math.max(0, layerTotal - constraints.penalties);

  let verdict: "approved" | "needs_revision" | "rejected";
  if (finalScore >= 75) {
    verdict = "approved";
  } else if (finalScore >= 40 && (request.retry_attempt || 0) < 3) {
    verdict = "needs_revision";
  } else {
    verdict = "rejected";
  }

  const allDetails = [
    ...layer1.details,
    ...layer2.details,
    ...layer3.details,
    ...layer4.details,
    ...constraints.details,
  ];

  return {
    layer1_forbidden_words: layer1.score,
    layer2_tone_alignment: layer2.score,
    layer3_length_compliance: layer3.score,
    layer4_brand_consistency: layer4.score,
    constraint_penalties: -constraints.penalties,
    final_score: finalScore,
    verdict,
    details: allDetails,
  };
}

// Auto-revision function
async function autoReviseContent(
  request: ComplianceRequest,
  previousScore: ComplianceScore
): Promise<string> {
  const instructions = previousScore.details
    .map((d) => `• ${d}`)
    .join("\n");

  const prompt = `You are an expert content optimizer for a SaaS brand. 
  
A piece of social media content failed compliance checks with these issues:

${instructions}

Previous Score: ${previousScore.final_score}/100

Please revise the following content to address these issues while maintaining the original intent and brand voice:

ORIGINAL CONTENT:
"${request.content}"

REVISED CONTENT:
Generate a revised version that addresses all issues above. Keep it natural and engaging.`;

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();
  return data.content[0].text;
}

// Main handler
serve(async (req) => {
  try {
    const complianceRequest: ComplianceRequest = await req.json();

    // Validate input
    if (
      !complianceRequest.content ||
      !complianceRequest.brand_id ||
      !complianceRequest.content_id
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    // Run compliance check
    let score = await validateContent(complianceRequest);

    // Handle auto-revision
    let finalContent = complianceRequest.content;
    let revisionAttempt = complianceRequest.retry_attempt || 0;

    while (
      score.verdict === "needs_revision" &&
      revisionAttempt < 3
    ) {
      revisionAttempt++;

      // Generate revised content
      finalContent = await autoReviseContent(
        {
          ...complianceRequest,
          content: finalContent,
        },
        score
      );

      // Re-run compliance check
      score = await validateContent({
        ...complianceRequest,
        content: finalContent,
        retry_attempt: revisionAttempt,
      });
    }

    // Store quality score
    await supabase.from("quality_scores").insert({
      content_id: complianceRequest.content_id,
      brand_id: complianceRequest.brand_id,
      campaign_id: complianceRequest.campaign_id,
      compliance_score: score.final_score,
      layer1_score: score.layer1_forbidden_words,
      layer2_score: score.layer2_tone_alignment,
      layer3_score: score.layer3_length_compliance,
      layer4_score: score.layer4_brand_consistency,
      constraint_penalties: score.constraint_penalties,
      verdict: score.verdict,
      revision_attempts: revisionAttempt,
      created_at: new Date().toISOString(),
    });

    // Update content item
    await supabase
      .from("content_items")
      .update({
        compliance_status: score.verdict,
        compliance_score: score.final_score,
        content: finalContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", complianceRequest.content_id);

    return new Response(
      JSON.stringify({
        success: true,
        content_id: complianceRequest.content_id,
        final_score: score.final_score,
        verdict: score.verdict,
        revised_content: finalContent,
        revision_attempts: revisionAttempt,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Compliance Engine Error:", error);
    return new Response(
      JSON.stringify({
        error: "Compliance check failed",
        details: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

### Function Deployment

**Deploy to Supabase**:
```bash
supabase functions deploy compliance-engine \
  --project-id your_project_id
```

**Set Environment Variables**:
```bash
supabase secrets set \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  CLAUDE_API_KEY="sk-ant-..."
```

---

## Heuristic Report System

The **Heuristic Report System** generates intelligent, strategic 100-word analyses of each piece of generated content, providing contextual insights about brand alignment, campaign effectiveness, and strategic value.

### Purpose and Vision

The Heuristic Report is a **second-level intelligence layer** that goes beyond compliance scoring to provide human-readable, strategic context. While the MasterCompliance Engine ensures content meets baseline standards, the Heuristic Report offers editorial insights that help marketers understand WHY content scores well and HOW it serves the broader campaign strategy.

### Report Structure

**Standard Heuristic Report Format**:
```
[Content-Specific Insight]
[Brand DNA Alignment Assessment]
[Campaign Scope Analysis]
[CTA Effectiveness Evaluation]
[Strategic Recommendation/Insight]
[Conhecimentos da Atualidade Reference (if applicable)]

Total: ~100 words
```

### Generation Parameters

The Heuristic Report is generated based on:

1. **Brand DNA Alignment**
   - How well does the content reflect the brand's core values?
   - Are mandatory terms used naturally?
   - Does it match the specified tone and energy?

2. **Campaign Scope & Objectives**
   - Does content address the campaign's stated goals?
   - Is it positioned for the right audience segment?
   - Does it contribute meaningfully to the campaign narrative?

3. **CTA Effectiveness**
   - Is the call-to-action compelling and clear?
   - Does it match the campaign's desired conversion path?
   - Is the CTA positioned naturally within the content?

4. **Conhecimentos da Atualidade** (Current Knowledge/Zeitgeist)
   - Does the content reflect current trends or timely insights?
   - Is it relevant to ongoing conversations in the industry?
   - Does it demonstrate thought leadership or currency?

5. **Content Performance Predictors**
   - Estimated engagement potential
   - Audience resonance indicators
   - Competitive positioning

### Example Heuristic Reports

#### Example 1: LinkedIn Professional Services Post

**Content**: "Our innovative solutions empower customer-centric organizations to transform their digital operations. We combine AI-driven analytics with strategic consulting to unlock unprecedented value. Discover how leading brands achieve 3x faster implementation. Learn more at [link]. #Innovation #DigitalTransformation #Solutions"

**Heuristic Report**:
```
This content strongly aligns with professional brand positioning through strategic use of "innovative" 
and "customer-centric"—core brand pillars. The specific metric (3x faster implementation) grounds 
the promise in measurable outcomes, enhancing credibility. The CTA ("Learn more") is appropriately 
positioned for LinkedIn's B2B audience, inviting further engagement without aggressive selling. 
Hashtag selection (#Innovation, #DigitalTransformation) targets decision-makers actively exploring 
transformation strategies, positioning the brand within industry zeitgeist conversations. This content 
demonstrates thought leadership while clearly guiding prospects toward consideration.
```

#### Example 2: Instagram Product Announcement

**Content**: "Meet our latest innovation: SmartFlow. Designed for teams who demand more from their tools. Beautifully simple. Powerfully effective. Swipe up to get exclusive early-access pricing. #Innovation #ProductLaunch #Solutions"

**Heuristic Report**:
```
This announcement balances enthusiasm with brand professionalism, leveraging poetic language 
("beautifully simple") without sacrificing clarity. Mandatory terms ("innovation," "product") appear 
naturally within the narrative. The CTA ("Swipe up") is platform-native and audience-appropriate 
for Instagram's fast-paced environment. By offering "exclusive early-access pricing," the content 
creates urgency and reward mechanisms that drive both immediate action and brand loyalty. The post 
positions SmartFlow within current market conversations around efficiency and user experience, 
reflecting broader digital tool trends. Strategic hashtag selection (#ProductLaunch) amplifies 
visibility among early-adopters and tech enthusiasts.
```

#### Example 3: Twitter Product Update

**Content**: "Just shipped a major upgrade to SmartFlow analytics. Real-time dashboards. Predictive insights. 50% faster query performance. Transform how your team works. Get started free: [link] #Innovation #Solutions"

**Heuristic Report**:
```
This update efficiently communicates three compelling benefits (speed, insight, performance) in 
a platform-optimized format. The concrete metric (50% faster) establishes competitive differentiation 
and builds confidence. Language maintains professional brand voice while remaining energetic—
appropriate for Twitter's real-time announcement culture. The CTA ("Get started free") removes 
friction barriers, appealing to exploration-minded audiences. Hashtags (#Innovation, #Solutions) 
ensure visibility among product enthusiasts and decision-makers tracking SaaS developments. This 
content reflects current zeitgeist around performance optimization and data democratization, positioning 
the brand as progress-oriented and customer-responsive.
```

### Data Storage

Heuristic Reports are stored in the `content_items` table within the `extra_fields` JSON column:

```json
{
  "id": "content_789",
  "campaign_id": "campaign_456",
  "brand_id": "brand_123",
  "content": "Our innovative solutions...",
  "compliance_status": "approved",
  "compliance_score": 87,
  "extra_fields": {
    "heuristic_report": "This content strongly aligns with professional brand positioning through strategic use of 'innovative' and 'customer-centric'—core brand pillars. The specific metric (3x faster implementation) grounds the promise in measurable outcomes, enhancing credibility. The CTA ('Learn more') is appropriately positioned for LinkedIn's B2B audience, inviting further engagement without aggressive selling. Hashtag selection (#Innovation, #DigitalTransformation) targets decision-makers actively exploring transformation strategies, positioning the brand within industry zeitgeist conversations. This content demonstrates thought leadership while clearly guiding prospects toward consideration.",
    "heuristic_generated_at": "2026-02-28T14:32:10Z",
    "heuristic_model": "claude-opus-4-6"
  }
}
```

### Generation Frequency

- **Timing**: Heuristic Reports are generated **after** MasterCompliance Engine approves or needs-revision content
- **Automatic**: Generated automatically via Edge Function trigger
- **Conditional**: Only for content with `compliance_status` = "approved" or "needs_revision"
- **Caching**: Reports are cached and not regenerated unless content is revised

---

## Edge Function: Heuristic Report

The **Heuristic Report Edge Function** (`heuristic-report/index.ts`) uses Claude's language capabilities to generate strategic, human-readable analyses of approved content.

### Function: `heuristic-report/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Claude API
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY")!;

interface HeuristicRequest {
  content_id: string;
  brand_id: string;
  campaign_id: string;
  content: string;
  content_type: string;
}

interface BrandDNA {
  name: string;
  tone_parameters: Record<string, unknown>;
  mandatory_terms: string[];
  editorial_pillars: string[];
}

// Retrieve brand DNA
async function getBrandDNA(brandId: string): Promise<BrandDNA> {
  const { data } = await supabase
    .from("brands")
    .select("name, brand_dna")
    .eq("id", brandId)
    .single();

  return {
    name: data.name,
    tone_parameters: data.brand_dna.tone_parameters,
    mandatory_terms: data.brand_dna.mandatory_terms,
    editorial_pillars: data.brand_dna.editorial_pillars,
  };
}

// Retrieve campaign details
async function getCampaignDetails(campaignId: string) {
  const { data } = await supabase
    .from("campaigns")
    .select(
      "name, objectives, target_audience, target_behavior"
    )
    .eq("id", campaignId)
    .single();

  return data;
}

// Generate heuristic report using Claude
async function generateHeuristicReport(
  brandDNA: BrandDNA,
  campaign: any,
  content: string,
  contentType: string
): Promise<string> {
  const prompt = `You are a strategic brand analyst and content strategist. Your task is to generate a brief, insightful 100-word heuristic analysis of the following social media content.

BRAND CONTEXT:
Brand Name: ${brandDNA.name}
Tone Parameters: ${JSON.stringify(brandDNA.tone_parameters)}
Mandatory Terms: ${brandDNA.mandatory_terms.join(", ")}
Editorial Pillars: ${brandDNA.editorial_pillars.join(", ")}

CAMPAIGN CONTEXT:
Campaign Name: ${campaign.name}
Objectives: ${campaign.objectives}
Target Audience: ${campaign.target_audience}
Target Behavior: ${campaign.target_behavior}

CONTENT TO ANALYZE:
Platform/Type: ${contentType}
Content: "${content}"

ANALYSIS REQUIREMENTS:
Generate a ~100-word strategic analysis covering:
1. Brand DNA alignment (how well does it reflect brand identity?)
2. Campaign effectiveness (how well does it serve campaign objectives?)
3. CTA assessment (is the call-to-action effective?)
4. Zeitgeist relevance (does it connect to current trends/conversations?)
5. Strategic recommendation or key insight

Write in a professional, analytical tone. Focus on WHY this content works strategically, not just THAT it meets compliance. Be specific with examples from the content.

HEURISTIC REPORT:`;

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();
  const reportText = data.content[0].text.trim();

  // Trim to ~100 words
  const words = reportText.split(/\s+/);
  const trimmedReport = words.slice(0, 100).join(" ");
  return trimmedReport + (words.length > 100 ? "..." : "");
}

// Main handler
serve(async (req) => {
  try {
    const heuristicRequest: HeuristicRequest = await req.json();

    // Validate input
    if (
      !heuristicRequest.content ||
      !heuristicRequest.brand_id ||
      !heuristicRequest.campaign_id ||
      !heuristicRequest.content_id
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    // Retrieve brand DNA and campaign
    const brandDNA = await getBrandDNA(heuristicRequest.brand_id);
    const campaign = await getCampaignDetails(
      heuristicRequest.campaign_id
    );

    // Generate heuristic report
    const report = await generateHeuristicReport(
      brandDNA,
      campaign,
      heuristicRequest.content,
      heuristicRequest.content_type
    );

    // Store report in extra_fields
    const { data: contentItem } = await supabase
      .from("content_items")
      .select("extra_fields")
      .eq("id", heuristicRequest.content_id)
      .single();

    const extraFields = contentItem?.extra_fields || {};
    extraFields.heuristic_report = report;
    extraFields.heuristic_generated_at = new Date().toISOString();
    extraFields.heuristic_model = "claude-opus-4-6";

    await supabase
      .from("content_items")
      .update({
        extra_fields: extraFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", heuristicRequest.content_id);

    return new Response(
      JSON.stringify({
        success: true,
        content_id: heuristicRequest.content_id,
        heuristic_report: report,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Heuristic Report Error:", error);
    return new Response(
      JSON.stringify({
        error: "Heuristic report generation failed",
        details: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

### Function Deployment

```bash
supabase functions deploy heuristic-report \
  --project-id your_project_id
```

### Trigger Configuration

The Heuristic Report generation is triggered via a database webhook when compliance status changes:

**Webhook Configuration** (in Supabase Dashboard):
- **Table**: `content_items`
- **Event**: UPDATE
- **HTTP Method**: POST
- **URL**: `https://your-project.supabase.co/functions/v1/heuristic-report`
- **Headers**: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

---

## Quality Scores Integration

The **Quality Scores Table** captures all compliance and strategic metrics for each piece of content, enabling performance tracking and historical analysis.

### Database Schema: `quality_scores`

```sql
CREATE TABLE quality_scores (
  id SERIAL PRIMARY KEY,
  content_id UUID NOT NULL UNIQUE,
  brand_id UUID NOT NULL,
  campaign_id UUID NOT NULL,
  compliance_score INT CHECK (compliance_score >= 0 AND compliance_score <= 100),
  layer1_score INT CHECK (layer1_score >= 0 AND layer1_score <= 25),
  layer2_score INT CHECK (layer2_score >= 0 AND layer2_score <= 25),
  layer3_score INT CHECK (layer3_score >= 0 AND layer3_score <= 25),
  layer4_score INT CHECK (layer4_score >= 0 AND layer4_score <= 25),
  constraint_penalties INT,
  verdict VARCHAR(20) CHECK (verdict IN ('approved', 'needs_revision', 'rejected')),
  revision_attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_id) REFERENCES content_items(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

### Example Quality Score Records

#### High-Scoring Content (Approved)

```json
{
  "id": 1,
  "content_id": "content_001",
  "brand_id": "brand_123",
  "campaign_id": "campaign_456",
  "compliance_score": 91,
  "layer1_score": 25,
  "layer2_score": 25,
  "layer3_score": 25,
  "layer4_score": 16,
  "constraint_penalties": 0,
  "verdict": "approved",
  "revision_attempts": 0,
  "created_at": "2026-02-28T10:00:00Z"
}
```

#### Mid-Range Content (Needed Revision)

```json
{
  "id": 2,
  "content_id": "content_002",
  "brand_id": "brand_123",
  "campaign_id": "campaign_456",
  "compliance_score": 68,
  "layer1_score": 25,
  "layer2_score": 18,
  "layer3_score": 25,
  "layer4_score": 20,
  "constraint_penalties": -20,
  "verdict": "needs_revision",
  "revision_attempts": 1,
  "created_at": "2026-02-28T11:00:00Z"
}
```

#### Low-Scoring Content (Rejected)

```json
{
  "id": 3,
  "content_id": "content_003",
  "brand_id": "brand_123",
  "campaign_id": "campaign_456",
  "compliance_score": 35,
  "layer1_score": 0,
  "layer2_score": 15,
  "layer3_score": 20,
  "layer4_score": 10,
  "constraint_penalties": -30,
  "verdict": "rejected",
  "revision_attempts": 3,
  "created_at": "2026-02-28T12:00:00Z"
}
```

### Querying Quality Scores

**Get Scores for a Campaign**:
```sql
SELECT 
  qs.compliance_score,
  qs.verdict,
  COUNT(*) as count
FROM quality_scores qs
WHERE campaign_id = 'campaign_456'
GROUP BY qs.verdict
ORDER BY qs.compliance_score DESC;
```

**Get Average Scores by Brand**:
```sql
SELECT 
  brand_id,
  AVG(compliance_score) as avg_score,
  AVG(layer1_score) as avg_layer1,
  AVG(layer2_score) as avg_layer2,
  AVG(layer3_score) as avg_layer3,
  AVG(layer4_score) as avg_layer4
FROM quality_scores
GROUP BY brand_id
ORDER BY avg_score DESC;
```

**Get Approval Rate by Brand**:
```sql
SELECT 
  brand_id,
  ROUND(100.0 * SUM(CASE WHEN verdict = 'approved' THEN 1 ELSE 0 END) / COUNT(*), 2) as approval_rate
FROM quality_scores
GROUP BY brand_id;
```

---

## Integration with Content Factory

The **Content Factory** is the main dashboard interface where users generate, review, and schedule content. The MasterCompliance Engine and Heuristic Report System are deeply integrated into this workflow.

### Content DataTable Display

The Content Factory displays all generated content in a sortable, filterable DataTable with compliance information prominently featured.

#### DataTable Columns

| Column | Data Source | Display Format |
|--------|-------------|----------------|
| Content | `content_items.content` | Text preview (truncated) |
| Compliance Score | `quality_scores.compliance_score` | Color-coded badge |
| Verdict | `quality_scores.verdict` | Status badge |
| Campaign | `campaigns.name` | Text link |
| Created | `content_items.created_at` | Relative timestamp |
| Actions | | Dropdown menu |

#### Compliance Score Color Coding

```
Score ≥ 75 (APPROVED)      → Green (#10B981)
Score 40-74 (NEEDS_REVISION) → Yellow (#F59E0B)
Score < 40 (REJECTED)        → Red (#EF4444)
```

### Viewing Heuristic Reports

The Heuristic Report is accessible via an "Expressive Modal" interface:

**Trigger**: Click "View Report" button in the DataTable row action menu

**Modal Layout**:
```
┌─────────────────────────────────────────┐
│ Heuristic Report - [Content Title]      │ ← Header
│ Generated: [date] | Model: Claude       │
├─────────────────────────────────────────┤
│                                         │
│ [Scrollable Content Area]               │
│ This content strongly aligns with       │
│ professional brand positioning...       │
│                                         │
│ [~100 words of analysis]                │
│                                         │
├─────────────────────────────────────────┤
│ [Close Button]      [Copy Report Button]│
└─────────────────────────────────────────┘
```

**Modal Features**:
- Full heuristic report text (100 words)
- Scrollable if content exceeds viewport
- Copy-to-clipboard functionality
- Metadata: generation date, model used
- Related compliance score visible in header

### Workflow Integration

**Typical User Journey**:

```
1. User Generates Content via AI Prompt
   ↓
2. System Submits to compliance-engine/index.ts
   ↓
3. MasterCompliance Engine Runs (Layers 1-4 + Constraints)
   ↓
4. Score Calculated:
   ├─ If ≥ 75 → APPROVED
   ├─ If 40-74 → Auto-revise (up to 3 times)
   └─ If < 40 → REJECTED
   ↓
5. Quality Score Stored in quality_scores Table
   ↓
6. Content Item Updated with:
   ├─ compliance_status
   ├─ compliance_score
   └─ revised_content (if applicable)
   ↓
7. Heuristic Report Generated (if approved/needs_revision)
   ↓
8. Content Appears in DataTable with:
   ├─ Green/Yellow/Red badge
   ├─ Score display
   ├─ "View Report" action button
   └─ Schedule/Edit/Delete actions
   ↓
9. User Views Report via Modal
   ↓
10. User Approves and Schedules Content
    ↓
11. Content Moves to Publishing Queue
```

### Compliance Status Flow Visualization

```
AI-Generated Content
    ↓
[MasterCompliance Engine]
    ├─ Forbidden Words Check
    ├─ Tone Alignment Check
    ├─ Length Compliance Check
    ├─ Brand Consistency Check
    └─ Constraint Validation
    ↓
Score = 0-100
    ↓
    ├─ ≥75 → APPROVED (green badge)
    │          Generate Heuristic Report
    │          Ready for scheduling
    │
    ├─ 40-74 → NEEDS_REVISION (yellow badge)
    │           Auto-revise up to 3 times
    │           If improves ≥75 → APPROVED
    │           If stuck <40 → REJECTED
    │
    └─ <40 → REJECTED (red badge)
             Log failure
             Not schedulable
```

### Content Factory UI Components

#### Compliance Badge Component

```typescript
// React component example
interface ComplianceBadgeProps {
  score: number;
  verdict: "approved" | "needs_revision" | "rejected";
}

export function ComplianceBadge({ score, verdict }: ComplianceBadgeProps) {
  const colorMap = {
    approved: "bg-green-100 text-green-800",
    needs_revision: "bg-yellow-100 text-yellow-800",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${colorMap[verdict]}`}>
      {score}/100 - {verdict.replace("_", " ")}
    </div>
  );
}
```

#### Heuristic Report Modal Component

```typescript
// React component example
interface HeuristicModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: string;
  contentId: string;
  generatedAt: string;
}

export function HeuristicModal({
  isOpen,
  onClose,
  report,
  contentId,
  generatedAt,
}: HeuristicModalProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(report);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Heuristic Report</DialogTitle>
          <p className="text-sm text-gray-500">
            Generated: {new Date(generatedAt).toLocaleDateString()} | Model: Claude Opus 4.6
          </p>
        </DialogHeader>
        <div className="py-4">
          <p className="text-base leading-relaxed">{report}</p>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
          <Button onClick={handleCopy}>
            Copy Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### API Endpoints for Content Factory

#### Get Content with Compliance Scores

```
GET /api/content?campaign_id={id}&limit=50&offset=0

Response:
{
  "data": [
    {
      "id": "content_001",
      "content": "Our innovative solutions...",
      "compliance_score": 87,
      "verdict": "approved",
      "campaign_id": "campaign_456",
      "created_at": "2026-02-28T10:00:00Z",
      "extra_fields": {
        "heuristic_report": "This content strongly aligns..."
      }
    }
  ],
  "total": 150
}
```

#### Get Single Content with Full Details

```
GET /api/content/{id}

Response:
{
  "id": "content_001",
  "content": "Our innovative solutions...",
  "compliance_score": 87,
  "layer_scores": {
    "layer1": 25,
    "layer2": 25,
    "layer3": 25,
    "layer4": 12
  },
  "constraints": 0,
  "verdict": "approved",
  "heuristic_report": "This content strongly aligns...",
  "revision_attempts": 0
}
```

#### Filter by Compliance Verdict

```
GET /api/content?campaign_id={id}&verdict=approved

GET /api/content?campaign_id={id}&verdict=needs_revision

GET /api/content?campaign_id={id}&verdict=rejected
```

---

## Summary

The **MasterCompliance Engine & Heuristic Report System** represents genOS™'s commitment to automated, intelligent content governance. Through four rigorous validation layers, strategic constraint enforcement, and intelligent auto-revision capabilities, the system ensures that only brand-aligned, compliant content reaches publication. The Heuristic Report System adds a layer of strategic insight, enabling marketers to understand not just whether content passes compliance, but WHY it serves their broader campaign objectives.

### Key Achievements:

✓ **Zero Manual Approval Bottlenecks**: Fully automated compliance validation and revision  
✓ **Objective Scoring**: 0-100 scale eliminates subjective approval decisions  
✓ **Intelligent Iteration**: Auto-revision improves content without human intervention  
✓ **Strategic Context**: Heuristic Reports provide human-readable insights  
✓ **Integration-Ready**: Seamlessly embedded in Content Factory workflow  
✓ **Data-Driven Insights**: Quality scores enable performance analytics and trend identification  

---

*Documento #7 de 10*

**Version 2.0.0 | Last Updated: 2026-02-28**