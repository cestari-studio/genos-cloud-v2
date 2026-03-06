import React, { useState } from 'react';
import {
    ComposedModal, ModalHeader, ModalBody, ModalFooter,
    ProgressIndicator, ProgressStep,
    TextInput, TextArea, Select, SelectItem, NumberInput,
    DatePicker, DatePickerInput,
    Button, Stack,
    InlineLoading, InlineNotification,
    AILabel, AILabelContent, AILabelActions
} from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { CostEstimator } from '../CostEstimator';
import AISkeleton from './AISkeleton';
import { SYSTEM_VERSIONS } from '../../config/versions';
import { AI_EXPLAINERS } from '../../config/explainers';

interface AIPostCreationModalProps {
    open: boolean;
    onClose: () => void;
    onPostCreated: (post: any) => void;
    generatingFromApiInfo?: (payload: any) => Promise<any>; // Passed from parent (Factory.tsx)
}

export default function AIPostCreationModal({
    open, onClose, onPostCreated, generatingFromApiInfo
}: AIPostCreationModalProps) {
    const { me, refreshWallet } = useAuth();
    const navigate = useNavigate();

    const [currentStep, setCurrentStep] = useState(0);
    const [phase, setPhase] = useState<'steps' | 'generating' | 'result'>('steps');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [canAfford, setCanAfford] = useState(true);

    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState('');

    React.useEffect(() => {
        const fetchProjects = async () => {
            if (!me?.tenant?.id) return;
            const { data } = await supabase
                .from('projects')
                .select('id, name')
                .eq('tenant_id', me.tenant.id)
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                setProjects(data);
                setSelectedProject(data[0].id);
            }
        };
        if (open) fetchProjects();
    }, [open, me?.tenant?.id]);

    // Form data
    const [topic, setTopic] = useState('');
    const [context, setContext] = useState('');
    const [format, setFormat] = useState<'feed' | 'carrossel' | 'stories' | 'reels'>('feed');
    const [cardCount, setCardCount] = useState(5);
    const [reelDuration, setReelDuration] = useState(30);
    const [feedMediaType, setFeedMediaType] = useState<'image' | 'video'>('image');
    const [aiInstructions, setAiInstructions] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [extraHashtags, setExtraHashtags] = useState('');
    const [customCta, setCustomCta] = useState('');

    const steps = [
        { label: 'Tema', description: 'Tema principal' },
        { label: 'Formato', description: 'Tipo e configuração' },
        { label: 'Detalhes', description: 'Instruções e data' },
        { label: 'Confirmar', description: 'Custo e aprovação' },
    ];

    const canProceed = (step: number): boolean => {
        switch (step) {
            case 0: return topic.trim().length >= 3;
            case 1: return true;
            case 2: return true;
            case 3: return canAfford;
            default: return false;
        }
    };

    const handleGenerate = async () => {
        if (!generatingFromApiInfo) return;
        setPhase('generating');
        setError('');

        try {
            const payload = {
                action: 'generate',
                tenantId: me?.tenant?.id,
                projectId: selectedProject || undefined,
                topic: topic.trim(),
                context: context.trim(),
                targetFormat: format,
                cardCount: format === 'carrossel' || format === 'stories' ? cardCount : undefined,
                reelDuration: format === 'reels' ? reelDuration : undefined,
                feedMediaType: format === 'feed' ? feedMediaType : undefined,
                ai_instructions: aiInstructions.trim(),
                scheduled_date: scheduledDate || null,
                extraHashtags: extraHashtags.trim(),
                customCta: customCta.trim()
            };

            const response = await generatingFromApiInfo(payload);
            // api.edgeFn already unwraps the { success: true, data: T } format.
            setResult(response);
            setPhase('result');
            refreshWallet();
        } catch (err: any) {
            setError(err.message || String(err));
            setPhase('steps');
        }
    };

    const resetState = () => {
        setCurrentStep(0);
        setPhase('steps');
        setResult(null);
        setError('');
        setTopic('');
        setContext('');
        setFormat('feed');
        setCardCount(5);
        setReelDuration(30);
        setFeedMediaType('image');
        setAiInstructions('');
        setScheduledDate('');
        setExtraHashtags('');
        setCustomCta('');
    };

    const handleClose = () => {
        if (phase !== 'generating') {
            onClose();
            // Delay reset to avoid flicker
            setTimeout(resetState, 300);
        }
    };

    const renderStepTema = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {projects.length > 0 && (
                <Select
                    id="ai-project-select"
                    labelText="Selecione o Projeto (Opcional)"
                    value={selectedProject}
                    onChange={(e: any) => setSelectedProject(e.target.value)}
                >
                    <SelectItem value="" text="Nenhum (Post Avulso)" />
                    {projects.map(p => (
                        <SelectItem key={p.id} value={p.id} text={p.name} />
                    ))}
                </Select>
            )}
            <TextInput
                id="ai-topic"
                labelText="Tema Principal (Obrigatório)"
                placeholder="Do que se trata o post?"
                value={topic}
                onChange={(e: any) => setTopic(e.target.value)}
                required
                data-modal-primary-focus
            />
            <TextArea
                id="ai-context"
                labelText="Contexto Adicional (Opcional)"
                placeholder="Informações de suporte, promoções, URLs de referência, etc."
                value={context}
                onChange={(e: any) => setContext(e.target.value)}
                rows={4}
            />
        </div>
    );

    const renderStepFormato = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Select
                id="ai-format"
                labelText="Formato"
                value={format}
                onChange={(e: any) => {
                    const val = e.target.value as any;
                    setFormat(val);
                }}
            >
                <SelectItem value="feed" text="Feed Estático" />
                <SelectItem value="carrossel" text="Carrossel" />
                <SelectItem value="stories" text="Stories" />
                <SelectItem value="reels" text="Reels (Roteiro)" />
            </Select>

            {(format === 'carrossel' || format === 'stories') && (
                <NumberInput
                    id="ai-card-count"
                    label="Quantidade de Cards/Frames"
                    min={2}
                    max={10}
                    step={1}
                    value={cardCount}
                    onChange={(_: any, { value }: any) => setCardCount(Number(value || 5))}
                />
            )}

            {format === 'reels' && (
                <NumberInput
                    id="ai-reel-duration"
                    label="Duração Esperada (Segundos)"
                    min={15}
                    max={90}
                    step={1}
                    value={reelDuration}
                    onChange={(_: any, { value }: any) => setReelDuration(Number(value || 30))}
                />
            )}

            {format === 'feed' && (
                <Select
                    id="ai-feed-media"
                    labelText="Tipo de Mídia"
                    value={feedMediaType}
                    onChange={(e: any) => setFeedMediaType(e.target.value as any)}
                >
                    <SelectItem value="image" text="Imagem" />
                    <SelectItem value="video" text="Vídeo Curto" />
                </Select>
            )}
        </div>
    );

    const renderStepDetalhes = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <TextArea
                id="ai-instructions"
                labelText="Instruções de Tom (Opcional)"
                placeholder="Ex: Seja mais informal, use muitos emojis, foque na urgência..."
                value={aiInstructions}
                onChange={(e: any) => setAiInstructions(e.target.value)}
                rows={2}
            />
            <TextArea
                id="ai-custom-cta"
                labelText="CTA Personalizado (Opcional)"
                placeholder="Ex: Clique no link da bio e garanta 20% OFF."
                value={customCta}
                onChange={(e: any) => setCustomCta(e.target.value)}
                rows={2}
            />
            <TextArea
                id="ai-extra-hashtags"
                labelText="Hashtags Extras (Opcionais)"
                placeholder="As tags fixas do DNA da Marca serão inseridas automaticamente."
                value={extraHashtags}
                onChange={(e: any) => setExtraHashtags(e.target.value)}
                rows={2}
            />

            <DatePicker
                datePickerType="single"
                minDate="today"
                onChange={([date]: Date[]) => {
                    if (date) {
                        setScheduledDate(date.toISOString().split('T')[0]);
                    } else {
                        setScheduledDate('');
                    }
                }}
            >
                <DatePickerInput
                    id="ai-scheduled-date"
                    labelText="Data de Agendamento (Opcional)"
                    placeholder="dd/mm/yyyy"
                    size="md"
                    helperText="Informe a data prevista para publicação deste post."
                />
            </DatePicker>
        </div>
    );

    const renderStepConfirmar = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
                <InlineNotification
                    kind={error.includes('API key') || error.includes('GEMINI') ? 'warning' : 'error'}
                    title={error.includes('API key') || error.includes('GEMINI') ? 'Configuração Necessária' : 'Erro ao gerar'}
                    subtitle={error.includes('API key') || error.includes('GEMINI')
                        ? 'A chave da API Gemini (GEMINI_API_KEY) não está configurada nos Secrets do Supabase. Acesse o painel e adicione o Secret antes de gerar.'
                        : error
                    }
                    lowContrast
                    onCloseButtonClick={() => setError('')}
                />
            )}
            <CostEstimator
                format={format}
                operation="generate"
                slideCount={format === 'carrossel' || format === 'stories' ? cardCount : 1}
                aiModel={me?.config?.ai_model || 'gemini-2.0-flash'}
                onValidationChange={setCanAfford}
            />
        </div>
    );

    const renderResult = () => {
        const post = result?.post || result;
        const cost = result?.cost;
        const audit = result?.audit || post?.ai_audit;

        return (
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="success-icon-check" style={{ color: 'var(--cds-support-success)', fontSize: '2rem' }}>✓</div>
                    <Stack gap={1}>
                        <h4 className="cds--type-heading-compact-01">Geração Concluída</h4>
                        <p className="cds--type-body-short-01">
                            O post <strong>"{post?.title}"</strong> foi criado com sucesso.
                        </p>
                    </Stack>
                </div>

                <div className="result-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                    <div style={{ borderLeft: '3px solid var(--cds-button-primary)', paddingLeft: '1rem' }}>
                        <p className="cds--type-label-01" style={{ color: 'var(--cds-text-helper)' }}>Tokens Consumidos</p>
                        <p className="cds--type-productive-heading-03">-{cost?.tokens_consumed || '—'}</p>
                    </div>
                    <div style={{ borderLeft: '3px solid var(--cds-support-success)', paddingLeft: '1rem' }}>
                        <p className="cds--type-label-01" style={{ color: 'var(--cds-text-helper)' }}>Saldo Atual</p>
                        <p className="cds--type-productive-heading-03">{cost?.new_balance?.toLocaleString() || '—'}</p>
                    </div>
                    <div style={{ borderLeft: '3px solid var(--cds-support-info)', paddingLeft: '1rem' }}>
                        <p className="cds--type-label-01" style={{ color: 'var(--cds-text-helper)' }}>Posts (Ciclo)</p>
                        <p className="cds--type-productive-heading-03">{cost?.posts_used} / {cost?.posts_limit}</p>
                    </div>
                </div>

                <Stack gap={2} style={{ background: 'var(--cds-layer-02)', padding: '1rem', border: '1px solid var(--cds-border-subtle)' }}>
                    <p className="cds--type-label-01" style={{ color: 'var(--cds-text-helper)' }}>Resumo do Post</p>
                    <p className="cds--type-body-short-01" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        fontStyle: 'italic'
                    }}>
                        {post?.description || 'Nenhuma descrição gerada.'}
                    </p>
                </Stack>

                <InlineNotification
                    kind="info"
                    title="Pronto para Revisão"
                    subtitle="Você pode editar o texto, ajustar a mídia e submeter para revisão na lista principal."
                    lowContrast
                    hideCloseButton
                />
            </div>
        );
    };

    return (
        <ComposedModal
            open={open}
            onClose={handleClose}
            size="lg"
            preventCloseOnClickOutside={phase === 'generating'}
        >
            <ModalHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 className="cds--type-heading-compact-02">
                        {phase === 'result' ? 'Post Gerado com Sucesso' :
                            phase === 'generating' ? 'Gerando Conteúdo Automático' :
                                'Criar Post com Inteligência Artificial'}
                    </h3>

                    <AILabel kind="inline" size="sm">
                        <AILabelContent>
                            <Stack gap={3}>
                                <div>
                                    <p className="cds--type-label-01" style={{ color: 'var(--cds-text-helper)' }}>AI EXPLAINED</p>
                                    <p className="cds--type-productive-heading-05">
                                        {me?.config?.ai_model?.includes('flash') ? '94%' :
                                            me?.config?.ai_model?.includes('pro') ? '97%' : '94%'}
                                    </p>
                                    <p className="cds--type-label-01">Confidence score</p>
                                    <p className="cds--type-body-short-01">
                                        {AI_EXPLAINERS.helianPostGeneration}
                                    </p>
                                </div>
                                <div className="cds--ai-label-content__divider" />
                                <Stack gap={1}>
                                    <p className="cds--type-label-01" style={{ color: 'var(--cds-text-helper)' }}>Modelo ativo</p>
                                    <p className="cds--type-body-short-02" style={{ fontWeight: 600 }}>
                                        {me?.config?.ai_model || 'Gemini 2.0 Flash'}
                                    </p>
                                </Stack>
                                <Stack gap={1}>
                                    <p className="cds--type-label-01" style={{ color: 'var(--cds-text-helper)' }}>Tipo de modelo</p>
                                    <p className="cds--type-body-short-02" style={{ fontWeight: 600 }}>Foundation model</p>
                                </Stack>
                            </Stack>
                        </AILabelContent>
                    </AILabel>
                </div>

                {phase === 'steps' && (
                    <div style={{ marginTop: '2rem' }}>
                        <ProgressIndicator currentIndex={currentStep}>
                            {steps.map((s, i) => (
                                <ProgressStep
                                    label={s.label}
                                    description={s.description}
                                    key={i}
                                    complete={i < currentStep}
                                    current={i === currentStep}
                                />
                            ))}
                        </ProgressIndicator>
                    </div>
                )}
            </ModalHeader>

            <ModalBody>
                <div style={{ padding: '1rem 0' }}>
                    {phase === 'steps' && currentStep === 0 && renderStepTema()}
                    {phase === 'steps' && currentStep === 1 && renderStepFormato()}
                    {phase === 'steps' && currentStep === 2 && renderStepDetalhes()}
                    {phase === 'steps' && currentStep === 3 && renderStepConfirmar()}
                    {phase === 'generating' && (
                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <InlineLoading description="Integrando BrandDNA™ e orquestrando Helian™ v5.0.0..." />
                            <AISkeleton type="text" lines={4} />
                            <AISkeleton type="placeholder" />
                        </div>
                    )}
                    {phase === 'result' && result && renderResult()}
                </div>
            </ModalBody>

            <ModalFooter>
                {phase === 'steps' && (
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <AILabel kind="inline" size="sm">
                                <AILabelContent>
                                    <p className="cds--type-label-01">Análise prévia Helian™</p>
                                    <p className="cds--type-body-short-01">Consumo estimado: ~500 tokens</p>
                                    <p className="cds--type-label-01" style={{ marginTop: '0.5rem' }}>Estratégia</p>
                                    <p className="cds--type-body-short-01">Uso de JIT Agent Envelope™ para contexto de marca.</p>
                                </AILabelContent>
                            </AILabel>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {currentStep > 0 ? (
                                <Button kind="secondary" onClick={() => setCurrentStep(prev => prev - 1)}>
                                    Voltar
                                </Button>
                            ) : (
                                <Button kind="secondary" onClick={handleClose}>
                                    Cancelar
                                </Button>
                            )}

                            {currentStep < 3 ? (
                                <Button kind="primary" disabled={!canProceed(currentStep)} onClick={() => setCurrentStep(prev => prev + 1)}>
                                    Próximo
                                </Button>
                            ) : (
                                <Button kind="primary" disabled={!canProceed(currentStep)} onClick={handleGenerate}>
                                    Gerar Post com IA
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {phase === 'result' && (
                    <Button kind="primary" onClick={() => {
                        if (result) onPostCreated(result);
                        handleClose();
                    }}>
                        Fechar
                    </Button>
                )}
            </ModalFooter>
        </ComposedModal>
    );
}
