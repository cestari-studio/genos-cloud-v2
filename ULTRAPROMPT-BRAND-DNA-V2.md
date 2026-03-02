# UltraPrompt — Brand DNA Editor v2 (genOS Antigravity)

## CONTEXTO DO PROJETO

- **Stack**: React 18.3 + TypeScript 5.6 + Vite 6.0 + Supabase + Vercel
- **Design System**: Carbon Design System v11 (`@carbon/react` ^1.71) + `@carbon/ibm-products` ^2.46
- **Tema**: g100 (dark)
- **Diretório**: `ui-react/src/pages/BrandDna.tsx`
- **Backend**: Supabase (qyfjkvwlpgjlpveqnkax)
- **MegaPrompt obrigatório**: `MEGAPROMPT-5-ANTIGRAVITY.md` (todas as regras Carbon se aplicam)

---

## MISSÃO

Refatorar completamente `BrandDna.tsx` para:

1. **Corrigir campos fantasma** — o editor atual escreve em campos que NÃO existem na tabela `brand_dna`
2. **Alinhar com o schema real do Supabase** — usar EXATAMENTE os nomes das colunas do banco
3. **Adicionar Import/Export** — JSON, MD e TXT compatíveis com o HTML Brand DNA Editor externo
4. **Adicionar Tenant Selector** — agency pode selecionar qual child tenant editar
5. **Manter 100% Carbon Design System** — zero componentes HTML custom

---

## SCHEMA REAL — Supabase `brand_dna`

```sql
-- 25 colunas na tabela brand_dna
id                        UUID PRIMARY KEY
tenant_id                 UUID REFERENCES tenants(id)
voice_tone                JSONB    -- {"primary": "...", "secondary": "...", "tertiary": "..."}
voice_description         TEXT     -- Descrição textual do tom de voz
language                  TEXT     -- "pt-BR", "en-US" etc.
persona_name              TEXT     -- Nome da persona da marca
regional_notes            TEXT     -- Notas regionais
content_rules             JSONB    -- {"style": "...", "principle": "...", "fixed_description_footer": "..."}
forbidden_words           TEXT[]   -- Array de palavras proibidas
hashtag_strategy          JSONB    -- {"primary": [...], "fixed_hashtags": [...], "max_total": N, "generate_remaining": bool, "strategy": "..."}
color_palette             JSONB    -- [{"hex": "#...", "name": "..."}]
sample_posts              JSONB    -- Array de posts exemplo
created_at                TIMESTAMPTZ
updated_at                TIMESTAMPTZ
personality_traits        JSONB    -- Array de strings: ["técnico", "confiante", ...]
typography                JSONB    -- Configurações de tipografia
target_audience           JSONB    -- [{"segment": "..."}]
brand_values              JSONB    -- Array de strings: ["design estratégico", ...]
char_limits               JSONB    -- Ver seção CHAR_LIMITS abaixo
editorial_pillars         JSONB    -- Array de strings ou objetos
audience_profile          JSONB    -- {"demographic": "..."}
references_and_benchmarks JSONB    -- Referências e benchmarks
generation_notes          TEXT     -- Notas para o motor de geração de conteúdo
mandatory_terms           TEXT[]   -- Array de termos obrigatórios
strict_compliance         BOOLEAN  -- Conformidade rigorosa
```

---

## BUG CRÍTICO — CAMPOS FANTASMA NO BrandDna.tsx ATUAL

O `BrandDna.tsx` atual escreve em 10 campos que **NÃO EXISTEM** no banco:

| Campo Fantasma (BrandDna.tsx)  | Campo REAL no DB        | Tipo DB  |
|-------------------------------|------------------------|----------|
| `brand_name`                  | `persona_name`         | TEXT     |
| `mission`                     | ❌ NÃO EXISTE          | —        |
| `vision`                      | ❌ NÃO EXISTE          | —        |
| `values`                      | `brand_values`         | JSONB    |
| `tone_of_voice`               | `voice_description`    | TEXT     |
| `preferred_vocabulary`        | `mandatory_terms`      | TEXT[]   |
| `words_to_avoid`              | `forbidden_words`      | TEXT[]   |
| `personas`                    | ❌ NÃO EXISTE          | —        |
| `content_guidelines`          | `generation_notes`     | TEXT     |
| `content_examples`            | `sample_posts`         | JSONB    |

