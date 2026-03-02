import {
    Tile,
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
import PageLayout from '../components/PageLayout';

export default function Console() {
    const navigate = useNavigate();
    const { me: { usage, isPayPerUse } } = useAuth();
    const currentCredits = usage?.tokens_limit ? (usage.tokens_limit - usage.tokens_used) : 0;
    const progressValue = usage?.tokens_limit ? (usage.tokens_used / usage.tokens_limit) * 100 : 0;

    return (
        <PageLayout pageName="genOS" pageDescription={t('consoleSubtitle')} helpMode>
            <Grid className="console-grid" style={{ marginBottom: '3rem' }}>
                <Column sm={4} md={8} lg={6}>
                    <Tile style={{
                        padding: '2rem',
                        border: isPayPerUse ? '1px solid var(--cds-support-warning)' : '1px solid var(--cds-border-subtle)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 className="cds--type-productive-heading-03" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                            <span style={{ fontSize: '2.5rem', fontWeight: 300 }}>
                                {currentCredits.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--cds-text-secondary)' }}>{t('consoleAvailableCredits')}</span>
                            </span>
                        </div>

                        <ProgressBar
                            label={t('consoleMonthlyEstimate')}
                            helperText={isPayPerUse ? t('consoleCurrentOverage') : t('consoleNormalizedUsage')}
                            value={progressValue}
                            status={isPayPerUse ? "error" : "active"}
                        />
                    </Tile>
                </Column>
            </Grid>

            <h3 className="cds--type-productive-heading-03" style={{ marginBottom: '1.5rem' }}>{t('consoleApplications')}</h3>

            <Grid>
                <Column sm={4} md={4} lg={4}>
                    <ClickableTile
                        onClick={() => navigate('/content-factory')}
                        renderIcon={ArrowRight}
                        style={{ minHeight: '160px', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}
                    >
                        <DataEnrichment size={32} style={{ marginBottom: '1rem', color: 'var(--cds-interactive)' }} />
                        <h4 className="cds--type-productive-heading-01" style={{ marginBottom: '0.5rem' }}>{t('contentFactory')}</h4>
                        <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
                            {t('consoleFactoryDesc')}
                        </p>
                    </ClickableTile>
                </Column>
            </Grid>
        </PageLayout>
    );
}
