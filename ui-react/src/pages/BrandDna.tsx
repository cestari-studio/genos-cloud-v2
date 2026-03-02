// genOS Lumina — Brand DNA (Addendum H §8.6)
import { useEffect, useState } from 'react';
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
  Section,
  Grid,
  Column,
  Stack
} from '@carbon/react';
import {
  Save,
  Chemistry,
  Renew,
  Add,
  Close,
} from '@carbon/icons-react';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import PageLayout from '../components/PageLayout';
import { useNotifications } from '../components/NotificationProvider';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../components/LocaleSelectorModal';

export default function BrandDna() {
  const { showToast } = useNotifications();
  const { refreshMe } = useAuth();
  const [dna, setDna] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Wizard States
  const [industry, setIndustry] = useState('');
  const [targetDescription, setTargetDescription] = useState('');
  const [brandValues, setBrandValues] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // New Section States
  const [newHashtag, setNewHashtag] = useState('');
  const [newCategory, setNewCategory] = useState({ name: '', description: '', timing_days_before: null as number | null });

  const loadData = async () => {
    setLoading(true);
    try {
      const tenantId = api.getActiveTenantId();
      if (!tenantId) { setDna(null); return; }
      const { data, error: e } = await supabase
        .from('brand_dna')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (e) throw new Error(e.message);
      setDna(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      showToast(t('brandDnaProcessing'), t('brandDnaConnecting'), 'info');
      await api.edgeFn('brand-dna', {
        action: 'generate',
        industry,
        targetDescription,
        brandValues,
        tenant_id: api.getActiveTenantId(),
      });
      showToast(t('brandDnaKernelCreated'), t('brandDnaSeeds'), 'success');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await loadData();
    } catch (err: any) {
      const msg = err.message || String(err);
      setError(msg);
      showToast(t('brandDnaGenerationFailed'), msg, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!dna) return;
    setSaving(true);
    setSaved(false);
    try {
      const tenantId = api.getActiveTenantId();
      if (!tenantId) throw new Error('No active tenant');
      const { error: e } = await supabase
        .from('brand_dna')
        .update({ ...dna, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId);
      if (e) throw new Error(e.message);

      await refreshMe(); // Call refreshMe after successful save
      showToast(t('brandDnaSaveSuccess'), t('brandDnaSaveSuccessDesc'), 'success');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(String(err));
      showToast(t('brandDnaSaveError'), String(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) => {
    setDna((prev: any) => ({ ...prev, [field]: value }));
  };

  const updateContentRules = (key: string, value: any) => {
    const rules = dna?.content_rules || {};
    update('content_rules', { ...rules, [key]: value } as any);
  };

  const updateHashtagStrategy = (key: string, value: any) => {
    const strategy = dna?.hashtag_strategy || {};
    update('hashtag_strategy', { ...strategy, [key]: value } as any);
  };

  const updateCharLimits = (key: string, value: number) => {
    const limits = dna?.char_limits || {};
    update('char_limits', { ...limits, [key]: value } as any);
  };

  const updateEditorialPillars = (pillars: any[]) => {
    update('editorial_pillars', pillars as any);
  };

  const updateFieldDetails = (category: string, key: string, value: any) => {
    const current = dna?.[category] || {};
    update(category, { ...current, [key]: value } as any);
  };

  const addHashtag = () => {
    if (!newHashtag.trim()) return;
    const current = dna?.hashtag_strategy?.fixed_hashtags || [];
    updateHashtagStrategy('fixed_hashtags', [...current, newHashtag.trim()]);
    setNewHashtag('');
  };

  const removeHashtag = (index: number) => {
    const current = dna?.hashtag_strategy?.fixed_hashtags || [];
    updateHashtagStrategy('fixed_hashtags', current.filter((_: any, i: number) => i !== index));
  };

  const addCategory = () => {
    if (!newCategory.name.trim() || !newCategory.description.trim()) return;
    const current = dna?.editorial_pillars || [];
    updateEditorialPillars([...current, newCategory]);
    setNewCategory({ name: '', description: '', timing_days_before: null });
  };

  const removeCategory = (index: number) => {
    const current = dna?.editorial_pillars || [];
    updateEditorialPillars(current.filter((_: any, i: number) => i !== index));
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem', padding: '0 2rem' }}>
      <SkeletonText heading width="15%" />
      <SkeletonPlaceholder style={{ height: '300px', width: '100%', marginBottom: '1rem' }} />
      <p style={{ color: '#0f62fe', fontSize: '0.875rem' }}>{t('brandDnaOrchestrating')}</p>
    </div>
  );

  return (
    <PageLayout
      pageSubtitle={t('brandDnaSubtitle')}
      helpMode
      actions={(
        <Button kind="primary" size="sm" renderIcon={Save} onClick={handleSave} disabled={saving}>
          {saving ? t('brandDnaSaving') : t('brandDnaSaveButton')}
        </Button>
      )}
    >
      <Section>
        {saved && (
          <Grid>
            <Column lg={16}>
              <InlineNotification
                kind="success"
                title={t('brandDnaConfigSuccess')}
                subtitle={t('brandDnaTrainingSuccess')}
                onCloseButtonClick={() => setSaved(false)}
                style={{ marginBottom: '1rem' }}
              />
            </Column>
          </Grid>
        )}

        {error ? (
          <Grid>
            <Column lg={16}>
              <Tile style={{ backgroundColor: '#262626', border: '1px solid #fa4d56' }}>
                <Stack gap={4}>
                  <p className="cds--type-productive-heading-03" style={{ color: '#fa4d56' }}>{t('brandDnaErrorTitle')}</p>
                  <p style={{ color: '#c6c6c6' }}>{error}</p>
                  <Button kind="tertiary" size="sm" onClick={loadData} renderIcon={Renew}>
                    {t('brandDnaRetry')}
                  </Button>
                </Stack>
              </Tile>
            </Column>
          </Grid>
        ) : dna ? (
          <Grid>
            <Column lg={16}>
              <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '0' }}>
                <Accordion align="start" size="lg">
                  <AccordionItem title={t('brandDnaIdentity')} open>
                    <Stack gap={5} style={{ padding: '1rem 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AILabel
                          size="sm"
                          AILabelContent={(
                            <AILabelContent>
                              <div style={{ padding: '0.5rem', minWidth: '250px' }}>
                                <p style={{ marginBottom: '0.5rem' }}><strong>{t('brandDnaExplainability')}</strong></p>
                                <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>{t('brandDnaHeuristic')}:</strong> MasterCompliance Tensor.</p>
                                <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>{t('brandDnaConfidence')}:</strong> 96.4% de precisão estrutural.</p>
                                <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>{t('brandDnaOrchestration')}:</strong> Processado via IBM Granite-13B.</p>
                              </div>
                            </AILabelContent>
                          )}
                        />
                        <span className="cds--type-label-01" style={{ color: '#8d8d8d' }}>{t('brandDnaConstraint')}</span>
                      </div>

                      <TextInput
                        id="brand-name"
                        labelText={t('brandDnaCorporateTarget')}
                        value={dna.brand_name || ''}
                        onChange={(e: any) => update('brand_name', e.target.value)}
                        style={{ backgroundColor: '#393939', color: '#f4f4f4' }}
                      />
                      <TextArea
                        id="mission"
                        labelText={t('brandDnaMission')}
                        value={dna.mission || ''}
                        onChange={(e: any) => update('mission', e.target.value)}
                        rows={3}
                      />
                      <TextArea
                        id="vision"
                        labelText={t('brandDnaVision')}
                        value={dna.vision || ''}
                        onChange={(e: any) => update('vision', e.target.value)}
                        rows={3}
                      />
                      <TextArea
                        id="values"
                        labelText={t('brandDnaValues')}
                        value={dna.values || ''}
                        onChange={(e: any) => update('values', e.target.value)}
                        rows={3}
                      />
                      <TextArea
                        id="brand-values"
                        labelText="Valores da Marca (Detalhados)"
                        value={dna.brand_values || ''}
                        onChange={(e: any) => update('brand_values', e.target.value)}
                        rows={3}
                      />
                    </Stack>
                  </AccordionItem>

                  <AccordionItem title={t('brandDnaTone')}>
                    <Stack gap={5} style={{ padding: '1rem 0' }}>
                      <TextArea
                        id="tone"
                        labelText={t('brandDnaToneVoice')}
                        value={dna.tone_of_voice || ''}
                        onChange={(e: any) => update('tone_of_voice', e.target.value)}
                        rows={4}
                      />
                      <TextArea
                        id="vocabulary"
                        labelText={t('brandDnaVocabulary')}
                        value={dna.preferred_vocabulary || ''}
                        onChange={(e: any) => update('preferred_vocabulary', e.target.value)}
                        rows={3}
                      />
                      <TextArea
                        id="avoid"
                        labelText={t('brandDnaAvoid')}
                        value={dna.words_to_avoid || ''}
                        onChange={(e: any) => update('words_to_avoid', e.target.value)}
                        rows={3}
                      />
                      <TextArea
                        id="personality-traits"
                        labelText="Traços de Personalidade"
                        placeholder="Ex: Inovador, Pragmático, Humano..."
                        value={dna.personality_traits || ''}
                        onChange={(e: any) => update('personality_traits', e.target.value)}
                        rows={3}
                      />
                    </Stack>
                  </AccordionItem>

                  <AccordionItem title={t('brandDnaAudience')}>
                    <Stack gap={5} style={{ padding: '1rem 0' }}>
                      <TextArea
                        id="audience"
                        labelText={t('brandDnaDemographic')}
                        value={dna.target_audience || ''}
                        onChange={(e: any) => update('target_audience', e.target.value)}
                        rows={4}
                      />
                      <TextArea
                        id="personas"
                        labelText={t('brandDnaPersonas')}
                        value={dna.personas || ''}
                        onChange={(e: any) => update('personas', e.target.value)}
                        rows={4}
                      />
                      <TextArea
                        id="audience-profile"
                        labelText="Perfil Detalhado da Audiência"
                        value={dna.audience_profile || ''}
                        onChange={(e: any) => update('audience_profile', e.target.value)}
                        rows={4}
                      />
                    </Stack>
                  </AccordionItem>

                  <AccordionItem title={t('brandDnaConstraints')}>
                    <Stack gap={5} style={{ padding: '1rem 0' }}>
                      <TextArea
                        id="guidelines"
                        labelText={t('brandDnaGuidelines')}
                        value={dna.content_guidelines || ''}
                        onChange={(e: any) => update('content_guidelines', e.target.value)}
                        rows={4}
                      />
                      <TextArea
                        id="examples"
                        labelText={t('brandDnaExamples')}
                        value={dna.content_examples || ''}
                        onChange={(e: any) => update('content_examples', e.target.value)}
                        rows={4}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                        <input
                          type="checkbox"
                          id="strict-compliance"
                          checked={dna.strict_compliance === true}
                          onChange={(e: any) => update('strict_compliance', e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        <label htmlFor="strict-compliance" style={{ cursor: 'pointer', color: '#f4f4f4' }}>
                          Conformidade Rigorosa (Strict Compliance)
                        </label>
                      </div>
                    </Stack>
                  </AccordionItem>

                  {/* Fixed Description Footer */}
                  <AccordionItem title="Assinatura Fixa da Descrição">
                    <Stack gap={5} style={{ padding: '1rem 0' }}>
                      <TextArea
                        id="fixed-description-footer"
                        labelText="Rodapé Fixo"
                        value={dna?.content_rules?.fixed_description_footer || ''}
                        onChange={(e: any) => updateContentRules('fixed_description_footer', e.target.value)}
                        rows={4}
                        helperText="Este texto será adicionado ao final de cada descrição de post"
                      />
                      <hr style={{ margin: '1rem 0', borderColor: '#393939' }} />
                      <TextArea
                        id="forbidden-words"
                        labelText="Palavras Proibidas"
                        placeholder="Separe por vírgula"
                        value={Array.isArray(dna.forbidden_words) ? dna.forbidden_words.join(', ') : (dna.forbidden_words || '')}
                        onChange={(e: any) => update('forbidden_words', e.target.value.split(',').map((s: string) => s.trim()))}
                        rows={2}
                      />
                      <TextArea
                        id="mandatory-terms"
                        labelText="Termos Obrigatórios"
                        placeholder="Separe por vírgula"
                        value={Array.isArray(dna.mandatory_terms) ? dna.mandatory_terms.join(', ') : (dna.mandatory_terms || '')}
                        onChange={(e: any) => update('mandatory_terms', e.target.value.split(',').map((s: string) => s.trim()))}
                        rows={2}
                      />
                    </Stack>
                  </AccordionItem>

                  {/* Fixed Hashtags */}
                  <AccordionItem title="Hashtags Fixas">
                    <Stack gap={5} style={{ padding: '1rem 0' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <TextInput
                          id="new-hashtag"
                          labelText="Adicionar Hashtag"
                          placeholder="#exemplo"
                          value={newHashtag}
                          onChange={(e: any) => setNewHashtag(e.target.value)}
                          onKeyPress={(e: any) => e.key === 'Enter' && addHashtag()}
                          style={{ flex: 1 }}
                        />
                        <Button
                          kind="primary"
                          size="sm"
                          renderIcon={Add}
                          onClick={addHashtag}
                          style={{ marginTop: '1.5rem', whiteSpace: 'nowrap' }}
                        >
                          Adicionar
                        </Button>
                      </div>

                      {(dna?.hashtag_strategy?.fixed_hashtags || []).length > 0 && (
                        <div>
                          <p className="cds--type-label-01" style={{ marginBottom: '0.5rem', color: '#f4f4f4' }}>Hashtags Atuais:</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {dna.hashtag_strategy.fixed_hashtags.map((tag: string, idx: number) => (
                              <Tag
                                key={idx}
                                type="blue"
                                title={tag}
                                onClose={() => removeHashtag(idx)}
                              >
                                {tag}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      )}

                      <NumberInput
                        id="max-hashtags"
                        label="Máximo Total de Hashtags"
                        value={dna?.hashtag_strategy?.max_total || 5}
                        min={1}
                        max={30}
                        step={1}
                        onChange={(_: any, { value }: any) => updateHashtagStrategy('max_total', Number(value) || 5)}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          id="generate-remaining"
                          checked={dna?.hashtag_strategy?.generate_remaining !== false}
                          onChange={(e: any) => updateHashtagStrategy('generate_remaining', e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        <label htmlFor="generate-remaining" style={{ cursor: 'pointer', color: '#f4f4f4' }}>
                          Gerar hashtags restantes automaticamente
                        </label>
                      </div>

                      <p className="cds--type-caption-01" style={{ color: '#8d8d8d' }}>
                        As hashtags restantes serão geradas automaticamente por IA de acordo com a categoria do post.
                      </p>
                    </Stack>
                  </AccordionItem>

                  {/* Post Categories */}
                  <AccordionItem title="Categorias de Posts">
                    <Stack gap={5} style={{ padding: '1rem 0' }}>
                      {(dna?.editorial_pillars || []).length > 0 && (
                        <div>
                          <p className="cds--type-label-01" style={{ marginBottom: '1rem', color: '#f4f4f4' }}>Categorias Existentes:</p>
                          <Stack gap={4}>
                            {dna.editorial_pillars.map((category: any, idx: number) => (
                              <div key={idx} style={{
                                padding: '1rem',
                                backgroundColor: '#393939',
                                borderRadius: '4px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: '1rem'
                              }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ marginBottom: '0.5rem' }}>
                                    <Tag type="blue">{category.name}</Tag>
                                  </div>
                                  <p style={{ color: '#c6c6c6', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                    {category.description}
                                  </p>
                                  {category.timing_days_before !== null && (
                                    <p style={{ color: '#8d8d8d', fontSize: '0.75rem' }}>
                                      Timing: {category.timing_days_before} dias antes
                                    </p>
                                  )}
                                </div>
                                <Button
                                  kind="danger--ghost"
                                  size="sm"
                                  renderIcon={Close}
                                  iconDescription="Remover"
                                  hasIconOnly
                                  onClick={() => removeCategory(idx)}
                                />
                              </div>
                            ))}
                          </Stack>
                        </div>
                      )}

                      <div style={{ padding: '1rem', backgroundColor: '#393939', borderRadius: '4px' }}>
                        <p className="cds--type-label-01" style={{ marginBottom: '1rem', color: '#f4f4f4' }}>Nova Categoria</p>
                        <Stack gap={4}>
                          <TextInput
                            id="category-name"
                            labelText="Nome da Categoria"
                            placeholder="ex: Viagem, Dica, Promoção"
                            value={newCategory.name}
                            onChange={(e: any) => setNewCategory({ ...newCategory, name: e.target.value })}
                          />
                          <TextArea
                            id="category-description"
                            labelText="Descrição"
                            placeholder="Descreva a categoria..."
                            rows={3}
                            value={newCategory.description}
                            onChange={(e: any) => setNewCategory({ ...newCategory, description: e.target.value })}
                          />
                          <div>
                            <NumberInput
                              id="category-timing"
                              label="Dias Antes (Timing Opcional)"
                              value={newCategory.timing_days_before ?? 0}
                              min={0}
                              max={365}
                              step={1}
                              onChange={(_: any, { value }: any) => setNewCategory({
                                ...newCategory,
                                timing_days_before: Number(value) || null
                              })}
                            />
                          </div>
                          <Button
                            kind="primary"
                            size="sm"
                            renderIcon={Add}
                            onClick={addCategory}
                            disabled={!newCategory.name.trim() || !newCategory.description.trim()}
                          >
                            Adicionar Categoria
                          </Button>
                        </Stack>
                      </div>

                      <p className="cds--type-caption-01" style={{ color: '#8d8d8d' }}>
                        As categorias são usadas para classificar posts e determinar timing de publicação.
                      </p>
                    </Stack>
                  </AccordionItem>

                  {/* Granular Character Limits */}
                  <AccordionItem title="Limites de Caracteres por Trecho">
                    <Stack gap={5} style={{ padding: '1rem 0' }}>
                      <NumberInput
                        id="char-limit-description"
                        label="Descrição do Post"
                        value={dna?.char_limits?.description || 300}
                        min={1}
                        max={5000}
                        step={10}
                        onChange={(_: any, { value }: any) => updateCharLimits('description', Number(value) || 300)}
                      />
                      <NumberInput
                        id="char-limit-carousel-title"
                        label="Título do Carrossel"
                        value={dna?.char_limits?.carousel_title || 60}
                        min={1}
                        max={500}
                        step={5}
                        onChange={(_: any, { value }: any) => updateCharLimits('carousel_title', Number(value) || 60)}
                      />
                      <NumberInput
                        id="char-limit-carousel-card"
                        label="Card do Carrossel"
                        value={dna?.char_limits?.carousel_card || 150}
                        min={1}
                        max={2000}
                        step={10}
                        onChange={(_: any, { value }: any) => updateCharLimits('carousel_card', Number(value) || 150)}
                      />
                      <NumberInput
                        id="char-limit-reel-title"
                        label="Título do Reel"
                        value={dna?.char_limits?.reel_title || 40}
                        min={1}
                        max={500}
                        step={5}
                        onChange={(_: any, { value }: any) => updateCharLimits('reel_title', Number(value) || 40)}
                      />
                      <NumberInput
                        id="char-limit-static-title"
                        label="Título da Imagem Estática"
                        value={dna?.char_limits?.static_title || 60}
                        min={1}
                        max={500}
                        step={5}
                        onChange={(_: any, { value }: any) => updateCharLimits('static_title', Number(value) || 60)}
                      />
                      <NumberInput
                        id="char-limit-static-paragraph"
                        label="Parágrafo Estático"
                        value={dna?.char_limits?.static_paragraph || 200}
                        min={1}
                        max={5000}
                        step={10}
                        onChange={(_: any, { value }: any) => updateCharLimits('static_paragraph', Number(value) || 200)}
                      />

                      <p className="cds--type-caption-01" style={{ color: '#8d8d8d' }}>
                        Defina limites de caracteres para cada trecho dos textos gerados pela IA.
                      </p>
                    </Stack>
                  </AccordionItem>
                </Accordion>
              </Tile>
            </Column>
          </Grid>
        ) : (
          <Grid>
            <Column lg={16}>
              <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <Chemistry size={48} fill="#0f62fe" style={{ marginBottom: '1rem' }} />
                  <h3 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4' }}>{t('brandDnaKernelUninitialized')}</h3>
                  <p style={{ color: '#c6c6c6' }}>{t('brandDnaKernelDesc')}</p>
                </div>

                <Stack gap={5} style={{ maxWidth: '600px', margin: '0 auto' }}>
                  <TextInput
                    id="wizard-industry"
                    labelText={t('brandDnaIndustry')}
                    placeholder={t('brandDnaIndustryPlaceholder')}
                    value={industry}
                    onChange={(e: any) => setIndustry(e.target.value)}
                    style={{ backgroundColor: '#393939', color: '#f4f4f4' }}
                    disabled={isGenerating}
                  />
                  <TextArea
                    id="wizard-target"
                    labelText={t('brandDnaTargetDesc')}
                    placeholder={t('brandDnaTargetPlaceholder')}
                    rows={3}
                    value={targetDescription}
                    onChange={(e: any) => setTargetDescription(e.target.value)}
                    disabled={isGenerating}
                  />
                  <TextArea
                    id="wizard-values"
                    labelText={t('brandDnaAbsoluteValues')}
                    placeholder={t('brandDnaAbsoluteValuesPlaceholder')}
                    rows={3}
                    value={brandValues}
                    onChange={(e: any) => setBrandValues(e.target.value)}
                    disabled={isGenerating}
                  />

                  <Button
                    kind="primary"
                    renderIcon={Renew}
                    onClick={handleGenerate}
                    disabled={isGenerating || !industry || !targetDescription || !brandValues}
                    style={{ marginTop: '1rem', width: '100%' }}
                  >
                    {isGenerating ? t('brandDnaInitializing') : t('brandDnaInitialize')}
                  </Button>
                </Stack>
              </Tile>
            </Column>
          </Grid>
        )}
      </Section>
    </PageLayout>
  );
}
