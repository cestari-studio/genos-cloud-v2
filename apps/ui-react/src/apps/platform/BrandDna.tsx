// genOS Lumina — Brand DNA Editor v2 (Antigravity Refactor)
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  AILabel,
  AILabelContent,
  Tile,
  TextInput,
  TextArea,
  Button,
  Accordion,
  AccordionItem,
  Tag,
  SkeletonText,
  SkeletonPlaceholder,
  InlineNotification,
  NumberInput,
  Checkbox,
  Grid,
  Column,
  Stack,
  Section,
  Dropdown,
  IconButton,
  Tooltip,
} from '@carbon/react';
import {
  Save,
  Renew,
  Add,
  Close,
  Upload,
  Download,
  DocumentExport,
  Chemistry,
  Help,
  ColorPalette,
  TextFont,
} from '@carbon/icons-react';
import { api, type Tenant } from '@/services/api';
import { supabase } from '@/services/supabase';
import PageLayout from '@/components/PageLayout';
import { useNotifications } from '@/components/NotificationProvider';
import { useAuth } from '@/shared/contexts/AuthContext';
import { t, getLocale } from '@/config/locale';
import './BrandDna.scss';


// ─── Interfaces ─────────────────────────────────────────────────────────────

interface BrandDnaFields {
  id?: string;
  tenant_id?: string;
  brand_story: string;
  industry: string;
  voice_tone: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  };
  voice_description: string;
  language: string;
  persona_name: string;
  regional_notes: string;
  content_rules: {
    style?: string;
    principle?: string;
    fixed_description_footer?: string;
  };
  forbidden_words: string[];
  hashtag_strategy: {
    primary?: string[];
    fixed_hashtags?: string[];
    max_total?: number;
    generate_remaining?: boolean;
    strategy?: string;
  };
  color_palette: { hex: string; name: string }[];
  sample_posts: any[];
  personality_traits: string[];
  tone_modifiers: string[];
  typography: any;
  target_audience_v2: {
    demographic?: string;
    segments?: any[];
  };
  brand_values: string[];
  char_limits: {
    reels_title?: number;
    reels_caption?: number;
    reels_overlay?: number;
    static_title?: number;
    static_caption?: number;
    static_body?: number;
    carousel_cover_title?: number;
    carousel_card_title?: number;
    carousel_card_text?: number;
    carousel_caption?: number;
  };
  editorial_pillars: any[];
  references_and_benchmarks: any;
  generation_notes: string;
  mandatory_terms: string[];
  strict_compliance: boolean;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_DNA: BrandDnaFields = {
  brand_story: '',
  industry: '',
  voice_tone: { primary: '', secondary: '', tertiary: '' },
  voice_description: '',
  language: 'pt-BR',
  persona_name: '',
  regional_notes: '',
  content_rules: { style: '', principle: '', fixed_description_footer: '' },
  forbidden_words: [],
  hashtag_strategy: { primary: [], fixed_hashtags: [], max_total: 5, generate_remaining: true, strategy: '' },
  color_palette: [],
  sample_posts: [],
  personality_traits: [],
  tone_modifiers: [],
  typography: {},
  target_audience_v2: {
    demographic: '',
    segments: [],
  },
  brand_values: [],
  char_limits: {
    reels_title: 60,
    reels_caption: 2200,
    reels_overlay: 40,
    static_title: 60,
    static_caption: 2200,
    static_body: 280,
    carousel_cover_title: 60,
    carousel_card_title: 50,
    carousel_card_text: 150,
    carousel_caption: 2200,
  },
  editorial_pillars: [],
  references_and_benchmarks: {},
  generation_notes: '',
  mandatory_terms: [],
  strict_compliance: false,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function BrandDna() {
  const { showToast } = useNotifications();
  const { me, refreshMe } = useAuth();
  const [dna, setDna] = useState<BrandDnaFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Tenant Selector Logic
  const isAgency = me.user?.role === 'super_admin' || me.user?.role === 'agency_operator';
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(api.getActiveTenantId() || '');

  // Wizard States
  const [industry, setIndustry] = useState('');
  const [targetDescription, setTargetDescription] = useState('');
  const [brandValues, setBrandValues] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTenantId = isAgency ? selectedTenantId : me.tenant?.id;

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadTenants = useCallback(async () => {
    if (!isAgency) return;
    try {
      const list = await api.loadTenants();
      setTenants(list);
      // Auto-select first tenant if none selected and list not empty
      setSelectedTenantId(prev => {
        if (!prev && list.length > 0) return list[0].id;
        return prev;
      });
    } catch (err) {
      console.warn('Error loading tenants:', err);
    }
  }, [isAgency]);

  const loadData = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('brand_dna')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .maybeSingle();

      if (e) throw e;

      if (data) {
        // Essential to ensure objects exist to avoid deep property access errors
        setDna({
          ...DEFAULT_DNA,
          ...data,
          voice_tone: { ...DEFAULT_DNA.voice_tone, ...data.voice_tone },
          content_rules: { ...DEFAULT_DNA.content_rules, ...data.content_rules },
          hashtag_strategy: { ...DEFAULT_DNA.hashtag_strategy, ...data.hashtag_strategy },
          char_limits: { ...DEFAULT_DNA.char_limits, ...data.char_limits },
          target_audience_v2: { ...DEFAULT_DNA.target_audience_v2, ...data.target_audience_v2 },
        });
      } else {
        setDna(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!dna || !activeTenantId) return;
    setSaving(true);
    setSaved(false);
    try {
      const savePayload = { ...dna, updated_at: new Date().toISOString() };
      delete (savePayload as any).id;
      delete (savePayload as any).tenant_id;
      delete (savePayload as any).created_at;

      const { error: e } = await supabase
        .from('brand_dna')
        .upsert({
          tenant_id: activeTenantId,
          ...savePayload,
        }, { onConflict: 'tenant_id' });

      if (e) throw e;

      await refreshMe();
      showToast(t('brandDnaSaveSuccess'), t('brandDnaSaveSuccessDesc'), 'success');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
      showToast(t('brandDnaSaveError'), err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof BrandDnaFields, value: any) => {
    setDna((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleAiGenerate = async () => {
    if (!activeTenantId) return;
    setIsGenerating(true);
    setError(null);
    try {
      showToast(t('brandDnaProcessing'), t('brandDnaConnecting'), 'info');
      await api.edgeFn('brand-dna', {
        action: 'generate',
        industry,
        targetDescription,
        brandValues,
        tenant_id: activeTenantId,
      });
      showToast(t('brandDnaKernelCreated'), t('brandDnaSeeds'), 'success');
      setSaved(true);
      await loadData();
    } catch (err: any) {
      setError(err.message);
      showToast(t('brandDnaGenerationFailed'), err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Import / Export ───────────────────────────────────────────────────────

  const exportJSON = () => {
    if (!dna) return;
    const currentTenant = tenants.find(t => t.id === activeTenantId) || me.tenant;
    const payload = {
      tenant_name: currentTenant?.name || '',
      depth_level: currentTenant?.depth_level || 2,
      contact_email: me.user?.email || '',
      dna: { ...dna }
    };
    delete (payload.dna as any).id;
    delete (payload.dna as any).tenant_id;
    delete (payload.dna as any).created_at;
    delete (payload.dna as any).updated_at;

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTenant?.name || 'tenant'}-brand-dna.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    if (!dna) return;
    const name = tenants.find(t => t.id === activeTenantId)?.name || me.tenant?.name || 'genOS Tenant';
    let md = `# ${name} — Brand DNA\n\n`;
    md += `## Identidade\n`;
    md += `**Persona:** ${dna.persona_name || ''}\n`;
    md += `**Industry:** ${dna.industry || ''}\n`;
    md += `**Voice:** ${dna.voice_description || ''}\n`;
    md += `**Language:** ${dna.language || 'pt-BR'}\n\n`;
    md += `## Brand Story\n${dna.brand_story || ''}\n\n`;

    md += `## Tom de Voz\n`;
    const vt = dna.voice_tone || {};
    md += `- Primary: ${vt.primary || ''}\n`;
    md += `- Secondary: ${vt.secondary || ''}\n`;
    md += `- Tertiary: ${vt.tertiary || ''}\n\n`;

    md += `## Personalidade\n`;
    (dna.personality_traits || []).forEach((t: string) => { md += `- ${t}\n`; });
    md += `\n## Tone Modifiers\n`;
    (dna.tone_modifiers || []).forEach((m: string) => { md += `- ${m}\n`; });
    md += `\n## Valores\n`;
    (dna.brand_values || []).forEach((v: string) => { md += `- ${v}\n`; });
    md += `\n## Termos Obrigatórios\n`;
    (dna.mandatory_terms || []).forEach((t: string) => { md += `- ${t}\n`; });
    md += `\n## Palavras Proibidas\n`;
    (dna.forbidden_words || []).forEach((w: string) => { md += `- ${w}\n`; });

    const cl = dna.char_limits || {};
    md += `\n## Limites de Caracteres\n`;
    Object.entries(cl).forEach(([key, val]) => { md += `- ${key}: ${val}\n`; });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-brand-dna.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(content);
          const imported = data.dna || data;
          delete imported.id;
          delete imported.tenant_id;
          delete imported.created_at;
          delete imported.updated_at;
          setDna((prev: any) => ({ ...prev, ...imported }));
          showToast('JSON importado', 'Não esqueça de salvar!', 'success');
        } else if (file.name.endsWith('.md')) {
          showToast('Importação de MD parcial', 'Implementando parse completo...', 'info');
          // Simple parsing logic could be added here if needed
        }
      } catch (err: any) {
        showToast('Erro no import', err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  // ─── Render Helpers ────────────────────────────────────────────────────────

  const ArrayTagInput = ({
    label,
    items,
    onAdd,
    onRemove
  }: {
    label: string,
    items: string[],
    onAdd: (v: string) => void,
    onRemove: (i: number) => void
  }) => {
    const [val, setVal] = useState('');
    return (
      <div className="brand-dna-tag-input-container">
        <p className="cds--label brand-dna-tag-label">{label}</p>
        <div className="brand-dna-tag-controls">
          <TextInput
            id={`tag-input-${label}`}
            labelText=""
            placeholder="Adicionar item..."
            value={val}
            onChange={(e: any) => setVal(e.target.value)}
            onKeyPress={(e: any) => { if (e.key === 'Enter') { onAdd(val); setVal(''); } }}
            hideLabel
          />
          <Button size="sm" kind="ghost" hasIconOnly renderIcon={Add} iconDescription="Add" onClick={() => { onAdd(val); setVal(''); }} />
        </div>
        <div className="brand-dna-tag-list">
          {items.map((item: any, idx) => (
            <Tag key={idx} type="blue" filter onClick={() => onRemove(idx)} onClose={() => onRemove(idx)}>
              {typeof item === 'string' ? item : (item.name || item.trait || JSON.stringify(item))}
            </Tag>
          ))}
        </div>
      </div>
    );

  };

  // ─── Main View ─────────────────────────────────────────────────────────────

  if (loading) return (
    <Section className="brand-dna-skeleton-section">
      <SkeletonText heading width="15%" />
      <SkeletonPlaceholder className="brand-dna-skeleton-placeholder" />
    </Section>
  );


  const headerActions = (
    <div className="brand-dna-header-actions">
      <Button kind="ghost" size="sm" renderIcon={Upload} onClick={() => fileInputRef.current?.click()}>
        Import
      </Button>
      <Button kind="ghost" size="sm" renderIcon={Download} onClick={exportJSON}>
        JSON
      </Button>
      <Button kind="ghost" size="sm" renderIcon={DocumentExport} onClick={exportMarkdown}>
        MD
      </Button>
      <Button kind="primary" size="sm" renderIcon={Save} onClick={handleSave} disabled={saving || !dna}>
        {saving ? '...' : 'Salvar'}
      </Button>
      <input ref={fileInputRef} type="file" accept=".json,.md,.txt" className="brand-dna-file-input" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
    </div>
  );


  return (
    <PageLayout
      pageName="Content Factory | Brand DNA"
      pageDescription="Defina a identidade da sua marca: tom de voz, pilares e personalidade que guiam a IA."
      actions={headerActions}
    >
      <Section>
        {isAgency && (
          <div className="brand-dna-tenant-selector-container">
            <Dropdown
              id="tenant-selector"
              titleText="Tenant Ativo"
              label="Selecione um tenant"
              items={tenants}
              itemToString={(item) => item?.name || ''}
              selectedItem={tenants.find(t => t.id === selectedTenantId) || null}
              onChange={({ selectedItem }) => selectedItem && setSelectedTenantId(selectedItem.id)}
            />
          </div>
        )}


        {error ? (
          <Grid>
            <Column lg={16}>
              <InlineNotification kind="error" title="Erro no DNA" subtitle={error} />
              <Button kind="tertiary" size="sm" onClick={loadData} renderIcon={Renew} className="brand-dna-error-container">Recarregar</Button>
            </Column>
          </Grid>
        ) : dna ? (

          <Grid>
            <Column lg={16}>
              <Tile className="brand-dna-accordion-tile">
                <Accordion align="start" size="lg">

                  {/* ─── Identidade ──────────────── */}
                  <AccordionItem title="Identidade da Marca" open>
                    <Stack gap={5} className="brand-dna-section-stack">
                      <div className="brand-dna-identity-header">
                        <AILabel size="sm" autoAlign>
                          <AILabelContent>
                            <div className="brand-dna-ai-label-inner">
                              <p><strong>Configuração de Identidade</strong></p>
                              <p className="cds--type-body-short-01">Estes campos definem quem é a marca para a IA.</p>
                            </div>
                          </AILabelContent>
                        </AILabel>

                        <TextInput
                          id="industry"
                          labelText="Indústria / Nicho"
                          value={dna.industry || ''}
                          onChange={(e: any) => update('industry', e.target.value)}
                        />
                        <TextInput
                          id="persona_name"
                          labelText="Nome da Persona"
                          value={dna.persona_name || ''}
                          onChange={(e: any) => update('persona_name', e.target.value)}
                        />
                      </div>
                      <TextArea
                        id="brand_story"
                        labelText="História da Marca (Brand Story)"
                        value={dna.brand_story || ''}
                        onChange={(e: any) => update('brand_story', e.target.value)}
                        rows={4}
                      />
                      <TextArea
                        id="voice_description"
                        labelText="Descrição Voz da Marca"
                        value={dna.voice_description || ''}
                        onChange={(e: any) => update('voice_description', e.target.value)}
                      />
                      <Dropdown
                        id="language"
                        titleText="Idioma de Conteúdo"
                        label="Linguagem principal"
                        items={['pt-BR', 'en-US', 'es-ES', 'ja-JP']}
                        selectedItem={dna.language}
                        onChange={({ selectedItem }) => update('language', selectedItem)}
                      />
                      <TextArea
                        id="regional_notes"
                        labelText="Notas Regionais / Dialeto"
                        value={dna.regional_notes || ''}
                        onChange={(e: any) => update('regional_notes', e.target.value)}
                      />
                      <TextArea
                        id="generation_notes"
                        labelText="Notas para o Motor de IA"
                        value={dna.generation_notes || ''}
                        onChange={(e: any) => update('generation_notes', e.target.value)}
                        helperText="Instruções de baixo nível para a geração."
                      />
                    </Stack>
                  </AccordionItem>

                  {/* ─── Tom de Voz ──────────────── */}
                  <AccordionItem title="Tom de Voz & Personalidade">
                    <Stack gap={5} className="brand-dna-section-stack">

                      <Grid>
                        <Column lg={5} md={4} sm={4}>
                          <TextInput id="vt_p" labelText="Primário" value={dna.voice_tone.primary} onChange={(e: any) => update('voice_tone', { ...dna.voice_tone, primary: e.target.value })} />
                        </Column>
                        <Column lg={5} md={4} sm={4}>
                          <TextInput id="vt_s" labelText="Secundário" value={dna.voice_tone.secondary} onChange={(e: any) => update('voice_tone', { ...dna.voice_tone, secondary: e.target.value })} />
                        </Column>
                        <Column lg={6} md={8} sm={4}>
                          <TextInput id="vt_t" labelText="Terciário" value={dna.voice_tone.tertiary} onChange={(e: any) => update('voice_tone', { ...dna.voice_tone, tertiary: e.target.value })} />
                        </Column>
                      </Grid>
                      <ArrayTagInput
                        label="Traços de Personalidade"
                        items={dna.personality_traits || []}
                        onAdd={(v) => v && update('personality_traits', [...(dna.personality_traits || []), v])}
                        onRemove={(i) => update('personality_traits', dna.personality_traits.filter((_, idx) => idx !== i))}
                      />
                    </Stack>
                  </AccordionItem>

                  {/* ─── Valores ─────────────────── */}
                  <AccordionItem title="Valores e Restrições">
                    <Stack gap={5} className="brand-dna-section-stack">

                      <ArrayTagInput
                        label="Valores da Marca"
                        items={dna.brand_values || []}
                        onAdd={(v) => v && update('brand_values', [...(dna.brand_values || []), v])}
                        onRemove={(i) => update('brand_values', dna.brand_values.filter((_, idx) => idx !== i))}
                      />
                      <ArrayTagInput
                        label="Termos Obrigatórios (TEXT[])"
                        items={dna.mandatory_terms || []}
                        onAdd={(v) => v && update('mandatory_terms', [...(dna.mandatory_terms || []), v])}
                        onRemove={(i) => update('mandatory_terms', dna.mandatory_terms.filter((_, idx) => idx !== i))}
                      />
                      <ArrayTagInput
                        label="Palavras Proibidas (TEXT[])"
                        items={dna.forbidden_words || []}
                        onAdd={(v) => v && update('forbidden_words', [...(dna.forbidden_words || []), v])}
                        onRemove={(i) => update('forbidden_words', dna.forbidden_words.filter((_, idx) => idx !== i))}
                      />
                      <Checkbox
                        id="strict_compliance"
                        labelText="Mandatory Compliance (IA restrita)"
                        checked={dna.strict_compliance}
                        onChange={(_: any, { checked }: any) => update('strict_compliance', checked)}
                      />
                    </Stack>
                  </AccordionItem>

                  {/* ─── Regras de Conteúdo ────────── */}
                  <AccordionItem title="Custom Content Engine Rules">
                    <Stack gap={5} className="brand-dna-section-stack">

                      <TextInput id="cr_style" labelText="Estilo" value={dna.content_rules.style} onChange={(e: any) => update('content_rules', { ...dna.content_rules, style: e.target.value })} />
                      <TextInput id="cr_princ" labelText="Princípio" value={dna.content_rules.principle} onChange={(e: any) => update('content_rules', { ...dna.content_rules, principle: e.target.value })} />
                      <TextArea
                        id="cr_footer"
                        labelText="Rodapé Fixo de Descrição"
                        value={dna.content_rules.fixed_description_footer}
                        onChange={(e: any) => update('content_rules', { ...dna.content_rules, fixed_description_footer: e.target.value })}
                        helperText="Este texto será anexado a todos os posts gerados."
                      />
                    </Stack>
                  </AccordionItem>

                  {/* ─── Hashtags ─────────────────── */}
                  <AccordionItem title="Estratégia de Hashtags">
                    <Stack gap={5} className="brand-dna-section-stack">

                      <ArrayTagInput
                        label="Fixed Hashtags"
                        items={dna.hashtag_strategy.fixed_hashtags || []}
                        onAdd={(v) => v && update('hashtag_strategy', { ...dna.hashtag_strategy, fixed_hashtags: [...(dna.hashtag_strategy.fixed_hashtags || []), v] })}
                        onRemove={(i) => update('hashtag_strategy', { ...dna.hashtag_strategy, fixed_hashtags: dna.hashtag_strategy.fixed_hashtags?.filter((_, idx) => idx !== i) })}
                      />
                      <NumberInput
                        id="max_h"
                        label="Máximo de Hashtags"
                        value={dna.hashtag_strategy.max_total}
                        onChange={(_: any, { value }: any) => update('hashtag_strategy', { ...dna.hashtag_strategy, max_total: Number(value) })}
                      />
                      <Checkbox
                        id="gen_rem"
                        labelText="Gerar hashtags restantes via IA"
                        checked={dna.hashtag_strategy.generate_remaining}
                        onChange={(_: any, { checked }: any) => update('hashtag_strategy', { ...dna.hashtag_strategy, generate_remaining: checked })}
                      />
                    </Stack>
                  </AccordionItem>

                  {/* ─── Char Limits (EN KEYS v5.0) ─ */}
                  <AccordionItem title="Limites de Caracteres (Motores genOS)">
                    <Grid className="brand-dna-section-stack">

                      {[
                        { k: 'reels_title', l: 'Reel: Título' },
                        { k: 'reels_caption', l: 'Reel: Legenda' },
                        { k: 'reels_overlay', l: 'Reel: Overlay' },
                        { k: 'static_title', l: 'Estático: Título' },
                        { k: 'static_caption', l: 'Estático: Legenda' },
                        { k: 'static_body', l: 'Estático: Parágrafo' },
                        { k: 'carousel_cover_title', l: 'Carrossel: Título Capa' },
                        { k: 'carousel_card_title', l: 'Carrossel: Título Card' },
                        { k: 'carousel_card_text', l: 'Carrossel: Texto Card' },
                        { k: 'carousel_caption', l: 'Carrossel: Legenda' },
                      ].map(item => (
                        <Column lg={4} md={4} sm={4} key={item.k}>
                          <NumberInput
                            id={`cl_${item.k}`}
                            label={item.l}
                            value={(dna.char_limits as any)[item.k]}
                            onChange={(_: any, { value }: any) => update('char_limits', { ...dna.char_limits, [item.k]: Number(value) || 0 })}
                            style={{ marginBottom: '1rem' }}
                          />
                        </Column>
                      ))}
                    </Grid>
                  </AccordionItem>

                  {/* ─── Público-Alvo ─────────────── */}
                  <AccordionItem title="Público-Alvo & Audiência">
                    <Stack gap={5} className="brand-dna-section-stack">

                      <TextArea
                        id="audience_demo"
                        labelText="Perfil Demográfico"
                        value={dna.target_audience_v2?.demographic || ''}
                        onChange={(e: any) => update('target_audience_v2', { ...dna.target_audience_v2, demographic: e.target.value })}
                        helperText="Idade, gênero, localização, renda, profissão etc."
                        rows={3}
                      />
                      <div className="brand-dna-error-container">
                        <p className="cds--label brand-dna-tag-label">Segmentos de Audiência (v5.0)</p>
                        {(dna.target_audience_v2?.segments || []).map((seg: any, idx: number) => (
                          <div key={idx} className="brand-dna-audience-segment-row">
                            <TextInput

                              id={`seg-${idx}`}
                              labelText=""
                              hideLabel
                              value={typeof seg === 'string' ? seg : (seg.segment || seg.desc || '')}
                              onChange={(e: any) => {
                                const segments = [...(dna.target_audience_v2?.segments || [])];
                                if (typeof seg === 'string') {
                                  segments[idx] = e.target.value;
                                } else {
                                  segments[idx] = { ...segments[idx], segment: e.target.value };
                                }
                                update('target_audience_v2', { ...dna.target_audience_v2, segments });
                              }}
                            />
                            <Button size="sm" kind="ghost" hasIconOnly renderIcon={Close} iconDescription="Remover" onClick={() => {
                              const segments = (dna.target_audience_v2?.segments || []).filter((_: any, i: number) => i !== idx);
                              update('target_audience_v2', { ...dna.target_audience_v2, segments });
                            }} />
                          </div>
                        ))}
                        <Button size="sm" kind="ghost" renderIcon={Add} onClick={() => update('target_audience_v2', { ...dna.target_audience_v2, segments: [...(dna.target_audience_v2?.segments || []), ''] })}>
                          Adicionar Segmento
                        </Button>
                      </div>
                    </Stack>
                  </AccordionItem>

                  {/* ─── Categorias de Posts (Editorial Pillars) ─── */}
                  <AccordionItem title="Categorias de Posts">
                    <Stack gap={5} className="brand-dna-section-stack">

                      <p className="cds--type-body-short-01 brand-dna-tag-label">
                        Defina categorias (pilares editoriais) para organizar o conteúdo gerado. Cada categoria pode ter um timing específico.
                      </p>
                      {(dna.editorial_pillars || []).map((pillar: any, idx: number) => (
                        <Tile key={idx} className="brand-dna-pillar-tile">
                          <div className="brand-dna-pillar-content">
                            <div className="brand-dna-pillar-fields">

                              <TextInput
                                id={`pillar-name-${idx}`}
                                labelText="Nome da Categoria"
                                value={pillar.name || ''}
                                onChange={(e: any) => {
                                  const updated = [...dna.editorial_pillars];
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  update('editorial_pillars', updated);
                                }}
                              />
                              <TextArea
                                id={`pillar-desc-${idx}`}
                                labelText="Descrição"
                                value={pillar.description || ''}
                                rows={2}
                                onChange={(e: any) => {
                                  const updated = [...dna.editorial_pillars];
                                  updated[idx] = { ...updated[idx], description: e.target.value };
                                  update('editorial_pillars', updated);
                                }}
                              />
                              <NumberInput
                                id={`pillar-timing-${idx}`}
                                label="Timing (dias antes do evento)"
                                value={pillar.timing_days_before ?? 0}
                                min={0}
                                max={365}
                                onChange={(_: any, { value }: any) => {
                                  const updated = [...dna.editorial_pillars];
                                  updated[idx] = { ...updated[idx], timing_days_before: Number(value) || 0 };
                                  update('editorial_pillars', updated);
                                }}
                              />
                            </div>
                            <Button size="sm" kind="danger--ghost" hasIconOnly renderIcon={Close} iconDescription="Remover" onClick={() => update('editorial_pillars', dna.editorial_pillars.filter((_: any, i: number) => i !== idx))} className="brand-dna-pillar-remove-btn" />
                          </div>
                        </Tile>

                      ))}
                      <Button size="sm" kind="tertiary" renderIcon={Add} onClick={() => update('editorial_pillars', [...(dna.editorial_pillars || []), { name: '', description: '', timing_days_before: 0 }])}>
                        Nova Categoria
                      </Button>
                    </Stack>
                  </AccordionItem>

                  {/* ─── Visual & Benchmarks ───────── */}
                  <AccordionItem title="Identity Visual & Benchmarks">
                    <Stack gap={5} className="brand-dna-section-stack">
                      <div className="brand-dna-visual-header">
                        <ColorPalette />

                        <span className="cds--label">Paleta de Cores (JSONB)</span>
                      </div>
                      <TextArea
                        id="color_p"
                        labelText=""
                        hideLabel
                        value={JSON.stringify(dna.color_palette, null, 2)}
                        onChange={(e: any) => { try { update('color_palette', JSON.parse(e.target.value)); } catch (p) { /* suppress */ } }}
                        rows={5}
                      />
                      <div className="brand-dna-visual-header">
                        <TextFont />
                        <span className="cds--label">Tipografia (JSONB)</span>
                      </div>

                      <TextArea
                        id="typography"
                        labelText=""
                        hideLabel
                        value={JSON.stringify(dna.typography, null, 2)}
                        onChange={(e: any) => { try { update('typography', JSON.parse(e.target.value)); } catch (p) { /* suppress */ } }}
                        rows={5}
                      />
                      <TextArea
                        id="refs_bench"
                        labelText="Referências & Benchmarks (JSONB)"
                        value={JSON.stringify(dna.references_and_benchmarks || {}, null, 2)}
                        onChange={(e: any) => { try { update('references_and_benchmarks', JSON.parse(e.target.value)); } catch (p) { /* suppress */ } }}
                        rows={4}
                        helperText="Marcas de referência, concorrentes, inspirações."
                      />
                      <TextArea
                        id="sample_posts_json"
                        labelText="Sample Posts (JSONB)"
                        value={JSON.stringify(dna.sample_posts || [], null, 2)}
                        onChange={(e: any) => { try { update('sample_posts', JSON.parse(e.target.value)); } catch (p) { /* suppress */ } }}
                        rows={4}
                        helperText="Exemplos reais de posts para a IA aprender o estilo."
                      />
                    </Stack>
                  </AccordionItem>

                </Accordion>
              </Tile>
            </Column>
          </Grid>
        ) : (
          <Grid>
            <Column lg={16}>
              <Tile style={{ backgroundColor: 'var(--cds-background)', border: '1px solid var(--cds-layer-03)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <Chemistry size={48} fill="var(--cds-interactive)" style={{ marginBottom: '1rem' }} />
                  <h3 className="cds--type-productive-heading-03" style={{ color: 'var(--cds-text-primary)' }}>Brand DNA Não Inicializado</h3>
                  <p style={{ color: 'var(--cds-text-secondary)' }}>Configure o kernel de identidade para começar.</p>
                </div>

                <Stack gap={5} style={{ maxWidth: '600px', margin: '0 auto' }}>
                  <TextInput id="wiz-ind" labelText="Indústria" value={industry} onChange={(e: any) => setIndustry(e.target.value)} disabled={isGenerating} />
                  <TextArea id="wiz-desc" labelText="Descrição do Público" rows={3} value={targetDescription} onChange={(e: any) => setTargetDescription(e.target.value)} disabled={isGenerating} />
                  <TextArea id="wiz-val" labelText="Valores Centrais" rows={3} value={brandValues} onChange={(e: any) => setBrandValues(e.target.value)} disabled={isGenerating} />
                  <Button kind="primary" renderIcon={Renew} onClick={handleAiGenerate} disabled={isGenerating || !industry} style={{ marginTop: '1rem', width: '100%' }}>
                    {isGenerating ? 'Inicializando...' : 'Gerar com IA'}
                  </Button>
                </Stack>
              </Tile>
            </Column>
          </Grid>
        )}
      </Section>
    </PageLayout >
  );
}
