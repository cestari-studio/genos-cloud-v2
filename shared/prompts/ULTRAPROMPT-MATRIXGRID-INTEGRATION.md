# ULTRAPROMPT — MatrixGrid (Quality Gate) Integration into Content Factory

## MISSION
Integrate the MatrixGridPage (currently standalone at `pages/MatrixGridPage.tsx`) as a **sub-view inside the Content Factory** module, accessible via route `/content-factory/quality-gate`. This is the **quality assurance dashboard** where master/agency operators validate AI-generated content against the Constraint Kernel before publication. Visible to **master (depth=0) and agency (depth=1) only**; client users (depth≥2) must NOT see it.

---

## ARCHITECTURE CONTEXT

### Stack
- React 18.3 + TypeScript 5.6 + Vite 6.0
- Carbon Design System v11 (`@carbon/react` ^1.71 + `@carbon/ibm-products` ^2.46)
- Theme: g100 (dark)
- Supabase PostgreSQL with RLS
- Router: react-router-dom v6

### Multi-Tenant RBAC
```
depth_level 0 = Master (Cestari Studio) → sees everything
depth_level 1 = Agency → sees everything except admin
depth_level 2 = Client → sees only content-factory + brand-dna (view only)
```
Access control is done via `useAuth()` → `me.tenant.depth_level`.

### Current Route Structure (App.tsx)
```tsx
<Route path="/" element={<Console />} />
<Route path="/console" element={<Console />} />
<Route path="/content-factory" element={<ContentFactory />} />
<Route path="/factory/audit" element={<ComplianceAuditPage />} />
<Route path="/brand-dna" element={<BrandDna />} />
<Route path="/brand-dna/semantic" element={<SemanticMapPage />} />
<Route path="/settings" element={guard(<Settings />)} />
```

### Current SideNav Structure (Shell.tsx)
```tsx
<SideNavMenu title={t('contentFactory')} renderIcon={DataEnrichment}>
  <SideNavMenuItem href="/content-factory">{t('posts')}</SideNavMenuItem>
  <SideNavMenuItem href="/factory/audit">{t('complianceAuditor')}</SideNavMenuItem>
  <SideNavMenuItem href="/brand-dna">{t('brandDna')}</SideNavMenuItem>
  <SideNavMenuItem href="/brand-dna/semantic">{t('semanticMap')}</SideNavMenuItem>
</SideNavMenu>
```

### Current MatrixGridPage.tsx (224 lines)
- Standalone page with its own `<PageLayout>`
- **Uses MOCK DATA** (hardcoded `initialRows` array) — needs to be replaced with real Supabase queries
- Expandable DataTable with columns: Ativo de Conteúdo, Formato/Destino, Status Governança, Score (IBM Granite)
- Expanded row shows TWO panels side-by-side:
  - **LEFT: "Avaliação do Constraint Kernel"** — tone/style, tone match %, char count validation (Pass/Violation tags)
  - **RIGHT: "Ação Corretiva Agêntica"** — Re-Rewrite and Aprovar Exceção buttons
