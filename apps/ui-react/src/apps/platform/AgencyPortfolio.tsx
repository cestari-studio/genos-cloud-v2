import React, { useEffect, useState, useCallback } from 'react';
import {
    DataTable,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableHeader,
    TableBody,
    TableCell,
    TableToolbar,
    TableToolbarContent,
    TableToolbarSearch,
    Button,
    Tag,
    Stack,
    Section,
    Layer,
    Tile,
    IconButton,
    DataTableSkeleton,
    ProgressBar,
    Grid,
    Column,
    ActionableNotification,
} from '@carbon/react';
import {
    Switcher,
    Add,
    ChartRelationship,
    SettingsAdjust
} from '@carbon/icons-react';
import PageLayout from '@/components/PageLayout';
import { api, Tenant } from '@/services/api';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useNotifications } from '@/components/NotificationProvider';

export default function AgencyPortfolio() {
    const { me } = useAuth();
    const { showToast } = useNotifications();
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<Tenant[]>([]);
    const [switching, setSwitching] = useState<string | null>(null);

    const agencyId = me.tenant?.id;

    const fetchClients = useCallback(async () => {
        if (!agencyId) return;
        setLoading(true);
        try {
            const data = await api.loadChildTenants(agencyId);
            setClients(data);
        } catch (err: any) {
            showToast('Erro ao carregar portfólio', err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [agencyId, showToast]);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const handleSwitchContext = async (clientId: string) => {
        setSwitching(clientId);
        try {
            api.setActiveTenant(clientId);
            // Force refresh of auth context/app state
            window.location.href = '/console';
        } catch (err: any) {
            showToast('Erro ao trocar contexto', err.message, 'error');
            setSwitching(null);
        }
    };

    const headers = [
        { key: 'name', header: 'Nome da Marca' },
        { key: 'slug', header: 'Slug/ID' },
        { key: 'plan', header: 'Plano' },
        { key: 'status', header: 'Status' },
        { key: 'actions', header: 'Ações' },
    ];

    const rows = clients.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        plan: c.plan.toUpperCase(),
        status: c.status,
        actions: c.id
    }));

    return (
        <PageLayout
            pageName="Agency Portfolio™"
            pageDescription="Gerencie todos os seus clientes genOS em um único dashboard unificado."
            aiExplanation="Esta visão hierárquica utiliza isolamento RLS dinâmico para permitir que você opere em nome de qualquer cliente do seu portfólio sem sair da plataforma."
            actions={
                <Button kind="primary" size="sm" renderIcon={Add}>
                    Novo Cliente
                </Button>
            }
        >
            <Section>
                <Stack gap={6}>
                    {/* Dashboard Stats */}
                    <Grid condensed>
                        <Column lg={4} md={4} sm={4}>
                            <Tile className="stat-tile">
                                <Stack gap={2}>
                                    <p className="cds--type-label-01">Total de Clientes</p>
                                    <h2 className="cds--type-productive-heading-05">{clients.length}</h2>
                                </Stack>
                            </Tile>
                        </Column>
                        <Column lg={4} md={4} sm={4}>
                            <Tile className="stat-tile">
                                <Stack gap={2}>
                                    <p className="cds--type-label-01">Clientes Ativos</p>
                                    <h2 className="cds--type-productive-heading-05">
                                        {clients.filter(c => c.status === 'active').length}
                                    </h2>
                                </Stack>
                            </Tile>
                        </Column>
                    </Grid>

                    {/* Clients Table */}
                    <Layer>
                        {loading ? (
                            <DataTableSkeleton headers={headers} rowCount={5} columnCount={5} />
                        ) : (
                            <DataTable rows={rows} headers={headers}>
                                {({
                                    rows,
                                    headers,
                                    getHeaderProps,
                                    getRowProps,
                                    getTableProps,
                                    getTableContainerProps,
                                    onInputChange,
                                }) => (
                                    <TableContainer title="Portfólio de Marcas" description="Lista completa de parceiros e clientes gerenciados." {...getTableContainerProps()}>
                                        <TableToolbar>
                                            <TableToolbarContent>
                                                <TableToolbarSearch
                                                    onChange={(e: any) => onInputChange(e)}
                                                    placeholder="Buscar clientes..."
                                                />
                                                <IconButton
                                                    kind="ghost"
                                                    label="Atualizar"
                                                    onClick={fetchClients}
                                                >
                                                    <ChartRelationship />
                                                </IconButton>
                                            </TableToolbarContent>
                                        </TableToolbar>
                                        <Table {...getTableProps()}>
                                            <TableHead>
                                                <TableRow>
                                                    {headers.map((header) => (
                                                        <TableHeader {...getHeaderProps({ header })}>
                                                            {header.header}
                                                        </TableHeader>
                                                    ))}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {rows.map((row) => (
                                                    <TableRow {...getRowProps({ row })}>
                                                        {row.cells.map((cell) => {
                                                            if (cell.info.header === 'status') {
                                                                return (
                                                                    <TableCell key={cell.id}>
                                                                        <Tag type={cell.value === 'active' ? 'green' : 'warm-gray'} size="sm">
                                                                            {cell.value}
                                                                        </Tag>
                                                                    </TableCell>
                                                                );
                                                            }
                                                            if (cell.info.header === 'plan') {
                                                                return (
                                                                    <TableCell key={cell.id}>
                                                                        <Tag type="blue" size="sm">{cell.value}</Tag>
                                                                    </TableCell>
                                                                );
                                                            }
                                                            if (cell.info.header === 'actions') {
                                                                return (
                                                                    <TableCell key={cell.id}>
                                                                        <Stack orientation="horizontal" gap={3}>
                                                                            <Button
                                                                                kind="ghost"
                                                                                size="sm"
                                                                                hasIconOnly
                                                                                renderIcon={Switcher}
                                                                                iconDescription="Acessar Console do Cliente"
                                                                                tooltipPosition="left"
                                                                                onClick={() => handleSwitchContext(cell.value)}
                                                                                disabled={switching === cell.value}
                                                                            />
                                                                            <Button
                                                                                kind="ghost"
                                                                                size="sm"
                                                                                hasIconOnly
                                                                                renderIcon={SettingsAdjust}
                                                                                iconDescription="Configurações do Cliente"
                                                                                tooltipPosition="left"
                                                                            />
                                                                        </Stack>
                                                                    </TableCell>
                                                                );
                                                            }
                                                            return <TableCell key={cell.id}>{cell.value}</TableCell>;
                                                        })}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </DataTable>
                        )}
                    </Layer>
                </Stack>
            </Section>

            {/* Profit Analysis Section */}
            <Section style={{ marginTop: '3rem' }}>
                <Stack gap={6}>
                    <div>
                        <h4 className="cds--type-productive-heading-03">Profit Analysis™ (FinOps)</h4>
                        <p className="cds--type-body-short-01" style={{ color: 'var(--cds-text-secondary)' }}>
                            Monitorando margem operacional e consumo de infraestrutura por marca.
                        </p>
                    </div>

                    <Grid condensed>
                        <Column lg={8} md={8} sm={4}>
                            <Tile style={{ padding: '1.5rem', background: 'var(--cds-layer-01)', border: '1px solid var(--cds-border-subtle-01)' }}>
                                <Stack gap={5}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <p className="cds--type-heading-01">Margem Operacional Média</p>
                                        <Tag type="green" size="sm">+32% MoM</Tag>
                                    </div>
                                    <div style={{ height: '120px', display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                        {[40, 65, 45, 80, 55, 90, 75, 85, 60, 95].map((h, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    flex: 1,
                                                    height: `${h}%`,
                                                    background: 'var(--cds-link-primary)',
                                                    opacity: 0.3 + (i * 0.07),
                                                    borderRadius: '2px 2px 0 0'
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <p className="cds--type-caption-01">Projeção baseada em créditos consumidos vs. tier de assinatura.</p>
                                </Stack>
                            </Tile>
                        </Column>
                        <Column lg={4} md={4} sm={4}>
                            <Tile style={{ padding: '1.5rem', background: 'var(--cds-layer-01)', border: '1px solid var(--cds-border-subtle-01)' }}>
                                <Stack gap={4}>
                                    <p className="cds--type-heading-01">Distribuição de Custo</p>
                                    <Stack gap={3}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span className="cds--type-label-01">AI Generation</span>
                                            <span className="cds--type-label-01 bold">64%</span>
                                        </div>
                                        <ProgressBar label="AI Generation" value={64} size="small" hideLabel />

                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span className="cds--type-label-01">Vector Storage</span>
                                            <span className="cds--type-label-01 bold">21%</span>
                                        </div>
                                        <ProgressBar label="Vector Storage" value={21} size="small" hideLabel />

                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span className="cds--type-label-01">Edge Ops</span>
                                            <span className="cds--type-label-01 bold">15%</span>
                                        </div>
                                        <ProgressBar label="Edge Ops" value={15} size="small" hideLabel />
                                    </Stack>
                                </Stack>
                            </Tile>
                        </Column>
                    </Grid>
                </Stack>
            </Section>

            <Section style={{ marginTop: '2rem' }}>
                <Tile style={{ border: '1px dashed var(--cds-border-strong-01)', background: 'transparent' }}>
                    <Stack gap={3} orientation="horizontal" style={{ alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                        <ChartRelationship size={24} />
                        <p className="cds--type-body-short-01">
                            Integrando dados de faturamento do **Stripe Connect™** para visibilidade total (v5.1 roadmap).
                        </p>
                    </Stack>
                </Tile>
            </Section>

            {switching && (
                <ActionableNotification
                    kind="info"
                    title="Trocando Contexto"
                    subtitle="Redirecionando para o ambiente do cliente selecionado..."
                    hideCloseButton
                    inline
                    style={{ marginTop: '2rem' }}
                />
            )}
        </PageLayout>
    );
}
