import React from 'react';
import {
    TextInput,
    TextArea,
    Select,
    SelectItem,
    Button,
    FormGroup,
    Stack,
    InlineLoading,
    InlineNotification,
    AILabel,
    AILabelContent
} from '@carbon/react';
import { useTranslation } from 'react-i18next';

interface StepAIProjectScopeProps {
    onComplete: (data: any) => Promise<void>;
    loading: boolean;
    error?: string | null;
}

const StepAIProjectScope: React.FC<StepAIProjectScopeProps> = ({ onComplete, loading, error }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = React.useState({
        projectName: '',
        industry: '',
        primaryGoal: '',
        targetPlatforms: ['instagram', 'linkedin'],
        description: ''
    });

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onComplete(formData);
    };

    return (
        <div className="onboarding-step step-ai-scope">
            <h2 className="step-title">{t('onboarding.scope.title', 'AI Project Setup')}</h2>
            <p className="step-description">
                {t('onboarding.scope.description', 'Define the intelligence parameters for your new content ecosystem. This will calibrate the Helian™ Engine.')}
            </p>

            <form onSubmit={handleSubmit}>
                <Stack gap={7}>
                    <FormGroup legendText={t('onboarding.scope.basic_info', 'Identity & Industry')}>
                        <div style={{ position: 'relative' }}>
                            <TextInput
                                id="project-name"
                                labelText={t('onboarding.scope.project_name', 'Project/Brand Name')}
                                placeholder="e.g. Acme Studio"
                                value={formData.projectName}
                                onChange={(e) => handleChange('projectName', e.target.value)}
                                required
                            />
                            <div style={{ position: 'absolute', top: 0, right: 0 }}>
                                <AILabel align="bottom-right">
                                    <AILabelContent>
                                        <p className="cds--type-body-short-01">
                                            This name will be used as the primary identifier for your <strong>BrandDNA™</strong> vector.
                                        </p>
                                    </AILabelContent>
                                </AILabel>
                            </div>
                        </div>

                        <Select
                            id="industry-select"
                            labelText={t('onboarding.scope.industry', 'Industry Type')}
                            value={formData.industry}
                            onChange={(e) => handleChange('industry', e.target.value)}
                            style={{ marginTop: '1rem' }}
                            required
                        >
                            <SelectItem value="" text={t('common.select_option', 'Choose an option')} />
                            <SelectItem value="technology" text="Technology" />
                            <SelectItem value="healthcare" text="Healthcare" />
                            <SelectItem value="real_estate" text="Real Estate" />
                            <SelectItem value="e_commerce" text="E-Commerce" />
                            <SelectItem value="education" text="Education" />
                        </Select>
                    </FormGroup>

                    <FormGroup legendText={t('onboarding.scope.dna_briefing', 'Strategic Briefing')}>
                        <div style={{ position: 'relative' }}>
                            <TextArea
                                id="project-description"
                                labelText={t('onboarding.scope.description_label', 'Brand Mission & Vision')}
                                placeholder={t('onboarding.scope.description_placeholder', 'Describe your brand purpose, core values, and what makes you unique...')}
                                value={formData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                rows={4}
                                required
                            />
                            <div style={{ position: 'absolute', top: 0, right: 0 }}>
                                <AILabel align="bottom-right">
                                    <AILabelContent>
                                        <Stack gap={3}>
                                            <p className="cds--type-productive-heading-01">Semantic Analysis</p>
                                            <p className="cds--type-body-short-01">
                                                Our AI uses <strong>Natural Language Processing</strong> to extract core values and brand voice from this description.
                                            </p>
                                            <p className="cds--type-helper-text-01">
                                                The more detail you provide, the better the calibration.
                                            </p>
                                        </Stack>
                                    </AILabelContent>
                                </AILabel>
                            </div>
                        </div>
                    </FormGroup>

                    {error && (
                        <InlineNotification
                            kind="error"
                            title={t('common.error', 'Error')}
                            subtitle={error}
                        />
                    )}

                    <div className="step-actions">
                        <Button
                            type="submit"
                            disabled={loading || !formData.projectName || !formData.industry}
                            kind="primary"
                        >
                            {loading ? (
                                <InlineLoading description={t('onboarding.scope.calibrating', 'Calibrating Engine...')} />
                            ) : (
                                t('onboarding.scope.generate_dna', 'Generate BrandDNA™ Proposal')
                            )}
                        </Button>
                    </div>
                </Stack>
            </form>
        </div>
    );
};

export default StepAIProjectScope;
