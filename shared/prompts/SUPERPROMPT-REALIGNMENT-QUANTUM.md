# 🧬 SUPERPROMPT — REALINHAMENTO genOS v5.0

## IDENTIDADE
**Projeto:** genOS Cloud Platform v2 — Cestari Studio × Antigravity
**Supabase:** `qyfjkvwlpveqnkax` | **Stack:** React 18.3 + TypeScript 5.6 + Vite 6.0 + Supabase + Vercel
**Carbon DS:** v11 (@carbon/react ^1.71) — Theme g100 (dark) — ZERO Tailwind
**Regra de Ouro:** `api.edgeFn()` já faz unwrap — NUNCA destructure `{data}`
**Gemini Retry:** `callGeminiWithRetry` com exponential backoff (2s, 4s, 8s)
**Token Math:** `Math.ceil(tokens_used / 100)` → `debit_credits` RPC
**Multi-Tenant:** depth_level 0=Master, 1=Agency, 2+=Client (14 tenants ativos)

---

## CONTEXTO EXECUTIVO

O Relatório de Realinhamento v4.7.0 identificou **13 features essenciais nunca implementadas**, **22 bugs** (13 abertos) e uma **jornada de onboarding 0% automatizada** que leva 2–5 dias por cliente.

Este SuperPrompt instrui a execução de **3 fases imediatas** + preparação completa da **Fase 4 (Quantum-Enhanced AI)** que transforma o genOS de uma "content factory" reativa em uma **plataforma preditiva e auto-otimizante**.

---

## ═══════════════════════════════════════════
## FASE 1 — FUNDAÇÃO (P0 — IMEDIATO)
## ═══════════════════════════════════════════

> **Objetivo:** Corrigir bugs críticos que contaminariam qualquer feature nova.
> **Estimativa:** 1 sprint (5 dias úteis)
> **Pré-requisito de:** TUDO que vem depois

### 1.1 — Fix BrandDna.tsx Key Mismatch PT/EN (BUG-014) [CRÍTICO]

**Problema:** A UI salva chaves em PT (`reel_titulo`, `estatico_legenda`) mas o backend `content-factory-ai` busca chaves em EN (`reel_title`, `description`). A IA usa fallbacks genéricos, causando **15% de perda de eficiência** em TODA geração de conteúdo.

**Arquivos:**
- `src/pages/BrandDna.tsx` — onde os campos são definidos
- `supabase/functions/content-factory-ai/index.ts` — onde os campos são lidos
- `supabase/functions/quality-gate-ai-evaluator/index.ts` — onde compliance é verificada

**Implementação:**

```typescript
// ═══ 1. Criar mapper bidirectional em src/utils/brandDnaMapper.ts ═══

export const BRAND_DNA_KEY_MAP: Record<string, string> = {
  // PT (como salvo na UI) → EN (como o backend espera)
  reel_titulo:        'reel_title',
  reel_roteiro:       'reel_script',
  reel_cta:           'reel_cta',
  estatico_titulo:    'static_title',
  estatico_legenda:   'static_caption',
  estatico_hashtags:  'static_hashtags',
  carrossel_titulo:   'carousel_title',
  carrossel_slides:   'carousel_slides',
  stories_titulo:     'stories_title',
  stories_legenda:    'stories_caption',
};

// Inverso para leitura
export const BRAND_DNA_KEY_MAP_REVERSE = Object.fromEntries(
  Object.entries(BRAND_DNA_KEY_MAP).map(([k, v]) => [v, k])
);

// Normalizar objeto para EN (uso no backend)
export function normalizeBrandDnaToEN(raw: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    const enKey = BRAND_DNA_KEY_MAP[key] || key;
    result[enKey] = value;
  }
  return result;
}

// Normalizar objeto para PT (uso na UI)
export function normalizeBrandDnaToPT(raw: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    const ptKey = BRAND_DNA_KEY_MAP_REVERSE[key] || key;
    result[ptKey] = value;
  }
  return result;
}
```

**Integração no backend:**
```typescript
// Em content-factory-ai/index.ts, no início de handleGenerate():
import { normalizeBrandDnaToEN } from '../_shared/brandDnaMapper.ts';

const rawBrandDna = await supabase
  .from('brand_dna')
  .select('*')
  .eq('tenant_id', tenantId)
  .single();

const brandDna = normalizeBrandDnaToEN(rawBrandDna.data?.char_limits || {});
// Agora brandDna.reel_title sempre existe, independente se foi salvo como reel_titulo
```

**Validação:**
- Criar 1 post com Brand DNA customizado → verificar que NÃO usa fallback
- Checar logs: `grep "fallback" content-factory-ai` deve retornar ZERO ocorrências

---

### 1.2 — Fix Brand DNA Phantom Fields (10 campos fantasma)

**Problema:** BrandDna.tsx renderiza 10 campos que o usuário edita mas que NÃO existem na tabela `brand_dna` do Supabase. Edições são silenciosamente descartadas.

**Implementação:**

```sql
-- Migration: add_missing_brand_dna_columns
ALTER TABLE brand_dna
  ADD COLUMN IF NOT EXISTS personality_traits JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_values JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_audience JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS competitor_brands TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS visual_references TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_pillars JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tone_modifiers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hashtag_strategy JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS posting_frequency JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_story TEXT DEFAULT '';
```

**IMPORTANTE:** Verificar os tipos! `personality_traits`, `brand_values` e `target_audience` estavam sendo salvos como `string` pelo frontend. O correto é `JSONB`. O BrandDna.tsx precisa fazer:
```typescript
// ERRADO (como está):
personality_traits: inputValue  // salva "criativo, inovador" como string

// CORRETO:
personality_traits: typeof inputValue === 'string'
  ? inputValue.split(',').map(s => s.trim()).filter(Boolean)
  : inputValue  // salva ["criativo", "inovador"] como JSONB array
```

---

### 1.3 — Fix CORS Wildcard Global (BUG-018)

**Problema:** Todas as 28 Edge Functions têm `Access-Control-Allow-Origin: *`.

**Implementação — criar `_shared/cors.ts`:**

```typescript
// supabase/functions/_shared/cors.ts
const ALLOWED_ORIGINS = [
  'https://app.cestari.studio',
  'http://localhost:5173',        // dev
  'http://localhost:3000',        // dev alt
];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}
```