### O que acontece hoje:
- Quando o usuário salva, Supabase **ignora silenciosamente** os campos fantasma
- Dados reais como `voice_tone`, `persona_name`, `color_palette`, `typography`, `references_and_benchmarks`, `language`, `regional_notes` **NUNCA são editados**

### Campos reais que o editor NÃO edita:
- `voice_tone` (JSONB com primary/secondary/tertiary)
- `voice_description` (TEXT)
- `language` (TEXT)
- `persona_name` (TEXT)
- `regional_notes` (TEXT)
- `color_palette` (JSONB)
- `typography` (JSONB)
- `references_and_benchmarks` (JSONB)
- `sample_posts` (JSONB)
- `generation_notes` (TEXT)

---

## CHAR_LIMITS — MISMATCH DE KEYS

O HTML Editor externo usa keys em **português** (que são as mesmas do banco):

```json
{
  "reel_titulo": 60,
  "reel_legenda": 2200,
  "reel_overlay": 40,
  "estatico_titulo": 60,
  "estatico_legenda": 2200,
  "carrossel_legenda": 2200,
  "estatico_paragrafo": 280,
  "carrossel_texto_card": 150,
  "carrossel_titulo_capa": 60,
  "carrossel_titulo_card": 50
}
```

O BrandDna.tsx atual usa keys em **inglês** (que NÃO existem no banco):

```json
{
  "description": 300,
  "carousel_title": 60,
  "carousel_card": 150,
  "reel_title": 40,
  "static_title": 60,
  "static_paragraph": 200
}
```

### CORREÇÃO OBRIGATÓRIA:
O editor DEVE usar as keys portuguesas (do banco). Mapeamento:

| Key do Editor (CORRIGIR) | Key REAL no DB           | Label no UI                  |
|--------------------------|--------------------------|------------------------------|
| description              | reel_legenda             | Legenda do Reel              |
| carousel_title           | carrossel_titulo_capa    | Título Capa do Carrossel     |
| carousel_card            | carrossel_texto_card     | Texto Card do Carrossel      |
| reel_title               | reel_titulo              | Título do Reel               |
| static_title             | estatico_titulo          | Título Estático              |
| static_paragraph         | estatico_paragrafo       | Parágrafo Estático           |
| ❌ NÃO EXISTE            | reel_overlay             | Overlay do Reel              |
| ❌ NÃO EXISTE            | estatico_legenda         | Legenda Estática             |
| ❌ NÃO EXISTE            | carrossel_legenda        | Legenda do Carrossel         |
| ❌ NÃO EXISTE            | carrossel_titulo_card    | Título Card do Carrossel     |

---

## ESTRUTURA DO NOVO BrandDna.tsx

### Seções Accordion (todas usando Carbon `<Accordion>` + `<AccordionItem>`):

1. **Identidade da Marca**
   - `persona_name` (TextInput) — Nome da persona
   - `voice_description` (TextArea) — Descrição do tom de voz
   - `language` (Dropdown: pt-BR, en-US, es-ES) — Idioma
   - `regional_notes` (TextArea) — Notas regionais
   - `generation_notes` (TextArea) — Notas para IA

2. **Tom de Voz**
   - `voice_tone.primary` (TextInput) — Tom primário
   - `voice_tone.secondary` (TextInput) — Tom secundário
   - `voice_tone.tertiary` (TextInput) — Tom terciário
   - `personality_traits` (Tag input — array de strings)

3. **Valores e Identidade**
   - `brand_values` (Tag input — array de strings)
   - `mandatory_terms` (Tag input — array TEXT[])
   - `forbidden_words` (Tag input — array TEXT[])
   - `strict_compliance` (Checkbox/Toggle)

4. **Audiência**
   - `target_audience` (array de objetos com segment)
   - `audience_profile` (JSONB — demographic etc.)

5. **Regras de Conteúdo**
   - `content_rules.style` (TextInput)
   - `content_rules.principle` (TextInput)
   - `content_rules.fixed_description_footer` (TextArea — rodapé fixo)
   - `sample_posts` (JSONB — lista editável)

