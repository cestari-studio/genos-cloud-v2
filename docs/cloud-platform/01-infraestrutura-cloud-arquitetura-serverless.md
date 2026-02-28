# genOS™ Cloud Platform — Super Prompt #1
# Infraestrutura Cloud & Arquitetura Serverless

**Versão:** 2.0.0
**Data:** 2026-02-28
**Autor:** Cestari Studio
**Status:** Documento de Referência para Reconstrução Total

---

## 1. VISÃO GERAL DA PLATAFORMA

### 1.1 Identidade

O **genOS™ Cloud Platform** é uma plataforma cloud modular de automação de conteúdo com inteligência artificial, projetada para agências criativas que operam em modelo multi-tenant. A plataforma é propriedade do **Cestari Studio** (fundador: Octavio Cestari, designer, não-programador).

**Evolução:** O projeto nasceu como "genOS Lumina v1.0.0" — uma aplicação monolítica Express.js + React + Vite com sincronização CSV bidirecional. A reestruturação para Cloud Platform adota uma arquitetura modular serverless, onde cada funcionalidade é isolada como um "App" independente dentro de um ecossistema unificado.

### 1.2 Proposta de Valor

- **Para a Agência (Cestari Studio):** Painel de controle centralizado ("Console") para gerenciar todos os clientes, suas Brand DNAs, geração de conteúdo por IA, compliance e billing.
- **Para os Clientes (Tenants):** Acesso a uma "Workstation" com funcionalidades de seu plano contratado, sem exposição à complexidade do backend.
- **Para o Futuro:** Cada módulo é um "App" isolado que pode ser ativado/desativado por tenant via subscription, permitindo monetização granular.

### 1.3 Módulos Planejados (Roadmap)

| App | Slug | Status | Descrição |
|-----|------|--------|-----------|
| Content Factory | `content-factory` | **ATIVO — Primeiro e Único MVP** | Geração, compliance, heurísticas e aprovação de conteúdo |
| GEO Intelligence | `geo-intelligence` | Planejado (futuro) | Geomarketing e análise de audiência por localização |
| Branding DNA Studio | `branding-dna` | Planejado (futuro) | Editor avançado de identidade visual e verbal |
| Commerce Hub | `commerce-hub` | Planejado (futuro) | Catálogo, templates e marketplace de ativos digitais |

**REGRA ABSOLUTA:** Somente o Content Factory será implementado no MVP. Os demais módulos existem apenas como conceito e registros no banco de dados (tabela `applications`).

---

## 2. STACK TECNOLÓGICO DEFINITIVO

### 2.1 Infraestrutura Core

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Database** | Supabase (PostgreSQL 15+) | Multi-tenancy via RLS, Realtime, Edge Functions nativas |
| **Auth** | Wix OAuth2 → Supabase JWT | Wix é o provedor de identidade dos clientes. Supabase valida e gera tokens internos |
| **Backend (Serverless)** | Supabase Edge Functions (Deno) | Zero custo em idle, cold start ~200ms, TypeScript nativo |
| **Frontend** | React + Vite | SPA com roteamento client-side, deploy estático |
| **Design System** | IBM Carbon Design System (React) | Tema `g100` (dark), componentes industriais: DataTable, Modal, Tag, Button |
| **Hosting Frontend** | Vercel | Deploy automático via Git, CDN global, edge functions auxiliares |
| **AI Providers** | Google Gemini 2.0 Flash (bulk) + Anthropic Claude 3.5 Sonnet (estratégico) | Router inteligente com fallback cruzado |
| **Monitoramento** | Supabase Dashboard + activity_log table | Sem ferramentas externas no MVP |

### 2.2 Decisões Arquiteturais Irrevogáveis

