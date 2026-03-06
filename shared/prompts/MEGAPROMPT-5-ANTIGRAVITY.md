# MegaPrompt 5 — genOS Cloud v2 (Antigravity)

## IDENTIDADE DO PROJETO
- **Nome**: genOS Cloud v2
- **Stack**: React 18.3 + TypeScript 5.6 + Vite 6.0 + Supabase + Vercel
- **Design System**: Carbon Design System v11 (`@carbon/react` ^1.71) + Carbon for IBM.com (`@carbon/ibm-products` ^2.46)
- **Tema**: g100 (dark)
- **Diretório UI**: `ui-react/`
- **Deploy**: Vercel (app.cestari.studio)
- **Backend**: Supabase (qyfjkvwlpgjlpveqnkax)

---

## REGRA ABSOLUTA — CARBON DESIGN SYSTEM

**TUDO neste projeto DEVE usar componentes nativos do Carbon Design System.**

Você NÃO pode criar componentes custom quando existe um equivalente no Carbon. Isto inclui:

| Necessidade | Componente Carbon CORRETO | ❌ PROIBIDO |
|---|---|---|
| Painéis laterais (user/notificação) | `<HeaderPanel>` + `<Switcher>` | `<div>` custom com backdrop |
| Botões de ícone | `<IconButton>` | `<button>` HTML com style inline |
| Badge AI inline | `<AILabel kind="inline">` com `<AILabelContent>` | `<Tag>` com `<span>` custom |
| Badge AI grande | `<AILabel size="xl">` com `<AILabelContent>` | Custom div |
| Tabs | `<Tabs>` + `<TabList>` + `<Tab>` + `<TabPanels>` + `<TabPanel>` | Buttons custom com estado |
| Modais | `<Modal>` ou `<ComposedModal>` | Dialog HTML custom |
| Formulários | `<TextInput>`, `<TextArea>`, `<NumberInput>`, `<Select>`, `<Toggle>` | `<input>` / `<select>` HTML |
| Notificações | `<InlineNotification>`, `<ToastNotification>` | Alert custom |
| Loading | `<Loading>`, `<InlineLoading>` | Spinner custom |
| Tables | `<DataTable>` + `<Table>` + `<TableHead>` etc. | `<table>` HTML |
| Header da página | `<PageHeader>` (de `@carbon/ibm-products`) | `<div>` com `<h1>` custom |
| Gráficos | `@carbon/charts-react` | Chart.js, Recharts etc. |
| Ícones | `@carbon/icons-react` | SVG inline, Font Awesome etc. |

### Padrão para Painéis Laterais (Shell.tsx)
```tsx
import { HeaderPanel, Switcher, SwitcherItem, SwitcherDivider } from '@carbon/react';

// Painel do usuário
<HeaderPanel
  aria-label="Painel do usuário"
  expanded={isUserPanelExpanded}
  className="shell-user-header-panel"
>
  <Switcher aria-label="Opções do usuário">
    <SwitcherItem aria-label="Usuário">...</SwitcherItem>
    <SwitcherDivider />
    <SwitcherItem aria-label="Logout">
      <Button kind="danger--tertiary" renderIcon={Logout} onClick={handleLogout}>
        {t('logout')}
      </Button>
    </SwitcherItem>
  </Switcher>
</HeaderPanel>
```

### Padrão para AILabel (PageLayout.tsx)
```tsx
import { AILabel, AILabelContent, IconButton } from '@carbon/react';
import { Help } from '@carbon/icons-react';

// Badge AI inline (tokens)
<AILabel autoAlign kind="inline" size="sm">
  <AILabelContent>
    <div style={{ padding: '0.75rem' }}>
      <p>AI Token Usage</p>
      <p>{credits} / {maxCredits}</p>
    </div>
  </AILabelContent>
</AILabel>

// Botão de ajuda
<IconButton label="Ajuda" kind="ghost" size="sm" onClick={() => setHelpOpen(true)}>
  <Help />
</IconButton>

// Badge AI grande (Content Factory)
<AILabel autoAlign size="xl">
  <AILabelContent>
    <div style={{ padding: '1rem' }}>
      <p>AI Powered</p>
      <p>Conteúdo gerado e avaliado por modelos de IA.</p>
    </div>
  </AILabelContent>
</AILabel>
```