6. **Hashtags**
   - `hashtag_strategy.primary` (Tag input)
   - `hashtag_strategy.fixed_hashtags` (Tag input)
   - `hashtag_strategy.max_total` (NumberInput)
   - `hashtag_strategy.generate_remaining` (Checkbox)
   - `hashtag_strategy.strategy` (TextInput)

7. **Pilares Editoriais / Categorias**
   - `editorial_pillars` (array — CRUD com nome + descrição + timing)

8. **Limites de Caracteres**
   - Todos os 10 campos char_limits com keys portuguesas
   - `reel_titulo`, `reel_legenda`, `reel_overlay`
   - `estatico_titulo`, `estatico_legenda`, `estatico_paragrafo`
   - `carrossel_titulo_capa`, `carrossel_titulo_card`, `carrossel_texto_card`, `carrossel_legenda`

9. **Identidade Visual** (NOVO — não existia no editor)
   - `color_palette` (CRUD — array de {hex, name})
   - `typography` (JSONB editável)
   - `references_and_benchmarks` (TextArea/JSONB)

---

## TENANT SELECTOR — FEATURE NOVA

### Requisito:
Agency operators (roles: `super_admin`, `agency_operator`) precisam de um dropdown para selecionar qual child tenant editar.

### Implementação:

```tsx
import { Dropdown } from '@carbon/react';

// No topo do componente, após useAuth():
const { me } = useAuth();
const isAgency = me.user?.role === 'super_admin' || me.user?.role === 'agency_operator';

// State:
const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
const [tenants, setTenants] = useState<{id: string, name: string}[]>([]);

// Carregar tenants (apenas para agency):
useEffect(() => {
  if (!isAgency) return;
  const loadTenants = async () => {
    const { data } = await supabase
      .from('tenants')
      .select('id, name')
      .order('name');
    setTenants(data || []);
    // Default: primeiro child ou tenant ativo
    if (data?.length) {
      setSelectedTenantId(api.getActiveTenantId() || data[0].id);
    }
  };
  loadTenants();
}, [isAgency]);

// O tenantId usado para carregar/salvar DNA:
const activeTenantId = isAgency ? selectedTenantId : api.getActiveTenantId();

// UI — Dropdown Carbon no topo da página (dentro de actions ou antes do Accordion):
{isAgency && (
  <Dropdown
    id="tenant-selector"
    titleText="Tenant"
    label="Selecione um tenant"
    items={tenants}
    itemToString={(item) => item?.name || ''}
    selectedItem={tenants.find(t => t.id === selectedTenantId) || null}
    onChange={({ selectedItem }) => {
      if (selectedItem) {
        setSelectedTenantId(selectedItem.id);
        // recarregar DNA do novo tenant
      }
    }}
  />
)}
```

---

## IMPORT/EXPORT — FEATURE NOVA

### Export JSON (compatível com HTML Editor):

