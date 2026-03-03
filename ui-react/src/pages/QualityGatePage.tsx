'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    DataTable, TableContainer, Table, TableHead, TableRow, TableHeader,
    TableBody, TableCell, TableToolbar, TableToolbarContent, TableToolbarSearch,
    Button, OverflowMenu, OverflowMenuItem, Tag, Pagination,
    TableExpandHeader, TableExpandRow, TableExpandedRow, Section, Tile, Stack, Grid, Column,
    AILabel, AILabelContent, DataTableSkeleton, ProgressBar, Modal, TextArea,
    InlineNotification, TagProps, Select, SelectItem
} from '@carbon/react';
import { supabase } from '../services/supabase';
import {
    Security, ThumbsUp, ThumbsDown, MachineLearningModel, DataVis_1,
    Settings as SettingsIcon, Renew, View, Checkmark, Filter
} from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';
import { t } from '../config/locale';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../components/NotificationProvider';
import PublishButton from '../components/PublishButton';
import PublishStatusBadge from '../components/PublishStatusBadge';

// --- Interfaces ---

interface Evaluation {
    id: string;
    post_id: string;
    tenant_id: string;
    overall_score: number;
    status: 'pending' | 'passed' | 'failed' | 'exception_approved';
    evaluated_at: string;
    evaluated_by: string;
    reason_exception?: string;
    posts: {
        title: string;
        content_type: string;
        format: string;
    };
    constraint_results: ConstraintResult[];
}

interface ConstraintResult {
    id: string;
    rule_id: string;
    passed: boolean;
    actual_value: string;
    expected_value: string;
    severity: 'violation' | 'warning' | 'info';
    detail?: string;
    constraint_rules?: {
        rule_type: string;
        format_target: string;
    };
}

interface Stats {
    total_evaluated: number;
    passed: number;
    failed: number;
    exception_approved: number;
    avg_score: number;
    pass_rate: number;
}

const headers = [
    { key: 'post', header: 'Ativo de Conteúdo' },
    { key: 'score', header: 'Score de Qualidade' },
    { key: 'status', header: 'Status Governança' },
    { key: 'publish', header: 'Publicação' },
    { key: 'violations', header: 'Violas / Warnings' },
    { key: 'date', header: 'Data Avaliação' },
];