---

## IMPORTS OBRIGATÓRIOS — NÃO INVENTAR

Todos os imports DEVEM vir destes pacotes:

```tsx
// Componentes Carbon
import { Button, IconButton, Tag, Modal, TextInput, TextArea, NumberInput,
  Select, SelectItem, Toggle, InlineNotification, ToastNotification,
  Loading, InlineLoading, DataTable, Table, TableHead, TableRow, TableHeader,
  TableBody, TableCell, Grid, Column, Tabs, TabList, Tab, TabPanels, TabPanel,
  Header, HeaderName, HeaderNavigation, HeaderMenuItem, HeaderGlobalBar,
  HeaderGlobalAction, HeaderPanel, Switcher, SwitcherItem, SwitcherDivider,
  SideNav, SideNavItems, SideNavLink, SideNavMenu, SideNavMenuItem,
  AILabel, AILabelContent, Link, Dropdown, ComboBox, MultiSelect,
  ProgressBar, Slider, Tooltip, Popover, PopoverContent,
  ComposedModal, ModalHeader, ModalBody, ModalFooter
} from '@carbon/react';

// Carbon for IBM.com
import { PageHeader } from '@carbon/ibm-products';

// Ícones
import { Add, Edit, TrashCan, Save, Close, Checkmark, ChevronDown,
  Notification, UserAvatar, Settings, Help, Logout, Copy, Download,
  Upload, Renew, WarningAlt, Information, ArrowRight, Menu
} from '@carbon/icons-react';

// Charts (quando necessário)
import { DonutChart, BarChartSimple, LineChart } from '@carbon/charts-react';
import '@carbon/charts-react/styles.css';
```

---

## ESTRUTURA DE ARQUIVOS

```
ui-react/src/
├── components/
│   ├── Shell.tsx              — Header + SideNav + HeaderPanel(s)
│   ├── PageLayout.tsx         — Layout padrão de todas as páginas
│   ├── LocaleSelectorModal.tsx — i18n modal + função t()
│   ├── NotificationCenter.tsx  — Centro de notificações
│   └── ThemeProvider.tsx       — Tema g100
├── contexts/
│   └── AuthContext.tsx         — useAuth() → me, login, logout
├── pages/
│   ├── Factory.tsx             — Content Factory (main)
│   ├── BrandDna.tsx            — Brand DNA editor
│   ├── Settings.tsx            — Configurações do tenant/child
│   ├── Console.tsx             — Dashboard
│   ├── ComplianceAuditPage.tsx — Compliance Audit
│   ├── SemanticMapPage.tsx     — Semantic Map (D3)
│   ├── Schedule.tsx            — Agendamento
│   └── MatrixGridPage.tsx      — Matrix Grid
├── services/
│   └── api.ts                 — Supabase client + helpers
└── App.tsx                    — Routes + ErrorBoundary
```

---

## PADRÃO PageLayout

TODAS as páginas usam `<PageLayout>`. Props:

```tsx
<PageLayout
  pageSubtitle="genOS - Content Factory"  // aparece no subtitle
  itemCount={posts.length}                 // opcional: "19 posts | genOS - ..."
  helpMode                                 // true = mostra IconButton ? em vez de AILabel
  actions={<Button>...</Button>}           // ações no header direito
>
  {children}
</PageLayout>
```

- Content Factory: `helpMode={false}` (mostra AILabel grande)
- Todas as outras: `helpMode={true}` (mostra IconButton com ícone Help)

---

## MULTI-TENANT

- 14 tenants: 1 master (depth=0), 1 agency (depth=1), 12 clients (depth=2)
- Auth via Supabase Auth
- `me.tenant` = tenant do usuário logado
- `me.wallet?.credits` = tokens AI disponíveis
- `me.role` = role (master_admin, agency_admin, client_admin, editor, viewer)
- RLS em todas as tabelas

---

## SUPABASE TABLES (principais)

