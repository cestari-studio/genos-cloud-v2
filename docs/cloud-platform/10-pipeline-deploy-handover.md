# genOS™ Cloud Platform — Super Prompt #10

## Deployment Pipeline & Handover Documentation

**Version:** 2.0.0
**Date:** 2026-02-28
**Owner:** Octavio Cestari (ocestari89@gmail.com)
**Studio:** Cestari Studio
**Supabase Project:** qyfjkvwlpgjlpveqnkax
**Wix Site:** 405fddff-d534-419d-9201-4ae5436eccc4

---

## Table of Contents

1. [Deploy Pipeline Overview](#deploy-pipeline-overview)
2. [Vercel Deployment](#vercel-deployment)
3. [Supabase Edge Functions Deployment](#supabase-edge-functions-deployment)
4. [Database Migrations](#database-migrations)
5. [CI/CD Pipeline with GitHub Actions](#cicd-pipeline-with-github-actions)
6. [Environment Setup from Scratch](#environment-setup-from-scratch)
7. [Handover Checklist](#handover-checklist)
8. [Monitoring Post-Deploy](#monitoring-post-deploy)
9. [Rollback Procedures](#rollback-procedures)
10. [Contact & Ownership](#contact--ownership)

---

## Deploy Pipeline Overview

The genOS™ Cloud Platform uses a two-target deployment strategy:

- **Frontend:** Vercel (next-generation serverless platform)
- **Backend:** Supabase Edge Functions (Deno-based serverless runtime)
- **Database:** Supabase PostgreSQL with automatic migrations

### Deployment Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│          (main branch: production, PR: preview)              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─ Git Webhook
                     │
        ┌────────────┴─────────────┐
        │                          │
        v                          v
    ┌─────────────┐          ┌──────────────────┐
    │   Vercel    │          │ GitHub Actions   │
    │ (Frontend)  │          │    (CI/CD)       │
    └─────────────┘          └────────┬─────────┘
                                      │
                         ┌────────────┼────────────┐
                         │            │            │
                         v            v            v
                    ┌─────────┐ ┌──────────┐ ┌─────────┐
                    │ Type    │ │  Lint    │ │ Deploy  │
                    │ Check   │ │  & Test  │ │ Supabase│
                    └─────────┘ └──────────┘ └─────────┘
                                                    │
                                                    v
                                          ┌──────────────────┐
                                          │ Supabase         │
                                          │ • Migrations     │
                                          │ • Edge Functions │
                                          │ • Database       │
                                          └──────────────────┘
```

### Deployment Targets

| Target | Platform | Type | URL |
|--------|----------|------|-----|
| Frontend | Vercel | Next.js App | genos.cestaristudio.com |
| Backend Functions | Supabase | Edge Functions | supabase.co/functions |
| Database | Supabase PostgreSQL | SQL Database | supabase.co/database |

---

## Vercel Deployment

### Overview

Vercel provides automated Git-based deployments with zero-downtime updates. Every push to the main branch triggers an automatic build and deployment.

### Git-Based Auto-Deploy

**How It Works:**

1. Push code to `main` branch on GitHub
2. GitHub sends webhook to Vercel
3. Vercel automatically:
   - Clones the repository
   - Installs dependencies
   - Runs the build command
   - Tests the build output
   - Deploys to production

**No manual steps required after code push.**

### Build Configuration

#### Build Command

```bash
cd console && npm run build
```

This command:
- Changes to the `console` directory (React/TypeScript frontend)
- Runs the build script defined in `console/package.json`
- Compiles TypeScript to JavaScript
- Optimizes assets for production
- Generates static HTML, CSS, and JavaScript

#### Output Directory

```
console/dist
```

Vercel serves all files from this directory. The structure is:

```
console/dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ... (other assets)
├── favicon.svg
└── ... (other static files)
```

### Environment Variables in Vercel

Vercel Dashboard → Project Settings → Environment Variables

**Configure these variables:**

| Variable | Value | Type |
|----------|-------|------|
| `VITE_SUPABASE_URL` | https://qyfjkvwlpgjlpveqnkax.supabase.co | Public |
| `VITE_SUPABASE_ANON_KEY` | (Supabase anon key) | Public |
| `VITE_WIX_OAUTH_CLIENT_ID` | (Wix app client ID) | Public |
| `VITE_WIX_OAUTH_REDIRECT_URI` | https://genos.cestaristudio.com/auth/callback | Public |
| `VITE_API_BASE_URL` | https://qyfjkvwlpgjlpveqnkax.supabase.co/functions/v1 | Public |

**Steps to Configure in Vercel:**

1. Log in to Vercel Dashboard (vercel.com)
2. Select the genOS project
3. Click "Settings" → "Environment Variables"
4. Click "Add New"
5. Enter Variable Name and Value
6. Select "Production" (or all environments)
7. Click "Save"
8. Redeploy the project for changes to take effect

### Preview Deployments for Pull Requests

Vercel automatically creates preview deployments for every pull request:

- **Automatic:** Each PR gets a unique preview URL
- **URL Format:** `https://<project-slug>-git-<branch-name>-[team].vercel.app`
- **Status Checks:** Vercel adds a status check to the PR (shows as "vercel/preview")
- **Duration:** Preview URL stays active while PR is open, deleted when PR is closed
- **Environment:** Uses the same environment variables as production (configurable)

**Preview Deployment URLs are listed in:**
- GitHub PR comment (Vercel bot comment)
- Vercel Dashboard → Deployments tab
- Direct access without authentication

### Custom Domain Setup (genos.cestaristudio.com)

**In Vercel Dashboard:**

1. Project Settings → Domains
2. Click "Add" or "Add Domain"
3. Enter domain: `genos.cestaristudio.com`
4. Choose from:
   - Use Vercel's nameservers (recommended)
   - Add DNS records to your domain registrar

**If using external DNS (e.g., Namecheap, Route53):**

Vercel provides CNAME records to add:

```
cname.vercel-dns.com.
```

Add DNS record:
- Type: CNAME
- Name: genos
- Value: cname.vercel-dns.com
- TTL: 3600

**Verify Domain:**

1. Vercel sends an email to verify domain ownership
2. Click verification link
3. Domain becomes active within a few minutes
4. SSL certificate auto-provisioned

**Test Connection:**

```bash
# Test DNS propagation
nslookup genos.cestaristudio.com

# Test HTTPS (should show valid certificate)
curl -I https://genos.cestaristudio.com
```

### Force Redeploy

If you need to rebuild without code changes:

**Vercel Dashboard → Deployments → Click deployment → Redeploy**

Or use Vercel CLI:

```bash
npm install -g vercel
vercel --prod
```

### Deployment Logs

**View logs in Vercel Dashboard:**

1. Deployments tab
2. Click on the deployment
3. "Build Logs" shows the build process
4. "Runtime Logs" shows errors from the running application

**Search for errors:**
- Look for "error" or "failed" in build logs
- Check "Function" logs if Edge Function calls fail

### Rollback to Previous Deployment

**Vercel Dashboard → Deployments:**

1. Find the previous working deployment
2. Click on it
3. Click "Redeploy"
4. Vercel rebuilds and deploys that version

**This does NOT revert code in GitHub** — it rebuilds the old commit.

---

## Supabase Edge Functions Deployment

### Overview

Edge Functions are TypeScript/JavaScript functions that run on Supabase's Deno runtime, located globally close to users for ultra-low latency.

### Prerequisites

**Install Supabase CLI:**

```bash
# macOS with Homebrew
brew install supabase/tap/supabase

# Linux (using npm)
npm install -g supabase

# Verify installation
supabase --version
```

**Login to Supabase:**

```bash
supabase login
```

This opens browser to authenticate and generate an access token.

### Deploying Individual Functions

**Command Structure:**

```bash
supabase functions deploy <function-name> \
  --project-id qyfjkvwlpgjlpveqnkax \
  --region us-east-1
```

**Example — Deploy content-generate function:**

```bash
supabase functions deploy content-generate \
  --project-id qyfjkvwlpgjlpveqnkax \
  --region us-east-1
```

**Output:**

```
Deploying function 'content-generate'...
✓ Successfully deployed function 'content-generate'
Function URL: https://qyfjkvwlpgjlpveqnkax.supabase.co/functions/v1/content-generate
```

### Deploying All Functions at Once

**Deploy all functions in the project:**

```bash
supabase functions deploy \
  --project-id qyfjkvwlpgjlpveqnkax
```

This automatically deploys all functions found in `supabase/functions/` directory.

**Functions in genOS™ Platform:**

1. `content-generate` — Calls Gemini API to generate content
2. `content-analyze` — Analyzes content using AI
3. `webhook-handler` — Receives Wix webhooks
4. `auth-callback` — OAuth callback handler
5. Additional utility functions as defined in `supabase/functions/`

### Function Structure

**File Organization:**

```
supabase/functions/
├── content-generate/
│   └── index.ts
├── content-analyze/
│   └── index.ts
├── webhook-handler/
│   └── index.ts
└── auth-callback/
    └── index.ts
```

**Minimal Function Template (TypeScript):**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    })
  }

  // Function logic
  const { input } = await req.json()

  const result = await processInput(input)

  return new Response(
    JSON.stringify(result),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

### Environment Variables (Secrets)

Edge Functions cannot access `.env` files. Use Supabase Secrets instead.

**Set Secrets:**

```bash
# Set single secret
supabase secrets set GEMINI_API_KEY=sk-...

# Set multiple secrets
supabase secrets set \
  GEMINI_API_KEY=sk-... \
  WIX_API_KEY=... \
  SLACK_WEBHOOK_URL=...
```

**Verify Secrets:**

```bash
supabase secrets list
```

**Use Secrets in Functions:**

```typescript
const geminiApiKey = Deno.env.get("GEMINI_API_KEY")
```

**Secrets Required for genOS™ Functions:**

| Secret | Purpose | Where to Get |
|--------|---------|--------------|
| `GEMINI_API_KEY` | Google Gemini API access | Google AI Studio (ai.google.dev) |
| `WIX_API_KEY` | Wix platform API (deprecated) | Wix Dashboard (if using) |
| `SUPABASE_ANON_KEY` | Supabase client key for function-to-DB calls | Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (use carefully) | Supabase Settings → API |

**Rotate Secrets (Rolling Update):**

```bash
# Set new secret without affecting old deployments
supabase secrets set GEMINI_API_KEY=sk-new-key

# Old deployments continue to work
# New deployments use new key

# After verification, delete old secret
supabase secrets delete GEMINI_API_KEY_OLD
```

### Accessing Edge Functions

**Public HTTP Endpoint:**

```
https://qyfjkvwlpgjlpveqnkax.supabase.co/functions/v1/<function-name>
```

**Example Call (from Frontend):**

```typescript
const response = await fetch(
  'https://qyfjkvwlpgjlpveqnkax.supabase.co/functions/v1/content-generate',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAuthToken}`, // Optional, for authenticated functions
    },
    body: JSON.stringify({ topic: 'AI in Business' })
  }
)

const data = await response.json()
```

### Function Logs and Monitoring

**View Function Logs:**

```bash
supabase functions list
supabase functions logs <function-name> \
  --project-id qyfjkvwlpgjlpveqnkax \
  --limit 50
```

**In Supabase Dashboard:**

1. Project Settings → Functions
2. Select a function
3. View execution logs, errors, and latency metrics

### Debugging Functions Locally

**Run Functions Locally:**

```bash
supabase start
supabase functions serve
```

This starts a local Supabase instance and runs functions on `localhost:54321/functions/v1/`.

**Test Locally:**

```bash
curl -X POST http://localhost:54321/functions/v1/content-generate \
  -H "Content-Type: application/json" \
  -d '{"topic": "Test Topic"}'
```

### Cold Starts and Performance

**Cold Start Behavior:**
- First invocation: ~1-2 seconds (Deno runtime startup)
- Subsequent invocations: ~100-300ms (warm container)

**Optimization Tips:**
1. Keep dependencies minimal
2. Import only used modules
3. Cache expensive operations
4. Use connection pooling for databases

---

## Database Migrations

### Overview

Supabase manages database schema changes through migration files. Migrations are version-controlled SQL scripts that transform the database schema.

### Migration File Structure

**Location:** `supabase/migrations/` (or `supabase/sql/migrations/`)

**Naming Convention:**

```
<timestamp>_<descriptive_name>.sql
```

**Examples:**

```
20260101120000_core_tenants.sql
20260101120100_content_items.sql
20260101120200_add_rls_policies.sql
20260101120300_create_activity_log.sql
```

**Timestamp Format:** `YYYYMMDDhhmmss` (sortable, unique)

### Example Migration Files

**001 — Core Tables (tenants, users, roles):**

```sql
-- supabase/migrations/20260101120000_core_tenants.sql

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  wix_site_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX idx_tenants_wix_site_id ON public.tenants(wix_site_id);
CREATE INDEX idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
```

**002 — Content Tables:**

```sql
-- supabase/migrations/20260101120100_content_items.sql

CREATE TABLE IF NOT EXISTS public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(content_id, version_number)
);

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_content_items_tenant_id ON public.content_items(tenant_id);
CREATE INDEX idx_content_items_status ON public.content_items(status);
CREATE INDEX idx_content_versions_content_id ON public.content_versions(content_id);
```

**003 — RLS Policies:**

```sql
-- supabase/migrations/20260101120200_add_rls_policies.sql

-- RLS Policy: Tenants table
CREATE POLICY "Users can view their own tenant"
  ON public.tenants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_id = tenants.id
      AND user_id = auth.uid()
    )
  );

-- RLS Policy: Content items
CREATE POLICY "Users can view content in their tenant"
  ON public.content_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_id = content_items.tenant_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert content"
  ON public.content_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_id = content_items.tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );
```

**004 — Activity Log:**

```sql
-- supabase/migrations/20260101120300_create_activity_log.sql

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_activity_log_tenant_id ON public.activity_log(tenant_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at);

-- Trigger to auto-log content updates
CREATE OR REPLACE FUNCTION public.log_content_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_log (
    tenant_id, user_id, action, resource_type, resource_id, details
  ) VALUES (
    NEW.tenant_id,
    auth.uid(),
    TG_OP,
    'content_item',
    NEW.id,
    jsonb_build_object('old', OLD, 'new', NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER content_change_trigger
  AFTER INSERT OR UPDATE ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_content_changes();
```

### Applying Migrations

**Push Migrations to Database:**

```bash
supabase db push --project-id qyfjkvwlpgjlpveqnkax
```

**What happens:**
1. Supabase CLI reads all migration files in `supabase/migrations/`
2. Compares with migrations already applied to the database
3. Runs only new, unapplied migrations
4. Updates the `schema_migrations` table

**Verify Migrations Applied:**

```bash
supabase migration list --project-id qyfjkvwlpgjlpveqnkax
```

**Output:**

```
ID                              Local name
20260101120000_core_tenants     20260101120000_core_tenants
20260101120100_content_items    20260101120100_content_items
20260101120200_add_rls_policies 20260101120200_add_rls_policies
20260101120300_create_activity_log 20260101120300_create_activity_log
```

### Creating New Migrations

**Generate Migration File:**

```bash
supabase migration new <name>
```

**Example:**

```bash
supabase migration new add_ai_generation_table
```

Creates: `supabase/migrations/20260228143022_add_ai_generation_table.sql`

**Edit the migration file and add SQL:**

```sql
CREATE TABLE IF NOT EXISTS public.ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.content_items(id),
  prompt TEXT NOT NULL,
  output TEXT NOT NULL,
  model TEXT,
  tokens_used INTEGER,
  cost DECIMAL(10, 4),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ai_generations_content_id ON public.ai_generations(content_id);
```

**Apply the migration:**

```bash
supabase db push
```

### Rollback Strategy

**Option 1 — Revert Last Migration:**

```bash
supabase db reset
```

This destroys the entire database and re-applies all migrations from scratch. Use only in development.

**Option 2 — Create a Rollback Migration:**

Instead of deleting migrations, create a new migration that undoes changes:

```bash
supabase migration new drop_ai_generations_table
```

**Migration file:**

```sql
-- Revert: add_ai_generation_table

DROP TABLE IF EXISTS public.ai_generations CASCADE;
```

**Then apply:**

```bash
supabase db push
```

**Option 3 — In Supabase Dashboard (SQL Editor):**

1. Supabase Dashboard → SQL Editor
2. Drop tables manually (risky!)
3. Delete migration records from `schema_migrations` (not recommended)

**Best Practice:** Always create rollback migrations. Never delete migration files once applied to production.

### Migration Testing

**Test Migrations Locally:**

```bash
# Start local Supabase instance
supabase start

# Apply migrations to local instance
supabase db push

# Run tests
npm test

# View database
psql postgres://postgres:postgres@localhost:54322/postgres
```

---

## CI/CD Pipeline with GitHub Actions

### Overview

GitHub Actions automates testing, building, and deploying on every code push and pull request.

### Workflow Files

**Location:** `.github/workflows/`

### Production Deployment Workflow

**File:** `.github/workflows/deploy-prod.yml`

```yaml
name: Deploy Production

on:
  push:
    branches:
      - main

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      # Frontend Deployment
      - name: Build frontend
        run: cd console && npm run build

      - name: Deploy to Vercel
        uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          production: true

      # Backend Deployment
      - name: Setup Supabase CLI
        run: npm install -g supabase

      - name: Deploy Edge Functions
        run: |
          supabase functions deploy \
            --project-id ${{ secrets.SUPABASE_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Apply Database Migrations
        run: |
          supabase db push \
            --project-id ${{ secrets.SUPABASE_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Set Edge Function Secrets
        run: |
          supabase secrets set \
            GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }} \
            --project-id ${{ secrets.SUPABASE_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### Pull Request Preview Workflow

**File:** `.github/workflows/preview-pr.yml`

```yaml
name: Preview Deployment

on:
  pull_request:
    branches:
      - main

jobs:
  preview:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Build frontend
        run: cd console && npm run build

      - name: Deploy preview to Vercel
        uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### Secrets Required in GitHub Actions

| Secret | Value | Where to Get |
|--------|-------|--------------|
| `VERCEL_TOKEN` | Vercel API token | Vercel Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel organization ID | Vercel Dashboard → Settings |
| `VERCEL_PROJECT_ID` | Vercel project ID | Vercel Project Settings |
| `SUPABASE_PROJECT_ID` | qyfjkvwlpgjlpveqnkax | Supabase Dashboard → Settings |
| `SUPABASE_ACCESS_TOKEN` | Supabase access token | Supabase Account Settings |
| `GEMINI_API_KEY` | Google Gemini API key | Google AI Studio (ai.google.dev) |

**Add Secrets to GitHub:**

1. Repository → Settings → Secrets and Variables → Actions
2. Click "New repository secret"
3. Enter Name and Value
4. Click "Add secret"

### Workflow Triggers

**On Push to Main:**
- Runs production deployment workflow
- Builds frontend, backend, applies migrations
- Deploys to Vercel and Supabase

**On Pull Request:**
- Runs type-check, lint, build
- Deploys preview version to Vercel
- Adds status check to PR

**Manual Trigger (if configured):**

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'production'
```

Trigger from GitHub Actions tab → Select workflow → "Run workflow"

### Monitoring Workflow Execution

**In GitHub:**

1. Repository → Actions
2. Select workflow run
3. View job logs
4. Click job name to expand logs

**Common Issues:**

| Issue | Cause | Fix |
|-------|-------|-----|
| `VERCEL_TOKEN not found` | Secret not set | Add to GitHub Secrets |
| `npm: not found` | Node.js not installed | Add `actions/setup-node@v3` step |
| `supabase: command not found` | CLI not installed | Add `npm install -g supabase` step |
| `Build failed: Port 3000 in use` | Cleanup issue | Add cleanup step in workflow |

---

## Environment Setup from Scratch

### Complete Step-by-Step Guide

Follow this guide to rebuild the entire genOS™ Platform from scratch.

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/genOS-cloud-platform.git
cd genOS-cloud-platform
```

### Step 2: Install Dependencies

```bash
# Install root dependencies
npm install

# Install console (frontend) dependencies
cd console && npm install && cd ..

# Install supabase CLI (for migrations and functions)
npm install -g supabase
```

**Verify installations:**

```bash
node --version          # Should be v18+
npm --version           # Should be v9+
supabase --version      # Should be v1.100+
```

### Step 3: Setup Environment Variables

**Create `.env` file in root:**

```bash
cp .env.example .env
```

**Edit `.env` with your values:**

```bash
# Supabase
VITE_SUPABASE_URL=https://qyfjkvwlpgjlpveqnkax.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Wix OAuth
VITE_WIX_OAUTH_CLIENT_ID=your-wix-client-id
VITE_WIX_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback

# API
VITE_API_BASE_URL=http://localhost:54321/functions/v1

# Gemini (for Edge Functions)
GEMINI_API_KEY=sk-...
```

**Find these values:**

- **Supabase URL & Keys:** Supabase Dashboard → Settings → API → Project URL and Keys
- **Wix OAuth:** Wix Dev Dashboard → OAuth Apps → Copy Client ID
- **Gemini API Key:** Google AI Studio (ai.google.dev) → Create New API Key

### Step 4: Create/Use Supabase Project

**Option A: Use Existing Project**

The existing project is already configured: `qyfjkvwlpgjlpveqnkax`

Login to Supabase:

```bash
supabase login
```

Link to existing project:

```bash
supabase link --project-ref qyfjkvwlpgjlpveqnkax
```

**Option B: Create New Supabase Project**

1. Go to supabase.com
2. Sign in (or create account)
3. Click "New Project"
4. Enter project name: `genOS-Cloud-Platform`
5. Set database password (save this!)
6. Choose region: `US East` (or closest to you)
7. Click "Create new project"
8. Wait for initialization (~2 minutes)
9. Copy project URL and API keys

**In terminal:**

```bash
supabase link --project-ref <your-new-project-id>
```

### Step 5: Run Migrations

**Apply all database migrations:**

```bash
supabase db push
```

**Verify migrations applied:**

```bash
supabase migration list
```

**Expected tables after migrations:**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

Should show:
- `tenants`
- `tenant_users`
- `content_items`
- `content_versions`
- `activity_log`
- (and any others defined in migrations)

### Step 6: Deploy Edge Functions

**Verify functions exist:**

```bash
ls supabase/functions/
```

**Set secrets for Edge Functions:**

```bash
supabase secrets set GEMINI_API_KEY=sk-your-actual-key
```

**Deploy all functions:**

```bash
supabase functions deploy
```

**Verify deployment:**

```bash
supabase functions list
```

Should show:
- `content-generate`
- `content-analyze`
- `webhook-handler`
- `auth-callback`
- (and any other functions)

### Step 7: Deploy Frontend to Vercel

**Option A: Already Linked to Vercel**

Push code to GitHub:

```bash
git add .
git commit -m "Deploy genOS Platform"
git push origin main
```

Vercel auto-deploys (via GitHub webhook).

**Option B: New Vercel Project**

1. Go to vercel.com
2. Click "Add New" → "Project"
3. Import GitHub repository
4. Set build command: `cd console && npm run build`
5. Set output directory: `console/dist`
6. Add environment variables (see [Vercel Deployment](#vercel-deployment))
7. Click "Deploy"

**Verify deployment:**

```bash
# Should show the deploy URL
vercel --prod
```

### Step 8: Configure Wix OAuth

**Get OAuth Credentials:**

1. Wix Dev Dashboard → OAuth & Permissions → OAuth Apps
2. Click "Create New App"
3. Name: "genOS Content Platform"
4. Redirect URI: `https://genos.cestaristudio.com/auth/callback` (or your frontend URL)
5. Copy Client ID and Client Secret

**Store in environment variables:**

In `.env`:
```
VITE_WIX_OAUTH_CLIENT_ID=your-client-id
WIX_OAUTH_CLIENT_SECRET=your-client-secret
```

In Vercel → Project Settings → Environment Variables:
```
VITE_WIX_OAUTH_CLIENT_ID=your-client-id
```

In Supabase Edge Function secrets:
```bash
supabase secrets set WIX_OAUTH_CLIENT_SECRET=your-client-secret
```

### Step 9: Test Login Flow

**Start local development server:**

```bash
npm run dev
```

Opens on `http://localhost:3000`

**Test OAuth login:**

1. Click "Login with Wix"
2. Redirects to Wix login
3. Authorize application
4. Redirects back to `http://localhost:3000/auth/callback`
5. Should see dashboard if authentication succeeds

**Troubleshoot login:**

- Check console logs (`F12` → Console)
- Verify `.env` variables are correct
- Check Supabase Edge Function logs: `supabase functions logs auth-callback`
- Check activity_log table for errors: SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10

### Step 10: Test Content Generation

**In Frontend:**

1. Login as authenticated user
2. Click "Create Content"
3. Enter topic (e.g., "AI in Business")
4. Click "Generate with AI"
5. Should see generated content within 5-10 seconds

**Troubleshoot generation:**

- Check Edge Function logs: `supabase functions logs content-generate`
- Verify `GEMINI_API_KEY` is set correctly
- Check Google Gemini API quota (ai.google.dev → Quota)
- Check content_items table: SELECT * FROM content_items ORDER BY created_at DESC LIMIT 5

---

## Handover Checklist

Use this checklist to verify the platform is production-ready before handoff.

### Documentation Checklist

- [ ] Document 1: Architecture & Features (`01-architecture-features.md`)
- [ ] Document 2: Technology Stack (`02-tech-stack.md`)
- [ ] Document 3: Frontend Setup (`03-frontend-setup.md`)
- [ ] Document 4: Backend Edge Functions (`04-backend-edge-functions.md`)
- [ ] Document 5: Database Schema (`05-database-schema.md`)
- [ ] Document 6: Authentication & OAuth (`06-authentication-oauth.md`)
- [ ] Document 7: API Integration & Webhooks (`07-api-integration-webhooks.md`)
- [ ] Document 8: AI Content Generation (`08-ai-content-generation.md`)
- [ ] Document 9: Deployment Environments (`09-deployment-environments.md`)
- [ ] Document 10: Pipeline & Handover (this file)

### Environment Setup Checklist

- [ ] Git repository cloned
- [ ] Node.js v18+ installed
- [ ] npm dependencies installed (`npm install`)
- [ ] `.env` file created and populated
- [ ] Supabase project linked (`supabase link`)
- [ ] Supabase CLI v1.100+ installed

### Database Setup Checklist

- [ ] All migrations applied (`supabase db push`)
- [ ] Tables verified in Supabase Dashboard:
  - [ ] `tenants`
  - [ ] `tenant_users`
  - [ ] `content_items`
  - [ ] `content_versions`
  - [ ] `activity_log`
- [ ] Row Level Security (RLS) enabled on all tables
- [ ] Indexes created for performance

### Backend Deployment Checklist

- [ ] All Edge Functions deployed:
  - [ ] `content-generate`
  - [ ] `content-analyze`
  - [ ] `webhook-handler`
  - [ ] `auth-callback`
- [ ] All secrets configured:
  - [ ] `GEMINI_API_KEY` set
  - [ ] `SUPABASE_ANON_KEY` set (if needed)
- [ ] Functions tested locally and in production
- [ ] Function logs accessible and clean

### Frontend Deployment Checklist

- [ ] Console frontend builds successfully (`cd console && npm run build`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Vercel project created and linked
- [ ] Environment variables configured in Vercel:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] `VITE_WIX_OAUTH_CLIENT_ID`
  - [ ] `VITE_WIX_OAUTH_REDIRECT_URI`
  - [ ] `VITE_API_BASE_URL`
- [ ] Custom domain configured (genos.cestaristudio.com)
- [ ] SSL certificate auto-provisioned
- [ ] Frontend accessible at production URL

### Authentication Checklist

- [ ] Wix OAuth app created
- [ ] Client ID and redirect URI configured
- [ ] OAuth callback function deployed and tested
- [ ] Login flow works end-to-end:
  - [ ] User clicks "Login"
  - [ ] Redirects to Wix login
  - [ ] User authorizes
  - [ ] Redirects back to dashboard
  - [ ] Session created in auth table
- [ ] Logout flow works:
  - [ ] User session destroyed
  - [ ] Redirected to login page
- [ ] Permission-based access control working:
  - [ ] Owners can invite users
  - [ ] Users can only see their tenant data

### Content Generation Checklist

- [ ] Gemini API key set and valid
- [ ] Content generation function deployed
- [ ] Test content generation:
  - [ ] Enter topic: "AI in Business"
  - [ ] Click "Generate"
  - [ ] Content appears within 10 seconds
  - [ ] Content saved to `content_items` table
- [ ] Multiple content generations work without errors
- [ ] Activity log records all generation events

### Monitoring Checklist

- [ ] Supabase Dashboard accessible
- [ ] Database monitoring active
- [ ] Edge Function logs visible
- [ ] Vercel Dashboard accessible
- [ ] Frontend deployment logs visible
- [ ] Activity log table populated with user actions
- [ ] Error tracking configured (optional: Sentry, Bugsnag)

### Backup & Disaster Recovery Checklist

- [ ] Database backups enabled in Supabase
- [ ] GitHub repository is source of truth
- [ ] `.env` values backed up securely
- [ ] API keys backed up in secure location
- [ ] Rollback procedure documented and tested
- [ ] Incident response plan documented

---

## Monitoring Post-Deploy

### Supabase Dashboard Monitoring

**Access Dashboard:**

1. supabase.com → Dashboard
2. Select project: `qyfjkvwlpgjlpveqnkax`
3. Monitor sections:

| Section | What to Monitor |
|---------|-----------------|
| **Database** | Table sizes, storage usage, query performance |
| **Auth** | User sign-ups, active sessions, failed logins |
| **Logs** | Error messages, slow queries, function errors |
| **Realtime** | Active subscriptions, broadcast messages |
| **Edge Functions** | Execution count, latency, error rate |

**Key Metrics:**

- Database size (should not exceed quota)
- Query response time (should be <100ms)
- Function execution time (should be <2s)
- Error rate (should be <1%)

### Vercel Dashboard Monitoring

**Access Dashboard:**

1. vercel.com → Projects
2. Select project: `genOS-Cloud-Platform`
3. Monitor:

| Section | What to Monitor |
|---------|-----------------|
| **Deployments** | Latest deployment status, build time |
| **Analytics** | Page views, Core Web Vitals, response times |
| **Functions** | Edge Function execution, latency |
| **Logs** | Runtime errors, build errors |

**Performance Budgets:**

- First Contentful Paint (FCP): < 1.5s
- Largest Contentful Paint (LCP): < 2.5s
- Cumulative Layout Shift (CLS): < 0.1

### Activity Log Monitoring

**View Recent Activities:**

```sql
SELECT
  timestamp,
  user_id,
  action,
  resource_type,
  details
FROM public.activity_log
ORDER BY created_at DESC
LIMIT 50;
```

**Common Actions:**

| Action | Meaning | Alert If |
|--------|---------|----------|
| `LOGIN` | User logged in | Unusual times or IPs |
| `CONTENT_CREATE` | New content created | None (expected) |
| `CONTENT_UPDATE` | Content modified | Multiple rapid updates |
| `CONTENT_DELETE` | Content deleted | Unexpected deletions |
| `USER_INVITE` | User invited to tenant | None (expected) |

**Alert Thresholds:**

- Failed login attempts > 5 in 1 hour → Potential attack
- Unusual data access patterns → Investigate
- Bulk content deletions → Manual verification

### Automated Monitoring Setup

**Option 1: Supabase Email Alerts**

1. Supabase Dashboard → Notifications
2. Set up email alerts for:
   - High storage usage
   - High error rate
   - Database connection issues

**Option 2: GitHub Actions Monitoring Workflow**

Create `.github/workflows/monitor.yml`:

```yaml
name: Monitor Production

on:
  schedule:
    - cron: '0 * * * *'  # Every hour

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Check Supabase Health
        run: |
          curl https://qyfjkvwlpgjlpveqnkax.supabase.co/auth/v1/health

      - name: Check Vercel Health
        run: |
          curl https://genos.cestaristudio.com

      - name: Alert on Failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Rollback Procedures

### Frontend Rollback (Vercel)

**Identify Broken Deployment:**

1. Vercel Dashboard → Deployments
2. Identify the failed deployment
3. Check build logs for errors

**Rollback to Previous Version:**

**Option A: Use Vercel Dashboard**

1. Deployments tab
2. Find the last known-good deployment
3. Click on it
4. Click "Promote to Production"

OR click three dots → "Set as Production"

**Option B: Revert Git Commit**

```bash
# View recent commits
git log --oneline | head -10

# Revert the bad commit
git revert <commit-hash>

# Push (automatically triggers Vercel redeploy)
git push origin main
```

**Verify Rollback:**

1. Visit https://genos.cestaristudio.com
2. Check that previous version is running
3. Test login flow and content generation
4. Monitor Vercel logs for errors

**Typical Rollback Time:** 2-5 minutes (Vercel rebuilds)

### Backend Rollback (Supabase Edge Functions)

**Identify Broken Function:**

1. Supabase Dashboard → Functions
2. Check logs for errors
3. Identify which function failed

**Rollback Edge Function Code:**

**Option A: Redeploy Previous Version**

```bash
# View git history
git log --oneline supabase/functions/content-generate/

# Checkout previous version
git checkout <commit-hash> -- supabase/functions/content-generate/

# Redeploy
supabase functions deploy content-generate \
  --project-id qyfjkvwlpgjlpveqnkax
```

**Option B: Update Locally and Redeploy**

1. Edit function code in `supabase/functions/<function>/index.ts`
2. Test locally: `supabase functions serve`
3. Deploy: `supabase functions deploy <function-name>`

**Verify Rollback:**

```bash
# View function logs
supabase functions logs content-generate \
  --project-id qyfjkvwlpgjlpveqnkax \
  --limit 20

# Test function
curl -X POST https://qyfjkvwlpgjlpveqnkax.supabase.co/functions/v1/content-generate \
  -H "Content-Type: application/json" \
  -d '{"topic": "Test"}'
```

**Typical Rollback Time:** 1-3 minutes (function redeploy)

### Database Rollback

**Identify Problem:**

1. View recent migrations: `supabase migration list`
2. Check activity_log for unusual changes
3. Query database: `supabase sql <query>`

**Rollback Strategy:**

**Option A: Create Rollback Migration**

```bash
# Create new migration
supabase migration new revert_broken_changes

# Edit migration file to undo changes
# Example: DROP TABLE IF EXISTS new_table;
# Or: ALTER TABLE users DROP COLUMN IF EXISTS new_column;

# Apply rollback
supabase db push
```

**Option B: Restore from Backup**

1. Supabase Dashboard → Backups
2. View available restore points
3. Click "Restore" on desired point
4. Confirm restoration
5. Choose restore mode:
   - In-place (overwrite current database)
   - New database (restore to new instance, then swap)

**Typical Restore Time:** 5-30 minutes (depends on database size)

**Option C: Point-in-Time Recovery (PITR)**

For recent mistakes (within 7 days for free tier):

1. Supabase Dashboard → Backups → Point-in-Time Recovery
2. Select timestamp to restore to
3. Choose database to restore to
4. Confirm and wait

**Verify Rollback:**

```sql
-- Verify table structure
\d <table_name>

-- Verify data
SELECT COUNT(*) FROM <table_name>;

-- Check activity log
SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10;
```

### Secrets & Environment Variables Rollback

**If You Accidentally Exposed a Secret:**

1. **Revoke the secret immediately:**
   - Gemini: Create new API key, delete old one
   - Wix: Rotate OAuth secret
   - Database: Contact Supabase support

2. **Update all references:**
   ```bash
   supabase secrets set GEMINI_API_KEY=sk-new-key
   ```

3. **Verify update applied:**
   ```bash
   supabase secrets list
   ```

4. **Redeploy functions using new secrets:**
   ```bash
   supabase functions deploy content-generate
   ```

### Rollback Coordination

**Team Communication:**

1. Declare incident in team Slack/channel
2. Post incident summary (what broke, when, impact)
3. Assign rollback lead
4. Execute rollback steps
5. Verify functionality restored
6. Post all-clear message
7. Schedule post-mortem (discuss root cause)

**Incident Response Checklist:**

- [ ] Incident declared (when, what, severity)
- [ ] Stakeholders notified
- [ ] Rollback lead assigned
- [ ] Affected users identified
- [ ] Rollback executed
- [ ] Verification passed
- [ ] Users notified of resolution
- [ ] Root cause documented
- [ ] Follow-up actions assigned

---

## Contact & Ownership

### Project Owner

| Role | Name | Email | Timezone |
|------|------|-------|----------|
| Owner | Octavio Cestari | ocestari89@gmail.com | EST (UTC-5) |

### Organization

| Item | Value |
|------|-------|
| Studio Name | Cestari Studio |
| Website | cestaristudio.com |
| GitHub Org | (if applicable) |

### Deployment Credentials

| Service | Project ID | Region | Link |
|---------|-----------|--------|------|
| Supabase | qyfjkvwlpgjlpveqnkax | us-east-1 | supabase.com/projects/qyfjkvwlpgjlpveqnkax |
| Vercel | (in Vercel Dashboard) | Global | vercel.com |
| GitHub | genOS-cloud-platform | N/A | github.com/... |

### Domain Information

| Domain | Owner | Registrar | Renewal |
|--------|-------|-----------|---------|
| genos.cestaristudio.com | Octavio Cestari | (your registrar) | (renewal date) |

### Key Contacts

**For Technical Issues:**
- Octavio Cestari: ocestari89@gmail.com

**For Wix Integration:**
- Wix Account: (your Wix account email)
- Site ID: 405fddff-d534-419d-9201-4ae5436eccc4

**For Support:**

- Supabase Support: support@supabase.io
- Vercel Support: support@vercel.com
- GitHub Support: support@github.com

### Handover Sign-Off

This document certifies that the genOS™ Cloud Platform has been properly documented and is ready for handover to the team.

**Documented By:** Octavio Cestari
**Date:** 2026-02-28
**Version:** 2.0.0

**Checklist:**
- [ ] All 10 Super Prompts documented
- [ ] Deployment pipeline tested end-to-end
- [ ] All services deployed and verified
- [ ] Team trained on deployment procedures
- [ ] Incident response plan documented
- [ ] Backup and disaster recovery tested
- [ ] Contact information verified

**Approval Signatures:**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Owner | Octavio Cestari | 2026-02-28 | __________________ |
| (Add team members as needed) | | | |

---

## Appendix: Quick Reference

### Commands Cheat Sheet

**Frontend Development:**
```bash
npm run dev              # Start dev server (localhost:3000)
npm run build           # Build for production
npm run preview         # Preview production build locally
npm run type-check      # Check TypeScript
npm run lint            # Run linter
```

**Backend Development:**
```bash
supabase start          # Start local Supabase
supabase functions serve # Start functions server
supabase db push        # Apply migrations
supabase functions deploy <name> # Deploy function
```

**Deployment:**
```bash
git push origin main              # Trigger auto-deploy
supabase db push --project-id ... # Apply migrations to prod
supabase functions deploy --project-id ... # Deploy to prod
vercel --prod                      # Deploy to Vercel
```

### Useful URLs

| Service | URL |
|---------|-----|
| Frontend | https://genos.cestaristudio.com |
| Supabase Dashboard | https://supabase.com/projects/qyfjkvwlpgjlpveqnkax |
| Vercel Dashboard | https://vercel.com |
| GitHub Repository | (your repo URL) |
| Wix Developer | https://www.wix.com/apps/build |

### File Structure Reference

```
genOS-cloud-platform/
├── console/                    # Frontend (React/TypeScript)
│   ├── src/
│   ├── dist/                  # Build output (deployed to Vercel)
│   ├── package.json
│   └── vite.config.ts
├── supabase/
│   ├── functions/             # Edge Functions
│   │   ├── content-generate/
│   │   ├── content-analyze/
│   │   └── ...
│   ├── migrations/            # Database migrations
│   │   ├── 001_core_tenants.sql
│   │   ├── 002_content_items.sql
│   │   └── ...
│   └── config.toml
├── .github/
│   └── workflows/             # CI/CD pipelines
│       ├── deploy-prod.yml
│       └── preview-pr.yml
├── docs/
│   └── cloud-platform/        # Documentation
│       ├── 01-architecture-features.md
│       ├── 02-tech-stack.md
│       └── ... (10 docs total)
├── .env.example               # Environment variable template
├── package.json               # Root dependencies
└── README.md                  # Project README
```

---

*Documento #10 de 10 — Documentação Completa do genOS™ Cloud Platform.*
