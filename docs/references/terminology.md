# genOS Glossary — Complete Terminology Reference

## Core Concepts

| Term | Definition |
|------|-----------|
| **genOS Full** | The multi-tenant content automation platform built by Cestari Studio. Current version: v1.0.0 "Lumina" |
| **genOS Content Factory** | The Google Sheets predecessor — officially called "genOS Content Factory — Google Spreadsheet Edition". NEVER confuse with genOS Full |
| **REGRA ZERO** | Non-negotiable rule: every DB query, API response, and AI generation MUST be scoped to `user_id + tenant_id + role`. Zero exceptions |
| **Lumina** | Codename for genOS Full v1.0.0 — the MVP operational release |
| **Cestari Studio** | The agency that builds and operates genOS. Founded by Octavio |

## Architecture Terms

| Term | Definition |
|------|-----------|
| **Hybrid Architecture** | Supabase Cloud (auth/config/audit) + Local Node.js (CSV/Wix/AI) running together |
| **Source of Truth** | During local phase: CSV files. During production: Supabase. Wix is always a mirror |
| **Dual-Write** | Every data operation writes simultaneously to CSV + Supabase + Wix. Ensures zero-migration to production |
| **Three-Way Sync** | The consistency model: CSV ↔ Supabase ↔ Wix CMS |
| **Drift** | When CSV and Supabase data are out of sync. Detected by hash comparison. Resolved by consistency-check |
| **csv_wins strategy** | During local phase, CSV is authoritative when resolving drift |

## Content Pipeline Terms

| Term | Definition |
|------|-----------|
| **Content Factory** | Main UI module for AI-assisted content generation |
| **Content Item** | Any piece of content in the system (blog, social post, trip, newsletter, etc.) |
| **MasterCompliance** | 4-layer validation engine scoring content 0-100. ALWAYS spelled this way — never "MasterComplience" |
| **Agent Envelope** | Required JSON payload for every AI call: `{ user_id, tenant_id, role, brand_dna, system_prompt, compliance_rules, permissions, plan_limits }` |
| **Brand DNA** | Per-tenant personality config: voice_tone, language, forbidden_words, hashtags, persona_name |
| **Brand DNA Override** | Local JSON file that merges ON TOP of cloud values for quick testing. Priority: defaults < cloud < local override |
| **System Prompt** | Template stored in `system_prompts` table, used to instruct AI per content type |
| **Prompt Lab** | UI workspace for editing, testing, and versioning prompts |

## CSV & Sync Terms

| Term | Definition |
|------|-----------|
| **CSV Engine** | PapaParse-based service for reading/writing/validating CSV files |
| **CSV Registry** | Supabase table (`csv_registry`) that indexes all CSV files per tenant |
| **CSV Slug** | Kebab-case identifier for a CSV (e.g., `blog-posts`, `trips`). Unique per tenant |
| **CSV Category** | Classification: `content` (syncs to Wix), `feedback` (from Wix), `insights` (local only), `operations` (varies) |
| **Dependency Graph** | Rules defining cascade effects between CSVs. E.g., trip published → generates blog post |
| **Dependency Engine** | Service that resolves which CSVs to update when another changes |
| **Wix Bridge** | Service that syncs CSV ↔ Wix Data API bidirectionally |
| **Sync Direction** | Per CSV: `to_wix`, `from_wix`, `bidirectional`, `local_only` |
| **Field Mapping** | JSON config mapping CSV columns to Wix CMS field names |

## Feedback Terms

| Term | Definition |
|------|-----------|
| **Feedback Loop** | Full cycle: Wix webhook → classify → AI revise → CSV update → sync back to Wix |
| **_genOS_status** | Wix dropdown field: `Pendente`, `Aprovado`, `Precisa Revisão`, `Rejeitado` |
| **_genOS_comment** | Free text field where client leaves revision notes |
| **_genOS_rating** | Client satisfaction score (1-5) per content item |
| **_genOS_* fields** | Suite of hidden metadata fields added to every Wix CMS collection |
| **Feedback Queue** | Supabase table processing incoming feedback events |
| **Processing Status** | Feedback lifecycle: `pending` → `processing` → `applied` / `escalated` / `failed` |

## AI Terms

| Term | Definition |
|------|-----------|
| **AI Router** | Service that selects the right AI provider based on task type, priority, and complexity |
| **Gemini** | Google's AI (Gemini 2.0 Flash) — used for bulk generation, high-volume tasks |
| **Claude** | Anthropic's AI (Agent SDK V2) — used for orchestration, strategic content, complex revisions |
| **Apple Intelligence** | Local AI on macOS — used for lightweight local tasks (future) |
| **Fallback Chain** | If primary provider fails: Gemini → Claude → Apple Intelligence |
| **Revision Prompt** | Structured prompt built for content revision including brand DNA, original content, and client feedback |

## RBAC Terms

| Term | Definition |
|------|-----------|
| **sys_admin** | Platform-wide superuser. Cestari Studio only |
| **agency_admin** | Manages multiple tenants. Can set overrides and preferences |
| **tenant_admin** | Owns a single tenant. Full config control |
| **tenant_editor** | Creates and edits content. No config access |
| **tenant_viewer** | Read-only access |
| **RLS** | Row Level Security — PostgreSQL feature enforcing tenant isolation automatically |

## Infrastructure Terms

| Term | Definition |
|------|-----------|
| **Supabase** | Cloud backend: PostgreSQL DB, Auth, RLS, Realtime, Storage |
| **Express.js** | Local Node.js server running on localhost:3001 |
| **Vite** | Frontend dev server running on localhost:3000 |
| **Chokidar** | File watcher monitoring `/projects/*/content/*.csv` for changes |
| **ngrok** | Tunnel service exposing local server for Wix webhooks |
| **Carbon Design System** | IBM's design system used exclusively for all genOS UI. v11, g100 (dark) theme |
| **IBM Plex Sans/Mono** | Typography: Plex Sans for UI, Plex Mono for code |

## Versioning

| Version | Codename | Focus |
|---------|----------|-------|
| v1.0.0 | Lumina | MVP: Content Factory, CSV Engine, Wix Bridge, Feedback Loop, Brand DNA Editor |
| v1.1.0 | Aether | Intelligence: Prompt Lab, Self-Improvement, Analytics, Apple Intelligence |
| v1.2.0 | Nexus | Multi-team: Roles UI, Activity Log, Audit, Marketplace v1 |
| v2.0.0 | Quantum | Full Platform: Vercel deploy, Client dashboard, Stripe, watsonx |
