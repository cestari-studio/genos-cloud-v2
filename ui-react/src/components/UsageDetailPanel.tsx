import React, { useEffect, useState } from 'react';
import {
    AILabel,
    AILabelContent,
    Button,
    Column,
    DataTable,
    Grid,
    InlineLoading,
    Layer,
    Link,
    Pagination,
    ProgressBar,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableHeader,
    TableRow,
    Tag,
    Tile,
} from '@carbon/react';
import { SidePanel } from '@carbon/ibm-products';
import { DonutChart } from '@carbon/charts-react';
import '@carbon/charts/styles.css';
import { api, type AddonPackage } from '../services/api';
import { supabase } from '../services/supabase';
import { t } from '../config/locale';

interface UsageDetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    tenantId: string;
}

const COST_HEADERS = [
    { key: 'format', header: t('billingCostFormat') },
    { key: 'operation', header: t('billingCostOp') },
    { key: 'base_cost', header: t('billingCostBase') },
    { key: 'per_slide_cost', header: t('billingCostSlide') },
];

const LOG_HEADERS = [
    { key: 'operation', header: t('billingCostOp') },
    { key: 'format', header: t('billingCostFormat') },
    { key: 'cost', header: t('billingTokens') },
    { key: 'created_at', header: t('waSentAt') },
];

