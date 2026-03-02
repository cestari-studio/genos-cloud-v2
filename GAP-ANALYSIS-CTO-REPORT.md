# Análise de Gaps — Relatório CTO vs. Código Real
**Data**: 2026-03-02
**Auditor**: Claude (análise automatizada de código-fonte + Supabase)

---

## RESUMO EXECUTIVO

O relatório CTO apresenta um quadro **otimista demais** em vários pontos. Das 10 funcionalidades marcadas como "✅ OK", **3 têm problemas críticos** que o relatório não menciona, e **2 têm problemas médios**. O relatório também **subestima severamente** os gaps da tabela de "Pequenos Ajustes" — o problema do BrandDna.tsx não é "baixa severidade", é um **bug crítico de perda de dados**.

---

## 1. VERIFICAÇÃO ITEM A ITEM — Dashboard de Funcionalidades

### ✅ CONFIRMADO OK

| Item | Relatório diz | Código confirma |
|------|---------------|-----------------|
| Login (Wix Auth Bridge) | ✅ OK | ✅ REAL — `MasterLogin.tsx` + `wix-auth-bridge` Edge Fn + `AuthContext.login()` funciona |
| Console / Dashboard | ✅ OK | ✅ REAL — `Console.tsx` lazy-loaded, usa `api.getMe()` |
| Content Factory (MatrixList) | ✅ OK | ✅ REAL — `MatrixList.tsx` usa Carbon DataTable com RLS por tenant |
| Settings (UPSERT Config) | ✅ OK | ✅ REAL — UPSERT em `tenant_config` + atualiza `credit_wallets` |
| Token Sync (Real-time) | ✅ OK | ✅ REAL — Polling 60s via `AuthContext` + `me.usage` no `PageLayout` |
| Navegação (Shell/PageLayout) | ✅ OK | ✅ REAL — Carbon `HeaderPanel`, `Switcher`, nome dinâmico |
| i18n (4 Idiomas) | ✅ OK | ✅ REAL — `LocaleSelectorModal.tsx` com `t()` function |

### ⚠️ PARCIALMENTE CORRETO

| Item | Relatório diz | Realidade |
|------|---------------|-----------|
| **Geração com IA (Edge Fn)** | ✅ OK — "Prompt Gemini v2.0-Flash inclui DNA completo" | ⚠️ **PARCIAL** — O prompt injeta `char_limits` e `hashtag_strategy`, MAS os `char_limits` usam keys em **português** no DB (`reel_titulo`) enquanto o BrandDna.tsx edita keys em **inglês** (`reel_title`). Se o operador editar char_limits pelo app, eles são salvos com keys que a Edge Function NÃO reconhece. |
| **Estabilidade (Auto-reload)** | ✅ OK — "Resolvido via estabilização de dependências" | ⚠️ **PARCIAL** — O `AuthContext` faz polling a cada 60s (`refreshMe`) e o `Shell` faz polling de notificações a cada 30s. São 3 queries Supabase a cada 30s por usuário logado. Estável sim, mas pode causar problemas com mais de ~20 usuários simultâneos. |

### 🔴 INCORRETO / ENGANOSO

| Item | Relatório diz | Realidade |
|------|---------------|-----------|
| **Brand DNA (Persistence)** | ✅ OK — "UPDATE em tempo real na tabela brand_dna" | 🔴 **FALSO** — O update funciona tecnicamente (não dá erro), mas **salva campos fantasma que não existem no DB**. O Supabase ignora silenciosamente `brand_name`, `mission`, `vision`, `values`, `tone_of_voice`, `preferred_vocabulary`, `words_to_avoid`, `personas`, `content_guidelines`, `content_examples`. Os dados editados pelo usuário **são descartados no save**. |
| **Brand DNA (Accordion Logic)** | ✅ OK — "Footer, Hashtags, Categorias e Char Limits salvos" | 🔴 **PARCIALMENTE FALSO** — Footer/Hashtags/Categorias salvam OK (usam campos reais: `content_rules`, `hashtag_strategy`, `editorial_pillars`). MAS os Char Limits salvam com keys **erradas** (inglês vs. português do DB). E 10 campos reais NUNCA são editados. |

---

## 2. TABELA DE "PEQUENOS AJUSTES" — Reclassificação de Severidade

O relatório CTO classificou assim:

| Problema | Severidade CTO | Severidade REAL |
|----------|---------------|-----------------|
| Shell polling 30s excessivo | 🟢 Baixa | 🟡 **Média** — Com 16 tenants e múltiplos users, são ~160 queries/min sem necessidade. Deveria usar Supabase Realtime (subscriptions) |
| Factory sem validação crédito < custo | 🟡 Média | 🟡 **Média** — Correto, user pode clicar "Gerar" e receber erro do backend |
| BrandDna "Gerar com IA" ignora DNA existente | 🟢 Baixa | 🟢 **Baixa** — O wizard só aparece quando `dna === null`, então isso é correto no código. **O relatório está errado sobre o bug** |