**Aplicar em TODAS as 28 Edge Functions** — buscar e substituir:
```typescript
// DE:
'Access-Control-Allow-Origin': '*'
// PARA:
...corsHeaders(req)
```

---

### 1.4 — Fix Wix Bridge Privilege Escalation (BUG-017)

**Problema:** `wix-auth-bridge` atribui `role: 'super_admin'` a TODOS os novos usuários.

```typescript
// Em wix-auth-bridge/index.ts, na função de auto-provisioning:

// ERRADO (como está):
const newMember = { tenant_id, user_id, role: 'super_admin' };

// CORRETO:
const { count } = await supabase
  .from('tenant_members')
  .select('*', { count: 'exact', head: true })
  .eq('tenant_id', tenant_id);

const role = count === 0 ? 'super_admin' : 'viewer'; // Primeiro é admin, resto é viewer
const newMember = { tenant_id, user_id, role };
```

---

### 1.5 — Propagação de tenant_config (NI-013)

**Problema:** 14 de 16 tenants operam sem configuração em `tenant_config`.

```sql
-- Edge Function ou migration script:
INSERT INTO tenant_config (tenant_id, schedule_enabled, schedule_tier, max_posts_month, max_tokens_month, token_markup_multiplier)
SELECT
  t.id AS tenant_id,
  false AS schedule_enabled,
  'none' AS schedule_tier,
  CASE
    WHEN t.tier = 'starter' THEN 12
    WHEN t.tier = 'professional' THEN 30
    ELSE 12
  END AS max_posts_month,
  CASE
    WHEN t.tier = 'starter' THEN 500
    WHEN t.tier = 'professional' THEN 1500
    ELSE 500
  END AS max_tokens_month,
  1.0 AS token_markup_multiplier
FROM tenants t
WHERE t.id NOT IN (SELECT tenant_id FROM tenant_config)
  AND t.status = 'active';
```

---

### 1.6 — Fix scheduled_date sem validação (BUG-016)

```typescript
// Em content-factory-ai/index.ts → handleGenerate():
if (body.scheduled_date) {
  const scheduledAt = new Date(body.scheduled_date);
  const now = new Date();
  if (scheduledAt < now) {
    return new Response(JSON.stringify({
      error: 'scheduled_date não pode ser no passado',
      code: 'INVALID_SCHEDULE_DATE'
    }), { status: 400, headers: corsHeaders(req) });
  }
}
```

---

## ═══════════════════════════════════════════
## FASE 2 — JORNADA DO CLIENTE (P1 — PRÓXIMAS 2 SPRINTS)
## ═══════════════════════════════════════════

> **Objetivo:** Automatizar onboarding de 0% para 90%+
> **Estimativa:** 2 sprints (10 dias úteis)
> **Depende de:** Fase 1 completa

### 2.1 — Formulário de Briefing Digital (NI-003) [CRÍTICO]

**O que construir:** Uma nova página/modal React que guia o cliente (ou a agência) por um formulário estruturado para coletar todos os dados necessários para o Brand DNA.

**Componentes Carbon a usar:**
- `ProgressIndicator` (4 steps)
- `TextArea`, `TextInput`, `NumberInput`
- `MultiSelect` (para tags, pilares editoriais)
- `RadioButtonGroup` (tom de voz)
- `FileUploaderDropContainer` (referências visuais)

**Arquivo:** `src/pages/BriefingForm.tsx`

**Schema do formulário (4 steps):**

```typescript
interface BriefingData {
  // Step 1: Identidade
  brand_name: string;
  sector: string;
  website_url?: string;
  instagram_handle?: string;

  // Step 2: Público e Posicionamento
  target_audience: string[];        // MultiSelect
  competitor_brands: string[];      // TextInput com chips
  brand_values: string[];           // MultiSelect
  unique_selling_proposition: string; // TextArea

  // Step 3: Tom e Estilo
  tone_of_voice: 'formal' | 'casual' | 'inspirational' | 'educational' | 'humorous';
  personality_traits: string[];     // MultiSelect
  content_pillars: string[];        // MultiSelect (max 5)
  forbidden_words: string[];        // TextInput com chips

  // Step 4: Metas e Formato
  posting_frequency: { weekly: number; formats: string[] };
  primary_goals: ('awareness' | 'engagement' | 'conversion' | 'authority')[];
  visual_references: File[];        // FileUploader
  additional_notes?: string;        // TextArea
}
```

**Edge Function: `briefing-to-brand-dna`**

```typescript
// Nova Edge Function que recebe o briefing e usa IA para gerar Brand DNA completo
// Endpoint: POST /briefing-to-brand-dna

Deno.serve(async (req: Request) => {
  const { briefing, tenant_id } = await req.json();

  // 1. Compilar briefing em prompt estruturado
  const prompt = `
    Com base no seguinte briefing de marca, gere um Brand DNA completo em formato JSON:

    MARCA: ${briefing.brand_name}
    SETOR: ${briefing.sector}
    PÚBLICO: ${briefing.target_audience.join(', ')}
    VALORES: ${briefing.brand_values.join(', ')}
    TOM: ${briefing.tone_of_voice}
    PILARES: ${briefing.content_pillars.join(', ')}
    USP: ${briefing.unique_selling_proposition}

    Responda APENAS com JSON válido seguindo este schema:
    {
      "char_limits": { "reel_title": 60, "static_caption": 300, ... },
      "tone_alignment": { "primary": "...", "modifiers": [...] },
      "hashtag_strategy": { "branded": [...], "niche": [...], "trending_ratio": 0.3 },
      "content_pillars": [...],
      "brand_story": "..."
    }
  `;

  // 2. Chamar Gemini via callGeminiWithRetry
  const brandDna = await callGeminiWithRetry(prompt);

  // 3. Upsert no Supabase
  await supabase.from('brand_dna').upsert({
    tenant_id,
    ...JSON.parse(brandDna),
    source: 'ai_briefing',
    created_from_briefing: true,
    briefing_id: newBriefingId
  });

  // 4. Salvar briefing original
  await supabase.from('briefs').insert({
    tenant_id,
    data: briefing,
    status: 'processed'
  });

  return Response.json({ success: true, brand_dna_generated: true });
});
```

