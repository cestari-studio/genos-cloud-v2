# Arquitetura e Especificação Técnica: genOS Lumina v1.0.0

**genOS Lumina** é um sistema operacional de conteúdo fully-managed, projetado para o Cestari Studio. Ele atua como o cérebro central para orquestração de Inteligência Artificial, compliance de marca, sincronização de dados via CSV, multi-tenancy e aprovação de clientes.

---

## 🏗️ 1. Arquitetura do Sistema

O sistema utiliza uma arquitetura Headless baseada em microsserviços integrados, operando de forma autônoma com intervenção humana focada na aprovação e revisão estratégica.

### Fluxo de Dados:
\`\`\`text
UI (Carbon Design / React)  →  Express API (Node.ts)  →  Supabase (PostgreSQL + RLS)
                                                      →  AI Router (Gemini / Claude / Local)
                                                      →  CSV Watcher (Chokidar / Sync Pipeline)
                                                      →  Webhooks (Wix CMS / Feedback)
\`\`\`

### Tecnologias Principais:
- **Backend:** Express.js + TypeScript (Node.js)
- **Frontend:** React + Vite + Carbon Design System (IBM)
- **Database:** Supabase (PostgreSQL) com Row Level Security (RLS)
- **IA:** Google Gemini (Bulk) e Anthropic Claude (Estratégico)
- **Sync:** Chokidar para watch de arquivos CSV bidirecionais

---

## 🗄️ 2. Banco de Dados e Multi-Tenancy (Supabase)

O sistema foi desenhado do zero para ser **Multi-Tenant**, suportando a agência master e múltiplos clientes de forma isolada e segura.

### Hierarquia de Tenants:
- **Master Account:** Cestari Studio (Acesso a dashboard global, roteamento de API, margens de lucro).
- **Client Tenants:** Contas de clientes. Cada um possui seu próprio \`Brand DNA\`, \`Compliance Rules\`, métricas e banco de CSVs locais. 

### Tabelas Principais (Core):
1. \`tenants\`: Gestão de inquilinos, status, plan, e hierarquia (parent_tenant_id).
2. \`brand_dna\`: Armazena tom de voz, regras de conteúdo, arquétipo, limites e pilares editoriais de cada cliente.
3. \`content_items\`: Fonte de verdade do conteúdo gerado, conectada às tabelas de CSV. Possui status, score de compliance e metadados.
4. \`ai_sessions\`: Log detalhado de requisições de IA, tokens gastos, provedor utilizado e custo em USD.
5. \`token_usage\`: Rastreamento de custo duplo (Agency Cost vs Client Cost) baseado nas estratégias de pricing.
6. \`compliance_rules\`: Regras ativas por tenant (comprimento, tom, hashtags obrigatórias).
7. \`system_prompts\`: Prompts de sistema ativados por tipo de conteúdo.
8. \`csv_registry\`: Mapeamento de quais CSVs sincronizam com quais tabelas no banco.
9. \`feedback_queue\` & \`activity_log\`: Loops de feedback do Wix e log de auditoria global.

---

## 🤖 3. Ecossistema de Inteligência Artificial

A plataforma não depende de um único LLM, mas possui um **AI Router** inteligente.

### Roteamento e Fallback:
- **Conteúdo Estratégico** (Artigos de Blog, Campanhas de Email): **Anthropic Claude 3.5 Sonnet** (Otimizado para nuance e profundidade).
- **Conteúdo em Massa / Bulk** (Reels, Stories, Carrosséis, Estáticos): **Google Gemini 2.0 Flash** (Otimizado para velocidade e volume estruturado).
- **Fallbacks:** Se o Claude falhar, usa Gemini. Se o Gemini falhar, usa Claude.
- **Local Mock:** Se não houver chaves de API, entra em cena o gerador local (\`genOS-local-v1\`) via templates estruturados no backend.

### Geração Estruturada (Agent Envelope):
Antes de a IA gerar qualquer texto, o GenOS monta o *Agent Envelope*, que compila para o LLM:
1. Contexto do Tenant e Plataforma.
2. Todo o **Brand DNA** em formato JSON.
3. Regras estritas de **MasterCompliance**.

### Batch Generation & Social Formats:
Capacidade de gerar calendários inteiros. A IA recebe inputs (posts por semana, formatos, pilares) e cospe JSON mapeado para \`[REEL_TITLE_01]\`, \`[CAROUSEL_TEXT_01]\`, etc.

---

## 🛡️ 4. MasterCompliance Engine (Heurísticas e Validação)

Nenhum texto entra no painel como "Aprovado" sem passar pela esteira do MasterCompliance. O score varia de 0 a 100.

**As 4 Camadas de Validação (25 pontos cada):**
1. **Forbidden Words Check:** Procura termos proibidos registrados no Brand DNA (ex: "barato", "grátis"). Se encontrar, penaliza a nota para 0 nesta camada.
2. **Tone Alignment Check:** Verifica a energia e formalidade. Exemplo: penaliza uso de gírias ("mano", "tá ligado") se o tom deve ser profissional; cobra pontuação dinâmica (exclamações, CTAs) para tons vibrantes.
3. **Length Compliance Check:** Garante limites rigorosos de caracteres configurados para o tipo de post na aba de Compliance.
4. **Brand Consistency Check:** Verifica uso de termos de vocabulário da marca e aderência mínima/máxima à estratégia de Hashtags predefinida no DNA.

**Constraint Kernel:** Uma sobrecamada estrita. Se o Kernel detectar violações absolutas (ex: falta de CTA), o conteúdo sofre grave penalização de score (-30pts).
- Verdit: \`approved\` (>= 75), \`needs_revision\` (40-74), \`rejected\` (< 40).

---

## 🔄 5. Pipeline de Sincronização CSV

Como a agência utiliza arquivos CSV locais (\`/projects/cestari-studio/*.csv\`) para interações offline, o GenOS possui um **CSV Watcher** rodando via \`chokidar\`.

- Sincronização **Bidirecional**: Os CSVs mapeados em \`csv_registry\` são lidos do disco usando \`hashRow\` para captar *drifts* (linhas adicionadas, modificadas ou removidas).
- Ao detectar alteração, injeta/atualiza a \`content_items\` no Supabase.
- Quando a IA ou o Cliente aprova algo na plataforma via webhook, o backend grava no Supabase e dá o \`pull\` reescrevendo o arquivo CSV da equipe.

---

## 🧬 6. Brand DNA

Central de identidade automatizada. Pode ser preenchida de forma manual ou **gerada pela IA** a partir de um briefing puro. Inclui:
- **Tom de Voz:** Primário, secundário, e como fala / não fala.
- **Personalidade:** Arquétipo, traços, linguagem.
- **Hashtags:** Estratégia "Always on" vs restritivas por categoria.
- **Pilares Editoriais:** Ex: Educativo (40%), Promocional (10%), com regras de balanceamento na geração Batch.

---

## 🖥️ 7. Frontend, Páginas e Permissões (UI)

O Frontend foi desenvolvido em React + Vite, consumindo visualmente o requintado **Carbon Design System da IBM**. 

Os acessos (Guards) são travados via RLS e permissões resolvidas no hook de AuthContext.

**Módulos Principais (\`/ui-react/src/pages\`):**
- **Login / MasterLogin:** Autenticação de perfil seguro (Vídeo de fundo, dropdown de perfis "Workstation"/"Enterprise"). Integra ponte RLS com mock de Handshake pro Wix.
- **Dashboard:** Visão geral do Tenant logado. Mostra volume de AI Sessions, Compliance Médio, Score de Conteúdos, Custos e Logs.
- **Factory:** Interface de geração unitária ou em Batch ("Fábrica de Conteúdo").
- **Matrix Grid / Semantic Map / Compliance Audit:** Visões avançadas do Carbon para análise técnica de tópicos.
- **Brand DNA:** Setup do posicionamento da marca, editor de voz.
- **CSV Browser:** Leitura crua das tabelas refletidas na UI.
- **Observatory (e Pricing):** Visão de custo vs agência (rastreamento de token pricing, margem de lucro por LLM).
- **Admin Hub:** Diretório focado na visão Cestari Master \`/admin/...\` (Health Dashboard, Topology, API Connector, Tenant List).

---

## 🗂️ Estrutura de Diretórios Simplificada
\`\`\`text
/genOS-Full
├── server/
│   ├── index.ts                 (Core backend)
│   ├── routes/                  (Endpoints: ai, content, sync, dna, popups)
│   └── services/
│       ├── aiRouter.ts          (Roteador Claude/Gemini/Local)
│       ├── agentEnvelope.ts     (Construtor de Prompts p/ IA)
│       ├── masterCompliance.ts  (Engine de 4 camadas de compliance)
│       ├── csvWatcher.ts        (Engine de sincronização bidirecional chokidar)
│       ├── supabaseClient.ts    (Conexão DB + RLS logic)
│       └── constraintKernel.ts  (Heurística estrita)
├── ui-react/                    (Frontend Vite + React)
│   ├── src/
│   │   ├── App.tsx              (Rotas e Auth Guards)
│   │   ├── components/          (Shell Carbon, Providers)
│   │   ├── pages/               (Login, Dashboard, Factory, BrandDna, admin/*)
│   │   └── services/api.ts      (Requisições frontend)
├── projects/                    (Arquivos CSV das marcas locais)
└── API.md                       (Documentação de rotas e webhooks)
\`\`\`

---
*Gerado via genOS Lumina Orchestrator.*