1. **Serverless-First:** ZERO servidores Express.js persistentes. Toda lógica de backend roda em Supabase Edge Functions (Deno). Não há mais `server/index.ts` nem rotas Express.
2. **Supabase como Backend-as-a-Service:** Auth, Database, Realtime, Edge Functions, Storage — tudo em um único provedor.
3. **Carbon g100 Obrigatório:** Todo componente de UI DEVE usar variantes Carbon do tema `g100`. Sem exceções. Sem CSS customizado que sobrescreva tokens Carbon.
4. **Monorepo Modular:** Cada "App" é um pacote isolado dentro de `/apps/`. Compartilham código via `/shared/` e `/core/`.
5. **Wix como Identity Provider:** Clientes fazem login via Wix. A plataforma nunca gerencia senhas diretamente.
6. **Credit Wallet Mandatório:** Toda chamada de IA consome créditos. Sem créditos = sem geração.

---

## 3. ARQUITETURA SERVERLESS DETALHADA

### 3.1 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VERCEL (CDN + Edge)                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  React SPA (Vite Build)                                     │    │
│  │  ├── /login          → MasterLogin (dropdown Console/etc)   │    │
│  │  ├── /console/*      → Admin Hub (agency-only)              │    │
│  │  ├── /factory/*      → Content Factory (Matrix List)        │    │
│  │  └── /workstation/*  → Client Workstation (futuro)          │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS (Supabase JS Client)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SUPABASE (BaaS Layer)                           │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Auth (JWT)   │  │ Realtime     │  │ Storage (media/assets)   │  │
│  │ via Wix      │  │ (WebSocket)  │  │                          │  │
│  │ Bridge       │  │              │  │                          │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────────────┘  │
│         │                                                           │
│  ┌──────▼──────────────────────────────────────────────────────┐   │
│  │              Edge Functions (Deno Runtime)                   │   │
│  │                                                              │   │
│  │  ┌─────────────────┐  ┌────────────────────┐                │   │
│  │  │ wix-auth-bridge  │  │ ai-router          │                │   │
│  │  │ (OAuth handshake)│  │ (Gemini/Claude)    │                │   │
│  │  └─────────────────┘  └────────────────────┘                │   │
│  │                                                              │   │
│  │  ┌─────────────────┐  ┌────────────────────┐                │   │
│  │  │ credit-manager   │  │ compliance-engine  │                │   │
│  │  │ (wallet ops)     │  │ (4-layer check)    │                │   │
│  │  └─────────────────┘  └────────────────────┘                │   │
│  │                                                              │   │
│  │  ┌─────────────────┐  ┌────────────────────┐                │   │
│  │  │ heuristic-report │  │ support-agent      │                │   │
│  │  │ (100-word brief) │  │ (triage + health)  │                │   │
│  │  └─────────────────┘  └────────────────────┘                │   │
│  │                                                              │   │
│  │  ┌─────────────────┐  ┌────────────────────┐                │   │
│  │  │ wix-webhook      │  │ content-crud       │                │   │
│  │  │ (feedback sync)  │  │ (CRUD + status)    │                │   │
│  │  └─────────────────┘  └────────────────────┘                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL (Database)                            │   │
│  │  ┌────────────┐ ┌──────────────┐ ┌────────────────────────┐ │   │
│  │  │ tenants    │ │ content_items│ │ credit_wallets         │ │   │
│  │  │ brand_dna  │ │ ai_sessions  │ │ usage_logs             │ │   │
│  │  │ compliance │ │ token_usage  │ │ applications           │ │   │
│  │  │ _rules     │ │              │ │ subscriptions          │ │   │
│  │  └────────────┘ └──────────────┘ └────────────────────────┘ │   │
│  │           ↕ RLS (Row Level Security por tenant_id)           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Fluxo de Requisição Típico

```
1. Usuário clica "Regenerar" em um post no Matrix List
2. React dispara: supabase.functions.invoke('ai-router', { body: { postId, action: 'regenerate' } })
3. Edge Function 'ai-router' executa:
   a. Verifica JWT → extrai tenant_id e role
   b. Chama Edge Function 'credit-manager' → verifica saldo
   c. Carrega Brand DNA do tenant (query direta no Supabase)
   d. Monta Agent Envelope (Brand DNA + Compliance Rules + Post Context)
   e. Chama Gemini/Claude API (conforme roteamento)
   f. Recebe resposta da IA
   g. Chama Edge Function 'compliance-engine' → score 0-100
   h. Salva em content_items (status: 'generated')
   i. Debita créditos via 'credit-manager'
   j. Insere registro em token_usage e ai_sessions
   k. Retorna resposta ao frontend
4. React recebe resposta → atualiza DataTable via Supabase Realtime
5. Row glow (Blue 60 pulse) desaparece, row fica editável novamente
```

### 3.3 Edge Functions — Catálogo Completo

| Function | Método | Descrição | Dependências |
|----------|--------|-----------|-------------|
| `wix-auth-bridge` | POST | Recebe credentials Wix, valida OAuth2, gera JWT Supabase com tenant_id e role no metadata | Wix OAuth API |
| `ai-router` | POST | Orquestra geração de conteúdo: envelope, LLM call, compliance, créditos | credit-manager, compliance-engine |
| `credit-manager` | POST | Consulta/debita/adiciona créditos no wallet do tenant | credit_wallets table |
| `compliance-engine` | POST | Executa as 4 camadas de MasterCompliance + Constraint Kernel | brand_dna, compliance_rules |
| `heuristic-report` | POST | Gera relatório heurístico de ~100 palavras sobre um post | brand_dna, content_items |
| `content-crud` | POST | CRUD de content_items com validações de status e permissões | content_items, tenants |
| `wix-webhook` | POST | Recebe webhooks de feedback do Wix CMS, atualiza feedback_queue | feedback_queue |
| `support-agent` | POST | Triage de tickets + health check autônomo + criação de item no Wix CMS | Wix CMS API |
| `brand-dna-crud` | POST | CRUD do Brand DNA com versionamento | brand_dna |
| `billing-sync` | POST | Sincroniza status de billing com Stripe (futuro) | billing_accounts |

---

## 4. ESTRUTURA DE DIRETÓRIOS (MONOREPO)

### 4.1 Estrutura Raiz

```
/genOS-Cloud/
│
├── apps/
│   ├── content-factory/           # Primeiro e único App ativo
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   └── MatrixList.tsx  # Página principal (single-page app)
│   │   │   ├── components/
│   │   │   │   ├── MatrixTable.tsx  # Carbon DataTable com expansion
│   │   │   │   ├── HeuristicModal.tsx
│   │   │   │   ├── FeedbackModal.tsx
│   │   │   │   ├── BrandDnaViewer.tsx
│   │   │   │   └── RowGlow.css
│   │   │   ├── hooks/
│   │   │   │   ├── useContentItems.ts
│   │   │   │   ├── useRealtimeStatus.ts
│   │   │   │   └── useCreditWallet.ts
│   │   │   └── types/
│   │   │       └── content.ts
│   │   └── package.json
│   │
│   ├── geo-intelligence/           # Placeholder (futuro)
│   │   └── README.md
│   │
│   └── branding-dna/               # Placeholder (futuro)
│       └── README.md
│
├── console/                        # Console Hub (admin da agência)
│   ├── src/
│   │   ├── App.tsx                  # Router principal
│   │   ├── pages/
│   │   │   ├── Login.tsx            # MasterLogin com dropdown
│   │   │   ├── Dashboard.tsx        # Visão geral
│   │   │   ├── TenantList.tsx       # Lista de tenants
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── Shell.tsx            # Carbon UI Shell (Header + SideNav)
│   │   │   ├── AuthProvider.tsx
│   │   │   └── RLSProvider.tsx
│   │   └── services/
│   │       └── supabase.ts
│   └── package.json
│
├── supabase/
│   ├── functions/                   # Edge Functions (Deno)
│   │   ├── ai-router/
│   │   │   └── index.ts
│   │   ├── wix-auth-bridge/
│   │   │   └── index.ts
│   │   ├── credit-manager/
│   │   │   └── index.ts
│   │   ├── compliance-engine/
│   │   │   └── index.ts
│   │   ├── heuristic-report/
│   │   │   └── index.ts
│   │   ├── content-crud/
│   │   │   └── index.ts
│   │   ├── wix-webhook/
│   │   │   └── index.ts
│   │   ├── support-agent/
│   │   │   └── index.ts
│   │   ├── brand-dna-crud/
│   │   │   └── index.ts
│   │   └── billing-sync/
│   │       └── index.ts
│   │
│   ├── migrations/                  # SQL migrations versionadas
│   │   ├── 001_core_tenants.sql
│   │   ├── 002_content_items.sql
│   │   ├── 003_credit_wallets.sql
│   │   ├── 004_applications.sql
│   │   ├── 005_subscriptions.sql
│   │   ├── 006_rls_policies.sql
│   │   └── 007_indexes.sql
│   │
│   └── seed/
│       ├── tenants.sql
│       ├── applications.sql
│       └── brand_dna.sql
│
├── shared/                          # Código compartilhado entre apps
│   ├── types/
│   │   ├── tenant.ts
│   │   ├── content.ts
│   │   ├── credit.ts
│   │   └── auth.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── carbon-helpers.ts
│   └── constants/
│       ├── plans.ts
│       └── roles.ts
│
├── core/                            # Lógica de negócio pura (sem dependências de framework)
│   ├── compliance/
│   │   ├── masterCompliance.ts      # Engine de 4 camadas
│   │   └── constraintKernel.ts      # Sobrecamada estrita
│   ├── ai/
│   │   ├── agentEnvelope.ts         # Construtor de prompts
│   │   └── routingStrategy.ts       # Lógica de roteamento Gemini/Claude
│   ├── credits/
│   │   └── walletEngine.ts          # Lógica de wallet
│   └── auth/
│       └── rbac.ts                  # Role-based access control
│
├── docs/                            # Esta documentação
│   └── cloud-platform/
│       ├── 01-infraestrutura-cloud-arquitetura-serverless.md
│       ├── 02-database-schema-seguranca-rls.md
│       ├── ... (10 documentos)
│       └── 10-pipeline-deploy-handover.md
│
├── package.json                     # Root monorepo (workspaces)
├── turbo.json                       # Turborepo config (build orchestration)
├── .env.example
├── .gitignore
└── README.md
```

### 4.2 Configuração do Monorepo

```json
// package.json (raiz)
{
  "name": "genos-cloud",
  "private": true,
  "workspaces": [
    "apps/*",
    "console",
    "shared",
    "core"
  ],
  "scripts": {
    "dev:console": "cd console && vite",
    "dev:factory": "cd apps/content-factory && vite",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check"
  }
}
```

---

## 5. AMBIENTE E CONFIGURAÇÃO

### 5.1 Variáveis de Ambiente

```env
# ===== SUPABASE =====
SUPABASE_URL=https://qyfjkvwlpgjlpveqnkax.supabase.co
SUPABASE_ANON_KEY=eyJ...                    # Chave pública (anon)
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # Chave privada (service_role) — NUNCA no frontend

# ===== WIX =====
WIX_CLIENT_ID=...                           # OAuth2 Client ID
WIX_CLIENT_SECRET=...                       # OAuth2 Client Secret
WIX_SITE_ID=405fddff-d534-419d-9201-4ae5436eccc4   # Site Cestari Studio
WIX_REDIRECT_URI=https://genos.cestaristudio.com/auth/callback

# ===== AI PROVIDERS =====
GEMINI_API_KEY=...                          # Google AI Studio
ANTHROPIC_API_KEY=...                       # Anthropic Console

# ===== VERCEL =====
VERCEL_PROJECT_ID=...
VERCEL_ORG_ID=...

# ===== BILLING (FUTURO) =====
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

### 5.2 Supabase Project Reference

| Atributo | Valor |
|----------|-------|
| Project ID | `qyfjkvwlpgjlpveqnkax` |
| Region | (conforme setup original) |
| Tenant Root (Cestari Studio Master) | `056fbab6-3d03-4ceb-94a4-d91338f514b8` |
| Tenant Agency (Cestari Studio Agency) | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| Total Tenants (clientes) | 13 (depth_level = 2) |
| Total Tables (schema public) | 25 |

---

## 6. DADOS EXISTENTES NO SUPABASE (INVENTÁRIO)

### 6.1 Tabelas Atuais (25 tabelas)

As seguintes tabelas já existem e contêm dados reais de produção. Qualquer migração DEVE preservar estes dados:

| Tabela | Rows | RLS | Função |
|--------|------|-----|--------|
| `tenants` | 16 | ✅ | Multi-tenancy hierárquico (master → agency → clients) |
| `brand_dna` | 11 | ✅ | Identidade verbal e visual de cada cliente |
| `content_items` | 20 | ✅ | Posts gerados/aprovados (fonte de verdade) |
| `ai_sessions` | 24 | ✅ | Log de sessões de IA |
| `token_usage` | 1 | ✅ | Rastreamento de tokens consumidos |
| `compliance_rules` | 9 | ✅ | Regras de compliance por tenant |
| `system_prompts` | 3 | ✅ | Prompts de sistema registrados |
| `csv_registry` | 10 | ✅ | Mapeamento de CSVs (legado, manter para referência) |
| `csv_sync_log` | 203 | ✅ | Log de sync CSV (legado) |
| `feedback_queue` | 5 | ✅ | Fila de feedback do Wix |
| `activity_log` | 284 | ✅ | Auditoria global (crítico — não deletar) |
| `billing_accounts` | 15 | ✅ | Contas de billing por tenant |
| `pricing_config` | 9 | ✅ | Configuração de pricing por tier |
| `quality_scores` | 9 | ✅ | Scores de qualidade de conteúdo |
| `popup_events` | 5 | ✅ | Eventos de popup/notification |
| `sentiment_analysis` | 2 | ✅ | Análise de sentimento |
| `audience_analytics` | 0 | ✅ | Analytics de audiência |
| `addons_catalog` | 20 | ❌ | Catálogo de addons disponíveis |
| `tenant_addons` | 0 | ✅ | Addons ativados por tenant |
| `tenant_members` | 0 | ✅ | Membros de cada tenant (RBAC) |
| `connected_accounts` | 0 | ✅ | Contas sociais conectadas |
| `marketplace_items` | 0 | ✅ | Items do marketplace |
| `marketplace_purchases` | 0 | ✅ | Compras no marketplace |
| `mcp_connections` | 0 | ✅ | Conexões MCP |
| `write_retry_queue` | 0 | ✅ | Fila de retry para escritas CSV |

### 6.2 Tabelas NOVAS a Criar (Cloud Platform)

| Tabela | Função |
|--------|--------|
| `applications` | Registro de Apps disponíveis (content-factory, geo-intelligence, etc.) |
| `subscriptions` | Vincula tenant ↔ app com status (active, suspended, trial) |
| `credit_wallets` | Carteira de créditos por tenant (prepaidCredits, overageAmount) |
| `usage_logs` | Log de consumo de créditos por operação |

### 6.3 Tenants Existentes (13 clientes)

```
Nome                              | Supabase ID                            | Wix Member ID
All Life Institute                | 84b2c2be-cc24-4d9d-bcc2-ecf964ec88ea | f4bf15c0-4bbb-4aa4-83c3-eda3be498f50
Clareira de Avalon                | 4e802ccc-1565-4af6-a1b2-8036f2ce5597 | 19df4f9e-93f5-4c69-89c9-83ea5e8efc3c
Dads Love                         | ffd1a308-6324-4a55-853d-e319f3d1df00 | (pendente)
Fabio Andreoni                    | f6916eae-e9a4-4689-8721-1880c73e0918 | (pendente)
Gabriel Salvadeo                  | 58ec90b1-c2de-4614-9b07-5a0224541456 | 01f3e25f-7ac2-4bac-b65e-1b3cf16cca1d
Joab Nascimento                   | 92453dd2-2f4b-41f7-b2a3-da6950107dad | (pendente)
José Victor F. de Carvalho        | e9d6f432-8158-4b01-b23b-ee294d9cc9e1 | (pendente)
Lets Travel With Us 360           | 4e1114d5-efb7-4853-8f53-a479366b1262 | (pendente)
Nina Couto                        | f4803866-5877-4a7a-a0d9-32a558d53e85 | c2e5c3d4-7a22-4f80-a1bd-12345abcde01
Octavio Cestari                   | 43b655af-1744-4234-b312-4ade4aaf36ee | (pendente)
Primeira Folha                    | 177511cd-1d37-4797-a61b-8bd6cdd367f0 | (pendente)
Puttinato                         | 8d8623ca-5fb1-4c05-ade5-02cf0d10367a | bd93a5dc-4aa7-414f-bad3-c6d20f5c62a0
Theo Webert                       | ddfb2b85-c7a6-49c0-bc6a-4eb8589d3fef | 5e55fe78-2e7e-4cf0-ac58-8bc32aab5f7c
```

---

## 7. COMPARATIVO: ANTES vs DEPOIS

### 7.1 O que MUDA

| Aspecto | genOS Lumina v1.0 (Antes) | genOS™ Cloud Platform (Depois) |
|---------|---------------------------|-------------------------------|
| Backend | Express.js monolítico (`server/index.ts`) | Supabase Edge Functions (Deno, serverless) |
| Rotas | Express Router (13 arquivos em `routes/`) | Edge Functions individuais |
| CSV Sync | Chokidar file watcher bidirecional | **REMOVIDO** — dados vivem apenas no Supabase |
| Auth | Mock handshake + RLS hooks customizados | Wix OAuth2 → Supabase JWT real |
| Frontend | Multi-page SPA (17+ páginas) | Console (admin) + Content Factory (single-page) |
| Deploy | Docker Compose + manual | Vercel (frontend) + Supabase CLI (functions) |
| Custo idle | Servidor always-on (~R$50/mês mínimo) | **R$0** — serverless pay-per-use |
| Billing | billing_accounts (estático) | Credit Wallet (prepaid + overage dinâmico) |

### 7.2 O que PERMANECE

- **Supabase como database** (mesmo project ID: `qyfjkvwlpgjlpveqnkax`)
- **Todas as 25 tabelas existentes** (nenhuma é deletada)
- **Carbon Design System g100** (tema, componentes, filosofia visual)
- **MasterCompliance Engine** (4 camadas + Constraint Kernel — mesma lógica, novo runtime)
- **Agent Envelope** (mesma estrutura de compilação de contexto)
- **AI Router** (mesma lógica de roteamento Gemini/Claude, novo runtime Deno)
- **Brand DNA** (mesma estrutura de dados, mesma tabela)
- **Multi-tenancy hierárquico** (master → agency → clients)
- **Activity Log** (284 registros existentes preservados)

### 7.3 O que é ADICIONADO

- **Tabela `applications`** — registro de Apps modulares
- **Tabela `subscriptions`** — vínculo tenant ↔ app
- **Tabela `credit_wallets`** — carteira de créditos
- **Tabela `usage_logs`** — log de consumo granular
- **Login com dropdown** (Console / Workstation / Support)
- **Row Glow Effect** — shimmer azul Blue 60 durante regeneração AI
- **Heuristic Report Modal** — relatório de ~100 palavras por post
- **RBAC para Workstation** — roles de visibilidade por coluna (database-only, sem UI no MVP)
- **Support Agent** — triage de tickets por IA + health check autônomo

---

## 8. REGRAS DE MIGRAÇÃO

### 8.1 Princípios de Migração

1. **ZERO downtime:** Todas as migrações são aditivas. Nenhuma tabela existente é dropada.
2. **Dados preservados:** Os 284 registros de activity_log, 20 content_items, 24 ai_sessions, 11 brand_dnas — TODOS são mantidos.
3. **Novas tabelas são criadas via `ALTER TABLE` quando necessário** (ex: adicionar coluna `app_slug` em tabelas existentes).
4. **CSVs viram histórico:** A tabela `csv_registry` e `csv_sync_log` são mantidas como read-only para referência histórica. O CSV Watcher é desativado.
5. **Seed de `applications`:** Criar registros para `content-factory` (ativo), `geo-intelligence`, `branding-dna`, `commerce-hub` (todos inativos).

### 8.2 Ordem de Execução

```
1. CREATE TABLE applications (...)
2. CREATE TABLE subscriptions (...)
3. CREATE TABLE credit_wallets (...)
4. CREATE TABLE usage_logs (...)
5. INSERT INTO applications (content-factory, geo-intelligence, branding-dna, commerce-hub)
6. INSERT INTO subscriptions (todos os 13 tenants → content-factory, status: 'active')
7. INSERT INTO credit_wallets (todos os 13 tenants com saldo inicial baseado no plano)
8. ALTER TABLE content_items ADD COLUMN app_slug TEXT DEFAULT 'content-factory'
9. CREATE RLS POLICIES para novas tabelas
10. CREATE INDEXES para performance
```

---

## 9. CUSTOS E LIMITES

### 9.1 Supabase Free Tier

| Recurso | Limite Free | Uso Estimado |
|---------|-------------|-------------|
| Database | 500MB | ~50MB (25 tabelas, dados leves) |
| Edge Functions | 500K invocações/mês | ~5K/mês (13 clientes × ~400 ops) |
| Auth | 50K MAU | ~50 users |
| Storage | 1GB | ~100MB (media assets) |
| Realtime | 200 concurrent connections | ~15 |
| Bandwidth | 5GB | ~2GB |

### 9.2 Vercel Free Tier

| Recurso | Limite Free | Uso Estimado |
|---------|-------------|-------------|
| Builds | 6000 min/mês | ~100 min |
| Bandwidth | 100GB | ~5GB |
| Serverless | 100GB-Hrs | ~5GB-Hrs |
| Edge Functions | 500K invocações | ~1K (minimal, CDN cache) |

### 9.3 Custo Total Estimado (MVP)

**R$0/mês** em idle. Custo variável apenas nas chamadas de API da Gemini/Claude, que são repassadas ao cliente via Credit Wallet.

---

## 10. CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Criar monorepo com workspaces
- [ ] Configurar Vite para Console e Content Factory
- [ ] Instalar Carbon Design System (@carbon/react)
- [ ] Criar Edge Functions no Supabase (10 functions)
- [ ] Executar migrações SQL (tabelas novas)
- [ ] Implementar Wix Auth Bridge
- [ ] Implementar Credit Wallet Engine
- [ ] Implementar MasterLogin com dropdown
- [ ] Implementar Matrix List (DataTable com expansion)
- [ ] Implementar Row Glow Effect (CSS)
- [ ] Implementar Heuristic Report Modal
- [ ] Configurar deploy no Vercel
- [ ] Testes end-to-end

---

*Este documento é a referência absoluta para a reconstrução do genOS™ Cloud Platform. Qualquer decisão arquitetural que contradiga este documento deve ser explicitamente discutida e aprovada antes da implementação.*

*Documento #1 de 10 — Super Prompts de Documentação Exaustiva.*
