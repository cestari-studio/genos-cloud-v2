import React, { useState } from 'react';
import {
    Stack,
    TextInput,
    TextArea,
    Select,
    SelectItem,
    Button,
    InlineNotification,
} from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';

interface BriefingFormProps {
    initialData?: {
        brandName: string;
        industry: string;
        brandStory: string;
        targetAudience: string;
        personality?: string;
        specificGoals?: string;
    };
    onSubmit: (data: any) => Promise<void>;
    loading?: boolean;
    error?: string;
}

export default function BriefingForm({ initialData, onSubmit, loading, error }: BriefingFormProps) {
    const [brandName, setBrandName] = useState(initialData?.brandName || '');
    const [industry, setIndustry] = useState(initialData?.industry || 'Marketing');
    const [brandStory, setBrandStory] = useState(initialData?.brandStory || '');
    const [targetAudience, setTargetAudience] = useState(initialData?.targetAudience || '');
    const [personality, setPersonality] = useState(initialData?.personality || '');
    const [specificGoals, setSpecificGoals] = useState(initialData?.specificGoals || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ brandName, industry, brandStory, targetAudience, personality, specificGoals });
    };

    const isValid = brandName.length > 2 && brandStory.length > 10 && targetAudience.length > 5;

    return (
        <form onSubmit={handleSubmit}>
            <Stack gap={7}>
                {error && (
                    <InlineNotification
                        kind="error"
                        title="Erro no Briefing"
                        subtitle={error}
                        lowContrast
                    />
                )}

                <Stack gap={5}>
                    <h2 className="cds--type-productive-heading-03">Informações da Marca</h2>
                    <TextInput
                        id="brand-name"
                        labelText="Nome da Marca"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="Ex: Cestari Studio"
                        required
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
                </Stack>

                <Stack gap={5}>
                    <h2 className="cds--type-productive-heading-03">O Briefing Core</h2>
                    <TextArea
                        id="brand-story"
                        labelText="Brand Story (Propósito e Visão)"
                        helperText="Fale sobre o que sua empresa faz e qual problema ela resolve."
                        value={brandStory}
                        onChange={(e) => setBrandStory(e.target.value)}
                        rows={4}
                        required
                    />
                    <TextArea
                        id="target-audience"
                        labelText="Público-Alvo"
                        helperText="Para quem você vende? Descreva o perfil ideal."
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        rows={3}
                        required
                    />
                    <TextInput
                        id="personality"
                        labelText="Personalidade da Marca (3 adjetivos)"
                        placeholder="Ex: Inovadora, Confiável, Jovem"
                        value={personality}
                        onChange={(e) => setPersonality(e.target.value)}
                    />
                    <TextArea
                        id="specific-goals"
                        labelText="Objetivos Imediatos"
                        placeholder="O que você espera alcançar nos próximos 30 dias com o genOS?"
                        value={specificGoals}
                        onChange={(e) => setSpecificGoals(e.target.value)}
                        rows={2}
                    />
                </Stack>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <Button
                        type="submit"
                        kind="primary"
                        renderIcon={ArrowRight}
                        disabled={!isValid || loading}
                    >
                        {loading ? 'Processando...' : 'Gerar Brand DNA'}
                    </Button>
                </div>
            </Stack>
        </form>
    );
}
