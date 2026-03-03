// genOS Cloud — Configurações (Master/Agency only)
import { useEffect, useState, useCallback } from 'react';
import {
  Tile,
  Button,
  InlineLoading,
  InlineNotification,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
  NumberInput,
  Grid,
  Column,
  Select,
  SelectItem,
  TextInput,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  AILabel,
  AILabelContent,
} from '@carbon/react';
import {
  Save,
  Edit,
  Checkmark,
  Close,
} from '@carbon/icons-react';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../config/locale';
import PageLayout from '../components/PageLayout';
import BillingPackagesTab from '../components/Settings/BillingPackagesTab';
import SocialConnectionsTab from '../components/SocialConnectionsTab';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ChildTenant {
  id: string;
  name: string;
  depth_level: number;
  parent_tenant_id: string | null;
}

interface TenantConfig {
  tenant_id: string;
  token_balance: number;
  post_limit: number;
  formats: string[];  // e.g. ['carousel', 'static', 'reels', 'stories']
  ai_model: string;
  post_language: string;  // language for generated post content (independent from UI locale)
  billing_start: string;
  billing_end: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  char_limit_title: number;
  char_limit_body: number;
  char_limit_caption: number;
  char_limit_cta: number;
  hard_block_enabled: boolean;
  overage_allowed: boolean;
  low_balance_threshold: number;
  zero_balance_message: string;
}

const POST_LANGUAGES = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'ja-JP', label: '日本語 (Japan)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'fr-FR', label: 'Français (France)' },
  { value: 'de-DE', label: 'Deutsch (Deutschland)' },
  { value: 'it-IT', label: 'Italiano (Italia)' },
  { value: 'zh-CN', label: '中文 (简体)' },
  { value: 'ko-KR', label: '한국어 (Korea)' },
];

const DEFAULT_CONFIG: Omit<TenantConfig, 'tenant_id'> = {
  token_balance: 5000,
  post_limit: 12,
  formats: ['carousel', 'static', 'reels', 'stories'],
  ai_model: 'gemini-2.0-flash',
  post_language: 'pt-BR',
  billing_start: new Date().toISOString().slice(0, 10),
  billing_end: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  char_limit_title: 60,
  char_limit_body: 300,
  char_limit_caption: 150,
  char_limit_cta: 40,
  hard_block_enabled: true,
  overage_allowed: false,
  low_balance_threshold: 50,
  zero_balance_message: "Seu saldo de tokens se esgotou. Adquira um novo pacote para continuar gerando conteúdo."
};

const AI_MODELS = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Rápido)', disabled: false },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Avançado)', disabled: false },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Balanceado)', disabled: false },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini — em breve', disabled: true },
  { value: 'gpt-4o', label: 'GPT-4o — em breve', disabled: true },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku — em breve', disabled: true },
  { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet — em breve', disabled: true },
];

const ALL_FORMATS = [
  { value: 'carousel', label: 'Carrossel' },
  { value: 'static', label: 'Imagem Estática' },
  { value: 'reels', label: 'Reels / Vídeo Curto' },
  { value: 'stories', label: 'Stories' },
  { value: 'text', label: 'Texto Puro' },
];