### BUGS NÃO REPORTADOS NO RELATÓRIO CTO:

| Bug | Severidade | Descrição |
|-----|-----------|-----------|
| **BrandDna campos fantasma** | 🔴 **CRÍTICA** | 10 campos que o usuário edita não existem no DB. Dados são silenciosamente perdidos. [Detalhado acima] |
| **char_limits mismatch PT/EN** | 🔴 **CRÍTICA** | BrandDna.tsx usa `reel_title`, DB tem `reel_titulo`. Edge Function lê do DB, recebe as keys PT. Se editados pelo app, gera keys EN que a geração ignora |
| **BrandDna campos reais não editáveis** | 🟠 **Alta** | 10 campos que EXISTEM no DB nunca aparecem no editor: `voice_tone`, `voice_description`, `persona_name`, `language`, `regional_notes`, `color_palette`, `typography`, `references_and_benchmarks`, `sample_posts`, `generation_notes` |
| **personality_traits tipo errado** | 🟡 **Média** | DB: JSONB (array de strings). BrandDna.tsx trata como TextArea (string). Na leitura, converte array→string. No save, salva string em vez de array. |
| **brand_values tipo errado** | 🟡 **Média** | Mesmo problema do personality_traits |
| **target_audience tipo errado** | 🟡 **Média** | DB: JSONB `[{segment: "..."}]`. Editor trata como TextArea string |
| **audience_profile tipo errado** | 🟡 **Média** | DB: JSONB `{demographic: "..."}`. Editor trata como TextArea string |
| **Sem tenant selector no BrandDna** | 🟡 **Média** | Agency (super_admin) não consegue editar Brand DNA de child tenants. Precisa trocar de tenant no switcher global primeiro |
| **Sem import/export no BrandDna** | 🟡 **Média** | Não existe funcionalidade de importar/exportar DNA. O HTML Editor externo gera arquivos que não podem ser usados no app |
| **tenant_config apenas 2 rows** | 🟡 **Média** | Com 16 tenants, só 2 têm configuração. 14 tenants operam com defaults hardcoded no código |
| **ErrorBoundary usa HTML nativo** | 🟢 **Baixa** | `App.tsx` ErrorBoundary usa `<button>` HTML em vez de Carbon `<Button>` |

---

## 3. ANÁLISE DO CHECKLIST (Screenshot)

### Itens marcados ✅ no checklist:

| Item | Status Real |
|------|-------------|
| Implementar refreshMe no Settings.tsx | ✅ **CONFIRMADO** — `await refreshMe()` chamado após `saveConfig` (linha 257) |
| Adicionar campos JSONB granulares no BrandDna.tsx | ⚠️ **PARCIAL** — Adicionou seções, mas campos usam nomes errados e tipos errados |
| Validar persistência e integração com Edge Functions | 🔴 **FALSO** — Persistência salva campos fantasma. Edge Fn lê campos reais que nunca são editados |
| Audit UI Interactions and Modals | ✅ **CONFIRMADO** — Shell e PageLayout usam Carbon corretamente |
| Standardize Shell.tsx with Carbon HeaderPanel | ✅ **CONFIRMADO** — `HeaderPanel` + `Switcher` + `SwitcherItem` |
| Synchronize AI usage in AuthContext via 60s polling | ✅ **CONFIRMADO** — `setInterval(refreshMe, 60000)` |
| Update PageLayout.tsx and MatrixList.tsx with AILabel | ✅ **CONFIRMADO** — Ambos usam `AILabel` + `AILabelContent` |
| Verify LocaleSelectorModal.tsx intentional reload | ✅ **CONFIRMADO** — Funcional |
| Audit BrandDna.tsx and Settings.tsx for full Carbon compliance | ⚠️ **PARCIAL** — Carbon compliance OK em ambos, mas BrandDna tem bugs de dados |

### Itens pendentes no checklist:

| Item | Prioridade Real |
|------|-----------------|
| **Validar botão "Gerar com IA"** | 🟡 Média — O botão funciona mas não valida se tenant JÁ TEM DNA. Na verdade, o wizard só aparece quando `dna === null`, então o botão NUNCA aparece se já existe DNA. O checklist pode estar pedindo outra validação. |
| **Estabelecer brand_dna.char_limits como fonte de verdade** | 🔴 **CRÍTICA** — Diretamente ligado ao bug de char_limits PT vs EN. DEVE ser prioridade |
| **Garantir retrocompatibilidade com campos legados** | 🟡 Média — Ao corrigir nomes de campos, precisa migrar dados existentes |
| **Testar persistência no Supabase** | 🔴 **CRÍTICA** — Vai expor o bug dos campos fantasma |
| **Validar com tsc --noEmit e vite build** | 🟢 Baixa — Já funcionou na última build (225cead) |
| **Criar walkthrough.md final** | 🟢 Baixa — Documentação |