- `tenants` — id, name, parent_id, depth, settings (jsonb)
- `brand_dna` — tenant_id, brand_name, tagline, voice_tone (jsonb), personality_traits (jsonb), audience_segments (jsonb), content_rules (jsonb), hashtag_strategy (jsonb), editorial_pillars (jsonb), char_limits (jsonb), visual_identity (jsonb), competitor_analysis (jsonb)
- `tenant_config` — tenant_id, ai_model, fallback_model, char_limits (jsonb legado)
- `content_items` — id, tenant_id, status, title, body, caption, cta, hashtags, format, category, ai_model, created_at
- `ai_sessions` — tracking de uso de AI
- `wallets` — tenant_id, credits
- `profiles` — user_id, tenant_id, role, full_name, avatar_url

---

## EDGE FUNCTIONS (Supabase)

6 funções em `supabase/functions/`:
1. `ai-router` (v11) — roteador principal AI
2. `content-generator` (v7) — geração de conteúdo
3. `content-factory-ai` (v8) — motor da Content Factory
4. `ai-generate` (v5) — geração direta
5. `ai-hashtags` (v5) — geração de hashtags
6. `wix-auth-bridge` (v16) — integração Wix

Todas usam Brand DNA completo via `build_agent_envelope` RPC.

---

## BUGS CONHECIDOS A CORRIGIR

### 1. Click-outside nos HeaderPanels
O `useEffect` de click-outside em `Shell.tsx` deve fechar os HeaderPanels quando clica fora. Usar seletores CSS do Carbon:
```tsx
useEffect(() => {
  const handler = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('.cds--header-panel') || t.closest('.cds--header__action')) return;
    setIsNotificationPanelExpanded(false);
    setIsUserPanelExpanded(false);
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, []);
```

### 2. Reload Loop
- `App.tsx` tem `ErrorBoundary` que captura crashes
- `index.html` tem `Cache-Control: no-cache` meta tags
- Nenhum `useEffect` pode ter dependências que mudam a cada render
- Settings.tsx: `eslint-disable react-hooks/exhaustive-deps` no effect que carrega config

### 3. Token Display
- Tokens vêm de `me.wallet?.credits` via `useAuth()`
- Exibir com `<AILabel kind="inline">` no PageLayout
- Exibir com `<SwitcherItem>` no user panel do Shell

---

## PROIBIÇÕES

1. ❌ **NUNCA** usar `<div>` ou `<button>` HTML quando existe componente Carbon equivalente
2. ❌ **NUNCA** usar `style={{}}` inline extensivo — usar classes CSS do Carbon (`cds--` prefixo)
3. ❌ **NUNCA** usar Chart.js, Recharts, D3 diretamente — usar `@carbon/charts-react`
4. ❌ **NUNCA** usar Font Awesome ou SVG inline — usar `@carbon/icons-react`
5. ❌ **NUNCA** criar componentes de formulário custom — usar Carbon `TextInput`, `Select`, `Toggle` etc.
6. ❌ **NUNCA** remover imports existentes do Carbon para substituir por custom
7. ❌ **NUNCA** usar `useRef` para click-outside quando Carbon `HeaderPanel` já gerencia foco
8. ❌ **NUNCA** ignorar tipagem TypeScript — `npx tsc --noEmit` deve dar zero erros

---

## CHECKLIST ANTES DE ENTREGAR

- [ ] `npx tsc --noEmit` = zero erros
- [ ] `npx vite build` = OK
- [ ] Todos os painéis laterais usam `<HeaderPanel>`
- [ ] Todos os botões de ícone usam `<IconButton>`
- [ ] Badge AI inline usa `<AILabel kind="inline">`
- [ ] Badge AI grande usa `<AILabel size="xl">`
- [ ] Botão de ajuda usa `<IconButton>` com `<Help />`
- [ ] Nenhum `<button>` ou `<input>` HTML nativo no código
- [ ] Nenhum `style={{}}` com mais de 3 propriedades (preferir classes CSS)
- [ ] Click-outside funciona sem useRef (usa seletores CSS do Carbon)
- [ ] Settings.tsx não causa reload loop
- [ ] Todos os textos passam por `t()` para i18n