- AILabel tooltips on Score column and inside expanded rows
- Status tags: Approved (green), Drift (red), Pending (blue)
- Confidence score coloring: <85 = red (#da1e28), ≥85 = green (#24a148)
- Pagination at bottom
- Uses `t('matrixGridSubtitle')` for page description

### Current Mock Data Structure
```typescript
interface KernelConstraints {
  chars?: { current: number; min: number; max: number; valid: boolean };
  frames?: { current: number; max: number; valid: boolean };
  style: string;
  toneMatch: number;
}

interface MatrixRow {
  id: string;
  title: string;
  format: string;        // 'Instagram Carousel', 'LinkedIn Article', 'X Post', 'Instagram Reels Video'
  status: string;        // 'Pending', 'Approved', 'Drift'
  confidence: number;    // 72-99
  kernelConstraints: KernelConstraints;
}
```

### Real posts Table Schema (from MatrixList.tsx)
```typescript
interface Post {
  id: string;
  tenant_id: string;
  format: 'feed' | 'carrossel' | 'stories' | 'reels';
  status: 'draft' | 'pending_review' | 'approved' | 'revision_requested' | 'published';
  title: string;
  description: string;
  caption: string;
  cta: string;
  hashtags: string[];
  cards: any[];
  content_type: string;
  platform: string;
  scheduled_date: string | null;
  time_slot: string | null;
  ai_metadata: any;     // JSONB — stores AI generation metadata including confidence, constraints
  created_at: string;
  updated_at: string;
}
```

### brand_dna.char_limits (JSONB) — the Constraint Kernel source
```typescript
char_limits: {
  reel_titulo?: number;
  reel_legenda?: number;
  reel_overlay?: number;
  estatico_titulo?: number;
  estatico_legenda?: number;
  estatico_paragrafo?: number;
  carrossel_titulo_capa?: number;
  carrossel_titulo_card?: number;
  carrossel_texto_card?: number;
  carrossel_legenda?: number;
}
```

### Translation System (LocaleSelectorModal.tsx)
Uses `t('key')` function. Supports: pt-BR, en, en-GB, ja. The key `matrixGridSubtitle` already exists in all locales. New keys needed for the quality gate page.

---

## WHAT TO DO (STEP BY STEP)

### STEP 1 — Add Route
In `App.tsx`:
```tsx
const MatrixGridPage = lazy(() => import('./pages/MatrixGridPage'));

// Inside FullLayout, add BEFORE the catch-all:
<Route path="/content-factory/quality-gate" element={guard(<MatrixGridPage />)} />
```
The `guard()` function already blocks depth≥2 (clients).

### STEP 2 — Add SideNav Item
In `Shell.tsx`, inside the `<SideNavMenu title={t('contentFactory')}>`, add a NEW item AFTER "Compliance Auditor" (and after Schedule if that was already added):
```tsx
{!isClient && (
  <SideNavMenuItem
    href="/content-factory/quality-gate"
    isActive={location.pathname === '/content-factory/quality-gate'}
    onClick={goTo('/content-factory/quality-gate')}
  >
    {t('qualityGate')}
  </SideNavMenuItem>
)}
```
Wrap with `{!isClient && (...)}` since clients (depth≥2) must NOT see it.

Also ensure the parent `SideNavMenu` isActive includes this new path (already covered if the Schedule UltraPrompt updated it to use `location.pathname.startsWith('/content-factory/')`).

### STEP 3 — Add Translation Keys
In `LocaleSelectorModal.tsx`, add to ALL 4 locale objects:
```
// pt-BR
qualityGate: 'Quality Gate',
qualityGateSubtitle: 'Fila de Aprovação Analítica — Constraint Kernel Validation',
qualityGateConstraintTitle: 'Avaliação do Constraint Kernel',
qualityGateConstraintDesc: 'Validação determinística de limites físicos e semânticos.',
qualityGateCorrectiveTitle: 'Ação Corretiva Agêntica',
qualityGateCorrectiveDesc: 'Se houver drift, a IA pode regenerar o node automaticamente.',
qualityGateApprove: 'Aprovar Exceção',
qualityGateRewrite: 'Trigger Re-Rewrite',
qualityGateBulkAction: 'Bater Carga Massiva',
qualityGateSearch: 'Buscar ativo ou campanha...',
qualityGateToneStyle: 'Tom e Estilo Alvo',
qualityGateToneAdherence: 'Aderência de Tom',
qualityGateCharRule: 'Regra de Caracteres',
qualityGateFrameRule: 'Regra de Frames (Vídeo)',
qualityGatePass: 'Pass',
qualityGateViolation: 'Violation',

// en
qualityGate: 'Quality Gate',
qualityGateSubtitle: 'Analytical Approval Queue — Constraint Kernel Validation',
qualityGateConstraintTitle: 'Constraint Kernel Assessment',
qualityGateConstraintDesc: 'Deterministic validation of physical and semantic limits.',
qualityGateCorrectiveTitle: 'Agentic Corrective Action',
qualityGateCorrectiveDesc: 'If drift is detected, AI can automatically regenerate the node.',
qualityGateApprove: 'Approve Exception',
qualityGateRewrite: 'Trigger Re-Rewrite',
qualityGateBulkAction: 'Bulk Process',
qualityGateSearch: 'Search asset or campaign...',
qualityGateToneStyle: 'Target Tone & Style',
qualityGateToneAdherence: 'Tone Adherence',
qualityGateCharRule: 'Character Rule',
qualityGateFrameRule: 'Frame Rule (Video)',
qualityGatePass: 'Pass',
qualityGateViolation: 'Violation',

// en-GB (same as en)
qualityGate: 'Quality Gate',
qualityGateSubtitle: 'Analytical Approval Queue — Constraint Kernel Validation',
qualityGateConstraintTitle: 'Constraint Kernel Assessment',
qualityGateConstraintDesc: 'Deterministic validation of physical and semantic limits.',
qualityGateCorrectiveTitle: 'Agentic Corrective Action',
qualityGateCorrectiveDesc: 'If drift is detected, AI can automatically regenerate the node.',
qualityGateApprove: 'Approve Exception',
qualityGateRewrite: 'Trigger Re-Rewrite',
qualityGateBulkAction: 'Bulk Process',
qualityGateSearch: 'Search asset or campaign...',
qualityGateToneStyle: 'Target Tone & Style',
qualityGateToneAdherence: 'Tone Adherence',
qualityGateCharRule: 'Character Rule',
qualityGateFrameRule: 'Frame Rule (Video)',
qualityGatePass: 'Pass',
qualityGateViolation: 'Violation',

// ja
qualityGate: 'クオリティゲート',
qualityGateSubtitle: '分析的承認キュー — コンストレイントカーネル検証',
qualityGateConstraintTitle: 'コンストレイントカーネル評価',
qualityGateConstraintDesc: '物理的およびセマンティック制限の決定論的検証。',
qualityGateCorrectiveTitle: 'エージェンティック是正措置',
qualityGateCorrectiveDesc: 'ドリフトが検出された場合、AIは自動的にノードを再生成できます。',
qualityGateApprove: '例外を承認',
qualityGateRewrite: '再書き込みトリガー',
qualityGateBulkAction: '一括処理',
qualityGateSearch: 'アセットまたはキャンペーンを検索...',
qualityGateToneStyle: 'ターゲットトーン＆スタイル',
qualityGateToneAdherence: 'トーンアドヒアランス',
qualityGateCharRule: '文字数ルール',
qualityGateFrameRule: 'フレームルール（動画）',
qualityGatePass: '合格',
qualityGateViolation: '違反',
```

### STEP 4 — Refactor MatrixGridPage.tsx (MAJOR CHANGES)

This is the biggest change. The page currently uses **100% mock data**. It needs to become **real**.

#### 4A — Add Auth Guard + Real Data Loading
```tsx
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { api } from '../services/api';
import { t } from '../components/LocaleSelectorModal';

export default function MatrixGridPage() {
  const { me } = useAuth();
  const isClient = (me.tenant?.depth_level ?? 0) >= 2;

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  if (isClient) return <Navigate to="/content-factory" replace />;

  const loadPosts = async () => {
    setLoading(true);
    const tenantId = api.getActiveTenantId();
    if (!tenantId) { setRows([]); setLoading(false); return; }

    // Load posts in pending_review or approved status (the quality gate queue)
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['pending_review', 'approved', 'revision_requested'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Also load brand_dna for char_limits (Constraint Kernel source)
      const { data: dnaData } = await supabase
        .from('brand_dna')
        .select('char_limits, voice_tone, content_rules')
        .eq('tenant_id', tenantId)
        .single();

      const charLimits = dnaData?.char_limits || {};
      const voiceTone = dnaData?.voice_tone || {};

      // Map real posts to MatrixGrid rows with computed constraints
      const mapped = data.map((post: any) => ({
        id: post.id,
        title: post.title || '—',
        format: formatLabel(post.format, post.platform),
        status: mapStatus(post.status),
        confidence: post.ai_metadata?.confidence ?? computeConfidence(post, charLimits),
        kernelConstraints: computeKernelConstraints(post, charLimits, voiceTone),
        _raw: post, // keep raw for actions
      }));

      setRows(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { loadPosts(); }, []);

  // ... rest of component
}
```

#### 4B — Helper Functions for Constraint Computation
```typescript
function formatLabel(format: string, platform?: string): string {
  const labels: Record<string, string> = {
    feed: 'Instagram Feed',
    carrossel: 'Instagram Carousel',
    stories: 'Instagram Stories',
    reels: 'Instagram Reels',
  };
  return platform ? `${labels[format] || format} — ${platform}` : labels[format] || format;
}

function mapStatus(dbStatus: string): string {
  const map: Record<string, string> = {
    pending_review: 'Pending',
    approved: 'Approved',
    revision_requested: 'Drift',
  };
  return map[dbStatus] || dbStatus;
}

function computeConfidence(post: any, charLimits: any): number {
  // Simple heuristic: check how many constraints pass
  let score = 85; // base
  const caption = post.caption || '';
  const title = post.title || '';

  // Check char limits based on format
  if (post.format === 'carrossel') {
    const maxCaption = charLimits.carrossel_legenda;
    if (maxCaption && caption.length > maxCaption) score -= 15;
    const maxTitle = charLimits.carrossel_titulo_capa;
    if (maxTitle && title.length > maxTitle) score -= 10;
  } else if (post.format === 'reels') {
    const maxCaption = charLimits.reel_legenda;
    if (maxCaption && caption.length > maxCaption) score -= 15;
  } else {
    const maxCaption = charLimits.estatico_legenda;
    if (maxCaption && caption.length > maxCaption) score -= 15;
  }

  return Math.max(50, Math.min(99, score));
}

function computeKernelConstraints(post: any, charLimits: any, voiceTone: any) {
  const caption = post.caption || '';
  const title = post.title || '';
  let charRule: any = undefined;

  if (post.format === 'carrossel') {
    const max = charLimits.carrossel_legenda || 600;
    charRule = { current: caption.length, min: 0, max, valid: caption.length <= max };
  } else if (post.format === 'reels') {
    const max = charLimits.reel_legenda || 300;
    charRule = { current: caption.length, min: 0, max, valid: caption.length <= max };
  } else {
    const max = charLimits.estatico_legenda || 400;
    charRule = { current: caption.length, min: 0, max, valid: caption.length <= max };
  }

  // Tone match from AI metadata or estimate
  const toneMatch = post.ai_metadata?.tone_match ?? 90;

  return {
    chars: charRule,
    style: voiceTone?.primary || 'Default',
    toneMatch,
  };
}
```

#### 4C — Wire Up Real Actions
The OverflowMenu and expanded row buttons must actually call Supabase:

```typescript
const handleApprove = async (postId: string) => {
  await supabase.from('posts').update({ status: 'approved' }).eq('id', postId);
  loadPosts(); // refresh
};

const handleRewrite = async (postId: string) => {
  const post = rows.find(r => r.id === postId)?._raw;
  if (!post) return;
  await api.edgeFn('content-factory-ai', {
    action: 'rewrite',
    tenantId: post.tenant_id,
    postId: post.id,
  });
  loadPosts();
};

const handleDiscard = async (postId: string) => {
  await supabase.from('posts').update({ status: 'revision_requested' }).eq('id', postId);
  loadPosts();
};
```

#### 4D — Replace hardcoded strings with `t()` calls
Every visible string must use translation keys from Step 3.

### STEP 5 — TypeScript + Build Verification
```bash
npx tsc --noEmit   # Must be zero errors
npx vite build     # Must succeed
```

---

## DESIGN RULES (MANDATORY)

1. **Carbon g100 dark theme** — backgrounds: `#161616`, `#262626`, `#393939` borders
2. **DO NOT** create custom CSS — use Carbon tokens and inline styles
3. **Expandable DataTable** must keep the current 2-column Grid layout inside expanded rows
4. **AILabel** must remain on Score column and inside expanded rows (IBM AI governance indicator)
5. **Tags** — Approved=green, Drift=red, Pending=blue (Carbon tag types)
6. **Confidence coloring** — <85 red (#da1e28), ≥85 green (#24a148)
7. **Constraint Kernel** validation rules come from `brand_dna.char_limits` JSONB
8. **All strings** must use `t('key')` translation system
9. **Security icon** on Constraint Kernel header stays
10. **Pagination** must work with real data (pageSizes: [10, 20, 30, 40, 50])

---

## DATA FLOW (Architecture)

```
User creates post → ContentFactory (MatrixList)
    ↓
Post saved to `posts` table (status: 'pending_review')
    ↓
Quality Gate (MatrixGridPage) shows pending posts
    ↓ reads brand_dna.char_limits for Constraint Kernel rules
    ↓ computes confidence score + constraint validation
    ↓
Operator reviews → Approve / Re-Rewrite / Discard
    ↓
If approved → post.status = 'approved' → appears in Schedule
If re-written → edge function regenerates → back to pending_review
If discarded → post.status = 'revision_requested'
```

---

## ACCEPTANCE CRITERIA

- [ ] Route `/content-factory/quality-gate` renders MatrixGridPage
- [ ] SideNav shows "Quality Gate" under Content Factory — ONLY for depth 0 and 1
- [ ] Client users (depth≥2) cannot access the route (redirected to /content-factory)
- [ ] Page loads REAL posts from Supabase `posts` table (NO more mock data)
- [ ] Constraint Kernel rules derived from `brand_dna.char_limits` JSONB
- [ ] Confidence score computed from actual char violations + ai_metadata
- [ ] "Aprovar Exceção" button updates post status to `approved` in database
- [ ] "Trigger Re-Rewrite" button calls edge function for AI re-generation
- [ ] Expanded row shows real constraint data (char counts vs. limits)
- [ ] Pagination works with real row count
- [ ] TypeScript compiles with zero errors
- [ ] Vite build succeeds
- [ ] No regressions on existing pages