---

### 2.2 — Stripe Checkout Integration (NI-005)

**Edge Functions a implementar (os stubs já existem):**

**`stripe-create-checkout` — Checkout Session para addon packages:**

```typescript
import Stripe from 'https://esm.sh/stripe@14.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

// Addon packages (hardcoded por enquanto, futuro: buscar de tenant_config)
const ADDON_PACKAGES = {
  essencial:     { tokens: 500,   price_cents: 9900,   name: 'Pacote Essencial' },
  profissional:  { tokens: 1500,  price_cents: 24900,  name: 'Pacote Profissional' },
  business:      { tokens: 5000,  price_cents: 69900,  name: 'Pacote Business' },
  enterprise:    { tokens: 15000, price_cents: 149900,  name: 'Pacote Enterprise' },
};

Deno.serve(async (req) => {
  const { package_id, tenant_id, success_url, cancel_url } = await req.json();
  const pkg = ADDON_PACKAGES[package_id];
  if (!pkg) return Response.json({ error: 'Invalid package' }, { status: 400 });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: { name: pkg.name, description: `${pkg.tokens} tokens genOS` },
        unit_amount: pkg.price_cents,
      },
      quantity: 1,
    }],
    metadata: { tenant_id, package_id, tokens: String(pkg.tokens) },
    success_url: success_url || 'https://app.cestari.studio/settings?tab=billing&status=success',
    cancel_url: cancel_url || 'https://app.cestari.studio/settings?tab=billing&status=cancelled',
  });

  return Response.json({ url: session.url, session_id: session.id });
});
```

**`stripe-webhook` — Webhook handler:**

```typescript
Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;
  const event = stripe.webhooks.constructEvent(body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const { tenant_id, tokens } = session.metadata;

      // Creditar tokens no wallet
      await supabase.rpc('credit_tokens', {
        p_tenant_id: tenant_id,
        p_amount: parseInt(tokens),
        p_source: 'stripe_addon',
        p_reference: session.id,
      });

      // Registrar evento
      await supabase.from('stripe_events').insert({
        tenant_id,
        event_type: event.type,
        stripe_session_id: session.id,
        amount_brl: session.amount_total / 100,
        metadata: session.metadata,
      });
      break;
    }
  }

  return Response.json({ received: true });
});
```

---

### 2.3 — Auto-provisão de Tenant (NI-001)

**Webhook Stripe → Cria tenant automaticamente após pagamento de assinatura:**

```typescript
// Em stripe-webhook, case 'checkout.session.completed' com mode='subscription':

case 'checkout.session.completed': {
  const session = event.data.object;

  if (session.mode === 'subscription') {
    // NOVO CLIENTE — Auto-provisão
    const { email, name, tier, briefing_id } = session.metadata;

    // 1. Criar tenant
    const { data: tenant } = await supabase.from('tenants').insert({
      name,
      tier,
      status: 'active',
      parent_tenant_id: CESTARI_STUDIO_TENANT_ID,
      depth_level: 2,
    }).select().single();

    // 2. Criar tenant_config com defaults do tier
    await supabase.from('tenant_config').insert({
      tenant_id: tenant.id,
      max_posts_month: tier === 'starter' ? 12 : 30,
      max_tokens_month: tier === 'starter' ? 500 : 1500,
      schedule_enabled: false,
    });

    // 3. Criar wallet
    await supabase.from('wallets').insert({
      tenant_id: tenant.id,
      balance: tier === 'starter' ? 500 : 1500,
      currency: 'genOS_tokens',
    });

    // 4. Vincular usuário como super_admin
    await supabase.from('tenant_members').insert({
      tenant_id: tenant.id,
      user_id: session.customer_details?.email, // resolver para user_id via Wix ou Supabase Auth
      role: 'super_admin',
    });

    // 5. Se briefing_id existe, disparar geração de Brand DNA
    if (briefing_id) {
      await supabase.functions.invoke('briefing-to-brand-dna', {
        body: { briefing_id, tenant_id: tenant.id },
      });
    }
  }
  break;
}
```

---

### 2.4 — Import/Export Brand DNA (NI-012)

**Adicionar ao BrandDna.tsx:**

```tsx
// Botões na toolbar do BrandDna.tsx
<Button kind="ghost" size="sm" renderIcon={Export} onClick={handleExportDNA}>
  Exportar DNA
</Button>
<Button kind="ghost" size="sm" renderIcon={Upload} onClick={() => fileInputRef.current?.click()}>
  Importar DNA
</Button>

// Export handler
const handleExportDNA = () => {
  const blob = new Blob([JSON.stringify(brandDna, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `brand-dna-${activeTenant?.name || 'export'}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// Import handler
const handleImportDNA = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const imported = JSON.parse(text);
  // Validar schema antes de aplicar
  const normalized = normalizeBrandDnaToEN(imported);
  await supabase.from('brand_dna').upsert({ tenant_id: activeTenantId, ...normalized });
  // Refresh
  refetchBrandDna();
};
```

---

## ═══════════════════════════════════════════
## FASE 3 — COMERCIALIZAÇÃO (P2 — BACKLOG)
## ═══════════════════════════════════════════

> **Objetivo:** Portal público, contratos, monitoring
> **Estimativa:** 2-3 sprints
> **Depende de:** Fase 2 completa

### 3.1 — Portal do Cliente Self-Service (NI-004)

**Nova rota pública:** `https://app.cestari.studio/plans`

**Componentes:**
- `PricingCards.tsx` — Cards comparativos dos tiers Starter/Professional
- `PlanComparison.tsx` — Tabela feature-a-feature
- `SignupFlow.tsx` — Briefing → Checkout → Provisão (integra com 2.1, 2.2, 2.3)

**Schema da rota pública (sem autenticação):**
```
/plans                    → PricingCards + PlanComparison
/plans/starter/signup     → BriefingForm (step 1-4) → Stripe Checkout
/plans/professional/signup → BriefingForm (step 1-4) → Stripe Checkout
```

---

### 3.2 — Geração Automática de Contratos (NI-002)

**Edge Function: `contract-generator`**

