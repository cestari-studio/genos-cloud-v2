# genOS Lumina v1.0.0

**AI-powered content operating system for Cestari Studio**

genOS Lumina is a full-stack content management platform that orchestrates AI content generation, brand compliance validation, CSV-based sync pipelines, and a client feedback loop — all designed for the Cestari Studio workflow.

## Architecture

```
UI (Carbon Design)  →  Express API  →  Supabase (PostgreSQL + RLS)
                                    →  AI Router (Gemini / Claude / Local)
                                    →  CSV Watcher (bidirectional sync)
                                    →  Wix CMS (webhooks)
```

## Core Features

**Content Factory** — Generate content via AI with automatic compliance scoring. Supports single generation, batch generation (up to 20 items), and manual creation. Every piece of content passes through the 4-layer MasterCompliance engine.

**MasterCompliance Engine** — 4-layer validation system (0-100 score):
- Forbidden Words (0-25): Checks against banned terms from compliance rules
- Tone Alignment (0-25): Validates energy level, CTA presence, brand voice
- Length Compliance (0-25): Per-content-type character limits from Brand DNA
- Brand Consistency (0-25): Measures use of brand vocabulary and terms

**AI Router** — Multi-provider routing with automatic fallback:
- Google Gemini for bulk content (social posts, reels, stories)
- Anthropic Claude for strategic content (blog articles, campaigns)
- Local mock generator as always-available fallback

**Agent Envelope** — Assembles context-rich system prompts from Brand DNA, compliance rules, and system prompts for consistent AI outputs.

**CSV Sync Pipeline** — Bidirectional sync between local CSV files and Supabase. File watcher detects changes and auto-syncs. 9 registered collections: accounts, briefs, content, contracts, devops, portal, status, topics, users.

**Client Feedback Loop** — Webhook-based feedback from clients. Automatic AI-powered revision when clients request changes. Tracks revision count and client ratings.

**Dashboard** — Real-time overview with content stats, compliance scores, AI session tracking, recent activity, and quick actions.

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your Supabase and AI API keys

# Start development server
npx ts-node server/index.ts

# Open in browser
open http://localhost:3001
```

## Project Structure

```
genOS-Full/
├── server/
│   ├── index.ts              # Express server + dashboard routes
│   ├── routes/
│   │   ├── content.ts        # Content CRUD with search/filter
│   │   ├── ai.ts             # AI generation + batch + compliance
│   │   ├── sync.ts           # CSV sync pipeline
│   │   └── webhooks.ts       # Wix + feedback webhooks
│   └── services/
│       ├── supabaseClient.ts # Supabase client + tenant resolver
│       ├── aiRouter.ts       # Multi-provider AI routing
│       ├── agentEnvelope.ts  # System prompt assembly
│       ├── masterCompliance.ts # 4-layer compliance engine
│       ├── feedbackLoop.ts   # Client feedback processor
│       └── csvWatcher.ts     # File watcher + sync engine
├── ui/
│   ├── index.html            # Dashboard
│   ├── factory.html          # Content Factory
│   ├── csv-browser.html      # CSV Collection Browser
│   ├── brand-dna.html        # Brand DNA Editor
│   ├── settings.html         # System Settings
│   ├── css/carbon.css        # Carbon Design System theme
│   └── js/
│       ├── app.js            # Shared utilities
│       ├── dashboard.js      # Dashboard logic
│       └── factory.js        # Content Factory logic
├── projects/cestari-studio/  # CSV files (auto-synced)
├── API.md                    # API Reference
└── README.md                 # This file
```

## Database (Supabase)

21 migrations applied. Key tables:
- `tenants` — Multi-tenant with RLS
- `brand_dna` — Brand voice, colors, content types, pillars
- `content_items` — All content with compliance scores
- `ai_sessions` — AI generation logs (tokens, cost, provider)
- `compliance_rules` — Configurable compliance rules
- `system_prompts` — Reusable AI system prompts
- `csv_registry` — CSV collection registration
- `csv_rows` — Synced CSV data
- `feedback_queue` — Client feedback pipeline
- `activity_log` — System activity audit trail

## Environment Variables

```
SUPABASE_URL=https://qyfjkvwlpgjlpveqnkax.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
TENANT_SLUG=cestari-studio
GEMINI_API_KEY=...        # Google AI Studio
ANTHROPIC_API_KEY=...     # Anthropic Claude
PORT=3001
```

## Tech Stack

Express.js + TypeScript, Supabase (PostgreSQL), Carbon Design System, Google Gemini API, Anthropic Claude API, Chokidar (file watching).

---

**Cestari Studio** — Future-proof brands through AI orchestration.