```tsx
const exportJSON = () => {
  const tenant = isAgency
    ? tenants.find(t => t.id === activeTenantId)
    : { name: me.tenant?.name };

  const payload = {
    tenant_name: tenant?.name || '',
    depth_level: 2,
    contact_email: me.user?.email || '',
    dna: { ...dna }  // todas as 25 colunas
  };

  delete payload.dna.id;
  delete payload.dna.tenant_id;
  delete payload.dna.created_at;
  delete payload.dna.updated_at;

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tenant?.name || 'tenant'}-brand-dna.json`;
  a.click();
  URL.revokeObjectURL(url);
};
```

### Export MD (compatível com HTML Editor):

```tsx
const exportMarkdown = () => {
  const name = currentTenantName;
  let md = `# ${name} — Brand DNA\n\n`;
  md += `## Identidade\n`;
  md += `**Persona:** ${dna.persona_name || ''}\n`;
  md += `**Voice:** ${dna.voice_description || ''}\n`;
  md += `**Language:** ${dna.language || 'pt-BR'}\n\n`;

  md += `## Tom de Voz\n`;
  const vt = dna.voice_tone || {};
  md += `- Primary: ${vt.primary || ''}\n`;
  md += `- Secondary: ${vt.secondary || ''}\n`;
  md += `- Tertiary: ${vt.tertiary || ''}\n\n`;

  md += `## Personalidade\n`;
  (Array.isArray(dna.personality_traits) ? dna.personality_traits : []).forEach((t: string) => { md += `- ${t}\n`; });
  md += `\n## Valores\n`;
  (Array.isArray(dna.brand_values) ? dna.brand_values : []).forEach((v: string) => { md += `- ${v}\n`; });
  md += `\n## Termos Obrigatórios\n`;
  (Array.isArray(dna.mandatory_terms) ? dna.mandatory_terms : []).forEach((t: string) => { md += `- ${t}\n`; });
  md += `\n## Palavras Proibidas\n`;
  (Array.isArray(dna.forbidden_words) ? dna.forbidden_words : []).forEach((w: string) => { md += `- ${w}\n`; });
  md += `\n## Pilares Editoriais\n`;
  (Array.isArray(dna.editorial_pillars) ? dna.editorial_pillars : []).forEach((p: any) => {
    md += typeof p === 'string' ? `- ${p}\n` : `- ${p.name}: ${p.description || ''}\n`;
  });

  md += `\n## Regras de Conteúdo\n`;
  const cr = dna.content_rules || {};
  if (cr.style) md += `**Estilo:** ${cr.style}\n`;
  if (cr.principle) md += `**Princípio:** ${cr.principle}\n`;
  if (cr.fixed_description_footer) md += `**Rodapé Fixo:**\n${cr.fixed_description_footer}\n`;

  md += `\n## Limites de Caracteres\n`;
  const cl = dna.char_limits || {};
  Object.entries(cl).forEach(([key, val]) => { md += `- ${key}: ${val}\n`; });

  md += `\n## Paleta de Cores\n`;
  (Array.isArray(dna.color_palette) ? dna.color_palette : []).forEach((c: any) => {
    md += `- ${c.name}: ${c.hex}\n`;
  });

  md += `\n## Notas de Geração\n${dna.generation_notes || ''}\n`;

  // download blob...
};
```

### Import JSON (compatível com HTML Editor export):

```tsx
const importFile = (file: File) => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target?.result as string;

      if (file.name.endsWith('.json')) {
        const data = JSON.parse(content);
        // HTML Editor exporta: { tenant_name, depth_level, contact_email, dna: {...} }
        const imported = data.dna || data;

        // Remover campos de sistema
        delete imported.id;
        delete imported.tenant_id;
        delete imported.created_at;
        delete imported.updated_at;

        // Merge com DNA existente (campos importados sobrescrevem)
        setDna((prev: any) => ({ ...prev, ...imported }));
        showToast('JSON importado com sucesso', '', 'success');

      } else if (file.name.endsWith('.md')) {
        // Parse markdown do HTML Editor
        const lines = content.split('\n');
        let section = '';
        const updates: any = {};

        lines.forEach(line => {
          if (line.startsWith('## ')) section = line.replace(/^## /, '').trim();
          else if (line.startsWith('**Persona:**')) updates.persona_name = line.split('**Persona:**')[1].trim();
          else if (line.startsWith('**Voice:**')) updates.voice_description = line.split('**Voice:**')[1].trim();
          else if (line.startsWith('**Language:**')) updates.language = line.split('**Language:**')[1].trim();
          else if (line.startsWith('- ') && section) {
            const val = line.replace(/^- /, '').trim();
            if (section === 'Personalidade') (updates.personality_traits ||= []).push(val);
            else if (section === 'Valores') (updates.brand_values ||= []).push(val);
            else if (section === 'Termos Obrigatórios') (updates.mandatory_terms ||= []).push(val);
            else if (section === 'Palavras Proibidas') (updates.forbidden_words ||= []).push(val);
            else if (section === 'Pilares Editoriais') (updates.editorial_pillars ||= []).push(val);
            else if (section === 'Tom de Voz') {
              const [k, v] = val.split(':').map(s => s.trim());
              if (!updates.voice_tone) updates.voice_tone = {};
              if (k === 'Primary') updates.voice_tone.primary = v;
              if (k === 'Secondary') updates.voice_tone.secondary = v;
              if (k === 'Tertiary') updates.voice_tone.tertiary = v;
            }
            else if (section === 'Limites de Caracteres') {
              const [k, v] = val.split(':').map(s => s.trim());
              if (!updates.char_limits) updates.char_limits = {};
              updates.char_limits[k] = Number(v);
            }
            else if (section === 'Paleta de Cores') {
              const [name, hex] = val.split(':').map(s => s.trim());
              (updates.color_palette ||= []).push({ name, hex });
            }
          }
        });

        setDna((prev: any) => ({ ...prev, ...updates }));
        showToast('Markdown importado com sucesso', '', 'success');

      } else if (file.name.endsWith('.txt')) {
        const updates: any = {};
        content.split('\n').forEach(line => {
          const [key, ...rest] = line.split(':');
          const val = rest.join(':').trim();
          if (key === 'Persona') updates.persona_name = val;
          else if (key === 'Voice') updates.voice_description = val;
          else if (key === 'Language') updates.language = val;
        });
        setDna((prev: any) => ({ ...prev, ...updates }));
        showToast('TXT importado com sucesso', '', 'success');
      }
    } catch (err) {
      showToast('Erro ao importar arquivo', String(err), 'error');
    }
  };
  reader.readAsText(file);
};
```

### UI de Import/Export (Carbon buttons no PageLayout actions):

```tsx
import { Upload, Download, DocumentExport } from '@carbon/icons-react';