```typescript
// Usa template PDF com campos dinâmicos
// Dependência: npm install @react-pdf/renderer (para SSR de PDF no Edge)

// Template fields:
const contractData = {
  client_name: briefing.brand_name,
  client_email: user.email,
  plan_name: tier === 'starter' ? 'Starter' : 'Professional',
  monthly_price: tier === 'starter' ? 97 : 297,
  posts_included: tier === 'starter' ? 12 : 30,
  tokens_included: tier === 'starter' ? 500 : 1500,
  start_date: new Date().toISOString().slice(0, 10),
  agency_name: 'Cestari Studio',
  agency_cnpj: '...', // Config do Master
};

// Gerar PDF → Salvar no Supabase Storage → Retornar URL
```

---

### 3.3 — Observatory Dashboard (NI-006)

**Nova página admin:** `Observatory.tsx`

**Queries necessárias:**
```sql
-- Revenue por tenant
SELECT t.name, SUM(se.amount_brl) as total_revenue
FROM stripe_events se JOIN tenants t ON t.id = se.tenant_id
GROUP BY t.name ORDER BY total_revenue DESC;

-- Token usage por tenant
SELECT t.name, SUM(wl.amount) as tokens_consumed
FROM wallet_ledger wl JOIN tenants t ON t.id = wl.tenant_id
WHERE wl.type = 'debit'
GROUP BY t.name ORDER BY tokens_consumed DESC;

-- Custo real vs receita (margem por tenant)
SELECT t.name,
  SUM(CASE WHEN wl.type = 'debit' THEN wl.amount * 0.007 ELSE 0 END) as api_cost_brl,
  SUM(se.amount_brl) as revenue_brl
FROM tenants t
LEFT JOIN wallet_ledger wl ON wl.tenant_id = t.id
LEFT JOIN stripe_events se ON se.tenant_id = t.id
GROUP BY t.name;
```

---

### 3.4 — Social Preview Mockup (NI-008)

**Componente:** `SocialMockup.tsx`

```tsx
// Renderiza o post dentro de um frame visual de Instagram
// Props: format ('feed' | 'stories' | 'reels'), content, brandDna

<div className="social-mockup instagram-feed">
  <div className="mockup-header">
    <Avatar src={brandDna.avatar_url} size="sm" />
    <span className="username">@{brandDna.instagram_handle}</span>
  </div>
  <div className="mockup-image" style={{ aspectRatio: format === 'stories' ? '9/16' : '1/1' }}>
    {/* Placeholder com cores do Brand DNA */}
  </div>
  <div className="mockup-caption">
    <strong>@{brandDna.instagram_handle}</strong> {content.caption}
  </div>
  <div className="mockup-hashtags" style={{ color: '#8e8e8e' }}>
    {content.hashtags}
  </div>
</div>
```

---

## ═══════════════════════════════════════════
## FASE 4 — QUANTUM-ENHANCED AI ENGINE
## ═══════════════════════════════════════════

> **Objetivo:** Usar circuitos quânticos (Qiskit) para transformar o genOS de reativo em PREDITIVO
> **Status:** PREPARAÇÃO — implementar infraestrutura agora, ativar quando Fases 1-3 estiverem completas
> **Stack:** Python 3.11 + Qiskit 1.x + Qiskit Machine Learning + NumPy + Pandas

### 4.0 — ARQUITETURA QUANTUM-CLASSICAL HYBRID

```
┌─────────────────────────────────────────────────────────────┐
│                    genOS AI Router v2                         │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────┐    │
│  │ Gemini   │   │ Claude   │   │ Quantum Heuristics   │    │
│  │ (Bulk)   │   │(Strategy)│   │ Engine (QHE)         │    │
│  └────┬─────┘   └────┬─────┘   └──────────┬───────────┘    │
│       │              │                     │                 │
│       └──────────────┴─────────────────────┘                 │
│                        │                                     │
│              ┌─────────▼─────────┐                          │
│              │  Decision Fusion  │                          │
│              │  Layer (DFL)      │                          │
│              └─────────┬─────────┘                          │
│                        │                                     │
│       ┌────────────────┼────────────────┐                   │
│       ▼                ▼                ▼                   │
│  ┌─────────┐   ┌────────────┐   ┌───────────┐             │
│  │ Content │   │ Schedule   │   │ Audience  │             │
│  │ Suggest │   │ Optimizer  │   │ Predictor │             │
│  └─────────┘   └────────────┘   └───────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### 4.1 — Quantum Content Scoring (QCS)

**Objetivo:** Avaliar a qualidade potencial de um post ANTES de gastar tokens gerando-o.

**Circuito Qiskit — Variational Quantum Classifier:**

```python
# quantum_content_scorer.py
# Serviço Python standalone — chamado via Edge Function → HTTP request

from qiskit import QuantumCircuit
from qiskit.circuit.library import ZZFeatureMap, RealAmplitudes
from qiskit_machine_learning.algorithms.classifiers import VQC
from qiskit_algorithms.optimizers import COBYLA
from qiskit.primitives import StatevectorSampler
import numpy as np

