import React, { useEffect, useState } from 'react';
import {
    ProgressBar,
    DataTable,
    Table,
    TableHead,
    TableRow,
    TableHeader,
    TableBody,
    TableCell,
    Link,
    Button,
    Tile,
    Grid,
    Column,
    InlineLoading,
    Tag,
    Stack
} from '@carbon/react';
import { SidePanel } from '@carbon/ibm-products';
import { DonutChart } from '@carbon/charts-react';
import '@carbon/charts/styles.css';
import { api, type AddonPackage } from '../services/api';
import { supabase } from '../services/supabase';

interface UsageDetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    tenantId: string;
}

export const UsageDetailPanel: React.FC<UsageDetailPanelProps> = ({ isOpen, onClose, tenantId }) => {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [packages, setPackages] = useState<AddonPackage[]>([]);
    const [costs, setCosts] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && tenantId) {
            fetchData();
        }
    }, [isOpen, tenantId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);

            // 1. Fetch Stats (Tenant Config & Wallet)
            const { data: config } = await supabase.from('tenant_config').select('*').eq('tenant_id', tenantId).single();
            const { data: wallet } = await supabase.from('credit_wallets').select('*').eq('tenant_id', tenantId).single();
            const { data: scheduleUsage } = await supabase
                .from('schedule_usage_log')
                .select('scheduled_count')
                .eq('tenant_id', tenantId)
                .eq('billing_month', monthStart.toISOString())
                .maybeSingle();

            const { count: postsMonth } = await supabase
                .from('posts')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantId)
                .gte('created_at', monthStart.toISOString());

            setStats({
                tokens_used: 0,
                tokens_limit: 10000,
                tokens_current: wallet?.prepaid_credits || 0,
                posts_used: postsMonth || 0,
                posts_limit: config?.post_limit || 24,
                overage: wallet?.overage_amount || 0,
                overage_allowed: config?.overage_allowed || false,
                schedule_enabled: config?.schedule_enabled || false,
                schedule_used: scheduleUsage?.scheduled_count || 0,
                schedule_limit: config?.schedule_post_limit || 12
            });

            // 2. Fetch Usage Logs (Last 20)
            const { data: usageData } = await supabase
                .from('usage_logs')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(20);
            setLogs(usageData || []);

            // 3. Fetch Available Packages
            const pkgs: any = await api.edgeFn('addon-manager', { action: 'list_packages' });
            setPackages((pkgs || []).filter((p: any) => p.is_active));

            // 4. Fetch Cost Reference
            const { data: costData } = await supabase
                .from('token_cost_config')
                .select('*')
                .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
                .order('tenant_id', { ascending: false });
            setCosts(costData || []);

        } catch (err) {
            console.error('Failed to fetch usage details', err);
        } finally {
            setLoading(false);
        }
    };

    const calculateRemainingDays = () => {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return lastDay.getDate() - now.getDate();
    };

    return (
        <SidePanel
            open={isOpen}
            onRequestClose={onClose}
            size="md"
            title="Detalhes de Uso e Billing"
            subtitle="Acompanhe seu consumo de tokens e cotas de posts"
        >
            {loading ? (
                <div style={{ padding: '2rem' }}>
                    <InlineLoading description="Carregando dados..." />
                </div>
            ) : (
                <div className="usage-panel-content" style={{ padding: '1.5rem' }}>

                    {/* SEÇÃO: Resumo do Mês */}
                    <Stack gap={7} style={{ marginBottom: '2rem' }}>
                        <h4 className="cds--type-productive-heading-03">Resumo do Mês</h4>
                        <Stack gap={5}>
                            <ProgressBar
                                label="Saldo de Tokens"
                                helperText={`${stats?.tokens_current} tokens disponíveis`}
                                value={stats?.tokens_current}
                                max={stats?.tokens_limit || 10000}
                                status={stats?.tokens_current < 1000 ? 'error' : 'active'}
                            />
                            <ProgressBar
                                label="Posts no Ciclo"
                                helperText={`${stats?.posts_used} de ${stats?.posts_limit} posts criados`}
                                value={stats?.posts_used}
                                max={stats?.posts_limit}
                                status={stats?.posts_used >= stats?.posts_limit ? 'error' : 'active'}
                            />
                            {stats?.schedule_enabled && (
                                <ProgressBar
                                    label="Agendamentos Premium"
                                    helperText={`${stats?.schedule_used} de ${stats?.schedule_limit} slots utilizados`}
                                    value={stats?.schedule_used}
                                    max={stats?.schedule_limit}
                                    status={stats?.schedule_used >= stats?.schedule_limit ? 'error' : 'active'}
                                />
                            )}
                        </Stack>

                        {stats?.overage_allowed && (
                            <Tile style={{ backgroundColor: '#393939' }}>
                                <span style={{ fontSize: '0.875rem', color: '#c6c6c6' }}>Overage acumulado: </span>
                                <strong style={{ color: '#fa4d56' }}>R$ {(stats.overage / 100).toFixed(2)}</strong>
                            </Tile>
                        )}
                        <div>
                            <Tag type="cool-gray" size="sm">{calculateRemainingDays()} dias restantes no ciclo</Tag>
                        </div>
                    </Stack>

                    {/* SEÇÃO: Consumo por Formato */}
                    <Stack gap={6} style={{ marginBottom: '2rem' }}>
                        <h4 className="cds--type-productive-heading-03">Consumo por Formato</h4>
                        <div style={{ height: '240px' }}>
                            <DonutChart
                                data={['feed', 'carousel', 'stories', 'reels'].map(f => ({
                                    group: f.charAt(0).toUpperCase() + f.slice(1),
                                    value: logs.filter(l => l.format === f).reduce((acc, curr) => acc + (curr.cost || 0), 0)
                                }))}
                                options={{
                                    title: '',
                                    resizable: true,
                                    donut: {
                                        center: {
                                            label: 'Tokens'
                                        }
                                    },
                                    legend: {
                                        alignment: 'center'
                                    },
                                    theme: 'g100'
                                }}
                            />
                        </div>
                    </Stack>

                    {/* SEÇÃO: Tabela de Custos */}
                    <Stack gap={6} style={{ marginBottom: '2rem' }}>
                        <h4 className="cds--type-productive-heading-03">Tabela de Custos</h4>
                        <DataTable
                            rows={costs.slice(0, 5).map((c, i) => ({ id: String(i), ...c }))}
                            headers={[
                                { key: 'format', header: 'Formato' },
                                { key: 'operation', header: 'Op' },
                                { key: 'base_cost', header: 'Custo' }
                            ]}
                        >
                            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                                <Table {...getTableProps()} size="sm">
                                    <TableHead>
                                        <TableRow>
                                            {headers.map((header) => (
                                                <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                                    {header.header}
                                                </TableHeader>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {rows.map((row) => (
                                            <TableRow {...getRowProps({ row })} key={row.id}>
                                                {row.cells.map((cell) => (
                                                    <TableCell key={cell.id}>{cell.value}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </DataTable>
                    </Stack>

                    {/* SEÇÃO: Histórico Recente */}
                    <Stack gap={6} style={{ marginBottom: '2rem' }}>
                        <h4 className="cds--type-productive-heading-03">Histórico Recente</h4>
                        {logs.length === 0 ? (
                            <p style={{ color: '#c6c6c6', fontSize: '0.875rem' }}>Nenhum log de uso encontrado.</p>
                        ) : (
                            <Stack gap={4}>
                                {logs.map(l => (
                                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #393939', fontSize: '0.875rem' }}>
                                        <Stack gap={2}>
                                            <div style={{ fontWeight: '500' }}>{l.operation}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#c6c6c6' }}>{new Date(l.created_at).toLocaleString()}</div>
                                        </Stack>
                                        <div style={{ color: '#fa4d56' }}>-{l.cost} tok</div>
                                    </div>
                                ))}
                            </Stack>
                        )}
                        <Link href="#" style={{ display: 'inline-block' }}>Ver histórico completo</Link>
                    </Stack>

                    {/* SEÇÃO: Pacotes Adicionais */}
                    <Stack gap={6}>
                        <h4 className="cds--type-productive-heading-03">Reforçar Saldo</h4>
                        <Grid narrow>
                            {packages.slice(0, 4).map(pkg => (
                                <Column sm={2} key={pkg.id}>
                                    <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                                        <Stack gap={2}>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>{pkg.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#42be65' }}>+{pkg.token_amount} tokens</div>
                                            <Button size="sm" kind="ghost" style={{ padding: 0, minHeight: '1.5rem', marginTop: '0.5rem' }}>Solicitar</Button>
                                        </Stack>
                                    </Tile>
                                </Column>
                            ))}
                        </Grid>
                    </Stack>

                </div>
            )}
        </SidePanel>
    );
};