export default function QualityGatePage() {
    const { me } = useAuth();
    const { showToast } = useNotifications();
    const [loading, setLoading] = useState(true);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [isExceptionModalOpen, setIsExceptionModalOpen] = useState(false);
    const [selectedEval, setSelectedEval] = useState<Evaluation | null>(null);
    const [exceptionReason, setExceptionReason] = useState('');
    const [tenants, setTenants] = useState<any[]>([]);
    const [selectedTenantFilter, setSelectedTenantFilter] = useState<string>('all');

    const isAgencyOrMaster = (me.tenant?.depth_level ?? 2) < 2;

    const loadTenants = useCallback(async () => {
        if (!isAgencyOrMaster) return;
        try {
            const list = await api.loadTenants();
            setTenants(list);
        } catch (err) {
            console.warn('Error loading tenants:', err);
        }
    }, [isAgencyOrMaster]);

    const fetchData = useCallback(async () => {
        const tenantId = (isAgencyOrMaster && selectedTenantFilter !== 'all')
            ? selectedTenantFilter
            : (me.tenant?.id || api.getActiveTenantId());

        if (!tenantId) return;

        setLoading(true);
        try {
            // Quality Gate data fetching
            let evals, statsData;
            try {
                const [evalsRes, statsRes]: [any, any] = await Promise.all([
                    api.edgeFn('quality-gate-evaluator', {
                        action: 'list_queue',
                        filters: { tenant_id: tenantId }
                    }),
                    api.edgeFn('quality-gate-stats', { tenant_id: tenantId })
                ]);
                evals = evalsRes.data || evalsRes;
                statsData = statsRes.data || statsRes;
            } catch (edgeErr) {
                console.warn('Edge function failed, falling back to direct query:', edgeErr);
                // Fallback to direct query if edge function fails
                const { data: directEvals } = await supabase
                    .from('quality_evaluations')
                    .select('*, posts(title, format, content_type)')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false });
                evals = directEvals || [];
                statsData = null; // No easy fallback for complex stats
            }

            setEvaluations(evals || []);
            setStats(statsData);
        } catch (err: any) {
            showToast('Erro ao carregar governança', err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [isAgencyOrMaster, selectedTenantFilter, me.tenant?.id, showToast]);

    useEffect(() => {
        loadTenants();
        fetchData();
    }, [loadTenants, fetchData]);

    const handleAction = async (action: string, id: string, extra?: any) => {
        try {
            showToast('Processando...', '', 'info');
            await api.edgeFn('quality-gate-evaluator', { action, evaluationId: id, postId: extra?.postId, ...extra });
            showToast('Sucesso', 'Ação concluída com sucesso', 'success');
            fetchData();
        } catch (err: any) {
            showToast('Erro na ação', err.message, 'error');
        }
    };

    const handleApproveException = () => {
        if (!selectedEval) return;
        handleAction('approve_exception', selectedEval.id, { reason: exceptionReason });
        setIsExceptionModalOpen(false);
        setSelectedEval(null);
        setExceptionReason('');
    };

    const renderStatusTag = (status: string) => {
        const types: Record<string, TagProps<any>['type']> = {
            passed: 'green',
            failed: 'red',
            pending: 'blue',
            exception_approved: 'purple',
        };
        return <Tag type={types[status] || 'cool-gray'}>{status.replace('_', ' ').toUpperCase()}</Tag>;
    };

    const renderScore = (score: number) => {
        const color = score >= 80 ? '#24a148' : score >= 50 ? '#f1c21b' : '#da1e28';
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '100px' }}>
                    <ProgressBar
                        label="Evaluation Score"
                        value={score}
                        max={100}
                        hideLabel
                        size="small"
                        status={score >= 80 ? 'finished' : 'active'}
                    />
                </div>
                <span style={{ color, fontWeight: 600 }}>{Math.round(score)}%</span>
            </div>
        );
    };

    const tableRows = evaluations.map(e => ({
        id: e.id,
        post: (
            <Stack gap={1}>
                <span style={{ fontWeight: 600 }}>{e.posts?.title}</span>
                <Tag size="sm" type="cool-gray">{e.posts?.format || e.posts?.content_type}</Tag>
            </Stack>
        ),
        score: renderScore(e.overall_score),
        status: renderStatusTag(e.status),
        publish: <PublishStatusBadge postId={e.post_id} />,
        violations: (
            <Stack orientation="horizontal" gap={2}>
                <Tag type="red" size="sm">{e.constraint_results?.filter(r => !r.passed && r.severity === 'violation').length}</Tag>
                <Tag type="warm-gray" size="sm">{e.constraint_results?.filter(r => !r.passed && r.severity === 'warning').length}</Tag>
            </Stack>
        ),
        date: new Date(e.evaluated_at).toLocaleDateString(),
    }));

    return (
        <PageLayout
            pageName="Quality Gate"
            pageDescription="Governança de conteúdo e conformidade com Brand DNA"
            actions={
                isAgencyOrMaster && (
                    <Button
                        kind="ghost"
                        renderIcon={SettingsIcon}
                        onClick={() => showToast('Configuração de regras em breve', 'Use o CLI por enquanto', 'info')}
                    >
                        Configurar Regras
                    </Button>
                )
            }
        >
            <Section style={{ marginBottom: '2rem' }}>
                <Grid>
                    <Column lg={4} md={4} sm={4}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                            <p className="cds--label" style={{ color: '#c6c6c6' }}>Total Avaliados</p>
                            <h2 className="cds--type-productive-heading-05" style={{ marginTop: '0.5rem' }}>{stats?.total_evaluated || 0}</h2>
                        </Tile>
                    </Column>
                    <Column lg={4} md={4} sm={4}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                            <p className="cds--label" style={{ color: '#c6c6c6' }}>Taxa de Aprovação</p>
                            <h2 className="cds--type-productive-heading-05" style={{ marginTop: '0.5rem', color: (stats?.pass_rate ?? 0) > 80 ? '#24a148' : '#f1c21b' }}>
                                {Math.round(stats?.pass_rate || 0)}%
                            </h2>
                        </Tile>
                    </Column>
                    <Column lg={4} md={4} sm={4}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                            <p className="cds--label" style={{ color: '#c6c6c6' }}>Failed / Reprovados</p>
                            <h2 className="cds--type-productive-heading-05" style={{ marginTop: '0.5rem', color: '#fa4d56' }}>{stats?.failed || 0}</h2>
                        </Tile>
                    </Column>
                    <Column lg={4} md={4} sm={4}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                            <p className="cds--label" style={{ color: '#c6c6c6' }}>Score Médio</p>
                            <h2 className="cds--type-productive-heading-05" style={{ marginTop: '0.5rem' }}>{Math.round(stats?.avg_score || 0)}</h2>
                        </Tile>
                    </Column>
                </Grid>
            </Section>

            <Section>
                {loading ? (
                    <DataTableSkeleton headers={headers} rowCount={5} columnCount={5} />
                ) : evaluations.length === 0 ? (
                    <Tile style={{ textAlign: 'center', padding: '4rem', backgroundColor: '#262626' }}>
                        <Security size={64} fill="#393939" style={{ marginBottom: '1rem' }} />
                        <h4 className="cds--type-productive-heading-03">Nenhum post aguardando avaliação</h4>
                        <p style={{ color: '#c6c6c6', marginTop: '0.5rem' }}>Todos os seus posts gerados aparecem aqui para inspeção de governança.</p>
                    </Tile>
                ) : (
                    <TableContainer title="Fila de Governança Determinística">
                        <TableToolbar>
                            <TableToolbarContent>
                                {isAgencyOrMaster && (
                                    <div style={{ width: '250px', marginRight: '1rem' }}>
                                        <Select
                                            id="tenant-filter"
                                            hideLabel
                                            value={selectedTenantFilter}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTenantFilter(e.target.value)}
                                            size="sm"
                                        >
                                            <SelectItem value="all" text="Todos os Clientes" />
                                            {tenants.map(t => (
                                                <SelectItem key={t.id} value={t.id} text={t.name} />
                                            ))}
                                        </Select>
                                    </div>
                                )}
                                <TableToolbarSearch placeholder="Buscar ativo..." />
                                <Button kind="ghost" hasIconOnly renderIcon={Renew} iconDescription="Atualizar" onClick={fetchData} />
                            </TableToolbarContent>
                        </TableToolbar>
                        <DataTable rows={tableRows} headers={headers}>
                            {({ rows, headers: tableHeaders, getHeaderProps, getRowProps, getTableProps, getExpandHeaderProps }: any) => (
                                <Table {...getTableProps()}>
                                    <TableHead>
                                        <TableRow>
                                            <TableExpandHeader {...getExpandHeaderProps()} />
                                            {tableHeaders.map((header: any) => (
                                                <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                                    {header.header}
                                                </TableHeader>
                                            ))}
                                            <TableHeader />
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {rows.map((row: any) => {
                                            const evalData = evaluations.find(e => e.id === row.id);
                                            return (
                                                <React.Fragment key={row.id}>
                                                    <TableExpandRow {...getRowProps({ row })}>
                                                        {row.cells.map((cell: any) => (
                                                            <TableCell key={cell.id}>{cell.value}</TableCell>
                                                        ))}
                                                        <TableCell className="cds--table-column-menu">
                                                            <OverflowMenu flipped size="sm">
                                                                <OverflowMenuItem
                                                                    itemText="Re-avaliar (Motor AI)"
                                                                    onClick={(e: any) => {
                                                                        e.stopPropagation();
                                                                        handleAction('re_evaluate', row.id, { postId: evalData?.post_id });
                                                                    }}
                                                                />
                                                                {isAgencyOrMaster && evalData?.status === 'failed' && (
                                                                    <OverflowMenuItem
                                                                        itemText="Aprovar Exceção"
                                                                        onClick={(e: any) => {
                                                                            e.stopPropagation();
                                                                            setSelectedEval(evalData!);
                                                                            setIsExceptionModalOpen(true);
                                                                        }}
                                                                    />
                                                                )}
                                                                <OverflowMenuItem itemText="Ver Post Original" hasDivider />
                                                            </OverflowMenu>
                                                            <div style={{ marginLeft: '0.5rem', display: 'inline-flex' }}>
                                                                <PublishButton postId={evalData?.post_id!} isApproved={evalData?.status === 'passed' || evalData?.status === 'exception_approved'} />
                                                            </div>
                                                        </TableCell>
                                                    </TableExpandRow>
                                                    <TableExpandedRow colSpan={tableHeaders.length + 2}>
                                                        <Tile style={{ margin: '1rem', backgroundColor: '#161616', border: '1px solid #393939' }}>
                                                            <h5 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <Security size={20} fill="#0f62fe" /> Relatório de Constraints
                                                            </h5>
                                                            <Grid>
                                                                {evalData?.constraint_results.map((res, idx) => (
                                                                    <Column lg={4} md={4} sm={4} key={idx}>
                                                                        <Tile light style={{ marginBottom: '1rem' }}>
                                                                            <Stack gap={2}>
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                                    <span className="cds--label">{res.constraint_rules?.rule_type.toUpperCase().replace('_', ' ')}</span>
                                                                                    <Tag type={(res.passed ? 'green' : res.severity === 'violation' ? 'red' : 'warm-gray') as TagProps<any>['type']} size="sm">
                                                                                        {res.passed ? 'PASS' : 'FAIL'}
                                                                                    </Tag>
                                                                                </div>
                                                                                <p style={{ fontSize: '0.875rem' }}>{res.detail || 'Nenhum detalhe adicional.'}</p>
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#c6c6c6' }}>
                                                                                    <span>Atual: {res.actual_value}</span>
                                                                                    <span>Esperado: {res.expected_value}</span>
                                                                                </div>
                                                                            </Stack>
                                                                        </Tile>
                                                                    </Column>
                                                                ))}
                                                            </Grid>
                                                            {evalData?.status === 'exception_approved' && (
                                                                <InlineNotification
                                                                    kind="info"
                                                                    title="Aprovado por Exceção"
                                                                    subtitle={`Motivo: ${evalData.reason_exception}`}
                                                                    hideCloseButton
                                                                    lowContrast
                                                                    style={{ marginTop: '1rem' }}
                                                                />
                                                            )}
                                                        </Tile>
                                                    </TableExpandedRow>
                                                </React.Fragment>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </DataTable>
                        <Pagination
                            backwardText="Página anterior"
                            forwardText="Próxima página"
                            pageSize={10}
                            page={1}
                            pageSizes={[10, 20, 50]}
                            totalItems={evaluations.length}
                        />
                    </TableContainer>
                )}
            </Section>

            <Modal
                open={isExceptionModalOpen}
                modalHeading="Aprovar Exceção de Governança"
                primaryButtonText="Confirmar Aprovação"
                secondaryButtonText="Cancelar"
                onRequestClose={() => setIsExceptionModalOpen(false)}
                onRequestSubmit={handleApproveException}
            >
                <p style={{ marginBottom: '1rem' }}>
                    Ao aprovar esta exceção, o post será marcado como pronto para publicação, ignorando as falhas de constraints detectadas.
                </p>
                <TextArea
                    labelText="Razão da Exceção"
                    placeholder="Descreva por que este post deve ser aprovado mesmo com violações..."
                    value={exceptionReason}
                    onChange={(e) => setExceptionReason(e.target.value)}
                />
            </Modal>

            <style>{`
        .cds--table-expand__row:hover {
          background-color: #353535 !important;
        }
        .cds--table-expanded-row:hover td {
          background-color: #161616 !important;
        }
      `}</style>
        </PageLayout>
    );
}
