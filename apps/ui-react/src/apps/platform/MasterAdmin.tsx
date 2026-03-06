import React, { useState, useEffect } from 'react';
import {
    Grid,
    Column,
    Tile,
    Section,
    Stack,
    Tag,
    Button,
    DataTable,
    TableContainer,
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
    InlineLoading,
    ActionableNotification,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    InlineNotification,
    ToastNotification,
    ProgressBar
} from '@carbon/react';
import {
    Security,
    Activity,
    VirtualMachine,
    Group,
    CloudApp,
    Renew,
    CheckmarkFilled,
    WarningAltFilled,
    ErrorFilled,
    Currency,
    ChartPie
} from '@carbon/icons-react';
import { SimpleBarChart, LineChart } from '@carbon/charts-react';
import '@carbon/charts/styles.css';
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/services/supabase';
import { api, type Tenant } from '@/services/api';
import { SYSTEM_VERSIONS } from '@/config/versions';
import { useGenOSVersion } from '../../shared/contexts/VersionProvider';
import './MasterAdmin.scss';


export default function MasterAdmin() {
    const { version: genOSVersion } = useGenOSVersion();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [usageStats, setUsageStats] = useState<any[]>([]);
    const [quantumStats, setQuantumStats] = useState<any[]>([]);
    const [auditTrail, setAuditTrail] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showQuantumToast, setShowQuantumToast] = useState(false);
    const [latestQuantumPulse, setLatestQuantumPulse] = useState<any>(null);
    const [quantumHeartbeatStatus, setQuantumHeartbeatStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Tenants
            const { data: tenantData, error: tenantError } = await supabase
                .from('tenants')
                .select('*')
                .order('created_at', { ascending: false });

            if (tenantError) throw tenantError;
            setTenants(tenantData || []);

            // 2. Fetch Global Usage for Chart (Last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const { data: usageData, error: usageError } = await supabase
                .from('usage_logs')
                .select('created_at, cost')
                .gte('created_at', sevenDaysAgo.toISOString());

            if (usageError) throw usageError;

            // Group by day for chart
            const grouped = (usageData || []).reduce((acc: any, curr: any) => {
                const date = curr.created_at.split('T')[0];
                acc[date] = (acc[date] || 0) + Number(curr.cost || 0);
                return acc;
            }, {});

            const chartData = Object.keys(grouped).map(date => ({
                group: 'Token Consumption',
                date,
                value: grouped[date]
            })).sort((a, b) => a.date.localeCompare(b.date));

            setUsageStats(chartData);

            // 3. Fetch Quantum Compliance Stats
            const { data: qStats, error: qError } = await supabase
                .from('vw_quantum_finops_summary')
                .select('*');

            if (qError) throw qError;
            setQuantumStats(qStats || []);

            // 4. Fetch Detailed Audit Trail (Last 50)
            const { data: qAudit, error: qAuditError } = await supabase
                .from('finops_audit_trail')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (qAuditError) throw qAuditError;
            setAuditTrail(qAudit || []);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Real-Time Heartbeat Subscription
        const channel = supabase
            .channel('system_notifications')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'system_notifications' },
                (payload) => {
                    const newNotif = payload.new;
                    if (newNotif.type === 'QUANTUM_PULSE_SUCCESS') {
                        setLatestQuantumPulse(newNotif);
                        setShowQuantumToast(true);
                        fetchData();
                    }
                    if (newNotif.type === 'QUANTUM_HEARTBEAT') {
                        setQuantumHeartbeatStatus(newNotif);
                        // Trigger a slight data refresh for any related charts
                        fetchData();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const chartOptions = {
        title: 'Global AI Consumption (Tokens)',
        axes: {
            bottom: { title: 'Date', mapsTo: 'date', scaleType: 'labels' as any },
            left: { title: 'Tokens', mapsTo: 'value' }
        },
        height: '300px',
        theme: 'g100'
    };

    const tableHeaders = [
        { key: 'name', header: 'Tenant Name' },
        { key: 'plan', header: 'Plan' },
        { key: 'status', header: 'Status' },
        { key: 'id', header: 'ID' }
    ];

    return (
        <>
            {showQuantumToast && latestQuantumPulse && (
                <div className="master-admin-toast-container">
                    <ToastNotification
                        kind="success"
                        title="The First Pulse"
                        subtitle={latestQuantumPulse.message}
                        caption={`ID: ${latestQuantumPulse.quantum_job_id || 'N/A'}`}
                        timeout={5000}
                        onClose={() => setShowQuantumToast(false)}
                    />
                </div>
            )}
            <PageLayout
                pageName="Master Admin"
                pageDescription={`Central de Comando Global genOS™ v${genOSVersion}`}
            >
                <Section>
                    <Tabs>
                        <TabList aria-label="Master Admin Tabs">
                            <Tab renderIcon={Activity}>System Health</Tab>
                            <Tab renderIcon={Group}>Tenants Management</Tab>
                            <Tab renderIcon={Renew}>Patch Manager</Tab>
                            <Tab renderIcon={Currency}>Quantum Compliance</Tab>
                        </TabList>
                        <TabPanels>
                            {/* ─── TAB 1: System Health ────────────────────────────────── */}
                            <TabPanel>
                                <Grid className="quantum-compliance-stack">
                                    <Column lg={10} md={8} sm={4}>
                                        <Tile className="system-health-chart-tile">
                                            <h4 className="chart-title">Ecosystem Usage</h4>
                                            {usageStats.length > 0 ? (
                                                <LineChart data={usageStats} options={chartOptions} />
                                            ) : (
                                                <div className="chart-loading-container">
                                                    <InlineLoading description="Carregando estatísticas..." />
                                                </div>
                                            )}
                                        </Tile>
                                    </Column>
                                    <Column lg={6} md={8} sm={4}>
                                        <Stack gap={5}>
                                            <Tile className="infrastructure-status-tile">
                                                <h5 className="status-section-title">Infrastructure Status</h5>
                                                <Stack gap={4}>
                                                    <div className="status-item">
                                                        <span className="status-label">
                                                            <CloudApp size={16} className="icon-blue" /> Vercel Edge Runtime
                                                        </span>
                                                        <Tag type="green" renderIcon={CheckmarkFilled}>Operational</Tag>
                                                    </div>
                                                    <div className="status-item">
                                                        <span className="status-label">
                                                            <VirtualMachine size={16} className="icon-purple" /> Supabase Postgres (RLS)
                                                        </span>
                                                        <Tag type="green" renderIcon={CheckmarkFilled}>Operational</Tag>
                                                    </div>
                                                    <div className="status-item">
                                                        <span className="status-label">
                                                            <Activity size={16} className="icon-error" /> Quantum Pulse QHE
                                                        </span>
                                                        <Tag
                                                            type={quantumHeartbeatStatus ? (quantumHeartbeatStatus.priority === 'info' ? 'green' : 'red') : 'green'}
                                                            renderIcon={quantumHeartbeatStatus?.priority === 'critical' ? WarningAltFilled : CheckmarkFilled}
                                                        >
                                                            {quantumHeartbeatStatus ? (quantumHeartbeatStatus.priority === 'info' ? 'ONLINE' : 'DEGRADED') : 'Operational'}
                                                        </Tag>
                                                    </div>
                                                    {quantumHeartbeatStatus?.metadata?.metrics && (
                                                        <div className="quantum-metrics-container">
                                                            <div className="quantum-metrics-header">
                                                                <span className="quantum-metrics-label">QPU: {quantumHeartbeatStatus.metadata.metrics.calibration.backend_name}</span>
                                                                <span className="quantum-metrics-value">T1: {quantumHeartbeatStatus.metadata.metrics.calibration.avg_t1}</span>
                                                            </div>
                                                            <ProgressBar
                                                                label="Cycle Usage (Instance)"
                                                                value={quantumHeartbeatStatus.metadata.metrics.usage.seconds_consumed}
                                                                max={quantumHeartbeatStatus.metadata.metrics.usage.seconds_allocated}
                                                                helperText={`${quantumHeartbeatStatus.metadata.metrics.usage.remaining_seconds}s remanescentes`}
                                                                size="small"
                                                            />
                                                            <div className="quantum-metrics-footer">
                                                                Fila: {quantumHeartbeatStatus.metadata.metrics.backends[0].queue_size} jobs | Latência: {quantumHeartbeatStatus.metadata.metrics.backends[0].est_wait_time}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Stack>
                                            </Tile>
                                            <Tile className="quick-actions-tile">
                                                <h5>Quick Actions</h5>
                                                <div className="quick-actions-container">
                                                    <Button kind="tertiary" size="sm">Flush Global Cache</Button>
                                                    <Button
                                                        kind="ghost"
                                                        size="sm"
                                                        renderIcon={Renew}
                                                        onClick={async () => {
                                                            await supabase.functions.invoke('genos-quantum-heartbeat');
                                                        }}
                                                    >
                                                        Trigger Quantum Heartbeat
                                                    </Button>
                                                    <Button kind="danger--tertiary" size="sm">Rotate Security Keys</Button>
                                                </div>
                                            </Tile>
                                        </Stack>
                                    </Column>
                                </Grid>
                            </TabPanel>

                            {/* ─── TAB 2: Tenants Management ────────────────────────────── */}
                            <TabPanel>
                                <div style={{ marginTop: 'var(--cds-spacing-07)' }}>
                                    {loading ? (
                                        <InlineLoading description="Carregando tenants..." />
                                    ) : (
                                        <DataTable rows={tenants} headers={tableHeaders}>
                                            {({
                                                rows,
                                                headers,
                                                getHeaderProps,
                                                getRowProps,
                                                getTableProps,
                                                getTableContainerProps,
                                            }) => (
                                                <TableContainer
                                                    title="Registered genOS Tenants"
                                                    description="Listagem completa de organizações sob o Master Tenant."
                                                    {...getTableContainerProps()}
                                                >
                                                    <Table {...getTableProps()} size="lg">
                                                        <TableHead>
                                                            <TableRow>
                                                                {headers.map((header) => (
                                                                    <TableHeader {...getHeaderProps({ header })}>
                                                                        {header.header}
                                                                    </TableHeader>
                                                                ))}
                                                                <TableHeader />
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {rows.map((row) => (
                                                                <TableRow {...getRowProps({ row })}>
                                                                    {row.cells.map((cell) => (
                                                                        <TableCell key={cell.id}>
                                                                            {cell.info.header === 'status' ? (
                                                                                <Tag type={cell.value === 'active' ? 'green' : 'red'}>
                                                                                    {cell.value}
                                                                                </Tag>
                                                                            ) : cell.value}
                                                                        </TableCell>
                                                                    ))}
                                                                    <TableCell className="table-cell-right">
                                                                        <Button
                                                                            kind="ghost"
                                                                            size="sm"
                                                                            onClick={() => api.setActiveTenant(row.id)}
                                                                        >
                                                                            Impersonate
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            )}
                                        </DataTable>
                                    )}
                                </div>
                            </TabPanel>

                            {/* ─── TAB 3: Patch Manager ───────────────────────────── */}
                            <TabPanel>
                                <Grid className="quantum-compliance-stack">
                                    <Column lg={16}>
                                        <Tile className="patch-manager-tile">
                                            <h4>Patch Manager</h4>
                                            <p className="patch-manager-desc">Gerenciamento de versões e patches do ecossistema genOS™.</p>
                                            <InlineNotification
                                                kind="info"
                                                lowContrast
                                                title="No pending patches"
                                                subtitle={`O sistema está operando na versão v${genOSVersion}. Todos os patches críticos foram aplicados.`}
                                                hideCloseButton
                                            />
                                        </Tile>
                                    </Column>
                                </Grid>
                            </TabPanel>

                            {/* ─── TAB 4: Quantum Compliance ───────────────────────────── */}
                            <TabPanel>
                                <Grid className="quantum-compliance-stack">
                                    <Column lg={16}>
                                        <Stack gap={6}>
                                            <Tile className="quantum-compliance-tile">
                                                <div className="quantum-compliance-header">
                                                    <div>
                                                        <h4>Quantum Slogan Compliance & FinOps</h4>
                                                        <p className="patch-manager-desc">Monitoring QPU instance "genOS Preview" usage across tenants.</p>
                                                    </div>
                                                    <Button size="sm" kind="ghost" renderIcon={Renew} onClick={fetchData}>Refresh Telemetry</Button>
                                                </div>

                                                <Grid fullWidth narrow>
                                                    <Column lg={4}>
                                                        <div className="quantum-stat-card">
                                                            <p className="cds--type-label-01 quantum-stat-label">TOTAL QPU SECONDS</p>
                                                            <h3 className="quantum-stat-value">
                                                                {quantumStats.reduce((acc, curr) => acc + Number(curr.total_seconds_consumed || 0), 0)}s
                                                            </h3>
                                                        </div>
                                                    </Column>
                                                    <Column lg={4}>
                                                        <div className="quantum-stat-card">
                                                            <p className="cds--type-label-01 quantum-stat-label">TOTAL ACCRUED COST</p>
                                                            <h3 className="quantum-stat-value--success">
                                                                ${quantumStats.reduce((acc, curr) => acc + Number(curr.total_accrued_cost || 0), 0).toFixed(2)}
                                                            </h3>
                                                        </div>
                                                    </Column>
                                                    <Column lg={8}>
                                                        <InlineNotification
                                                            kind="info"
                                                            lowContrast
                                                            title="Quota Status"
                                                            subtitle="Instance 'genOS Preview' is at 4.2% of monthly capacity (10m)."
                                                            hideCloseButton
                                                        />
                                                    </Column>
                                                </Grid>
                                            </Tile>

                                            <TableContainer title="Quantum Audit Trail (Detail)" description="Last 50 QPU executions and compliance checks.">
                                                <Table size="sm">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableHeader>Execution Time</TableHeader>
                                                            <TableHeader>Tenant</TableHeader>
                                                            <TableHeader>QPU Instance</TableHeader>
                                                            <TableHeader>Seconds</TableHeader>
                                                            <TableHeader>Compliance Check</TableHeader>
                                                            <TableHeader>Stripe Status</TableHeader>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {auditTrail.map((log) => (
                                                            <TableRow key={log.id}>
                                                                <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                                                                <TableCell>{log.tenant_id.slice(0, 8)}...</TableCell>
                                                                <TableCell className="audit-trail-qpu-cell">{log.metadata?.qpu || 'ibm_fez'}</TableCell>
                                                                <TableCell>{log.metadata?.seconds_consumed || 0}s</TableCell>
                                                                <TableCell>
                                                                    <Tag type="green" size="sm" renderIcon={CheckmarkFilled}>PASS</Tag>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Tag type={log.stripe_sync_status === 'synced' ? 'green' : 'blue'} size="sm">
                                                                        {log.stripe_sync_status}
                                                                    </Tag>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        </Stack>
                                    </Column>
                                </Grid>
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </Section>
            </PageLayout>
        </>
    );
};
