# genOS Cloud Platform v5.0 🚀

> **AI-powered Content & Brand Operations System**  
> Developed by **Cestari Studio** × **Antigravity**

genOS v5.0 is a state-of-the-art, multi-tenant SaaS platform that orchestrates brand identity, content generation, and audience engagement through a hybrid AI and Quantum computing architecture. Built on a serverless Edge Function methodology, genOS completely automates the lifecycle of digital agencies and SaaS enterprises.

---

## 🌟 Key Features (v5.0)

- **Automated SaaS Onboarding**: Zero-touch tenant provisioning. New users are guided through an interactive `OnboardingWizard` that extracts brand requirements, generates a full **Brand DNA**, provisions wallets with pre-paid AI credits, and signs SLAs automatically via Wix Auth Bridge.
- **Quantum Heuristics Engine (QHE)**: A predictive AI routing system using **Qiskit** and **FastAPI**. It leverages Variational Quantum Circuits (VQC) to calculate constructive interference algorithms for maximum content engagement and retention.
- **Decision Fusion Layer (DFL)**: Seamlessly merges classical LLM scoring (Google Gemini 2.0 / Anthropic Claude) with QHE probabilistic predictions for bullet-proof content auditing.
- **Content Factory UI**: Implemented via IBM's **Carbon Design System**, offering a distraction-free, terminal-inspired dark mode interface for massive and rapid semantic mapping and post generation.
- **Universal Analytics & Topology**: Real-time observability using standard D3/Carbon charts reflecting real API latency, token consumption, and edge function statuses.

## 🏗️ Technical Architecture

genOS is fully Headless & Serverless.

```
UI (React 18 + Vite) 
  → Supabase (PostgreSQL + RLS + JWT Auth)
    → Edge Functions (Deno / TypeScript)
      → AI Router (Gemini 2.0 Flash / Pro)
      → QHE (Python + Qiskit v2.2)
  → Wix Velo (Auth bridging & Provisioning)
```

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js (v20+)
- Python (v3.9+)
- Docker (OrbStack recommended for macOS)
- Supabase CLI (`npx supabase-cli`)
- Vercel CLI (`npm i -g vercel`)

### 2. Install & Start UI Layer
```bash
# Clone the repository
git clone https://github.com/cestaristudio/genos-cloud-v2.git
cd genos-cloud-v2

# Install frontend dependencies
cd ui-react
npm install

# Start Vite 6.0 Dev Server
npm run dev
```

### 3. Start Supabase (Backend/Database)
```bash
# From the project root
npx supabase start

# To deploy Edge Functions locally
npx supabase functions serve
```

### 4. Start Quantum Engine (QHE)
```bash
# From the project root
cd quantum-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt # (or fastApi, qiskit, pydantic, uvicorn)
python3 main.py
```
*The QHE will start at `http://localhost:8000/score`*

---

## 🔑 Environment Variables

The platform requires several environment configurations. Make sure to define them in your `.env` (UI), `.env.local` (Vercel), and in Supabase Vault:
```env
# Frontend (ui-react/.env)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GENOS_API_URL=your_edge_functions_url

# Supabase Edge Functions Secrets
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
BRIDGE_SECRET=...
QHE_API_URL=https://your-qhe-app.herokuapp.com
```

---

## 🛡️ License & Trademarks

- **genOS™** and **Content Factory™** are trademarks of **Cestari Studio**.
- **Carbon Design System** is licensed under Apache 2.0 by IBM.
- **Qiskit** is provided by the IBM Quantum community.

© 2026 Cestari Studio. All rights reserved. Do not distribute or copy without explicit authorization.

---
## 💡 Support

For internal support, architectural documents, and onboarding, please refer to `/docs` or contact the core maintainers via the Cestari Studio Slack workspace.
