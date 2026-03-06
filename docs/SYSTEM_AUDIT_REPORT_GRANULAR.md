# Relatório de Auditoria Granular — genOS Cloud v2
**Relatório Técnico de Integridade, Sincronização e Roadmap (v2.1)**
**Responsável**: Antigravity (Antigravity Senior Engineer)
**Data**: 2026-03-02

---

## 1. Arquitetura de Dados e Vínculos (Data Linkage Graph)

O genOS Cloud v2 opera em um modelo multi-tenant com orquestração via Edge Functions. Abaixo, o mapeamento de como os dados "pulsa" no sistema:

### A) Kernel de Identidade (Pivot: `brand_dna`)
- **Vínculo**: `persona_name` (DB) <-> `Nome da Persona` (UI) <-> `Persona` (AI Prompt).
- **Vínculo**: `voice_tone` (DB JSONB) <-> `Tom Primário/Sec/Ter` (UI) <-> Injetado como contexto tonal na Edge Function.
- **Vínculo**: `char_limits` (DB JSONB) <-> **Mapeamento Crítico**: 
    - Atualmente, a UI salva chaves em Português (`reel_titulo`, `estatico_legenda`).
    - A Edge Function `content-factory-ai` ainda busca chaves em Inglês (`reel_title`, `description`).
    - **STATUS**: ⚠️ **DESINCRONIZADO**. A IA está usando fallbacks (defaults) porque não encontra as chaves traduzidas.

### B) Motor de Créditos (Pivot: `credit_wallets`)
- **Fluxo**: User clica em "Gerar" -> Edge Function chama RPC `debit_credits(tenant_id, cost)` -> `credit_wallets.prepaid_credits` diminui ou `overage_amount` aumenta -> `usage_logs` registra a operação (`app_slug: 'content-factory'`).
- **Sincronização UI**: `AuthContext` faz polling de 60s via `api.getMe()` para atualizar o badge de tokens no Header em tempo real.

### C) Gestão de Conteúdo (Redundância Detectada)
- **Tabela `posts`**: Usada pela UI (`MatrixList.tsx`) e pela função principal `content-factory-ai`.
- **Tabela `content_items`**: Usada pela função `content-generator` (v1/legacy).
- **STATUS**: 🔴 **CONFLITO**. Existem dois motores de geração gravando em tabelas diferentes. O `content-generator.ts` deve ser depreciado ou unificado com o `content-factory-ai`.

---

## 2. Auditoria Granular por Componente

### Backend (Supabase Edge Functions)
1. **`wix-auth-bridge`**: Ponto único de entrada. Converte JWT Wix em Sessão Supabase. Sincroniza `tenant_members`.
2. **`content-factory-ai`**: O cérebro do sistema.
   - **Gaps**: O `Access-Control-Allow-Origin` está como `*`. Recomendado restringir para `app.cestari.studio`.
   - **Gaps**: Não valida se o `scheduled_date` é no passado.
3. **`ai-router`**: Atualmente sem uso extensivo. Pode ser implementado para rotear entre Gemini, Claude e OpenAI de acordo com o custo/complexidade.

### Frontend (React + Carbon)
1. **`Shell.tsx`**: Gerencia a navegação e polling de notificações. 
   - **Melhoria**: O badge de notificações conta `unread` mas o polling de 30s pode ser otimizado para Realtime (Postgres Changes) para economizar egress do Supabase.
2. **`MatrixList.tsx`**: DataTable complexa com ações de lote.
   - **O que não está sendo utilizado**: O campo `quality_score` é retornado pela IA mas não é exposto visualmente como uma coluna de "Saúde do Post".
3. **`Settings.tsx`**: Gerencia limites de faturamento.
   - **Inconsistência**: Permite salvar `post_limit` > 0 mesmo se o wallet estiver zerado.

---

## 3. Matriz de Melhorias e Roadmap

### 🟢 O que pode ser implementado (Low Hanging Fruit)
- **Preview de Canais**: Adicionar preview visual de como o post ficará no Instagram/LinkedIn dentro do modal de `Visualizar`.
- **Bulk Actions**: Aprovação em massa de posts na `MatrixList`.
- **Auto-Hashtag Manager**: Aba para gerenciar a `hashtag_strategy` de forma visual (drag and drop de prioridade).

