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
                <h1 style={{ marginBottom: '0.5rem' }}>Hub de Aplicações</h1>
                <p style={{ color: 'var(--cds-text-secondary)' }}>
                    Bem-vindo ao Cestari Studio Console. Suas aplicações e saldo em tempo real.
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
                                Carteira de Créditos
                            </h3>
                            {isPayPerUse ? (
                                <Tag type="red">Modo Pay-per-use</Tag>
                            ) : (
                                <Tag type="green">Pré-pago Ativo</Tag>
                            )}
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <span style={{ fontSize: '2rem', fontWeight: 300 }}>
                                {currentCredits.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--cds-text-secondary)' }}>créditos disponíveis</span>
                            </span>
                        </div>

                        <ProgressBar
                            label="Uso Mensal Estimado"
                            helperText={isPayPerUse ? `Overage Atual: $${wallet?.overage || 0} USD` : "Consumo normalizado."}
                            value={progressValue}
                            status={isPayPerUse ? "error" : "active"}
                        />
                    </div>
                </Column>
            </Grid>

            <h3 style={{ marginBottom: '1.5rem' }}>Aplicações Contratadas</h3>

            <Grid>
                <Column sm={4} md={4} lg={4}>
                    <ClickableTile
                        onClick={() => navigate('/content-factory')}
                        renderIcon={ArrowRight}
                        style={{ minHeight: '160px', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}
                    >
                        <DataEnrichment size={32} style={{ marginBottom: '1rem', color: 'var(--cds-interactive)' }} />
                        <h4 style={{ marginBottom: '0.5rem' }}>Content Factory</h4>
                        <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
                            Produção em massa de estratégia e conteúdo com a inteligência do genOS.
                        </p>
                    </ClickableTile>
                </Column>

                {/* Futuras aplicações iriam aqui */}
            </Grid>
        </div>
    );
}