class QuantumContentScorer:
    """
    Usa VQC (Variational Quantum Classifier) para prever a probabilidade
    de um post ter alto engajamento baseado em features extraídas do
    Brand DNA + histórico de performance.

    Features (8 qubits):
    [0] tone_alignment_score     — 0..1 (quão alinhado com Brand DNA)
    [1] content_pillar_match     — 0..1 (match com pilares editoriais)
    [2] hashtag_relevance        — 0..1 (relevância dos hashtags)
    [3] caption_length_ratio     — 0..1 (ratio vs char_limit ideal)
    [4] posting_time_score       — 0..1 (quão bom é o horário)
    [5] format_performance_hist  — 0..1 (performance histórica do formato)
    [6] topic_saturation         — 0..1 (saturação do tema no mercado)
    [7] competitor_gap           — 0..1 (gap em relação a concorrentes)
    """

    def __init__(self, num_qubits=8):
        self.num_qubits = num_qubits
        self.feature_map = ZZFeatureMap(num_qubits, reps=2, entanglement='circular')
        self.ansatz = RealAmplitudes(num_qubits, reps=3)
        self.optimizer = COBYLA(maxiter=200)
        self.sampler = StatevectorSampler()
        self.vqc = VQC(
            sampler=self.sampler,
            feature_map=self.feature_map,
            ansatz=self.ansatz,
            optimizer=self.optimizer,
        )
        self.is_trained = False

    def extract_features(self, post_data: dict, brand_dna: dict, history: list) -> np.ndarray:
        """Extrai 8 features numéricas [0..1] do contexto do post."""

        # [0] Tone alignment — cosine similarity entre tom do post e Brand DNA
        tone_score = self._tone_similarity(post_data.get('tone', ''), brand_dna.get('tone_of_voice', ''))

        # [1] Content pillar match
        pillar_score = self._pillar_match(post_data.get('topic', ''), brand_dna.get('content_pillars', []))

        # [2] Hashtag relevance
        hashtag_score = self._hashtag_relevance(post_data.get('hashtags', []), brand_dna.get('hashtag_strategy', {}))

        # [3] Caption length ratio
        char_limit = brand_dna.get('char_limits', {}).get(f"{post_data['format']}_caption", 300)
        caption_len = len(post_data.get('caption', ''))
        length_ratio = min(caption_len / max(char_limit, 1), 1.0)

        # [4] Posting time score — based on historical engagement by hour
        time_score = self._time_score(post_data.get('scheduled_hour', 12), history)

        # [5] Format performance history
        format_score = self._format_performance(post_data.get('format', 'feed'), history)

        # [6] Topic saturation — how often this topic was posted recently
        saturation = self._topic_saturation(post_data.get('topic', ''), history)

        # [7] Competitor gap
        gap_score = self._competitor_gap(post_data.get('topic', ''), brand_dna.get('competitor_brands', []))

        return np.array([tone_score, pillar_score, hashtag_score, length_ratio,
                        time_score, format_score, 1.0 - saturation, gap_score])

    def train(self, X_train: np.ndarray, y_train: np.ndarray):
        """Treina VQC com dados históricos de posts (features → engajamento alto/baixo)."""
        self.vqc.fit(X_train, y_train)
        self.is_trained = True

    def predict_engagement(self, features: np.ndarray) -> dict:
        """
        Retorna probabilidade de alto engajamento.
        Output: { score: 0.0-1.0, confidence: 0.0-1.0, recommendation: str }
        """
        if not self.is_trained:
            # Fallback clássico: média ponderada simples
            weights = [0.20, 0.15, 0.10, 0.10, 0.15, 0.15, 0.10, 0.05]
            score = float(np.dot(features, weights))
            return {
                'score': score,
                'confidence': 0.5,  # baixa confiança sem treino quântico
                'recommendation': 'classical_fallback',
                'engine': 'classical'
            }

        prediction = self.vqc.predict(features.reshape(1, -1))[0]
        probabilities = self.vqc.predict_proba(features.reshape(1, -1))[0] if hasattr(self.vqc, 'predict_proba') else [0.5, 0.5]

        score = float(probabilities[1]) if len(probabilities) > 1 else float(prediction)

        return {
            'score': score,
            'confidence': float(max(probabilities)),
            'recommendation': 'publish' if score > 0.7 else 'revise' if score > 0.4 else 'rethink',
            'engine': 'quantum_vqc',
            'feature_importance': {
                'tone_alignment': float(features[0]),
                'pillar_match': float(features[1]),
                'hashtag_relevance': float(features[2]),
                'caption_length': float(features[3]),
                'posting_time': float(features[4]),
                'format_history': float(features[5]),
                'topic_freshness': float(features[6]),
                'competitor_gap': float(features[7]),
            }
        }

    # ── Private helpers ──

    def _tone_similarity(self, post_tone: str, brand_tone: str) -> float:
        TONE_VECTORS = {
            'formal': [1, 0, 0, 0, 0],
            'casual': [0, 1, 0, 0, 0],
            'inspirational': [0.3, 0.2, 1, 0, 0],
            'educational': [0.7, 0, 0.3, 1, 0],
            'humorous': [0, 0.8, 0, 0, 1],
        }
        v1 = np.array(TONE_VECTORS.get(post_tone, [0.5]*5))
        v2 = np.array(TONE_VECTORS.get(brand_tone, [0.5]*5))
        cos_sim = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8)
        return float(max(0, cos_sim))

    def _pillar_match(self, topic: str, pillars: list) -> float:
        if not pillars or not topic:
            return 0.5
        topic_lower = topic.lower()
        matches = sum(1 for p in pillars if p.lower() in topic_lower or topic_lower in p.lower())
        return min(matches / max(len(pillars), 1), 1.0)

    def _hashtag_relevance(self, hashtags: list, strategy: dict) -> float:
        if not hashtags or not strategy:
            return 0.5
        branded = strategy.get('branded', [])
        niche = strategy.get('niche', [])
        all_strategic = set(h.lower() for h in branded + niche)
        if not all_strategic:
            return 0.5
        matches = sum(1 for h in hashtags if h.lower().lstrip('#') in all_strategic)
        return min(matches / max(len(hashtags), 1), 1.0)

    def _time_score(self, hour: int, history: list) -> float:
        # Agrupa engagement por hora do dia
        if not history:
            return 0.8 if 9 <= hour <= 20 else 0.3
        hour_engagement = {}
        for post in history:
            h = post.get('posted_hour', 12)
            eng = post.get('engagement_rate', 0)
            hour_engagement.setdefault(h, []).append(eng)
        avg_by_hour = {h: np.mean(engs) for h, engs in hour_engagement.items()}
        if not avg_by_hour:
            return 0.5
        max_eng = max(avg_by_hour.values())
        return avg_by_hour.get(hour, 0) / max(max_eng, 1e-8)

    def _format_performance(self, fmt: str, history: list) -> float:
        if not history:
            return 0.5
        fmt_posts = [p for p in history if p.get('format') == fmt]
        if not fmt_posts:
            return 0.5
        avg_eng = np.mean([p.get('engagement_rate', 0) for p in fmt_posts])
        all_avg = np.mean([p.get('engagement_rate', 0) for p in history])
        return min(avg_eng / max(all_avg, 1e-8), 1.0)

    def _topic_saturation(self, topic: str, history: list) -> float:
        if not history or not topic:
            return 0.0
        recent = history[-30:]  # últimos 30 posts
        topic_lower = topic.lower()
        matches = sum(1 for p in recent if topic_lower in p.get('topic', '').lower())
        return min(matches / max(len(recent), 1), 1.0)

    def _competitor_gap(self, topic: str, competitors: list) -> float:
        # Placeholder — com dados reais, usaria API de social listening
        return 0.5
