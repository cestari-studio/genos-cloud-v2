'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    DataTable, TableContainer, Table, TableHead, TableRow, TableHeader,
    TableBody, TableCell, TableToolbar, TableToolbarContent, TableToolbarSearch,
    Button, OverflowMenu, OverflowMenuItem, Tag, Pagination,
    TableExpandHeader, TableExpandRow, TableExpandedRow, Section, Tile, Stack, Grid, Column,
    AILabel, AILabelContent, DataTableSkeleton, ProgressBar, Modal, TextArea,
    InlineNotification, TagProps, Select, SelectItem, Layer, InlineLoading
} from '@carbon/react';
import { supabase } from '../services/supabase';
import {
    Security, MachineLearningModel, DataVis_1,
    Settings as SettingsIcon, Renew, VolumeUpFilled, UserMultiple
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
    // AI Analysis state: map of evaluation_id → result
    const [aiResults, setAiResults] = useState<Record<string, any>>({});
    const [aiRunning, setAiRunning] = useState<Record<string, boolean>>({});

    const handleRunAiAnalysis = async (evalId: string, postId: string) => {
        const tenantId = me.tenant?.id || api.getActiveTenantId();
        if (!tenantId || !postId) return;
        setAiRunning(prev => ({ ...prev, [evalId]: true }));
        try {
            const result = await api.edgeFn('quality-gate-ai-evaluator', { post_id: postId, tenant_id: tenantId });
            setAiResults(prev => ({ ...prev, [evalId]: result }));
            showToast('Análise de IA concluída', 'Tom e voz avaliados com sucesso.', 'success');
        } catch (err: any) {
            showToast('Erro na análise de IA', err.message, 'error');
        } finally {
            setAiRunning(prev => ({ ...prev, [evalId]: false }));
        }
    };

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
                const { data: directEvals } = await supabase
                    .from('quality_evaluations')
                    .select('*, posts(title, format, content_type)')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false });
                evals = directEvals || [];
                statsData = null;
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
        const tagType: TagProps<any>['type'] = score >= 80 ? 'green' : score >= 50 ? 'warm-gray' : 'red';
        return (
            <Stack orientation="horizontal" gap={3} className="quality-score-row">
                <div className="quality-score-bar">
                    <ProgressBar
                        label="Evaluation Score"
                        value={score}
                        max={100}
                        hideLabel
                        size="small"
                        status={score >= 80 ? 'finished' : 'active'}
                    />
                </div>
                <Tag type={tagType} size="sm">{Math.round(score)}%</Tag>
            </Stack>
        );
    };

    const tableRows = evaluations.map(e => ({
        id: e.id,
        post: (
            <Stack gap={1}>
                <span className="cds--type-productive-heading-01">{e.posts?.title}</span>
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
            aiExplanation="Score de qualidade calculado contra regras de governança. Violations bloqueiam aprovação; warnings alertam; info é informativo."
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
            <Section>
                <Grid>
                    <Column lg={4} md={4} sm={4}>
                        <Tile>
                            <Stack gap={2}>
                                <Stack orientation="horizontal" gap={2}>
                                    <p className="cds--label">Total Avaliados</p>
                                    <AILabel autoAlign>
                                        <AILabelContent>
                                            <p>Avaliação contra regras de governança, score 0-100. Cada constraint representa uma regra de Brand DNA ou compliance editorial.</p>
                                        </AILabelContent>
                                    </AILabel>
                                </Stack>
                                <h2 className="cds--type-productive-heading-05">{stats?.total_evaluated || 0}</h2>
                            </Stack>
                        </Tile>
                    </Column>
                    <Column lg={4} md={4} sm={4}>
                        <Tile>
                            <Stack gap={2}>
                                <p className="cds--label">Taxa de Aprovação</p>
                                <Stack orientation="horizontal" gap={2}>
                                    <h2 className="cds--type-productive-heading-05">{Math.round(stats?.pass_rate || 0)}%</h2>
                                    <Tag type={(stats?.pass_rate ?? 0) > 80 ? 'green' : 'warm-gray'} size="sm">
                                        {(stats?.pass_rate ?? 0) > 80 ? 'Saudável' : 'Atenção'}
                                    </Tag>
                                </Stack>
                            </Stack>
                        </Tile>
                    </Column>
                    <Column lg={4} md={4} sm={4}>
                        <Tile>
                            <Stack gap={2}>
                                <Stack orientation="horizontal" gap={2}>
                                    <p className="cds--label">Failed / Reprovados</p>
                                    <AILabel autoAlign>
                                        <AILabelContent>
                                            <p>Severidades: violation (bloqueia aprovação), warning (alerta sem bloqueio), info (diagnóstico informativo).</p>
                                        </AILabelContent>
                                    </AILabel>
                                </Stack>
                                <Stack orientation="horizontal" gap={2}>
                                    <h2 className="cds--type-productive-heading-05">{stats?.failed || 0}</h2>
                                    {(stats?.failed ?? 0) > 0 && <Tag type="red" size="sm">Ação necessária</Tag>}
                                </Stack>
                            </Stack>
                        </Tile>
                    </Column>
                    <Column lg={4} md={4} sm={4}>
                        <Tile>
                            <Stack gap={2}>
                                <p className="cds--label">Score Médio</p>
                                <h2 className="cds--type-productive-heading-05">{Math.round(stats?.avg_score || 0)}</h2>
                            </Stack>
                        </Tile>
                    </Column>
                </Grid>
            </Section>

            <Section>
                {loading ? (
                    <DataTableSkeleton headers={headers} rowCount={5} columnCount={5} />
                ) : evaluations.length === 0 ? (
                    <Tile>
                        <Stack gap={4} className="quality-gate-empty">
                            <Security size={64} className="quality-gate-empty__icon" />
                            <h4 className="cds--type-productive-heading-03">Nenhum post aguardando avaliação</h4>
                            <p className="cds--type-body-short-01">Todos os seus posts gerados aparecem aqui para inspeção de governança.</p>
                        </Stack>
                    </Tile>
                ) : (
                    <TableContainer title="Fila de Governança Determinística">
                        <TableToolbar>
                            <TableToolbarContent>
                                {isAgencyOrMaster && (
                                    <div className="quality-gate-tenant-select">
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
                                                            <PublishButton postId={evalData?.post_id!} isApproved={evalData?.status === 'passed' || evalData?.status === 'exception_approved'} />
                                                        </TableCell>
                                                    </TableExpandRow>
                                                    <TableExpandedRow colSpan={tableHeaders.length + 2}>
                                                        <Layer>
                                                            <Tile>
                                                                <Stack gap={5}>
                                                                    {/* ── Constraint Results ── */}
                                                                    <Stack orientation="horizontal" gap={2}>
                                                                        <Security size={20} className="icon--info" />
                                                                        <h5 className="cds--type-productive-heading-02">Relatório de Constraints</h5>
                                                                    </Stack>
                                                                    <Grid>
                                                                        {evalData?.constraint_results.map((res, idx) => (
                                                                            <Column lg={4} md={4} sm={4} key={idx}>
                                                                                <Layer>
                                                                                    <Tile>
                                                                                        <Stack gap={2}>
                                                                                            <Stack orientation="horizontal" gap={3}>
                                                                                                <span className="cds--label">{res.constraint_rules?.rule_type.toUpperCase().replace('_', ' ')}</span>
                                                                                                <Tag type={(res.passed ? 'green' : res.severity === 'violation' ? 'red' : 'warm-gray') as TagProps<any>['type']} size="sm">
                                                                                                    {res.passed ? 'PASS' : 'FAIL'}
                                                                                                </Tag>
                                                                                            </Stack>
                                                                                            <p className="cds--type-body-short-01">{res.detail || 'Nenhum detalhe adicional.'}</p>
                                                                                            <Stack orientation="horizontal" gap={4}>
                                                                                                <span className="cds--type-helper-text-01">Atual: {res.actual_value}</span>
                                                                                                <span className="cds--type-helper-text-01">Esperado: {res.expected_value}</span>
                                                                                            </Stack>
                                                                                        </Stack>
                                                                                    </Tile>
                                                                                </Layer>
                                                                            </Column>
                                                                        ))}
                                                                    </Grid>

                                                                    {/* ── AI Analysis Section ── */}
                                                                    <Stack gap={3}>
                                                                        <Stack orientation="horizontal" gap={3}>
                                                                            <MachineLearningModel size={20} className="icon--info" />
                                                                            <h5 className="cds--type-productive-heading-02">Análise de IA — Tom &amp; Voz da Marca</h5>
                                                                            <AILabel autoAlign size="xs">
                                                                                <AILabelContent>
                                                                                    <Stack gap={3} className="ai-label-popover-inner">
                                                                                        <p className="cds--type-label-01">IA EXPLAINED</p>
                                                                                        <p className="cds--type-body-short-01">
                                                                                            O modelo <strong>Gemini 2.0 Flash</strong> analisa a aderência do conteúdo ao tom de voz e pilares editoriais definidos no Brand DNA.
                                                                                            Peso: 50% Tom + 50% Voz da Marca = Score final.
                                                                                        </p>
                                                                                    </Stack>
                                                                                </AILabelContent>
                                                                            </AILabel>
                                                                            {!aiResults[row.id] && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    kind="ghost"
                                                                                    renderIcon={MachineLearningModel}
                                                                                    disabled={!!aiRunning[row.id]}
                                                                                    onClick={() => handleRunAiAnalysis(row.id, evalData?.post_id ?? '')}
                                                                                >
                                                                                    {aiRunning[row.id] ? 'Analisando...' : 'Analisar com IA'}
                                                                                </Button>
                                                                            )}
                                                                            {aiRunning[row.id] && <InlineLoading description="Gemini 2.0 Flash analisando..." />}
                                                                        </Stack>

                                                                        {aiResults[row.id] && (() => {
                                                                            const ai = aiResults[row.id];
                                                                            return (
                                                                                <Grid>
                                                                                    {/* Tile: Tom de Voz */}
                                                                                    <Column lg={8} md={8} sm={4}>
                                                                                        <Layer>
                                                                                            <Tile>
                                                                                                <Stack gap={4}>
                                                                                                    <Stack orientation="horizontal" gap={3}>
                                                                                                        <VolumeUpFilled size={16} className="icon--info" />
                                                                                                        <h6 className="cds--type-productive-heading-01">Análise de Tom</h6>
                                                                                                        <Tag type={ai.tone_adherence.score >= 80 ? 'green' : ai.tone_adherence.score >= 50 ? 'warm-gray' : 'red'} size="sm">
                                                                                                            {ai.tone_adherence.score}/100
                                                                                                        </Tag>
                                                                                                    </Stack>
                                                                                                    <ProgressBar
                                                                                                        label="Aderência ao Tom"
                                                                                                        value={ai.tone_adherence.score}
                                                                                                        max={100}
                                                                                                        status={ai.tone_adherence.score >= 80 ? 'finished' : 'active'}
                                                                                                        hideLabel
                                                                                                    />
                                                                                                    <Stack gap={2}>
                                                                                                        <Stack orientation="horizontal" gap={3}>
                                                                                                            <span className="cds--type-label-01">Tom Detectado</span>
                                                                                                            <Tag type="blue" size="sm">{ai.tone_adherence.detected_tone}</Tag>
                                                                                                        </Stack>
                                                                                                        <Stack orientation="horizontal" gap={3}>
                                                                                                            <span className="cds--type-label-01">Tom Esperado</span>
                                                                                                            <Tag type="teal" size="sm">{ai.tone_adherence.expected_tone}</Tag>
                                                                                                        </Stack>
                                                                                                    </Stack>
                                                                                                    <p className="cds--type-body-short-01">{ai.tone_adherence.analysis}</p>
                                                                                                    {ai.tone_adherence.suggestions?.length > 0 && (
                                                                                                        <Stack gap={1}>
                                                                                                            <p className="cds--type-label-01">Sugestões</p>
                                                                                                            {ai.tone_adherence.suggestions.map((s: string, i: number) => (
                                                                                                                <p key={i} className="cds--type-helper-text-01">• {s}</p>
                                                                                                            ))}
                                                                                                        </Stack>
                                                                                                    )}
                                                                                                </Stack>
                                                                                            </Tile>
                                                                                        </Layer>
                                                                                    </Column>

                                                                                    {/* Tile: Voz da Marca */}
                                                                                    <Column lg={8} md={8} sm={4}>
                                                                                        <Layer>
                                                                                            <Tile>
                                                                                                <Stack gap={4}>
                                                                                                    <Stack orientation="horizontal" gap={3}>
                                                                                                        <UserMultiple size={16} className="icon--info" />
                                                                                                        <h6 className="cds--type-productive-heading-01">Voz da Marca</h6>
                                                                                                        <Tag type={ai.brand_voice_score.score >= 80 ? 'green' : ai.brand_voice_score.score >= 50 ? 'warm-gray' : 'red'} size="sm">
                                                                                                            {ai.brand_voice_score.score}/100
                                                                                                        </Tag>
                                                                                                    </Stack>
                                                                                                    <ProgressBar
                                                                                                        label="Score Voz da Marca"
                                                                                                        value={ai.brand_voice_score.score}
                                                                                                        max={100}
                                                                                                        status={ai.brand_voice_score.score >= 80 ? 'finished' : 'active'}
                                                                                                        hideLabel
                                                                                                    />
                                                                                                    {/* Keyword tags */}
                                                                                                    {ai.brand_voice_score.keyword_usage?.length > 0 && (
                                                                                                        <Stack gap={2}>
                                                                                                            <p className="cds--type-label-01">Keywords</p>
                                                                                                            <Stack orientation="horizontal" gap={2}>
                                                                                                                {ai.brand_voice_score.keyword_usage.map((k: any, i: number) => (
                                                                                                                    <Tag key={i} type={k.found ? 'green' : 'red'} size="sm">{k.keyword}</Tag>
                                                                                                                ))}
                                                                                                            </Stack>
                                                                                                        </Stack>
                                                                                                    )}
                                                                                                    {/* Pillar alignment */}
                                                                                                    {ai.brand_voice_score.pillar_alignment?.length > 0 && (
                                                                                                        <Stack gap={2}>
                                                                                                            <p className="cds--type-label-01">Pilares Editoriais</p>
                                                                                                            {ai.brand_voice_score.pillar_alignment.map((pa: any, i: number) => (
                                                                                                                <Stack key={i} gap={1}>
                                                                                                                    <Stack orientation="horizontal" gap={2}>
                                                                                                                        <span className="cds--type-helper-text-01">{pa.pillar}</span>
                                                                                                                        <span className="cds--type-helper-text-01">{pa.score}%</span>
                                                                                                                    </Stack>
                                                                                                                    <ProgressBar
                                                                                                                        label={pa.pillar}
                                                                                                                        value={pa.score}
                                                                                                                        max={100}
                                                                                                                        hideLabel
                                                                                                                        size="small"
                                                                                                                        status={pa.score >= 70 ? 'finished' : 'active'}
                                                                                                                    />
                                                                                                                </Stack>
                                                                                                            ))}
                                                                                                        </Stack>
                                                                                                    )}
                                                                                                </Stack>
                                                                                            </Tile>
                                                                                        </Layer>
                                                                                    </Column>
                                                                                </Grid>
                                                                            );
                                                                        })()}
                                                                    </Stack>

                                                                    {evalData?.status === 'exception_approved' && (
                                                                        <InlineNotification
                                                                            kind="info"
                                                                            title="Aprovado por Exceção"
                                                                            subtitle={`Motivo: ${evalData.reason_exception}`}
                                                                            hideCloseButton
                                                                            lowContrast
                                                                        />
                                                                    )}
                                                                </Stack>
                                                            </Tile>
                                                        </Layer>
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
                <Stack gap={4}>
                    <p className="cds--type-body-short-01">
                        Ao aprovar esta exceção, o post será marcado como pronto para publicação, ignorando as falhas de constraints detectadas.
                    </p>
                    <TextArea
                        labelText="Razão da Exceção"
                        placeholder="Descreva por que este post deve ser aprovado mesmo com violações..."
                        value={exceptionReason}
                        onChange={(e) => setExceptionReason(e.target.value)}
                    />
                </Stack>
            </Modal>
        </PageLayout>
    );
}
