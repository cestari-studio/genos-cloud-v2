# ULTRAPROMPT — Schedule Integration into Content Factory

## MISSION
Integrate the Schedule page (currently standalone at `pages/Schedule.tsx`) as a **tab or sub-view inside the Content Factory** module, accessible via route `/content-factory/schedule`. This is NOT a standalone page anymore — it becomes the publishing queue view of the Content Factory pipeline. Visible to **master (depth=0) and agency (depth=1) only**; client users (depth≥2) must NOT see it.

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

### Current ContentFactory/index.tsx (173 lines)
- Uses `<PageLayout>` wrapper
- Contains `<MatrixList>` (the full DataTable of posts with batch actions, filters, expanded rows, CarouselPreview)
- Has a "Novo Post" Modal that calls edge function `content-factory-ai`
- Gets `tenant` from `useAuth()`
- onNewPost, onRefreshRef, onCountChange callbacks

### Current Schedule.tsx (257 lines)
- Standalone page with its own `<PageLayout>`
- Queries `posts` table: `WHERE tenant_id = X AND (scheduled_date IS NOT NULL OR status = 'approved')`
- DataTable with columns: Título, Formato, Plataforma, Status, Disparo Agendado
- Status tags: draft (cool-gray), scheduled (blue), published (green), cancelled (red)
- SidePanel from `@carbon/ibm-products` for detail view with:
  - StructuredList (Status, Formato, Plataforma, Timeline)
  - TextArea for LLM feedback
  - ButtonSet: Aprovar Envio, Barrar Artefato, Regenerar Node
  - AILabel with "MasterCompliance Tensor" tooltip
- OverflowMenu per row: Ver detalhes, Re-escrever Prompt, Publicar Instantaneamente, Cancelar Fluxo

### posts Table Schema (from MatrixList.tsx types)
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
  created_at: string;
  updated_at: string;
}
```

### Translation System (LocaleSelectorModal.tsx)
Uses `t('key')` function. Supports: pt-BR, en, en-GB, ja. Currently there are NO schedule-specific keys — they must be added.

---

## WHAT TO DO (STEP BY STEP)

### STEP 1 — Add Route
In `App.tsx`:
```tsx
const Schedule = lazy(() => import('./pages/Schedule'));

// Inside FullLayout, add BEFORE the catch-all:
<Route path="/content-factory/schedule" element={guard(<Schedule />)} />
```
The `guard()` function already blocks depth≥2 (clients). This is exactly the behavior we want.

### STEP 2 — Add SideNav Item
In `Shell.tsx`, inside the `<SideNavMenu title={t('contentFactory')}>`, add a NEW item AFTER "Compliance Auditor" and BEFORE "Brand DNA":
```tsx
{!isClient && (
  <SideNavMenuItem
    href="/content-factory/schedule"
    isActive={location.pathname === '/content-factory/schedule'}
    onClick={goTo('/content-factory/schedule')}
  >
    {t('schedule')}
  </SideNavMenuItem>
)}
```
Wrap with `{!isClient && (...)}` since clients (depth≥2) must NOT see it.

Also update the `isActive` logic of the parent `SideNavMenu` to include schedule:
```tsx
isActive={
  location.pathname.startsWith('/factory') ||
  location.pathname === '/content-factory' ||
  location.pathname.startsWith('/content-factory/') ||
  location.pathname.startsWith('/brand-dna')
}
```

### STEP 3 — Add Translation Keys
In `LocaleSelectorModal.tsx`, add to ALL 4 locale objects:
```
// pt-BR
schedule: 'Cronograma',
scheduleSubtitle: 'Terminal de Agendamento — Fila de Publicação',

// en
schedule: 'Schedule',
scheduleSubtitle: 'Publishing Queue — Scheduled Dispatch',

// en-GB
schedule: 'Schedule',
scheduleSubtitle: 'Publishing Queue — Scheduled Dispatch',

// ja
schedule: 'スケジュール',
scheduleSubtitle: '公開キュー — スケジュールディスパッチ',
```

### STEP 4 — Refactor Schedule.tsx
The page STAYS as its own file (`pages/Schedule.tsx`) but needs these changes:

1. **Remove the standalone PageLayout** — replace with `<PageLayout pageName="genOS" pageDescription={t('scheduleSubtitle')} helpMode>` using the new translation key.

2. **Add depth_level guard inside the component** (defensive, in case someone navigates directly):
```tsx
const { me } = useAuth();
const isClient = (me.tenant?.depth_level ?? 0) >= 2;
if (isClient) return <Navigate to="/content-factory" replace />;
```

3. **Replace mock/basic data loading with real Supabase query** — the current `loadData()` is already functional (queries `posts` table), but ensure it also pulls:
   - `content_type`, `platform`, `title`, `status`, `scheduled_date`, `time_slot`
   - Order by `scheduled_date ASC NULLS LAST`

4. **Add real actions to OverflowMenu items:**
   - "Publicar Instantaneamente" → update status to `published`
   - "Cancelar Fluxo" → update status to `cancelled`
   - "Re-escrever Prompt" → call `content-factory-ai` edge function with action `rewrite`

5. **SidePanel actions (ButtonSet)** should actually work:
   - "Aprovar Envio" → `UPDATE posts SET status = 'approved' WHERE id = X`
   - "Barrar Artefato" → `UPDATE posts SET status = 'revision_requested' WHERE id = X`
   - "Regenerar Node" → call edge function for re-generation

6. **Add `useAuth` import** and use `me.tenant.depth_level` for the guard.

### STEP 5 — TypeScript + Build Verification
```bash
npx tsc --noEmit   # Must be zero errors
npx vite build     # Must succeed
```

---

## DESIGN RULES (MANDATORY)

1. **Carbon g100 dark theme** — all backgrounds: `#161616` (layer-01), `#262626` (layer-02), `#393939` (borders)
2. **DO NOT** create custom CSS — use Carbon tokens and inline styles only
3. **DataTable** must use proper Carbon components: `TableToolbar`, `TableToolbarSearch`, `TableToolbarContent`
4. **Tags** use Carbon tag types: `'cool-gray'`, `'blue'`, `'green'`, `'red'`
5. **SidePanel** from `@carbon/ibm-products` — already imported in Schedule.tsx
6. **AILabel** must be present (IBM AI governance indicator)
7. **All strings** must use `t('key')` translation system
8. **Imports**: use relative paths (`../services/api`, `../components/PageLayout`)

---

## ACCEPTANCE CRITERIA

- [ ] Route `/content-factory/schedule` renders Schedule page
- [ ] SideNav shows "Cronograma" under Content Factory (PT-BR) — ONLY for depth 0 and 1
- [ ] Client users (depth≥2) cannot access the route (redirected to /content-factory)
- [ ] Schedule loads real posts from Supabase `posts` table
- [ ] SidePanel opens with post details + actions actually update the database
- [ ] TypeScript compiles with zero errors
- [ ] Vite build succeeds
- [ ] No regressions on existing pages
