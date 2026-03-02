import {
    ClickableTile,
    Grid,
    Column,
    ProgressBar,
    Tag,
} from '@carbon/react';
import { ArrowRight, CloudSatellite, DataEnrichment } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../components/LocaleSelectorModal';

export default function Console() {
    const navigate = useNavigate();
    const { me: { tenant, wallet, isPayPerUse } } = useAuth();

    // Calculate percentage for progress bar (assuming 5000 is a "full" wallet for display purposes)
    const maxCreditsDisplay = 5000;
    const currentCredits = wallet?.credits || 0;
    const progressValue = Math.min((currentCredits / maxCreditsDisplay) * 100, 100);

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '3rem' }}>
                <h1 style={{ marginBottom: '0.5rem' }}>{t('consoleTitle')}</h1>
                <p style={{ color: 'var(--cds-text-secondary)' }}>
                    {t('consoleSubtitle')}
                </p>
            </div>

            <Grid className="console-grid" style={{ marginBottom: '3rem' }}>
                <Column sm={4} md={8} lg={6}>
                    <div style={{
                        backgroundColor: 'var(--cds-layer-01)',
                        padding: '2rem',
                        borderRadius: '4px',
                        border: isPayPerUse ? '1px solid var(--cds-support-warning)' : '1px solid var(--cds-border-subtle)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CloudSatellite size={24} />
                                {t('consoleCreditWallet')}
                            </h3>
                            {isPayPerUse ? (
                                <Tag type="red">{t('consoleCreditWalletPayPerUse')}</Tag>
                            ) : (
                                <Tag type="green">{t('consoleCreditWalletPrepaid')}</Tag>
                            )}
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <span style={{ fontSize: '2rem', fontWeight: 300 }}>
                                {currentCredits.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--cds-text-secondary)' }}>{t('consoleAvailableCredits')}</span>
                            </span>
                        </div>

                        <ProgressBar
                            label={t('consoleMonthlyEstimate')}
                            helperText={isPayPerUse ? `${t('consoleCurrentOverage')}: $${wallet?.overage || 0} USD` : t('consoleNormalizedUsage')}
                            value={progressValue}
                            status={isPayPerUse ? "error" : "active"}
                        />
                    </div>
                </Column>
            </Grid>

            <h3 style={{ marginBottom: '1.5rem' }}>{t('consoleApplications')}</h3>

            <Grid>
                <Column sm={4} md={4} lg={4}>
                    <ClickableTile
                        onClick={() => navigate('/content-factory')}
                        renderIcon={ArrowRight}
                        style={{ minHeight: '160px', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}
                    >
                        <DataEnrichment size={32} style={{ marginBottom: '1rem', color: 'var(--cds-interactive)' }} />
                        <h4 style={{ marginBottom: '0.5rem' }}>{t('contentFactory')}</h4>
                        <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
                            {t('consoleFactoryDesc')}
                        </p>
                    </ClickableTile>
                </Column>
            </Grid>
        </div>
    );
}