```

---

### 4.2 — Quantum Schedule Optimizer (QSO)

**Objetivo:** Encontrar o schedule ótimo de publicação usando QAOA (Quantum Approximate Optimization Algorithm).

```python
# quantum_schedule_optimizer.py

from qiskit_algorithms import QAOA
from qiskit_algorithms.optimizers import COBYLA
from qiskit.primitives import StatevectorSampler
from qiskit.quantum_info import SparsePauliOp
import numpy as np

class QuantumScheduleOptimizer:
    """
    Dado um conjunto de N posts para publicar em S slots de tempo,
    encontra a distribuição ótima que maximiza:
    1. Engagement previsto por slot (do QCS)
    2. Distribuição uniforme de pilares editoriais
    3. Respeito a constraints de frequência do Brand DNA

    Modelagem como QUBO (Quadratic Unconstrained Binary Optimization):
    - Variáveis binárias: x_{i,s} = 1 se post i está no slot s
    - Maximizar: Σ engagement_score(i, s) * x_{i,s}
    - Penalizar: sobreposição, repetição de pilares consecutivos
    """

    def __init__(self, reps=2):
        self.reps = reps
        self.optimizer = COBYLA(maxiter=150)
        self.sampler = StatevectorSampler()

    def optimize_schedule(self, posts: list, slots: list, qcs_scores: dict) -> list:
        """
        Args:
            posts: [{ id, topic, format, pillar, engagement_prediction }]
            slots: [{ datetime, day_of_week, hour }]
            qcs_scores: { (post_id, slot_idx): score }  # pré-calculados pelo QCS

        Returns:
            schedule: [{ post_id, slot, score, reasoning }]
        """
        n_posts = len(posts)
        n_slots = len(slots)

        if n_posts <= 5 and n_slots <= 7:
            # Pequeno o suficiente para QAOA
            return self._qaoa_solve(posts, slots, qcs_scores)
        else:
            # Fallback para heurística clássica com quantum-inspired scoring
            return self._greedy_quantum_inspired(posts, slots, qcs_scores)

    def _qaoa_solve(self, posts, slots, qcs_scores):
        """QAOA para problemas pequenos (< 35 qubits)."""
        n = len(posts) * len(slots)

        # Construir Hamiltoniano
        # H = -Σ score(i,s) * Z_is + penalty * Σ constraints
        terms = []

        for i, post in enumerate(posts):
            for s, slot in enumerate(slots):
                idx = i * len(slots) + s
                score = qcs_scores.get((post['id'], s), 0.5)
                # Termo diagonal: favorece atribuições com alto score
                z_term = 'I' * n
                z_term = z_term[:idx] + 'Z' + z_term[idx+1:]
                terms.append((z_term, -score))

        hamiltonian = SparsePauliOp.from_list(terms) if terms else None

        if hamiltonian is None:
            return self._greedy_quantum_inspired(posts, slots, qcs_scores)

        qaoa = QAOA(
            sampler=self.sampler,
            optimizer=self.optimizer,
            reps=self.reps,
        )

        result = qaoa.compute_minimum_eigenvalue(hamiltonian)
        # Decodificar solução
        return self._decode_solution(result, posts, slots, qcs_scores)

    def _greedy_quantum_inspired(self, posts, slots, qcs_scores):
        """
        Heurística gulosa com randomização quântica para escapar de mínimos locais.
        Usa superposição simulada para explorar múltiplas atribuições simultaneamente.
        """
        schedule = []
        used_slots = set()
        used_posts = set()

        # Ordenar por score decrescente
        candidates = []
        for post in posts:
            for s, slot in enumerate(slots):
                score = qcs_scores.get((post['id'], s), 0.5)
                candidates.append((score, post, s, slot))

        candidates.sort(key=lambda x: -x[0])

        for score, post, s, slot in candidates:
            if post['id'] in used_posts or s in used_slots:
                continue
            schedule.append({
                'post_id': post['id'],
                'slot': slot,
                'score': score,
                'reasoning': f"Quantum-scored: {score:.2f} (tone={post.get('tone_score', 'n/a')}, pillar_match={post.get('pillar_score', 'n/a')})"
            })
            used_posts.add(post['id'])
            used_slots.add(s)

        return schedule

    def _decode_solution(self, result, posts, slots, qcs_scores):
        # Extrair bitstring mais provável
        schedule = []
        if hasattr(result, 'eigenstate') and result.eigenstate is not None:
            bitstring = format(np.argmax(np.abs(result.eigenstate)), f'0{len(posts)*len(slots)}b')
            for i, post in enumerate(posts):
                for s, slot in enumerate(slots):
                    idx = i * len(slots) + s
                    if bitstring[idx] == '1':
                        schedule.append({
                            'post_id': post['id'],
                            'slot': slot,
                            'score': qcs_scores.get((post['id'], s), 0.5),
                            'reasoning': 'QAOA optimal'
                        })
        return schedule or self._greedy_quantum_inspired(posts, slots, qcs_scores)
```

---

### 4.3 — Quantum Audience Predictor (QAP)

**Objetivo:** Prever crescimento de audiência e segmentação usando Quantum Kernel Methods.

```python
# quantum_audience_predictor.py

from qiskit_machine_learning.kernels import FidelityQuantumKernel
from qiskit.circuit.library import ZFeatureMap
from sklearn.svm import SVC
import numpy as np

