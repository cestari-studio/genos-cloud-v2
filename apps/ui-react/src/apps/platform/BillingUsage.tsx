import React, { useEffect, useState } from 'react';
import {
    Stack,
    Grid,
    Column,
    Tile,
    Tag,
    ProgressBar,
    Section,
} from '@carbon/react';
import {
    Finance,
    Wallet,
    ChartRelationship,
} from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';
import { api } from '../services/api';
import { useNotifications } from '../components/NotificationProvider';

export default function BillingUsage() {
    const { showToast } = useNotifications();
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState<any>(null);

    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const data = await api.getCreditBalance();
                setBalance(data);
            } catch (err: any) {
                showToast('Erro ao carregar saldo', err.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchBalance();
    }, [showToast]);

    const total = balance?.credits_limit || 5000;
    const used = balance?.credits_used || 0;
    const remaining = Math.max(0, total - used);
    const percentage = Math.round((used / total) * 100);

    return (
        <PageLayout
            pageName="Billing & Usage™"
            pageDescription="Monitore seu consumo de créditos genOS™ e histórico de faturamento."
            aiExplanation="O genOS™ utiliza um modelo de faturamento baseado em tokens de processamento neural. Este dashboard fornece visibilidade em tempo real sobre o saldo da sua 'Neural Wallet'."
        >
            <Section>
                <Stack gap={7}>
                    <Grid condensed>
                        <Column lg={8} md={8} sm={4}>
                            <Tile style={{ padding: '2rem' }}>
                                <Stack gap={6}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <h4 className="cds--type-productive-heading-03">Créditos Disponíveis</h4>
                                            <p className="cds--type-label-01" style={{ color: 'var(--cds-text-secondary)' }}>Neural Credit Wallet</p>
                                        </div>
                                        <Wallet size={32} />
                                    </div>

                                    <div style={{ margin: '1rem 0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span className="cds--type-body-short-02 bold">{remaining.toLocaleString()} créditos restantes</span>
                                            <span className="cds--type-body-short-02">{percentage}% consumidos</span>
                                        </div>
                                        <ProgressBar
                                            label="Neural Usage"
                                            value={percentage}
                                            max={100}
                                            status={percentage > 90 ? 'error' : 'active'}
                                            hideLabel
                                        />
                                    </div>

                                    <Grid condensed>
                                        <Column lg={6} md={4}>
                                            <Stack gap={2}>
                                                <p className="cds--type-label-01">Limite Mensal</p>
                                                <p className="cds--type-productive-heading-02">{total.toLocaleString()}</p>
                                            </Stack>
                                        </Column>
                                        <Column lg={6} md={4}>
                                            <Stack gap={2}>
                                                <p className="cds--type-label-01">Consumo Atual</p>
                                                <p className="cds--type-productive-heading-02">{used.toLocaleString()}</p>
                                            </Stack>
                                        </Column>
                                    </Grid>
                                </Stack>
                            </Tile>
                        </Column>

                        <Column lg={4} md={4} sm={4}>
                            <Tile style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--cds-layer-01)', border: '1px solid var(--cds-border-subtle-01)' }}>
                                <Stack gap={5} style={{ alignItems: 'center', textAlign: 'center' }}>
                                    <Finance size={48} />
                                    <div>
                                        <p className="cds--type-heading-01">Upgrade Plan</p>
                                        <p className="cds--type-body-short-01" style={{ margin: '0.5rem 0' }}>Precisa de mais poder de fogo? <br /> Scale seu plano agora.</p>
                                    </div>
                                    <Tag type="cool-gray" size="md" style={{ cursor: 'pointer' }}>
                                        Ver Planos Enterprise
                                    </Tag>
                                </Stack>
                            </Tile>
                        </Column>
                    </Grid>

                    <Tile style={{ border: '1px dashed var(--cds-border-strong-01)', background: 'transparent' }}>
                        <Stack gap={3} orientation="horizontal" style={{ alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                            <ChartRelationship size={24} />
                            <p className="cds--type-body-short-01">
                                Notas fiscais e histórico detalhado via **Stripe Billing Portal** integrado (v5.0.x).
                            </p>
                        </Stack>
                    </Tile>
                </Stack>
            </Section>
        </PageLayout>
    );
}
