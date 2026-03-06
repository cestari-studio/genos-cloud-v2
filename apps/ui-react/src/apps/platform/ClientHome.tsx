import React, { useEffect, useState } from 'react';
import {
    Stack,
    Grid,
    Column,
    Tile,
    Tag,
    SkeletonText,
    Section,
} from '@carbon/react';
import {
    Events,
    ChartRelationship,
    UserFollow,
    Launch
} from '@carbon/icons-react';
import PageLayout from '@/components/PageLayout';
import { api } from '@/services/api';
import { useAuth } from '@/shared/contexts/AuthContext';

export default function ClientHome() {
    const { me } = useAuth();
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<any>(null);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const data = await api.getROIMetrics();
                setMetrics(data);
            } catch (err) {
                console.error('Failed to load ROI metrics:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchMetrics();
    }, []);

    return (
        <PageLayout
            pageName="Client Cockpit™"
            pageDescription={`Visão geral de performance para ${me.tenant?.name || 'sua marca'}.`}
            aiExplanation="Estes dashboards agregam dados de engajamento e qualidade via Materialized Views para garantir latência sub-100ms em grandes volumes de dados."
        >
            <Section>
                <Stack gap={7}>
                    {/* ROI Summary Cards */}
                    <Grid condensed>
                        <Column lg={4} md={4} sm={4}>
                            <Tile className="stat-tile">
                                <Stack gap={2}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--cds-spacing-05)' }}>
                                        <p className="cds--type-label-01">Reach Estimado</p>
                                        <Events size={20} />
                                    </div>
                                    {loading ? <SkeletonText width="60%" /> : <h2 className="cds--type-productive-heading-05">{metrics?.reach_estimate?.toLocaleString() || '0'}</h2>}
                                    <Tag type="blue" size="sm">Reach Orgânico</Tag>
                                </Stack>
                            </Tile>
                        </Column>
                        <Column lg={4} md={4} sm={4}>
                            <Tile className="stat-tile">
                                <Stack gap={2}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--cds-spacing-05)' }}>
                                        <p className="cds--type-label-01">Engajamento Médio</p>
                                        <ChartRelationship size={20} />
                                    </div>
                                    {loading ? <SkeletonText width="60%" /> : <h2 className="cds--type-productive-heading-05">{metrics?.avg_engagement ? `${metrics.avg_engagement}%` : '0%'}</h2>}
                                    <Tag type="green" size="sm">+12% MoM</Tag>
                                </Stack>
                            </Tile>
                        </Column>
                        <Column lg={4} md={4} sm={4}>
                            <Tile className="stat-tile">
                                <Stack gap={2}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--cds-spacing-05)' }}>
                                        <p className="cds--type-label-01">Quality Score</p>
                                        <UserFollow size={20} />
                                    </div>
                                    {loading ? <SkeletonText width="60%" /> : <h2 className="cds--type-productive-heading-05">{metrics?.avg_quality ? `${metrics.avg_quality}/10` : '0/10'}</h2>}
                                    <Tag type="magenta" size="sm">BrandDNA Match</Tag>
                                </Stack>
                            </Tile>
                        </Column>
                    </Grid>

                    {/* Performance Trends Placeholder */}
                    <Tile style={{ padding: 'var(--cds-spacing-07)', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cds-layer-01)', border: '1px solid var(--cds-border-subtle-01)' }}>
                        <Stack gap={4} style={{ alignItems: 'center' }}>
                            <div style={{ width: '48px', height: '48px', opacity: 0.5 }}>
                                <Launch size={48} />
                            </div>
                            <h4 className="cds--type-productive-heading-03">Evolução da Marca</h4>
                            <p className="cds--type-body-short-01" style={{ color: 'var(--cds-text-secondary)', textAlign: 'center', maxWidth: '300px' }}>
                                Gráficos de tendência de engajamento do @carbon/charts estarão disponíveis <br /> assim que o primeiro pack for publicado.
                            </p>
                        </Stack>
                    </Tile>
                </Stack>
            </Section>
        </PageLayout>
    );
}
