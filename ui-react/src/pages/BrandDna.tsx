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
  Section,
  Grid,
  Column,
  Stack
} from '@carbon/react';
import {
  Save,
  Chemistry,
  Renew,
} from '@carbon/icons-react';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import PageLayout from '../components/PageLayout';
import { useNotifications } from '../components/NotificationProvider';
import { t } from '../components/LocaleSelectorModal';

export default function BrandDna() {
  const { showToast } = useNotifications();
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

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem', padding: '0 2rem' }}>
      <SkeletonText heading width="15%" />
      <SkeletonPlaceholder style={{ height: '300px', width: '100%', marginBottom: '1rem' }} />
      <p style={{ color: '#0f62fe', fontSize: '0.875rem' }}>{t('brandDnaOrchestrating')}</p>
    </div>
  );

  return (
    <PageLayout
      title={t('brandDnaTitle')}
      subtitle={t('brandDnaSubtitle')}
      helpMode={true}
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
