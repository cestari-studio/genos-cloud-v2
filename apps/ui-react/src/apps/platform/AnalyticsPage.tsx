// genOS Lumina — Analytics Dashboard
// 100% @carbon/react + @carbon/charts-react

import React, { useEffect, useState, useCallback } from 'react';
import {
    AILabel, AILabelContent,
    Grid, Column, Section, Stack, Tile, Tag, Button,
    Tabs, TabList, Tab, TabPanels, TabPanel,
    DataTableSkeleton, Layer, ProgressBar, InlineLoading,
} from '@carbon/react';
import {
    DonutChart, LineChart, SimpleBarChart, GaugeChart, StackedBarChart,
} from '@carbon/charts-react';
import { ScaleTypes } from '@carbon/charts';
import '@carbon/charts/styles.css';
import { AiObservability, DataAnalytics, ChartLine, DataView, Renew } from '@carbon/icons-react';
import PageLayout from '@/components/PageLayout';
import { api } from '@/services/api';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useNotifications } from '@/components/NotificationProvider';

const CHART_OPTS_BASE = {
    resizable: true,
    legend: { alignment: 'center' },
    theme: 'g100',
};

export default function AnalyticsPage() {
    const { me } = useAuth();
    const { showToast } = useNotifications();
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<any>(null);
    const [usageByFormat, setUsageByFormat] = useState<any>(null);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [qualityTrends, setQualityTrends] = useState<any[]>([]);
    const [publishPerf, setPublishPerf] = useState<any[]>([]);
    const [days] = useState(30);

    const tenantId = me.tenant?.id || api.getActiveTenantId();

    const fetchAll = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const [ov, uf, tl, qt, pp] = await Promise.all([
                api.edgeFn('analytics-aggregator', { action: 'overview', tenant_id: tenantId, days }),
                api.edgeFn('analytics-aggregator', { action: 'usage_by_format', tenant_id: tenantId, days }),
                api.edgeFn('analytics-aggregator', { action: 'usage_timeline', tenant_id: tenantId, days }),
                api.edgeFn('analytics-aggregator', { action: 'quality_trends', tenant_id: tenantId, days }),
                api.edgeFn('analytics-aggregator', { action: 'publish_performance', tenant_id: tenantId, days }),
            ]) as any[];
            setOverview(ov);
            setUsageByFormat(uf);
            setTimeline((tl as any).timeline || []);
            setQualityTrends((qt as any).trends || []);
            setPublishPerf((pp as any).performance || []);
        } catch (err: any) {
            showToast('Erro ao carregar analytics', err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [tenantId, days, showToast]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const kpiCards = overview ? [
        { label: 'Tokens Consumidos', value: overview.total_tokens?.toLocaleString('pt-BR') ?? '—', tag: null },
        { label: 'Posts Gerados', value: overview.total_posts ?? '—', tag: { type: 'blue', text: `${days}d` } },
        { label: 'Taxa de Aprovação', value: `${overview.approval_rate ?? 0}%`, tag: { type: overview.approval_rate >= 80 ? 'green' : 'warm-gray', text: overview.approval_rate >= 80 ? 'Saudável' : 'Atenção' } },
        { label: 'Score Médio de Qualidade', value: overview.avg_quality_score ?? '—', tag: null },
        { label: 'Publicações Realizadas', value: overview.published_count ?? '—', tag: null },
        { label: 'Avaliações de Qualidade', value: overview.total_evaluations ?? '—', tag: null },
    ] : [];

    // Timeline chart: group by date
    const timelineChartData = timeline.map(t => ({
        group: t.group,
        date: t.date,
        value: t.value,
    }));

    // Quality score line data
    const qualityLineData = qualityTrends.map(t => ({
        group: 'Score Médio',
        date: t.date,
        value: t.avg_score,
    })).concat(qualityTrends.map(t => ({
        group: 'Taxa de Aprovação',
        date: t.date,
        value: t.pass_rate,
    })));

    // Publish bar data
    const publishBarData = publishPerf.flatMap(p => [
        { group: 'Publicado', key: p.platform, value: p.published },
        { group: 'Falhou', key: p.platform, value: p.failed },
    ]);

    // Gauge data for approval rate
    const approvalGaugeData = overview ? [
        { group: 'Taxa de Aprovação', value: overview.approval_rate ?? 0 },
    ] : [];

    return (
        <PageLayout
            pageName="Analytics"
            pageDescription={`Desempenho de conteúdo nos últimos ${days} dias`}
            aiExplanation="Dados agregados de consumo, qualidade e publicação calculados pelo motor de análise genOS. Todos os percentuais são baseados no ciclo de faturamento atual."
            actions={
                <Button kind="ghost" size="sm" renderIcon={Renew} onClick={fetchAll} disabled={loading}>
                    Atualizar
                </Button>
            }
        >
            <Section>
                <Tabs>
                    <TabList aria-label="Analytics Views" activation="manual">
                        <Tab renderIcon={DataAnalytics}>Visão Geral</Tab>
                        <Tab renderIcon={ChartLine}>Consumo</Tab>
                        <Tab renderIcon={AiObservability}>Qualidade</Tab>
                        <Tab renderIcon={DataView}>Publicação</Tab>
                    </TabList>
                    <TabPanels>

                        {/* ─── Tab 1: Visão Geral ───────────────────────────── */}
                        <TabPanel>
                            <Stack gap={6}>
                                {/* KPI Cards */}
                                {loading ? (
                                    <DataTableSkeleton headers={[]} rowCount={1} columnCount={3} />
                                ) : (
                                    <Grid>
                                        {kpiCards.map((kpi, i) => (
                                            <Column key={i} lg={4} md={4} sm={4}>
                                                <Tile>
                                                    <Stack gap={2}>
                                                        <p className="cds--type-label-01">{kpi.label}</p>
                                                        <Stack orientation="horizontal" gap={2}>
                                                            <h2 className="cds--type-productive-heading-05">{kpi.value}</h2>
                                                            {kpi.tag && (
                                                                <Tag type={kpi.tag.type as any} size="sm">{kpi.tag.text}</Tag>
                                                            )}
                                                        </Stack>
                                                    </Stack>
                                                </Tile>
                                            </Column>
                                        ))}
                                    </Grid>
                                )}

                                {/* Overview Charts */}
                                <Grid>
                                    <Column lg={8} md={8} sm={4}>
                                        <Layer>
                                            <Tile>
                                                <Stack gap={3}>
                                                    <Stack orientation="horizontal" gap={2}>
                                                        <h4 className="cds--type-productive-heading-02">Consumo por Formato</h4>
                                                        <AILabel autoAlign size="xs">
                                                            <AILabelContent>
                                                                <Stack gap={2} className="ai-label-popover-inner">
                                                                    <p className="cds--type-label-01">IA EXPLAINED</p>
                                                                    <p className="cds--type-body-short-01">Tokens consumidos por tipo de formato no período selecionado. Calculado com base nos registros de usage_logs.</p>
                                                                </Stack>
                                                            </AILabelContent>
                                                        </AILabel>
                                                    </Stack>
                                                    {loading ? <InlineLoading /> : (
                                                        <div className="analytics-chart-md">
                                                            <DonutChart
                                                                data={(usageByFormat?.by_format || []).filter((d: any) => d.value > 0)}
                                                                options={{ ...CHART_OPTS_BASE, donut: { center: { label: 'Tokens' } } }}
                                                            />
                                                        </div>
                                                    )}
                                                </Stack>
                                            </Tile>
                                        </Layer>
                                    </Column>

                                    <Column lg={8} md={8} sm={4}>
                                        <Layer>
                                            <Tile>
                                                <Stack gap={3}>
                                                    <Stack orientation="horizontal" gap={2}>
                                                        <h4 className="cds--type-productive-heading-02">Taxa de Aprovação</h4>
                                                        <AILabel autoAlign size="xs">
                                                            <AILabelContent>
                                                                <Stack gap={2} className="ai-label-popover-inner">
                                                                    <p className="cds--type-label-01">IA EXPLAINED</p>
                                                                    <p className="cds--type-body-short-01">Percentual de posts que passaram no Quality Gate determinístico e/ou tiveram excessão aprovada.</p>
                                                                </Stack>
                                                            </AILabelContent>
                                                        </AILabel>
                                                    </Stack>
                                                    {loading ? <InlineLoading /> : (
                                                        <div className="analytics-chart-md">
                                                            <GaugeChart
                                                                data={approvalGaugeData}
                                                                options={{
                                                                    ...CHART_OPTS_BASE,
                                                                    gauge: {
                                                                        type: 'semi',
                                                                        status: (overview?.approval_rate ?? 0) >= 80 ? 'success' : 'warning',
                                                                    },
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </Stack>
                                            </Tile>
                                        </Layer>
                                    </Column>
                                </Grid>
                            </Stack>
                        </TabPanel>

                        {/* ─── Tab 2: Consumo ──────────────────────────────── */}
                        <TabPanel>
                            <Stack gap={6}>
                                <Layer>
                                    <Tile>
                                        <Stack gap={3}>
                                            <Stack orientation="horizontal" gap={2}>
                                                <h4 className="cds--type-productive-heading-02">Consumo ao Longo do Tempo</h4>
                                                <AILabel autoAlign size="xs">
                                                    <AILabelContent>
                                                        <Stack gap={2} className="ai-label-popover-inner">
                                                            <p className="cds--type-label-01">IA EXPLAINED</p>
                                                            <p className="cds--type-body-short-01">Tokens consumidos por dia, agrupados por formato de conteúdo. Picos indicam dias de alta produção.</p>
                                                        </Stack>
                                                    </AILabelContent>
                                                </AILabel>
                                            </Stack>
                                            {loading ? <InlineLoading /> : (
                                                <div className="analytics-chart-lg">
                                                    {timelineChartData.length > 0 ? (
                                                        <StackedBarChart
                                                            data={timelineChartData}
                                                            options={{
                                                                ...CHART_OPTS_BASE,
                                                                axes: {
                                                                    left: { title: 'Tokens', mapsTo: 'value', stacked: true },
                                                                    bottom: { title: 'Data', mapsTo: 'date', scaleType: ScaleTypes.TIME },
                                                                },
                                                                curve: 'curveMonotoneX',
                                                            }}
                                                        />
                                                    ) : (
                                                        <p className="cds--type-helper-text-01">Nenhum dado de consumo no período.</p>
                                                    )}
                                                </div>
                                            )}
                                        </Stack>
                                    </Tile>
                                </Layer>

                                <Layer>
                                    <Tile>
                                        <Stack gap={3}>
                                            <Stack orientation="horizontal" gap={2}>
                                                <h4 className="cds--type-productive-heading-02">Consumo por Operação</h4>
                                                <AILabel autoAlign size="xs">
                                                    <AILabelContent>
                                                        <Stack gap={2} className="ai-label-popover-inner">
                                                            <p className="cds--type-label-01">IA EXPLAINED</p>
                                                            <p className="cds--type-body-short-01">Distribuição de tokens por tipo de operação (geração, revisão, quality gate, hashtags).</p>
                                                        </Stack>
                                                    </AILabelContent>
                                                </AILabel>
                                            </Stack>
                                            {loading ? <InlineLoading /> : (
                                                <div className="analytics-chart-md">
                                                    <SimpleBarChart
                                                        data={(usageByFormat?.by_operation || []).filter((d: any) => d.value > 0)}
                                                        options={{
                                                            ...CHART_OPTS_BASE,
                                                            axes: {
                                                                left: { title: 'Tokens', mapsTo: 'value' },
                                                                bottom: { title: 'Operação', mapsTo: 'group', scaleType: ScaleTypes.LABELS },
                                                            },
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </Stack>
                                    </Tile>
                                </Layer>
                            </Stack>
                        </TabPanel>

                        {/* ─── Tab 3: Qualidade ────────────────────────────── */}
                        <TabPanel>
                            <Stack gap={6}>
                                <Layer>
                                    <Tile>
                                        <Stack gap={3}>
                                            <Stack orientation="horizontal" gap={2}>
                                                <h4 className="cds--type-productive-heading-02">Tendência de Qualidade</h4>
                                                <AILabel autoAlign size="xs">
                                                    <AILabelContent>
                                                        <Stack gap={2} className="ai-label-popover-inner">
                                                            <p className="cds--type-label-01">IA EXPLAINED</p>
                                                            <p className="cds--type-body-short-01">Score médio de qualidade e taxa de aprovação dia a dia. Uma tendência ascendente indica maturidade no processo criativo.</p>
                                                        </Stack>
                                                    </AILabelContent>
                                                </AILabel>
                                            </Stack>
                                            {loading ? <InlineLoading /> : (
                                                <div className="analytics-chart-lg">
                                                    {qualityLineData.length > 0 ? (
                                                        <LineChart
                                                            data={qualityLineData}
                                                            options={{
                                                                ...CHART_OPTS_BASE,
                                                                axes: {
                                                                    left: { title: '%', mapsTo: 'value', domain: [0, 100] },
                                                                    bottom: { title: 'Data', mapsTo: 'date', scaleType: ScaleTypes.TIME },
                                                                },
                                                                curve: 'curveMonotoneX',
                                                            }}
                                                        />
                                                    ) : (
                                                        <p className="cds--type-helper-text-01">Nenhuma avaliação de qualidade no período.</p>
                                                    )}
                                                </div>
                                            )}
                                        </Stack>
                                    </Tile>
                                </Layer>

                                {/* Quality summary bar */}
                                {!loading && overview && (
                                    <Grid>
                                        <Column lg={8} md={8} sm={4}>
                                            <Tile>
                                                <Stack gap={3}>
                                                    <h4 className="cds--type-productive-heading-02">Resumo de Governança</h4>
                                                    <ProgressBar label="Score Médio" value={overview.avg_quality_score || 0} max={100} status={overview.avg_quality_score >= 70 ? 'finished' : 'active'} helperText={`${overview.avg_quality_score || 0}/100`} />
                                                    <ProgressBar label="Taxa de Aprovação" value={overview.approval_rate || 0} max={100} status={overview.approval_rate >= 80 ? 'finished' : 'active'} helperText={`${overview.approval_rate || 0}%`} />
                                                </Stack>
                                            </Tile>
                                        </Column>
                                    </Grid>
                                )}
                            </Stack>
                        </TabPanel>

                        {/* ─── Tab 4: Publicação ───────────────────────────── */}
                        <TabPanel>
                            <Stack gap={6}>
                                <Layer>
                                    <Tile>
                                        <Stack gap={3}>
                                            <Stack orientation="horizontal" gap={2}>
                                                <h4 className="cds--type-productive-heading-02">Performance por Plataforma</h4>
                                                <AILabel autoAlign size="xs">
                                                    <AILabelContent>
                                                        <Stack gap={2} className="ai-label-popover-inner">
                                                            <p className="cds--type-label-01">IA EXPLAINED</p>
                                                            <p className="cds--type-body-short-01">Posts publicados vs. falhas por plataforma. Falhas persistentes indicam problemas de credenciais ou limites da API da plataforma.</p>
                                                        </Stack>
                                                    </AILabelContent>
                                                </AILabel>
                                            </Stack>
                                            {loading ? <InlineLoading /> : (
                                                <div className="analytics-chart-lg">
                                                    {publishBarData.length > 0 ? (
                                                        <StackedBarChart
                                                            data={publishBarData}
                                                            options={{
                                                                ...CHART_OPTS_BASE,
                                                                axes: {
                                                                    left: { title: 'Posts', mapsTo: 'value', stacked: true },
                                                                    bottom: { title: 'Plataforma', mapsTo: 'key', scaleType: ScaleTypes.LABELS },
                                                                },
                                                            }}
                                                        />
                                                    ) : (
                                                        <p className="cds--type-helper-text-01">Nenhum dado de publicação no período.</p>
                                                    )}
                                                </div>
                                            )}
                                        </Stack>
                                    </Tile>
                                </Layer>

                                {/* Per-platform detail */}
                                {!loading && publishPerf.length > 0 && (
                                    <Grid>
                                        {publishPerf.map((p: any) => (
                                            <Column key={p.platform} lg={4} md={4} sm={4}>
                                                <Layer>
                                                    <Tile>
                                                        <Stack gap={3}>
                                                            <Stack orientation="horizontal" gap={2}>
                                                                <p className="cds--type-productive-heading-01">{p.platform}</p>
                                                                <Tag type={p.success_rate >= 80 ? 'green' : p.success_rate >= 50 ? 'warm-gray' : 'red'} size="sm">
                                                                    {p.success_rate}%
                                                                </Tag>
                                                            </Stack>
                                                            <ProgressBar label="Taxa de Sucesso" value={p.success_rate} max={100} hideLabel status={p.success_rate >= 80 ? 'finished' : 'active'} />
                                                            <Stack orientation="horizontal" gap={4}>
                                                                <span className="cds--type-helper-text-01">Publicado: {p.published}</span>
                                                                <span className="cds--type-helper-text-01">Falhou: {p.failed}</span>
                                                            </Stack>
                                                        </Stack>
                                                    </Tile>
                                                </Layer>
                                            </Column>
                                        ))}
                                    </Grid>
                                )}
                            </Stack>
                        </TabPanel>

                    </TabPanels>
                </Tabs>
            </Section>
        </PageLayout>
    );
}