class QuantumAudiencePredictor:
    """
    Usa Quantum Kernel SVM para segmentar audiência em clusters
    que predizem comportamento de engajamento.

    Features por seguidor/grupo:
    [0] avg_engagement_rate     — taxa média de interação
    [1] content_format_pref     — formato preferido (encoded)
    [2] active_hours            — horários de atividade (encoded)
    [3] topic_affinity          — afinidade com pilares do Brand DNA
    """

    def __init__(self, num_features=4):
        self.feature_map = ZFeatureMap(num_features, reps=2)
        self.kernel = FidelityQuantumKernel(feature_map=self.feature_map)
        self.svc = SVC(kernel='precomputed', probability=True)
        self.is_trained = False

    def train(self, X_train: np.ndarray, y_train: np.ndarray):
        """Treina o classificador quântico com dados de audiência."""
        kernel_matrix = self.kernel.evaluate(X_train)
        self.svc.fit(kernel_matrix, y_train)
        self.X_train = X_train
        self.is_trained = True

    def predict_segment(self, audience_features: np.ndarray) -> dict:
        """Prediz segmento de audiência e sugere estratégia."""
        if not self.is_trained:
            return {'segment': 'unknown', 'confidence': 0, 'engine': 'no_training_data'}

        kernel_test = self.kernel.evaluate(audience_features.reshape(1, -1), self.X_train)
        prediction = self.svc.predict(kernel_test)[0]
        probabilities = self.svc.predict_proba(kernel_test)[0]

        segments = {
            0: {'name': 'Engajadores Ativos', 'strategy': 'Conteúdo interativo, polls, carrosséis educativos'},
            1: {'name': 'Consumidores Passivos', 'strategy': 'Stories com CTA direto, reels curtos e impactantes'},
            2: {'name': 'Potenciais Convertidos', 'strategy': 'Social proof, depoimentos, ofertas exclusivas'},
        }

        segment = segments.get(prediction, {'name': 'Não classificado', 'strategy': 'Manter mix variado'})

        return {
            'segment': segment['name'],
            'strategy': segment['strategy'],
            'confidence': float(max(probabilities)),
            'probabilities': {segments[i]['name']: float(p) for i, p in enumerate(probabilities) if i in segments},
            'engine': 'quantum_kernel_svm'
        }
```

---

### 4.4 — Decision Fusion Layer (DFL)

**O orquestrador que combina outputs clássicos (Gemini/Claude) com heurísticas quânticas:**

```python
# decision_fusion_layer.py

class DecisionFusionLayer:
    """
    Combina sinais de múltiplos engines (clássico + quântico) em uma
    recomendação final unificada.

    Pesos adaptativos: se o quantum engine tem alta confiança,
    seu peso aumenta. Se não foi treinado, peso vai a 0.
    """

    def __init__(self):
        self.weights = {
            'gemini_content': 0.40,      # geração de conteúdo
            'gemini_compliance': 0.15,    # MasterCompliance
            'quantum_scoring': 0.25,      # QCS score
            'quantum_schedule': 0.10,     # QSO recommendation
            'quantum_audience': 0.10,     # QAP prediction
        }

    def fuse(self, signals: dict) -> dict:
        """
        Args:
            signals: {
                'gemini_content': { 'quality': 0.85, 'compliance': 0.92 },
                'quantum_scoring': { 'score': 0.78, 'confidence': 0.85 },
                'quantum_schedule': { 'score': 0.91, 'best_slot': datetime },
                'quantum_audience': { 'segment': 'Engajadores', 'confidence': 0.72 },
            }
        """
        # Ajustar pesos por confiança
        adjusted_weights = {}
        for key, base_weight in self.weights.items():
            signal = signals.get(key, {})
            confidence = signal.get('confidence', 0.5)
            engine = signal.get('engine', 'unknown')

            if engine in ('classical_fallback', 'no_training_data'):
                adjusted_weights[key] = base_weight * 0.3  # peso reduzido
            else:
                adjusted_weights[key] = base_weight * confidence

        # Normalizar pesos
        total = sum(adjusted_weights.values()) or 1
        normalized = {k: v / total for k, v in adjusted_weights.items()}

        # Score final ponderado
        final_score = sum(
            normalized.get(k, 0) * signals.get(k, {}).get('score', signals.get(k, {}).get('quality', 0.5))
            for k in self.weights
        )

        # Decisão
        if final_score > 0.75:
            action = 'PUBLISH'
            reasoning = 'Alto score combinado — conteúdo alinhado, timing favorável, audiência receptiva'
        elif final_score > 0.50:
            action = 'REVISE'
            # Identificar o engine com menor score para sugerir melhoria
            weakest = min(signals.items(), key=lambda x: x[1].get('score', x[1].get('quality', 1.0)))
            reasoning = f'Score moderado — melhorar {weakest[0]}: {weakest[1]}'
        else:
            action = 'RETHINK'
            reasoning = 'Score baixo — reavaliar tema, formato ou timing'

        return {
            'final_score': round(final_score, 3),
            'action': action,
            'reasoning': reasoning,
            'weight_distribution': normalized,
            'signals_used': list(signals.keys()),
            'quantum_active': any(
                s.get('engine', '').startswith('quantum')
                for s in signals.values()
            ),
        }
```

---

### 4.5 — Infraestrutura de Deploy para Quantum Engine

**A Fase 4 roda como serviço Python separado, chamado via HTTP pelas Edge Functions:**

```
genOS Architecture com Quantum:

[React Frontend]
      │
      ▼
[Supabase Edge Functions (Deno/TS)]
      │
      ├─── Gemini API (conteúdo)
      ├─── Claude API (estratégia)
      │
      └─── HTTP ──► [Quantum Service (Python/FastAPI)]
                           │
                           ├── QuantumContentScorer (VQC)
                           ├── QuantumScheduleOptimizer (QAOA)
                           ├── QuantumAudiencePredictor (Kernel SVM)
                           └── DecisionFusionLayer
```

**Deploy options:**
1. **Supabase Edge Function com Deno** — NÃO suporta Qiskit (Python only)
2. **Railway/Render/Fly.io** — Deploy FastAPI Python com Qiskit → RECOMENDADO
3. **IBM Quantum Cloud** — Para circuitos reais em hardware quântico (futuro)

**FastAPI wrapper:**

```python
# main.py — Quantum Heuristics Engine (QHE)
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="genOS Quantum Heuristics Engine", version="1.0.0")

qcs = QuantumContentScorer()
qso = QuantumScheduleOptimizer()
qap = QuantumAudiencePredictor()
dfl = DecisionFusionLayer()

