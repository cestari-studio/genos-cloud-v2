import React from 'react';
import { Button, Checkbox, InlineNotification, Modal } from '@carbon/react';
import { useTranslation } from 'react-i18next';

interface StepContractProps {
    onAccept: () => Promise<void>;
    loading: boolean;
    error?: string | null;
}

const StepContract: React.FC<StepContractProps> = ({ onAccept, loading, error }) => {
    const { t } = useTranslation();
    const [accepted, setAccepted] = React.useState(false);

    return (
        <div className="onboarding-step step-contract">
            <h2 className="step-title">{t('onboarding.contract.title', 'Agreement & Service Level')}</h2>
            <p className="step-description">
                {t('onboarding.contract.description', 'Please review the genOS™ Industrial Service Level Agreement (SLA) and platform terms of use. This document outlines our commitment to data security and AI reliability.')}
            </p>

            <div className="contract-box" style={{
                backgroundColor: '#262626',
                padding: '1.5rem',
                maxHeight: '300px',
                overflowY: 'auto',
                marginBottom: '1.5rem',
                border: '1px solid #393939',
                fontSize: '0.875rem',
                color: '#f4f4f4'
            }}>
                <h3>genOS™ Industrial SLA v5.0.0</h3>
                <p><strong>1. Reliability:</strong> We guarantee 99.9% uptime for core content generation services.</p>
                <p><strong>2. Security:</strong> All data is strictly isolated via Row Level Security (RLS) and encrypted at rest.</p>
                <p><strong>3. AI Ethical Usage:</strong> Content generated is filtered for industrial compliance.</p>
                <p><strong>4. Data Ownership:</strong> The tenant maintains 100% ownership of generated BrandDNA™ vectors.</p>
                <hr style={{ margin: '1rem 0', borderColor: '#393939' }} />
                <p>By checking the box below, you enter into a binding digital agreement with Cestari Studio for the use of genOS™ Cloud features.</p>
            </div>

            <Checkbox
                id="accept-contract"
                labelText={t('onboarding.contract.checkbox', 'I have read and accept the Industrial SLA and Platform Terms.')}
                checked={accepted}
                onChange={(e, { checked }) => setAccepted(checked)}
                className="contract-checkbox"
            />

            {error && (
                <InlineNotification
                    kind="error"
                    title={t('common.error', 'Error')}
                    subtitle={error}
                    style={{ marginTop: '1rem' }}
                />
            )}

            <div className="step-actions" style={{ marginTop: '2rem' }}>
                <Button
                    onClick={onAccept}
                    disabled={!accepted || loading}
                    kind="primary"
                    iconDescription={t('common.continue', 'Continue')}
                >
                    {loading ? t('common.processing', 'Processing...') : t('common.accept_continue', 'Accept & Continue')}
                </Button>
            </div>
        </div>
    );
};

export default StepContract;
