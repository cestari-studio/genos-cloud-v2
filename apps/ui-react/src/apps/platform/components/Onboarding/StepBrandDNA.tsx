import React from 'react';
import {
    Button,
    Stack,
    TextInput,
    TextArea,
    Accordion,
    AccordionItem,
    Tag,
    InlineLoading,
    InlineNotification,
    Slider
} from '@carbon/react';
import { useTranslation } from 'react-i18next';

interface StepBrandDNAProps {
    proposal: any;
    onConfirm: (finalDna: any) => Promise<void>;
    loading: boolean;
    error?: string | null;
}

const StepBrandDNA: React.FC<StepBrandDNAProps> = ({ proposal, onConfirm, loading, error }) => {
    const { t } = useTranslation();
    const [dna, setDna] = React.useState(proposal || {
        voice_tone: {
            primary: 'Professional',
            secondary: 'Innovative',
            register: 'Formal'
        },
        personality_traits: {
            innovation: 80, // Inovação vs Tradição
            boldness: 70    // Ousadia vs Pragmatismo
        },
        brand_values: {
            core: 'Excellence, Transparency',
            mission: ''
        },
        editorial_pillars: []
    });

    const updateNested = (category: string, field: string, value: any) => {
        setDna((prev: any) => ({
            ...prev,
            [category]: {
                ...prev[category],
                [field]: value
            }
        }));
    };

    const handleSubmit = () => {
        onConfirm(dna);
    };

    return (
        <div className="onboarding-step step-brand-dna">
            <h2 className="step-title">{t('onboarding.dna.title', 'BrandDNA™ Vector Calibration')}</h2>
            <p className="step-description">
                {t('onboarding.dna.description', 'Review and fine-tune your brand identity. These parameters will be vectorized and used as the semantic foundation for all AI-generated content.')}
            </p>

            <Stack gap={7}>
                <Accordion>
                    <AccordionItem title={t('onboarding.dna.voice_personality', 'Voice & Personality')} open>
                        <Stack gap={5}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <TextInput
                                    id="tone-primary"
                                    labelText={t('onboarding.dna.primary_tone', 'Primary Tone')}
                                    value={dna.voice_tone.primary}
                                    onChange={(e) => updateNested('voice_tone', 'primary', e.target.value)}
                                />
                                <TextInput
                                    id="tone-secondary"
                                    labelText={t('onboarding.dna.secondary_tone', 'Secondary Tone')}
                                    value={dna.voice_tone.secondary}
                                    onChange={(e) => updateNested('voice_tone', 'secondary', e.target.value)}
                                />
                            </div>
                            <div className="traits-calibration">
                                <Slider
                                    id="slider-innovation"
                                    labelText={t('onboarding.dna.trait_innovation', 'Inovação (vs Tradição)')}
                                    min={0}
                                    max={100}
                                    value={dna.personality_traits.innovation}
                                    onChange={({ value }) => updateNested('personality_traits', 'innovation', value)}
                                />
                                <Slider
                                    id="slider-boldness"
                                    labelText={t('onboarding.dna.trait_boldness', 'Ousadia (vs Pragmatismo)')}
                                    min={0}
                                    max={100}
                                    value={dna.personality_traits.boldness}
                                    onChange={({ value }) => updateNested('personality_traits', 'boldness', value)}
                                    style={{ marginTop: '1rem' }}
                                />
                            </div>
                        </Stack>
                    </AccordionItem>

                    <AccordionItem title={t('onboarding.dna.strategy_values', 'Strategy & Values')}>
                        <Stack gap={5}>
                            <TextArea
                                id="brand-mission"
                                labelText={t('onboarding.dna.mission', 'Brand Manifesto / Mission')}
                                value={dna.brand_values.mission}
                                onChange={(e) => updateNested('brand_values', 'mission', e.target.value)}
                                rows={4}
                            />
                            <TextInput
                                id="brand-values-core"
                                labelText={t('onboarding.dna.core_values', 'Core Values (comma separated)')}
                                value={dna.brand_values.core}
                                onChange={(e) => updateNested('brand_values', 'core', e.target.value)}
                            />
                        </Stack>
                    </AccordionItem>

                    <AccordionItem title={t('onboarding.dna.editorial', 'Editorial Pillars')}>
                        <div className="pillars-container">
                            {dna.editorial_pillars.length > 0 ? (
                                dna.editorial_pillars.map((pillar: string, idx: number) => (
                                    <Tag key={idx} type="cool-gray" title={pillar}>
                                        {pillar}
                                    </Tag>
                                ))
                            ) : (
                                <p style={{ fontStyle: 'italic', opacity: 0.7 }}>
                                    {t('onboarding.dna.no_pillars', 'Pillars will be automatically generated based on your briefing.')}
                                </p>
                            )}
                        </div>
                    </AccordionItem>
                </Accordion>

                {error && (
                    <InlineNotification
                        kind="error"
                        title={t('common.error', 'Error')}
                        subtitle={error}
                    />
                )}

                <div className="step-actions">
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        kind="primary"
                    >
                        {loading ? (
                            <InlineLoading description={t('onboarding.dna.vectorizing', 'Vectorizing Identity...')} />
                        ) : (
                            t('onboarding.dna.confirm_vectorize', 'Confirm & Vectorize')
                        )}
                    </Button>
                </div>
            </Stack>
        </div>
    );
};

export default StepBrandDNA;
