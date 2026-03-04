import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Theme,
    ProgressIndicator,
    ProgressStep,
    TextInput,
    TextArea,
    Select,
    SelectItem,
    Button,
    InlineLoading,
    InlineNotification
} from '@carbon/react';
import { ArrowRight, CheckmarkOutline } from '@carbon/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export default function OnboardingWizard() {
    const { me, refreshMe } = useAuth();
    const navigate = useNavigate();

    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form State
    const [brandName, setBrandName] = useState(me?.tenant?.name || '');
    const [industry, setIndustry] = useState('Marketing');
    const [brandStory, setBrandStory] = useState('');
    const [targetAudience, setTargetAudience] = useState('');

    const steps = [
        { label: 'Sua Marca', description: 'Informações Básicas' },
        { label: 'O Briefing', description: 'História e Público' },
        { label: 'Criação do DNA', description: 'Processamento IA' }
    ];

    const handleNext = async () => {
        if (currentStep === 1) {
            // Step 2 -> 3: Trigger the AI generation
            setCurrentStep(2);
            setLoading(true);
            setError('');

            try {
                const payload = {
                    action: 'generate_dna_from_briefing',
                    tenantId: me?.tenant?.id,
                    briefing: {
                        brandName,
                        industry,
                        brandStory,
                        targetAudience
                    }
                };

                // We will call the content-factory-ai edge function to process this
                await api.edgeFn('content-factory-ai', payload);

                // Mark tenant onboarding as complete
                await api.edgeFn('content-factory-ai', {
                    action: 'complete_onboarding',
                    tenantId: me?.tenant?.id
                });

                await refreshMe();
                navigate('/content-factory/posts');
            } catch (err: any) {
                setError(err.message || String(err));
                setCurrentStep(1); // Go back to allow retry
            } finally {
                setLoading(false);
            }
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const isStepValid = () => {
        if (currentStep === 0) return brandName.trim().length > 2;
        if (currentStep === 1) return brandStory.trim().length > 10 && targetAudience.trim().length > 5;
        return true;
    };

    return (
        <Theme theme="g100">
            <div style={{
                minHeight: '100vh',
                backgroundColor: '#000000',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '2rem 1rem'
            }}>
                {/* Header */}
                <div style={{ width: '100%', maxWidth: '800px', marginBottom: '3rem', textAlign: 'center' }}>
                    <h1 className="cds--type-productive-heading-05" style={{ marginBottom: '0.5rem' }}>
                        Bem-vindo ao genOS™ Cloud
                    </h1>
                    <p className="cds--type-body-long-02" style={{ color: 'var(--cds-text-secondary)' }}>
                        Vamos configurar a identidade autônoma da sua marca em 3 passos simples.
                    </p>
                </div>

                {/* Progress Container */}
                <div style={{ width: '100%', maxWidth: '800px', marginBottom: '3rem' }}>
                    <ProgressIndicator currentIndex={currentStep}>
                        {steps.map((step, idx) => (
                            <ProgressStep
                                key={idx}
                                label={step.label}
                                description={step.description}
                                complete={idx < currentStep}
                                current={idx === currentStep}
                            />
                        ))}
                    </ProgressIndicator>
                </div>

                {/* Main Card */}
                <div style={{
                    width: '100%',
                    maxWidth: '600px',
                    backgroundColor: 'var(--cds-layer-01)',
                    padding: '2rem',
                    border: '1px solid var(--cds-border-subtle)'
                }}>
                    {error && (
                        <InlineNotification
                            kind="error"
                            title="Erro no Processamento"
                            subtitle={error}
                            onCloseButtonClick={() => setError('')}
                            style={{ marginBottom: '1.5rem' }}
                        />
                    )}

                    {currentStep === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <h2 className="cds--type-productive-heading-03">Informações da Marca</h2>
                            <TextInput
                                id="brand-name"
                                labelText="Nome da Marca"
                                value={brandName}
                                onChange={(e) => setBrandName(e.target.value)}
                                placeholder="Ex: Cestari Studio"
                            />
                            <Select
                                id="industry"
                                labelText="Nicho de Mercado / Indústria"
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                            >
                                <SelectItem value="Marketing" text="Marketing & Publicidade" />
                                <SelectItem value="Tecnologia" text="Tecnologia & Software (SaaS)" />
                                <SelectItem value="E-commerce" text="E-commerce & Varejo" />
                                <SelectItem value="Saúde" text="Saúde & Bem-estar" />
                                <SelectItem value="Educação" text="Educação & Treinamento" />
                                <SelectItem value="Consultoria" text="Consultoria & Serviços Corporativos" />
                                <SelectItem value="Outro" text="Outro" />
                            </Select>
                        </div>
                    )}

                    {currentStep === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <h2 className="cds--type-productive-heading-03">O Briefing Core</h2>
                            <TextArea
                                id="brand-story"
                                labelText="Brand Story (Propósito e Visão)"
                                helperText="Conte resumidamente o que sua empresa faz, o problema que resolve e seus diferenciais."
                                value={brandStory}
                                onChange={(e) => setBrandStory(e.target.value)}
                                placeholder="Ex: Somos uma startup focada em democratizar o acesso à inteligência artificial para pequenos negócios..."
                                rows={4}
                            />
                            <TextArea
                                id="target-audience"
                                labelText="Público-Alvo"
                                helperText="Para quem você vende? Descreva o perfil ideal do seu cliente."
                                value={targetAudience}
                                onChange={(e) => setTargetAudience(e.target.value)}
                                placeholder="Ex: Empreendedores de pequeno e médio porte, faixa etária 25-45 anos, buscando otimização de tempo..."
                                rows={3}
                            />
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2rem 0' }}>
                            <InlineLoading
                                description="O motor quântico Helian está gerando seu Brand DNA... (Tom de voz, traços de personalidade, regras de conteúdo)"
                                status={loading ? 'active' : 'finished'}
                            />
                        </div>
                    )}

                    {/* Footer Actions */}
                    {currentStep < 2 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--cds-border-subtle)' }}>
                            <Button
                                kind="primary"
                                renderIcon={ArrowRight}
                                onClick={handleNext}
                                disabled={!isStepValid()}
                            >
                                {currentStep === 1 ? 'Gerar Brand DNA com IA' : 'Próximo Passo'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </Theme>
    );
}