export const UsageDetailPanel: React.FC<UsageDetailPanelProps> = ({ isOpen, onClose, tenantId }) => {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [packages, setPackages] = useState<AddonPackage[]>([]);
    const [costs, setCosts] = useState<any[]>([]);
    const [logPage, setLogPage] = useState(1);
    const [logPageSize, setLogPageSize] = useState(10);

    useEffect(() => {
        if (isOpen && tenantId) fetchData();
    }, [isOpen, tenantId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);

            const [
                { data: config },
                { data: wallet },
                { data: scheduleUsage },
                { count: postsMonth },
                { data: usageData },
                pkgs,
                { data: costData },
            ] = await Promise.all([
                supabase.from('tenant_config').select('*').eq('tenant_id', tenantId).single(),
                supabase.from('credit_wallets').select('*').eq('tenant_id', tenantId).single(),
                supabase.from('schedule_usage_log').select('scheduled_count').eq('tenant_id', tenantId).eq('billing_month', monthStart.toISOString()).maybeSingle(),
                supabase.from('posts').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', monthStart.toISOString()),
                supabase.from('usage_logs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100),
                api.edgeFn('addon-manager', { action: 'list_packages' }),
                supabase.from('token_cost_config').select('*').or(`tenant_id.eq.${tenantId},tenant_id.is.null`).order('tenant_id', { ascending: false }),
            ]);

            setStats({
                tokens_current: wallet?.prepaid_credits || 0,
                tokens_limit: config?.token_balance || 10000,
                posts_used: postsMonth || 0,
                posts_limit: config?.post_limit || 24,
                overage: wallet?.overage_amount || 0,
                overage_allowed: config?.overage_allowed || false,
                schedule_enabled: config?.schedule_enabled || false,
                schedule_used: scheduleUsage?.scheduled_count || 0,
                schedule_limit: config?.schedule_post_limit || 12,
            });
            setLogs(usageData || []);
            setPackages(((pkgs as any) || []).filter((p: any) => p.is_active));
            setCosts(costData || []);
        } catch (err) {
            console.error('Failed to fetch usage details', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestPackage = async (pkg: AddonPackage) => {
        try {
            await api.edgeFn('addon-manager', {
                action: 'request_purchase',
                tenant_id: tenantId,
                package_id: pkg.id
            });
            // Show local success feedback
            alert(`Solicitação para "${pkg.name}" enviada com sucesso!`);
        } catch (err: any) {
            console.error('Failed to request package:', err);
            alert(`Erro ao solicitar pacote: ${err.message}`);
        }
    };

    const calculateRemainingDays = () => {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return lastDay.getDate() - now.getDate();
    };

    const tokenPct = stats ? Math.min(100, Math.round((stats.tokens_current / Math.max(1, stats.tokens_limit)) * 100)) : 0;
    const postPct = stats ? Math.min(100, Math.round((stats.posts_used / Math.max(1, stats.posts_limit)) * 100)) : 0;

    // Donut chart data from log breakdown by format
    const donutData = ['feed', 'carrossel', 'stories', 'reels'].map(f => ({
        group: f.charAt(0).toUpperCase() + f.slice(1),
        value: logs.filter(l => l.format === f).reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0),
    })).filter(d => d.value > 0);

    // Paginate logs
    const logStart = (logPage - 1) * logPageSize;
    const pagedLogs = logs.slice(logStart, logStart + logPageSize).map((l, i) => ({
        id: l.id || String(i),
        operation: l.operation || '—',
        format: l.format || '—',
        cost: `${l.cost ?? 0} tok`,
        created_at: new Date(l.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    }));

    // Cost table rows
    const costRows = costs.slice(0, 12).map((c, i) => ({
        id: String(i),
        format: c.format || '—',
        operation: c.operation || '—',
        base_cost: `${c.base_cost}`,
        per_slide_cost: `${c.per_slide_cost}`,
    }));

    return (
        <SidePanel
            open={isOpen}
            onRequestClose={onClose}
            size="md"
            title={t('settingsLoadingConfig').replace('...', '') + ' - ' + t('billingAddonPackages')}
            subtitle={t('settingsSubtitle')}
        >
            {loading ? (
                <Stack gap={5} className="usage-panel-loading">
                    <InlineLoading description="Carregando dados de consumo..." />
                </Stack>
            ) : (
                <Stack gap={7} className="usage-panel-content">

                    {/* ─── Seção 1: Saldo do Ciclo ──────────────────────────── */}
                    <Stack gap={4}>
                        <Stack orientation="horizontal" gap={3}>
                            <h4 className="cds--type-productive-heading-03">{t('consoleCreditWallet')}</h4>
                            <AILabel autoAlign size="xs">
                                <AILabelContent>
                                    <Stack gap={3} className="ai-label-popover-inner">
                                        <p className="cds--type-label-01">IA EXPLAINED</p>
                                        <p className="cds--type-body-short-01">
                                            O <strong>saldo de tokens</strong> é debitado a cada geração de conteúdo.
                                            O valor consumido depende do modelo de IA, formato e número de slides.
                                        </p>
                                        <p className="cds--type-helper-text-01">
                                            Tokens restantes = Saldo pré-pago − Consumo do ciclo atual.
                                        </p>
                                    </Stack>
                                </AILabelContent>
                            </AILabel>
                        </Stack>

                        <Stack gap={5}>
                            <ProgressBar
                                label="Tokens Disponíveis"
                                helperText={`${stats?.tokens_current?.toLocaleString('pt-BR')} tokens restantes de ${stats?.tokens_limit?.toLocaleString('pt-BR')}`}
                                value={tokenPct}
                                max={100}
                                status={tokenPct < 10 ? 'error' : tokenPct < 30 ? 'active' : 'finished'}
                            />
                            <ProgressBar
                                label="Posts no Ciclo"
                                helperText={`${stats?.posts_used} de ${stats?.posts_limit} posts criados este mês`}
                                value={postPct}
                                max={100}
                                status={postPct >= 100 ? 'error' : 'active'}
                            />
                            {stats?.schedule_enabled && (
                                <ProgressBar
                                    label="Agendamentos Premium"
                                    helperText={`${stats?.schedule_used} de ${stats?.schedule_limit} slots utilizados`}
                                    value={stats?.schedule_limit > 0 ? Math.min(100, Math.round((stats.schedule_used / stats.schedule_limit) * 100)) : 0}
                                    max={100}
                                    status={stats?.schedule_used >= stats?.schedule_limit ? 'error' : 'active'}
                                />
                            )}
                        </Stack>

                        <Stack orientation="horizontal" gap={3}>
                            <Tag type="cool-gray" size="sm">{calculateRemainingDays()} {t('waSentAt')}</Tag>
                            {stats?.overage_allowed && stats?.overage > 0 && (
                                <Tag type="red" size="sm">Overage: R$ {(stats.overage / 100).toFixed(2)}</Tag>
                            )}
                        </Stack>
                    </Stack>

                    {/* ─── Seção 2: Consumo por Formato ─────────────────────── */}
                    <Stack gap={4}>
                        <Stack orientation="horizontal" gap={3}>
                            <h4 className="cds--type-productive-heading-03">Consumo por Formato</h4>
                            <AILabel autoAlign size="xs">
                                <AILabelContent>
                                    <Stack gap={3} className="ai-label-popover-inner">
                                        <p className="cds--type-label-01">IA EXPLAINED</p>
                                        <p className="cds--type-body-short-01">
                                            Distribuição de tokens consumidos por formato de conteúdo.
                                            Formatos com mais slides (Carrossel) tendem a consumir mais tokens.
                                        </p>
                                    </Stack>
                                </AILabelContent>
                            </AILabel>
                        </Stack>

                        {donutData.length === 0 ? (
                            <p className="cds--type-helper-text-01">Nenhum consumo registrado neste ciclo.</p>
                        ) : (
                            <div className="usage-chart-container">
                                <DonutChart
                                    data={donutData}
                                    options={{
                                        title: '',
                                        resizable: true,
                                        donut: { center: { label: 'Tokens' } },
                                        legend: { alignment: 'center' },
                                        theme: 'g100',
                                    }}
                                />
                            </div>
                        )}
                    </Stack>

                    {/* ─── Seção 3: Tabela de Custos ────────────────────────── */}
                    <Stack gap={4}>
                        <Stack orientation="horizontal" gap={3}>
                            <h4 className="cds--type-productive-heading-03">Tabela de Custos</h4>
                            <AILabel autoAlign size="xs">
                                <AILabelContent>
                                    <Stack gap={3} className="ai-label-popover-inner">
                                        <p className="cds--type-label-01">IA EXPLAINED</p>
                                        <p className="cds--type-body-short-01">
                                            Custo base por operação + custo adicional por slide em conteúdos multi-slide.
                                            Configurável pelo administrador da conta.
                                        </p>
                                    </Stack>
                                </AILabelContent>
                            </AILabel>
                        </Stack>

                        <Layer>
                            <DataTable rows={costRows} headers={COST_HEADERS} size="sm">
                                {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
                                    <TableContainer>
                                        <Table {...getTableProps()} size="sm">
                                            <TableHead>
                                                <TableRow>
                                                    {headers.map((header: any) => (
                                                        <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                                            {header.header}
                                                        </TableHeader>
                                                    ))}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {rows.map((row: any) => (
                                                    <TableRow {...getRowProps({ row })} key={row.id}>
                                                        {row.cells.map((cell: any) => (
                                                            <TableCell key={cell.id}>{cell.value}</TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </DataTable>
                        </Layer>
                    </Stack>

                    {/* ─── Seção 4: Histórico de Uso ────────────────────────── */}
                    <Stack gap={4}>
                        <Stack orientation="horizontal" gap={3}>
                            <h4 className="cds--type-productive-heading-03">Histórico de Uso</h4>
                            <AILabel autoAlign size="xs">
                                <AILabelContent>
                                    <Stack gap={3} className="ai-label-popover-inner">
                                        <p className="cds--type-label-01">IA EXPLAINED</p>
                                        <p className="cds--type-body-short-01">
                                            Cada linha representa uma operação de IA executada no ciclo atual.
                                            O custo em tokens é registrado automaticamente após cada geração.
                                        </p>
                                    </Stack>
                                </AILabelContent>
                            </AILabel>
                        </Stack>

                        {logs.length === 0 ? (
                            <p className="cds--type-helper-text-01">Nenhum log de uso encontrado.</p>
                        ) : (
                            <Layer>
                                <DataTable rows={pagedLogs} headers={LOG_HEADERS} size="sm">
                                    {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
                                        <TableContainer>
                                            <Table {...getTableProps()} size="sm">
                                                <TableHead>
                                                    <TableRow>
                                                        {headers.map((header: any) => (
                                                            <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                                                {header.header}
                                                            </TableHeader>
                                                        ))}
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {rows.map((row: any) => (
                                                        <TableRow {...getRowProps({ row })} key={row.id}>
                                                            {row.cells.map((cell: any) => (
                                                                <TableCell key={cell.id}>{cell.value}</TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <Pagination
                                                totalItems={logs.length}
                                                pageSize={logPageSize}
                                                page={logPage}
                                                pageSizes={[10, 25, 50]}
                                                onChange={({ page: p, pageSize: ps }: any) => { setLogPage(p); setLogPageSize(ps); }}
                                            />
                                        </TableContainer>
                                    )}
                                </DataTable>
                            </Layer>
                        )}
                    </Stack>

                    {/* ─── Seção 5: Reforçar Saldo ──────────────────────────── */}
                    {packages.length > 0 && (
                        <Stack gap={4}>
                            <h4 className="cds--type-productive-heading-03">Reforçar Saldo</h4>
                            <Grid narrow>
                                {packages.slice(0, 4).map(pkg => (
                                    <Column sm={2} key={pkg.id}>
                                        <Layer>
                                            <Tile>
                                                <Stack gap={2}>
                                                    <p className="cds--type-body-compact-01">{pkg.name}</p>
                                                    <p className="token-balance--positive cds--type-label-01">+{pkg.token_amount.toLocaleString('pt-BR')} tokens</p>
                                                    <Button
                                                        size="sm"
                                                        kind="ghost"
                                                        onClick={() => handleRequestPackage(pkg)}
                                                    >
                                                        {t('waActive')} {/* Reusing 'Active' or simply 'Solicitar' */}
                                                    </Button>
                                                </Stack>
                                            </Tile>
                                        </Layer>
                                    </Column>
                                ))}
                            </Grid>
                        </Stack>
                    )}

                </Stack>
            )}
        </SidePanel>
    );
};