// Ref para file input hidden
const fileInputRef = useRef<HTMLInputElement>(null);

// Dentro de PageLayout actions:
actions={(
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
    <Button kind="ghost" size="sm" renderIcon={Upload} onClick={() => fileInputRef.current?.click()}>
      Import
    </Button>
    <Button kind="ghost" size="sm" renderIcon={Download} onClick={exportJSON}>
      Export JSON
    </Button>
    <Button kind="ghost" size="sm" renderIcon={DocumentExport} onClick={exportMarkdown}>
      Export MD
    </Button>
    <Button kind="primary" size="sm" renderIcon={Save} onClick={handleSave} disabled={saving}>
      {saving ? 'Salvando...' : 'Salvar'}
    </Button>
    <input
      ref={fileInputRef}
      type="file"
      accept=".json,.md,.txt"
      style={{ display: 'none' }}
      onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
    />
  </div>
)}
```

---

## REGRA DE TIPOS — ATENÇÃO AOS JSONB vs TEXT[] vs TEXT

Quando o editor salva, os dados DEVEM corresponder ao tipo da coluna:

| Campo               | Tipo    | Como salvar                                      |
|---------------------|---------|--------------------------------------------------|
| `voice_tone`        | JSONB   | `{ primary: "...", secondary: "...", tertiary: "..." }` |
| `personality_traits`| JSONB   | `["trait1", "trait2", ...]` (array de strings)    |
| `brand_values`      | JSONB   | `["value1", "value2", ...]` (array de strings)    |
| `target_audience`   | JSONB   | `[{"segment": "..."}, ...]`                       |
| `audience_profile`  | JSONB   | `{"demographic": "..."}` (objeto)                 |
| `content_rules`     | JSONB   | `{"style": "...", "principle": "...", "fixed_description_footer": "..."}` |
| `hashtag_strategy`  | JSONB   | `{"primary": [...], "fixed_hashtags": [...], "max_total": N, ...}` |
| `char_limits`       | JSONB   | `{"reel_titulo": 60, "estatico_titulo": 60, ...}` |
| `editorial_pillars` | JSONB   | `["pilar1", "pilar2"]` ou `[{name, description, timing_days_before}]` |
| `color_palette`     | JSONB   | `[{"hex": "#1B4F72", "name": "Blue"}]`            |
| `typography`        | JSONB   | Objeto livre                                      |
| `sample_posts`      | JSONB   | Array de objetos post                             |
| `references_and_benchmarks` | JSONB | Objeto livre                              |
| `forbidden_words`   | TEXT[]  | `['word1', 'word2']` — PostgreSQL text array      |
| `mandatory_terms`   | TEXT[]  | `['term1', 'term2']` — PostgreSQL text array      |
| `voice_description` | TEXT    | String simples                                    |
| `language`          | TEXT    | String: "pt-BR"                                   |
| `persona_name`      | TEXT    | String simples                                    |
| `regional_notes`    | TEXT    | String simples                                    |
| `generation_notes`  | TEXT    | String simples                                    |
| `strict_compliance` | BOOLEAN | `true` ou `false`                                 |

### ⚠️ CUIDADO com TextArea → JSONB

Campos JSONB que são arrays (como `personality_traits`, `brand_values`) NÃO devem ser tratados como TextArea simples que salva string. Eles devem usar **tag input** (como já funciona para `hashtag_strategy.fixed_hashtags`).

Para `personality_traits` e `brand_values`:
- UI: Input com tags (adicionar/remover items)
- State: Array de strings
- Save: Salva como JSONB array diretamente

Para `forbidden_words` e `mandatory_terms`:
- UI: TextArea com separação por vírgula OU tag input
- State: Array de strings
- Save: Supabase aceita array direto para TEXT[]

---

## CARBON DESIGN SYSTEM — COMPONENTES OBRIGATÓRIOS

TODO o editor DEVE usar apenas componentes Carbon:

```tsx
import {
  Accordion, AccordionItem,
  TextInput, TextArea, NumberInput,
  Dropdown, MultiSelect, ComboBox,
  Button, IconButton,
  Tag, Checkbox, Toggle,
  Tile, Grid, Column, Stack, Section,
  InlineNotification, Modal,
  AILabel, AILabelContent,
  SkeletonText, SkeletonPlaceholder,
  FileUploader
} from '@carbon/react';

