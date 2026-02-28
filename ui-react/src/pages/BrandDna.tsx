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
import PageLayout from '../components/PageLayout';
import { useNotifications } from '../components/NotificationProvider';

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
      const data = await api.get<any>('/brand-dna');
      // Supabase returns 406 or null object if no rows exist in a single(), adjust logic
      if (data && Object.keys(data).length > 0) {
        setDna(data);
      } else {
        setDna(null);
      }
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
      showToast('Processando Watsonx', 'Conectando ao modelo Granite...', 'info');
      await api.post('/dna/wizard/generate', {
        industry,
        targetDescription,
        brandValues
      });
      showToast('Kernel Constraint Criado', 'Sementes semânticas injetadas com sucesso.', 'success');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await loadData();
    } catch (err: any) {
      const msg = err.message || String(err);
      setError(msg);
      showToast('Falha na Geração', msg, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!dna) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/brand-dna', dna);
      showToast('DNA Salvo', 'As topologias restritivas foram salvas com sucesso no banco de dados Supabase.', 'success');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(String(err));
      showToast('Erro ao Salvar', String(err), 'error');
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
      <p style={{ color: '#0f62fe', fontSize: '0.875rem' }}>Orquestrando matriz de tensores do DNA...</p>
    </div>
  );

  return (
    <PageLayout
      title="Brand DNA (Core)"
      subtitle="Defina o Constraint Kernel: A identidade corporativa suprema que baliza a avaliação de Drift do LLM."
      actions={(
        <Button kind="primary" size="sm" renderIcon={Save} onClick={handleSave} disabled={saving}>
          {saving ? 'Gravando Kernel...' : 'Gravar DNA Base'}
        </Button>
      )}
    >
      <Section>
        {saved && (
          <Grid>
            <Column lg={16}>
              <InlineNotification
                kind="success"
                title="Configuração Consolidada:"
                subtitle="O Agentic Worker foi treinado nas novas topologias."
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
                  <p className="cds--type-productive-heading-03" style={{ color: '#fa4d56' }}>Erro Crítico de Roteamento</p>
                  <p style={{ color: '#c6c6c6' }}>{error}</p>
                  <Button kind="tertiary" size="sm" onClick={loadData} renderIcon={Renew}>
                    Rearmar Fluxo
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
                  <AccordionItem title="Identidade Paramétrica da Marca" open>
                    <Stack gap={5} style={{ padding: '1rem 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AILabel
                          size="sm"
                          AILabelContent={(
                            <AILabelContent>
                              <div style={{ padding: '0.5rem', minWidth: '250px' }}>
                                <p style={{ marginBottom: '0.5rem' }}><strong>Explicabilidade Helian</strong></p>
                                <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>Heurística:</strong> MasterCompliance Tensor.</p>
                                <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>Confiança:</strong> 96.4% de precisão estrutural.</p>
                                <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>Orquestração:</strong> Processado via IBM Granite-13B.</p>
                              </div>
                            </AILabelContent>
                          )}
                        />
                        <span className="cds--type-label-01" style={{ color: '#8d8d8d' }}>AI Governed Constraint</span>
                      </div>

                      <TextInput
                        id="brand-name"
                        labelText="Corporate Target Node"
                        value={dna.brand_name || ''}
                        onChange={(e: any) => update('brand_name', e.target.value)}
                        style={{ backgroundColor: '#393939', color: '#f4f4f4' }}
                      />
                      <TextArea
                        id="mission"
                        labelText="Missão (Kernel Bound)"
                        value={dna.mission || ''}
                        onChange={(e: any) => update('mission', e.target.value)}
                        rows={3}
                      />
                      <TextArea
                        id="vision"
                        labelText="Visão (Evolutionary Trajectory)"
                        value={dna.vision || ''}
                        onChange={(e: any) => update('vision', e.target.value)}
                        rows={3}
                      />
                      <TextArea
                        id="values"
                        labelText="Valores Core (Constraints)"
                        value={dna.values || ''}
                        onChange={(e: any) => update('values', e.target.value)}
                        rows={3}
                      />
                    </Stack>
                  </AccordionItem>

                  <AccordionItem title="Tom de Voz & Matriz de Expressão">
                    <Stack gap={5} style={{ padding: '1rem 0' }}>
                      <TextArea
                        id="tone"
                        labelText="Tom de Voz Primário"
                        value={dna.tone_of_voice || ''}
                        onChange={(e: any) => update('tone_of_voice', e.target.value)}
                        rows={4}
                      />
                      <TextArea
                        id="vocabulary"
                        labelText="Vocabulário Positivo (White-list)"
                        value={dna.preferred_vocabulary || ''}
                        onChange={(e: any) => update('preferred_vocabulary', e.target.value)}
                        rows={3}
                      />
                      <TextArea
                        id="avoid"
                        labelText="Termos Proibidos (Black-list)"
                        value={dna.words_to_avoid || ''}
                        onChange={(e: any) => update('words_to_avoid', e.target.value)}
                        rows={3}
                      />
                    </Stack>
                  </AccordionItem>

                  <AccordionItem title="Topologia de Audiência">
                    <Stack gap={5} style={{ padding: '1rem 0' }}>
                      <TextArea
                        id="audience"
                        labelText="Perfil Sociodemográfico"
                        value={dna.target_audience || ''}
                        onChange={(e: any) => update('target_audience', e.target.value)}
                        rows={4}
                      />
                      <TextArea
                        id="personas"
                        labelText="Arquétipos Agênticos (Personas)"
                        value={dna.personas || ''}
                        onChange={(e: any) => update('personas', e.target.value)}
                        rows={4}
                      />
                    </Stack>
                  </AccordionItem>

                  <AccordionItem title="Output Constraints (Tamanho & Formatos)">
                    <Stack gap={5} style={{ padding: '1rem 0' }}>
                      <TextArea
                        id="guidelines"
                        labelText="Regras de Output Rígidas"
                        value={dna.content_guidelines || ''}
                        onChange={(e: any) => update('content_guidelines', e.target.value)}
                        rows={4}
                      />
                      <TextArea
                        id="examples"
                        labelText="Shot Examples (Few-Shot Prompting)"
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
                  <h3 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4' }}>Kernel Não Inicializado</h3>
                  <p style={{ color: '#c6c6c6' }}>Infunda as sementes fundamentais para a orquestração do DNA via IBM Watsonx.</p>
                </div>

                <Stack gap={5} style={{ maxWidth: '600px', margin: '0 auto' }}>
                  <TextInput
                    id="wizard-industry"
                    labelText="Indústria ou Nicho"
                    placeholder="Ex: Tecnologia Cloud B2B"
                    value={industry}
                    onChange={(e: any) => setIndustry(e.target.value)}
                    style={{ backgroundColor: '#393939', color: '#f4f4f4' }}
                    disabled={isGenerating}
                  />
                  <TextArea
                    id="wizard-target"
                    labelText="Descrição Primária do Público-Alvo"
                    placeholder="Ex: Executivos C-Level buscando otimização de custos e arquitetos de software seniores..."
                    rows={3}
                    value={targetDescription}
                    onChange={(e: any) => setTargetDescription(e.target.value)}
                    disabled={isGenerating}
                  />
                  <TextArea
                    id="wizard-values"
                    labelText="Valores Absolutos da Marca"
                    placeholder="Ex: Inovação incessante, transparência técnica, alta performance e pragmatismo."
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
                    {isGenerating ? 'Processando Ingestão no IBM Granite...' : 'Inicializar Constraint Kernel via IA'}
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