### 🟡 O que deve ser melhorado (UX/DX)
- **Unificação de Schemas**: Mover tudo de `content_items` para `posts` e deletar a tabela obsoleta.
- **Tradução de Chaves de IA**: Atualizar `content-factory-ai/index.ts` para ler as chaves `reel_titulo` (Português) para alinhar com o novo `BrandDna.tsx`.
- **Role Alignment**: Alinhar os nomes de roles na UI (`Agency Operator`) com os claims de RLS (`Enterprise`).

---

## 4. O que NÃO está sincronizado

1. **Brand DNA vs Prompt AI**: Como mencionado, as chaves de limite de caracteres e regras regionais novas no banco ainda não estão sendo concatenadas no prompt da Edge Function v8.
2. **Notifications**: Ações feitas via Edge Function (como "IA terminou de gerar") criam logs na `activity_log`, mas a UI não emite um Toast imediato (depende do polling).
3. **Wix Sync**: Se o plano do usuário mudar no Wix, não há um webhook imediato atualizando `tenant_config` (apenas no próximo login).

---

## 5. MegaPrompt de Ajustes (Sincronização & Fixes)

```markdown
# MegaPrompt: genOS Cloud v2 — Sincronização de Backend

**OBJETIVO**: Sincronizar o motor de IA (Edge Function) com a nova estrutura de Brand DNA e unificar tabelas de conteúdo.

**INSTRUÇÕES PARA A IA**:
1. **Unificação de Tabelas**:
   - Analise `content-factory-ai/index.ts` e `content-generator/index.ts`.
   - Garanta que toda geração use a tabela `posts`.
   - Onde houver referência a `content_items`, mude para `posts`.

2. **Sincronização de Chaves (Schema Alignment)**:
   - No `content-factory-ai/index.ts`, atualize a função `buildGeneratePrompt` e `buildRevisePrompt`.
   - Substitua o mapeamento de chaves de `char_limits` de Inglês para as chaves Portuguesas reais do banco:
     - `description` -> `reel_legenda` / `estatico_legenda` / `carrossel_legenda`
     - `carousel_title` -> `carrossel_titulo_capa`
     - `carousel_card` -> `carrossel_texto_card`
     - `reel_title` -> `reel_titulo`
     - `static_title` -> `estatico_titulo`
     - `static_paragraph` -> `estatico_paragrafo`
   - Adicione suporte a `regional_notes` e `generation_notes` no `brandContext`.

3. **Segurança (CORS)**:
   - Restrinja `ALLOWED_ORIGINS` nas Edge Functions para 'https://app.cestari.studio'.

4. **Tratamento de Créditos**:
   - No `handleGenerate`, adicione uma verificação prévia: se `prepaid_credits` + `overage_limit` < custo, retorne erro `insufficient_funds` ANTES de chamar o Gemini.
```

---

## 6. MegaPrompt de Features & Melhorias (UX/Premium)

```markdown
# MegaPrompt: genOS Cloud v2 — Novas Features & UX Premium

**OBJETIVO**: Elevar a plataforma para um nível Enterprise com visualizações ricas e automação.

**NOVAS FEATURES A IMPLEMENTAR**:
1. **Visual Social Preview**:
   - Em `MatrixList.tsx`, no modal de preview, crie um componente `SocialMockup` que simula um post de Instagram (Avatar do tenant + Imagem/Vídeo + Legenda).
   - Use os dados de `brand_dna.color_palette` para sugerir cores de fundo no preview.

2. **AI Quality Score Dashboard**:
   - No `Console.tsx`, crie um gráfico (`@carbon/charts-react`) mostrando a média de `quality_score` dos posts aprovados versus os que precisaram de revisão.
   - Use `usage_logs` para mostrar um gráfico de "Eficiência de Geração" (Posts Gerados / Tokens Gastos).

3. **Realtime Notifications (Postgres Changes)**:
   - Refatore `NotificationProvider.tsx` para usar `supabase.channel('activity_log')`.
   - Quando um novo log de `severity: 'warning'` ou `toast: true` entrar, dispare o `showToast` imediatamente sem esperar o polling.

4. **Multi-Step Content Wizard**:
   - Em `Factory.tsx`, transforme o modal de criação em um `ProgressIndicator` de 3 passos:
     1. Definição (Tópico e Formato).
     2. Geração AI (Preview dos textos gerados).
     3. Agendamento e Mídia (Upload final e data).

**ESTILO UI**:
- Mantenha 100% Carbon Design System v11.
- Use `AILabel` em todas as métricas explicadas por IA.
- Use o tema `g100` (Dark).
```

---

**Relatório Finalizado.**
*Sistema pronto para refatoração e expansão de funcionalidades conforme os prompts acima.*