import {
  Save, Upload, Download, DocumentExport,
  Add, Close, Renew, Chemistry, Copy, Edit,
  ColorPalette, TextFont, Help
} from '@carbon/icons-react';
```

### PROIBIDO:
- ❌ `<input type="file">` HTML — usar `<FileUploader>` Carbon (ou `useRef` com input hidden se necessário para UX)
- ❌ `<select>` HTML — usar `<Dropdown>` Carbon
- ❌ `<input type="color">` — usar `<TextInput>` com preview de cor
- ❌ Qualquer componente não-Carbon

---

## FLUXO DE DADOS — LOAD → EDIT → SAVE

```
1. Componente monta
   ├─ Se isAgency: carrega lista de tenants → mostra Dropdown
   └─ Determina activeTenantId (selector ou api.getActiveTenantId())

2. Carrega DNA:
   supabase.from('brand_dna').select('*').eq('tenant_id', activeTenantId).maybeSingle()

3. Se não existe DNA → mostra Wizard de geração (já funciona)

4. Se existe → renderiza Accordion com TODOS os campos reais

5. Edição:
   - update(campo, valor) → setDna({...prev, [campo]: valor})
   - Helpers: updateVoiceTone, updateContentRules, updateHashtagStrategy, updateCharLimits, etc.

6. Save:
   supabase.from('brand_dna').update({
     ...dna,           // TODOS os campos reais
     updated_at: new Date().toISOString()
   }).eq('tenant_id', activeTenantId)

7. Import:
   - Parse file → merge com dna existente → setState → user salva manualmente

8. Export:
   - Gera payload no formato do HTML Editor → download
```

---

## CHECKLIST FINAL

- [ ] Todos os 25 campos do schema são editáveis (menos id, tenant_id, created_at)
- [ ] ZERO campos fantasma (brand_name, mission, vision, values, tone_of_voice, preferred_vocabulary, words_to_avoid, personas, content_guidelines, content_examples)
- [ ] char_limits usa keys portuguesas: `reel_titulo`, `reel_legenda`, `reel_overlay`, `estatico_titulo`, `estatico_legenda`, `estatico_paragrafo`, `carrossel_titulo_capa`, `carrossel_titulo_card`, `carrossel_texto_card`, `carrossel_legenda`
- [ ] personality_traits salva como JSONB array (não string)
- [ ] brand_values salva como JSONB array (não string)
- [ ] forbidden_words salva como TEXT[] (não string)
- [ ] mandatory_terms salva como TEXT[] (não string)
- [ ] voice_tone salva como JSONB {primary, secondary, tertiary}
- [ ] Tenant selector funciona para agency (super_admin / agency_operator)
- [ ] Import JSON aceita formato do HTML Editor: `{tenant_name, dna: {...}}`
- [ ] Export JSON gera formato compatível com HTML Editor
- [ ] Export MD gera formato que o HTML Editor consegue importar
- [ ] 100% Carbon Design System (zero HTML nativo)
- [ ] `npx tsc --noEmit` = zero erros
- [ ] `npx vite build` = OK
