import React, { useEffect } from 'react';
import {
    InlineLoading,
    ProgressBar,
    Stack,
    ActionableNotification,
    Button,
    Tile
} from '@carbon/react';
import { Rocket, CheckmarkFilled } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';

interface StepProvisioningProps {
    onComplete: () => Promise<void>;
    tenantTier: string;
    loading: boolean;
    error: string | null;
}

const StepProvisioning: React.FC<StepProvisioningProps> = ({ onComplete, loading, error }) => {
    const { t } = useTranslation();
    const [progress, setProgress] = React.useState(0);
    const [status, setStatus] = React.useState('Initializing...');

    useEffect(() => {
        if (!loading && !error) {
            const timer = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(timer);
                        return 100;
                    }
                    if (prev < 30) setStatus('Provisioning Projects...');
                    else if (prev < 60) setStatus('Syncing Branding Context...');
                    else if (prev < 90) setStatus('Calibrating AI Router...');
                    else setStatus('Ready for Launch');
                    return prev + 5;
                });
            }, 100);
            return () => clearInterval(timer);
        }
    }, [loading, error]);

    return (
        <div className="onboarding-step step-provisioning">
            <Stack gap={7}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                        <Rocket size={48} style={{ color: 'var(--cds-link-primary)' }} />
                    </div>
                    <h2 className="step-title">{t('onboarding.provisioning.title', 'Provisioning Ecosystem')}</h2>
                    <p className="step-description" style={{ margin: '0 auto 2rem auto' }}>
                        {t('onboarding.provisioning.description', 'We are preparing your dedicated industrial workspace. This involves multi-tenant isolation, specific content packs, and Helian™ router calibration.')}
                    </p>
                </div>

                <Tile style={{ backgroundColor: 'var(--cds-background)', border: '1px solid var(--cds-border-subtle-01)' }}>
                    <Stack gap={5}>
                        <ProgressBar
                            label={status}
                            helperText={`${progress}% Complete`}
                            value={progress}
                            status={error ? 'error' : (progress === 100 ? 'finished' : 'active')}
                        />

                        {progress === 100 && !error && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--cds-support-success)' }}>
                                <CheckmarkFilled size={20} />
                                <span className="cds--type-body-short-01">Infrastructure and isolation verified.</span>
                            </div>
                        )}
                    </Stack>
                </Tile>

                {error && (
                    <ActionableNotification
                        kind="error"
                        title="Provisioning Failed"
                        subtitle={error}
                        inline
                        actionButtonLabel="Retry"
                        onActionButtonClick={() => window.location.reload()}
                    />
                )}

                <div className="step-actions" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
                    <Button
                        kind="primary"
                        onClick={onComplete}
                        disabled={progress < 100 || loading}
                        style={{ minWidth: '200px' }}
                    >
                        {loading ? <InlineLoading description="Finalizing..." /> : 'Enter Platform'}
                    </Button>
                </div>
            </Stack>
        </div>
    );
};

export default StepProvisioning;