export default function Settings() {
  const { me, refreshMe } = useAuth();
  const depthLevel = me.tenant?.depth_level ?? 99;
  const isMaster = depthLevel === 0;
  const isAgency = depthLevel === 1;

  const [children, setChildren] = useState<ChildTenant[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ─── Load child tenants ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const tenantId = api.getActiveTenantId();
        if (!tenantId) return;

        // Get child tenants (depth >= 2) where parent is current tenant or any child of current
        const { data: allTenants } = await supabase
          .from('tenants')
          .select('id, name, depth_level, parent_tenant_id')
          .order('name');

        if (allTenants) {
          // For master (depth 0): show all depth >= 2
          // For agency (depth 1): show only own children (depth >= 2 with parent = current)
          const kids = allTenants.filter((t: any) =>
            t.depth_level >= 2 && (isMaster || t.parent_tenant_id === tenantId)
          );
          setChildren(kids);
          if (kids.length > 0) {
            setSelectedChild(kids[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading tenants:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isMaster]);

  // ─── Load config for selected child ──────────────────────────────────
  const loadConfig = useCallback(async (childId: string) => {
    if (!childId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('tenant_config')
        .select('*')
        .eq('tenant_id', childId)
        .maybeSingle();

      if (dbErr) throw dbErr;

      if (data) {
        setConfig({
          tenant_id: childId,
          token_balance: data.token_balance ?? DEFAULT_CONFIG.token_balance,
          post_limit: data.post_limit ?? DEFAULT_CONFIG.post_limit,
          formats: data.formats ?? DEFAULT_CONFIG.formats,
          ai_model: data.ai_model ?? DEFAULT_CONFIG.ai_model,
          post_language: data.post_language ?? DEFAULT_CONFIG.post_language,
          billing_start: data.billing_start ?? DEFAULT_CONFIG.billing_start,
          billing_end: data.billing_end ?? DEFAULT_CONFIG.billing_end,
          contact_name: data.contact_name ?? DEFAULT_CONFIG.contact_name,
          contact_email: data.contact_email ?? DEFAULT_CONFIG.contact_email,
          contact_phone: data.contact_phone ?? DEFAULT_CONFIG.contact_phone,
          char_limit_title: data.char_limit_title ?? DEFAULT_CONFIG.char_limit_title,
          char_limit_body: data.char_limit_body ?? DEFAULT_CONFIG.char_limit_body,
          char_limit_caption: data.char_limit_caption ?? DEFAULT_CONFIG.char_limit_caption,
          char_limit_cta: data.char_limit_cta ?? DEFAULT_CONFIG.char_limit_cta,
          hard_block_enabled: data.hard_block_enabled ?? DEFAULT_CONFIG.hard_block_enabled,
          overage_allowed: data.overage_allowed ?? DEFAULT_CONFIG.overage_allowed,
          low_balance_threshold: data.low_balance_threshold ?? DEFAULT_CONFIG.low_balance_threshold,
          zero_balance_message: data.zero_balance_message ?? DEFAULT_CONFIG.zero_balance_message,
        });
      } else {
        // No config yet — use defaults
        setConfig({ tenant_id: childId, ...DEFAULT_CONFIG });
      }
    } catch (err: any) {
      console.error('Error loading config:', err);
      setConfig({ tenant_id: childId, ...DEFAULT_CONFIG });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChild) loadConfig(selectedChild);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild]);

  // ─── Save config ─────────────────────────────────────────────────────
  const saveConfig = async () => {
    if (!config) return;

    // Validation
    if (config.token_balance < 0) {
      setError("O saldo de tokens não pode ser negativo.");
      return;
    }
    if (config.post_limit < 0) {
      setError("O limite de posts não pode ser negativo.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: upsertErr } = await supabase
        .from('tenant_config')
        .upsert({
          tenant_id: config.tenant_id,
          token_balance: config.token_balance,
          post_limit: config.post_limit,
          formats: config.formats,
          ai_model: config.ai_model,
          post_language: config.post_language,
          billing_start: config.billing_start,
          billing_end: config.billing_end,
          contact_name: config.contact_name,
          contact_email: config.contact_email,
          contact_phone: config.contact_phone,
          char_limit_title: config.char_limit_title,
          char_limit_body: config.char_limit_body,
          char_limit_caption: config.char_limit_caption,
          char_limit_cta: config.char_limit_cta,
          hard_block_enabled: config.hard_block_enabled,
          overage_allowed: config.overage_allowed,
          low_balance_threshold: config.low_balance_threshold,
          zero_balance_message: config.zero_balance_message,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id' });

      if (upsertErr) throw upsertErr;

      // Ensure credit_wallet exists and is updated (BUG-06 fix)
      await supabase
        .from('credit_wallets')
        .upsert({
          tenant_id: config.tenant_id,
          prepaid_credits: config.token_balance,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id' });

      // Refresh AuthContext to reflect changes in Header/Shell
      await refreshMe();

      // Reload local config from DB to ensure parity
      await loadConfig(config.tenant_id);

      setSuccess(t('settingsSaveSuccess'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || t('settingsSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof TenantConfig>(key: K, value: TenantConfig[K]) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  const toggleFormat = (fmt: string) => {
    if (!config) return;
    const current = config.formats || [];
    const updated = current.includes(fmt)
      ? current.filter(f => f !== fmt)
      : [...current, fmt];
    setConfig({ ...config, formats: updated });
  };

  const selectedChildName = children.find(c => c.id === selectedChild)?.name || '';

  if (loading && children.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
        <InlineLoading description={t('settingsLoadingConfig')} />
      </div>
    );
  }

  return (
    <PageLayout
      pageName="Content Factory | Configurações"
      pageDescription="Ajuste limites, integrações e preferências do Content Factory e dos seus recursos."
      helpMode
      actions={
        <Button
          kind="primary"
          size="sm"
          renderIcon={Save}
          onClick={saveConfig}
          disabled={saving || !config || !selectedChild}
        >
          {saving ? t('settingsSaveButtonSaving') : t('settingsSaveButton')}
        </Button>
      }
    >

      {/* Child tenant selector */}
      {children.length > 0 ? (
        <div style={{ marginBottom: '1.5rem', maxWidth: '400px' }}>
          <Select
            id="child-tenant-selector"
            labelText={t('settingsSelectChild')}
            value={selectedChild}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedChild(e.target.value)}
          >
            {children.map(c => (
              <SelectItem key={c.id} value={c.id} text={c.name} />
            ))}
          </Select>
        </div>
      ) : (
        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', marginBottom: '1.5rem' }}>
          <p style={{ color: '#c6c6c6' }}>{t('settingsNoChildren')}</p>
        </Tile>
      )}

      {error && (
        <InlineNotification
          kind="error"
          title={t('settingsError')}
          subtitle={error}
          lowContrast
          onCloseButtonClick={() => setError(null)}
          style={{ marginBottom: '1rem' }}
        />
      )}
      {success && (
        <InlineNotification
          kind="success"
          title={t('settingsSuccess')}
          subtitle={success}
          lowContrast
          onCloseButtonClick={() => setSuccess(null)}
          style={{ marginBottom: '1rem' }}
        />
      )}

      {config && selectedChild && (
        <>
          <Tabs>
            <TabList aria-label={t('settingsTitle')}>
              <Tab>{t('settingsTab1')}</Tab>
              <Tab>{t('settingsTab2')}</Tab>
              <Tab>{t('settingsTab3')}</Tab>
              <Tab>{t('settingsTab4')}</Tab>
              {(isMaster || isAgency) && <Tab>Redes Sociais</Tab>}
              {(isMaster || isAgency) && <Tab>Billing & Pacotes</Tab>}
            </TabList>

            <TabPanels>
              {/* ─── Tab 1: Tokens & Posts ────────────────────────────────── */}
              <TabPanel>
                <Grid style={{ marginTop: '1rem' }}>
                  <Column lg={8} md={4} sm={4}>
                    <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '1.5rem' }}>
                      <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>
                        {t('settingsTokenBalance')}
                      </h4>
                      <NumberInput
                        id="token-balance"
                        label={t('settingsAvailableTokens')}
                        value={config.token_balance}
                        min={0}
                        max={10000000}
                        step={100}
                        onChange={(_: any, { value }: any) => updateField('token_balance', Number(value) || 0)}
                        helperText={t('settingsTokenHelper')}
                      />
                      <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#161616', border: '1px solid #393939' }}>
                        <p style={{ color: '#c6c6c6', fontSize: '0.75rem', marginBottom: '0.5rem' }}>🌍 Estimativa de Geração (Base {config.ai_model})</p>
                        <p style={{ color: '#f4f4f4', fontSize: '0.875rem' }}>
                          ~{Math.floor(config.token_balance / 300)} Posts (Static/Feed)<br />
                          ~{Math.floor(config.token_balance / (300 + (4 * 100)))} Carrosséis (5 Slides)
                        </p>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={4} sm={4}>
                    <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '1.5rem' }}>
                      <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>
                        {t('settingsPostBalance')}
                      </h4>
                      <NumberInput
                        id="post-limit"
                        label={t('settingsPostLimit')}
                        value={config.post_limit}
                        min={0}
                        max={10000}
                        step={1}
                        onChange={(_: any, { value }: any) => updateField('post_limit', Number(value) || 0)}
                        helperText={t('settingsPostHelper')}
                      />
                    </Tile>
                  </Column>

                  <Column lg={16} md={8} sm={4} style={{ marginTop: '1rem' }}>
                    <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '1.5rem' }}>
                      <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1rem' }}>
                        {t('settingsEnabledFormats')}
                      </h4>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {ALL_FORMATS.map(fmt => {
                          const isActive = (config.formats || []).includes(fmt.value);
                          return (
                            <Tag
                              key={fmt.value}
                              type={isActive ? 'blue' : 'cool-gray'}
                              size="md"
                              onClick={() => toggleFormat(fmt.value)}
                              style={{ cursor: 'pointer', userSelect: 'none' }}
                            >
                              {isActive ? '✓ ' : ''}{fmt.label}
                            </Tag>
                          );
                        })}
                      </div>
                      <p className="cds--type-helper-text-01" style={{ color: '#8d8d8d', marginTop: '0.75rem' }}>
                        {t('settingsFormatsHelper')} "{selectedChildName}".
                      </p>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* ─── Tab 2: IA & Limites de Caracteres ───────────────────── */}
              <TabPanel>
                <Grid style={{ marginTop: '1rem' }}>
                  <Column lg={8} md={4} sm={4}>
                    <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '1.5rem' }}>
                      <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>
                        {t('settingsAiModel')}
                      </h4>
                      <Select
                        id="ai-model"
                        labelText={t('settingsMainModel')}
                        value={config.ai_model}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateField('ai_model', e.target.value)}
                      >
                        {AI_MODELS.map(m => (
                          <SelectItem key={m.value} value={m.value} text={m.label} disabled={m.disabled} />
                        ))}
                      </Select>
                      <p className="cds--type-helper-text-01" style={{ color: '#8d8d8d', marginTop: '0.75rem' }}>
                        {t('settingsModelHelper')}
                      </p>

                      <div style={{ marginTop: '1.5rem' }}>
                        <Select
                          id="post-language"
                          labelText={t('settingsPostLanguage')}
                          value={config.post_language}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateField('post_language', e.target.value)}
                        >
                          {POST_LANGUAGES.map(l => (
                            <SelectItem key={l.value} value={l.value} text={l.label} />
                          ))}
                        </Select>
                        <p className="cds--type-helper-text-01" style={{ color: '#8d8d8d', marginTop: '0.75rem' }}>
                          {t('settingsLanguageHelper')}
                        </p>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={4} sm={4}>
                    <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '1.5rem' }}>
                      <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>
                        {t('settingsCharLimits')}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <NumberInput
                          id="char-title"
                          label={t('settingsCharTitle')}
                          value={config.char_limit_title}
                          min={10}
                          max={500}
                          step={5}
                          onChange={(_: any, { value }: any) => updateField('char_limit_title', Number(value) || 60)}
                        />
                        <NumberInput
                          id="char-body"
                          label={t('settingsCharBody')}
                          value={config.char_limit_body}
                          min={50}
                          max={5000}
                          step={50}
                          onChange={(_: any, { value }: any) => updateField('char_limit_body', Number(value) || 300)}
                        />
                        <NumberInput
                          id="char-caption"
                          label={t('settingsCharCaption')}
                          value={config.char_limit_caption}
                          min={10}
                          max={2000}
                          step={10}
                          onChange={(_: any, { value }: any) => updateField('char_limit_caption', Number(value) || 150)}
                        />
                        <NumberInput
                          id="char-cta"
                          label={t('settingsCharCta')}
                          value={config.char_limit_cta}
                          min={5}
                          max={200}
                          step={5}
                          onChange={(_: any, { value }: any) => updateField('char_limit_cta', Number(value) || 40)}
                        />
                      </div>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* ─── Tab 3: Faturamento ──────────────────────────────────── */}
              <TabPanel>
                <Grid style={{ marginTop: '1rem' }}>
                  <Column lg={8} md={4} sm={4}>
                    <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '1.5rem' }}>
                      <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>
                        {t('settingsBillingCycle')}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <TextInput
                          id="billing-start"
                          labelText={t('settingsBillingStart')}
                          type="date"
                          value={config.billing_start}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('billing_start', e.target.value)}
                        />
                        <TextInput
                          id="billing-end"
                          labelText={t('settingsBillingEnd')}
                          type="date"
                          value={config.billing_end}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('billing_end', e.target.value)}
                        />
                      </div>
                      <p className="cds--type-helper-text-01" style={{ color: '#8d8d8d', marginTop: '0.75rem' }}>
                        {t('settingsBillingHelper')}
                      </p>
                    </Tile>
                  </Column>

                  <Column lg={8} md={4} sm={4}>
                    <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '1.5rem' }}>
                      <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>
                        {t('settingsTokenCosts')}
                      </h4>
                      <p className="cds--type-body-short-01" style={{ color: '#c6c6c6', marginBottom: '1rem' }}>
                        {t('settingsTokenCostsDesc')}
                      </p>
                      <div style={{ backgroundColor: '#161616', padding: '1rem', borderRadius: '4px', border: '1px solid #393939' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AILabel size="xs" autoAlign>
                              <AILabelContent>
                                <div style={{ padding: '0.75rem' }}>
                                  <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Modelo de Geração</p>
                                  <p style={{ fontSize: '0.875rem' }}>Este modelo será usado para todas as gerações de conteúdo e auditorias deste tenant.</p>
                                </div>
                              </AILabelContent>
                            </AILabel>
                            <span style={{ color: '#8d8d8d', fontSize: '0.875rem' }}>{t('settingsCurrentModel')}</span>
                          </div>
                          <span style={{ color: '#0f62fe', fontWeight: 600 }}>{AI_MODELS.find(m => m.value === config.ai_model)?.label || config.ai_model}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AILabel size="xs" autoAlign>
                              <AILabelContent>
                                <div style={{ padding: '0.75rem' }}>
                                  <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Saldo em Tokens</p>
                                  <p style={{ fontSize: '0.875rem' }}>Limite máximo de tokens que podem ser processados no ciclo atual.</p>
                                </div>
                              </AILabelContent>
                            </AILabel>
                            <span style={{ color: '#8d8d8d', fontSize: '0.875rem' }}>{t('settingsAvailableTokensLabel')}</span>
                          </div>
                          <span style={{ color: '#42be65', fontWeight: 600 }}>{config.token_balance.toLocaleString('pt-BR')}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AILabel size="xs" autoAlign>
                              <AILabelContent>
                                <div style={{ padding: '0.75rem' }}>
                                  <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Limite de Posts</p>
                                  <p style={{ fontSize: '0.875rem' }}>Quantidade de posts permitida para este tenant por ciclo.</p>
                                </div>
                              </AILabelContent>
                            </AILabel>
                            <span style={{ color: '#8d8d8d', fontSize: '0.875rem' }}>{t('settingsRemainingPosts')}</span>
                          </div>
                          <span style={{ color: '#42be65', fontWeight: 600 }}>{config.post_limit}</span>
                        </div>
                      </div>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* ─── Tab 4: Contato ──────────────────────────────────────── */}
              <TabPanel>
                <Grid style={{ marginTop: '1rem' }}>
                  <Column lg={8} md={8} sm={4}>
                    <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '1.5rem' }}>
                      <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>
                        {t('settingsContactInfo')} — {selectedChildName}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <TextInput
                          id="contact-name"
                          labelText={t('settingsContactName')}
                          value={config.contact_name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('contact_name', e.target.value)}
                        />
                        <TextInput
                          id="contact-email"
                          labelText={t('settingsContactEmail')}
                          type="email"
                          value={config.contact_email}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('contact_email', e.target.value)}
                        />
                        <TextInput
                          id="contact-phone"
                          labelText={t('settingsContactPhone')}
                          value={config.contact_phone}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('contact_phone', e.target.value)}
                        />
                      </div>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* ─── Tab 5: Redes Sociais ────────────────────────────────── */}
              {(isMaster || isAgency) && (
                <TabPanel>
                  <SocialConnectionsTab />
                </TabPanel>
              )}

              {/* ─── Tab 6: Billing & Pacotes (Admin Only) ───────────────── */}
              {(isMaster || isAgency) && (
                <TabPanel style={{ paddingTop: '1rem' }}>
                  <BillingPackagesTab
                    isMaster={isMaster}
                    isAgency={isAgency}
                    tenantId={selectedChild}
                    config={config}
                    updateField={updateField as any}
                    onSaveConfig={saveConfig}
                    savingConfig={saving}
                  />
                </TabPanel>
              )}
            </TabPanels>
          </Tabs>

        </>
      )}
    </PageLayout>
  );
}