---

## 4. ANÁLISE DA SEÇÃO "PRÓXIMOS PASSOS" DO RELATÓRIO

### P0 — Estabilidade Crítica & Segurança

| Item CTO | Análise |
|----------|---------|
| Rate Limiting no wix-auth-bridge | ✅ **CORRETO** — Edge Functions não têm rate limit nativo. Brute-force possível. Prioridade real. |
| Validar RLS para usage_logs | ⚠️ **PARCIAL** — RLS está HABILITADO (`rls_enabled: true`), mas não auditei as POLICIES. Pode ter policy permissiva (ex: `true`). Precisa verificar se policy filtra por `tenant_id`. |

### P1 — UX

| Item CTO | Análise |
|----------|---------|
| Stepper durante geração | ✅ Relevante — Factory usa `InlineLoading` estático |
| Preview de imagens | ℹ️ Não verificável pelo código — depende das Edge Functions DALL-E/Midjourney que não foram analisadas |

### P2 — Dados

| Item CTO | Análise |
|----------|---------|
| Semantic Map + sentimento | ℹ️ `SemanticMapPage` existe como lazy route, `sentiment_analysis` table tem 2 rows |
| History de tokens | ℹ️ `usage_logs` tem apenas 3 rows. `token_usage` tem 1 row. Tabelas existem mas pouco populadas |

---

## 5. GAPS NÃO MENCIONADOS EM NENHUM LUGAR

| Gap | Descrição | Severidade |
|-----|-----------|-----------|
| **tenant_config só 2 de 16** | Apenas 2 tenants têm configuração. Os outros 14 usam defaults hardcoded. Se um agency_operator for em Settings e selecionar um child que não tem config, recebe defaults que NUNCA foram salvos | 🟡 Média |
| **credit_wallets 16 rows, tenant_config 2 rows** | Inconsistência: todos tenants têm wallet mas não config | 🟡 Média |
| **brand_dna 15 de 16** | Um tenant não tem DNA. O wizard deveria funcionar para criar | 🟢 Baixa |
| **content_items 20 rows, posts 27 rows** | Tabelas separadas para content_items e posts. Não claro como se relacionam | 🟡 Média (possível dados duplicados) |
| **write_retry_queue 0 rows** | Funcionalidade de retry existe na tabela mas nunca foi usada | 🟢 Info |
| **Supabase Realtime não utilizado** | Nenhum subscription Realtime no frontend. Tudo via polling (30s + 60s). Desperdiça recursos | 🟡 Média |

---

## 6. PRIORIZAÇÃO RECOMENDADA

### 🔴 P0 — Fix imediato (antes de qualquer feature nova)

1. **Corrigir BrandDna.tsx campos fantasma** → Usar nomes reais do DB
2. **Corrigir char_limits keys PT/EN** → Alinhar com `reel_titulo`, `estatico_paragrafo` etc.
3. **Corrigir tipos JSONB** → `personality_traits`, `brand_values`, `target_audience`, `audience_profile` devem salvar como arrays/objetos, não strings
4. **Adicionar campos reais faltantes** → `voice_tone`, `persona_name`, `language`, `color_palette`, `typography`, `sample_posts`, `generation_notes`, `references_and_benchmarks`, `regional_notes`

### 🟠 P1 — Próxima sprint

5. **Tenant selector no BrandDna** → Agency precisa editar children
6. **Import/Export JSON/MD/TXT** → Compatível com HTML Editor
7. **Rate limiting no wix-auth-bridge**
8. **Auditar RLS policies** (não só `rls_enabled`, mas as policies em si)

### 🟡 P2 — Backlog

9. Migrar polling → Supabase Realtime
10. Propagar tenant_config para todos os 16 tenants
11. Validação de créditos no botão "Gerar"
12. Stepper visual na geração

---

## 7. CONCLUSÃO

O relatório CTO é **estruturalmente correto** na maioria dos pontos de infraestrutura (auth, rotas, Carbon compliance, polling, i18n). Porém **omite completamente o bug mais grave do sistema**: o BrandDna.tsx salvar dados em campos que não existem no banco, causando perda silenciosa de dados do usuário.

A classificação "🟢 ESTÁVEL / PRONTO PARA ESCALA" é **prematura**. O sistema é estável no sentido de não crashar, mas **não é confiável para dados de Brand DNA**, que é uma das features core da plataforma.

**Status correto**: 🟡 **ESTÁVEL COM BUGS DE DADOS CRÍTICOS — NÃO PRONTO PARA ESCALA SEM FIX**

O UltraPrompt `ULTRAPROMPT-BRAND-DNA-V2.md` já endereça todos os itens P0 e P1 listados acima.