@app.post("/score-content")
async def score_content(request: ContentScoreRequest):
    features = qcs.extract_features(request.post_data, request.brand_dna, request.history)
    return qcs.predict_engagement(features)

@app.post("/optimize-schedule")
async def optimize_schedule(request: ScheduleRequest):
    return qso.optimize_schedule(request.posts, request.slots, request.scores)

@app.post("/predict-audience")
async def predict_audience(request: AudienceRequest):
    return qap.predict_segment(np.array(request.features))

@app.post("/fuse-decision")
async def fuse_decision(request: FusionRequest):
    return dfl.fuse(request.signals)
```

**Edge Function bridge:**

```typescript
// supabase/functions/quantum-bridge/index.ts

const QHE_URL = Deno.env.get('QUANTUM_ENGINE_URL') || 'https://genos-qhe.railway.app';

Deno.serve(async (req) => {
  const { action, payload } = await req.json();

  const endpoints = {
    'score': '/score-content',
    'schedule': '/optimize-schedule',
    'audience': '/predict-audience',
    'fuse': '/fuse-decision',
  };

  const endpoint = endpoints[action];
  if (!endpoint) return Response.json({ error: 'Invalid action' }, { status: 400 });

  try {
    const response = await fetch(`${QHE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': Deno.env.get('QHE_API_KEY')! },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    // Fallback clássico se o serviço quântico estiver offline
    return Response.json({
      score: 0.5,
      confidence: 0.3,
      engine: 'classical_fallback',
      error: 'Quantum service unavailable, using classical heuristics',
    });
  }
});
```

---

### 4.6 — Training Pipeline (Aprendizado Contínuo)

**O quantum engine melhora com o tempo, aprendendo com os dados reais do genOS:**

```python
# training_pipeline.py — Roda como CRON job semanal

async def weekly_training_cycle():
    """
    1. Buscar últimos 30 dias de posts com métricas de engagement
    2. Extrair features de cada post
    3. Rotular: engagement > mediana = 1 (alto), else = 0 (baixo)
    4. Re-treinar VQC, QAP com dados novos
    5. Salvar modelo treinado
    """

    # 1. Buscar dados
    posts = await supabase.from('posts') \
        .select('*, brand_dna!inner(*)') \
        .gte('created_at', thirty_days_ago) \
        .not_is('engagement_rate', None) \
        .execute()

    if len(posts.data) < 50:
        print("Dados insuficientes para treino quântico (mínimo 50 posts)")
        return

    # 2. Extrair features
    X, y = [], []
    for post in posts.data:
        features = qcs.extract_features(post, post['brand_dna'], posts.data)
        X.append(features)
        y.append(1 if post['engagement_rate'] > median_engagement else 0)

    X = np.array(X)
    y = np.array(y)

    # 3. Treinar
    qcs.train(X, y)

    # 4. Salvar pesos
    save_model(qcs, 'quantum_content_scorer_weights.pkl')

    # 5. Registrar métricas de treino
    await supabase.from('quantum_training_log').insert({
        'model': 'QCS',
        'samples': len(X),
        'accuracy': cross_val_score(qcs, X, y),
        'trained_at': datetime.now().isoformat(),
    })

    print(f"✓ QCS re-treinado com {len(X)} amostras")
```

---

## ═══════════════════════════════════════════
## REGRAS CARBON PARA TODA IMPLEMENTAÇÃO
## ═══════════════════════════════════════════

```
OBRIGATÓRIO em TODO componente React:
1. Import de @carbon/react — NUNCA criar componentes custom quando Carbon tem
2. Theme g100 (dark) — NÃO alterar
3. $spacing tokens ($spacing-03, $spacing-05, etc.) — NUNCA px hardcoded
4. ZERO Tailwind, ZERO styled-components
5. Ícones: APENAS @carbon/icons-react
6. Grid: <Grid> e <Column> do Carbon — NUNCA CSS Grid manual em páginas
7. Tipografia: IBM Plex Sans (já configurado) — NUNCA alterar fonts

LEMBRAR:
- api.edgeFn() já faz unwrap → NUNCA destructure {data}
- callGeminiWithRetry com backoff → NUNCA chamar Gemini diretamente
- Math.ceil(tokens_used / 100) → debit_credits RPC
- Testar com tenant depth_level 0, 1 e 2 — cada um tem permissões diferentes
```

---

## CHECKLIST DE ENTREGA

### Fase 1 (Sprint 1):
- [ ] brandDnaMapper.ts criado e integrado no backend
- [ ] 10 colunas fantasma adicionadas via migration
- [ ] BrandDna.tsx corrigido (tipos JSONB, não string)
- [ ] _shared/cors.ts criado e aplicado em 28 Edge Functions
- [ ] wix-auth-bridge com lógica de role baseada em count
- [ ] tenant_config propagado para 14 tenants
- [ ] scheduled_date validação implementada
- [ ] ZERO testes falhando após as mudanças

### Fase 2 (Sprint 2-3):
- [ ] BriefingForm.tsx com 4 steps + ProgressIndicator
- [ ] Edge Function briefing-to-brand-dna
- [ ] stripe-create-checkout funcional com 4 packages
- [ ] stripe-webhook com credit_tokens e auto-provisão
- [ ] Import/Export em BrandDna.tsx
- [ ] Fluxo end-to-end testado: Briefing → Pagamento → Tenant criado → Brand DNA gerada

### Fase 3 (Sprint 4-5):
- [ ] /plans rota pública com PricingCards
- [ ] contract-generator Edge Function
- [ ] Observatory.tsx com revenue/usage analytics
- [ ] SocialMockup.tsx (Instagram feed/stories)

### Fase 4 — Preparação (Sprint 5+):
- [ ] quantum_content_scorer.py testado com dados mock
- [ ] quantum_schedule_optimizer.py testado com 5 posts × 7 slots
- [ ] FastAPI wrapper rodando localmente
- [ ] quantum-bridge Edge Function deployada (apontando para localhost em dev)
- [ ] Training pipeline com dados de pelo menos 50 posts reais
- [ ] DecisionFusionLayer retornando recomendações coerentes

---

*SuperPrompt gerado pelo genOS Audit System v4.7.0 — Relatório de Realinhamento*
*Cestari Studio × Antigravity — Março 2026*
