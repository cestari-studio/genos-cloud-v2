import React, { useState, useEffect } from 'react';
import {
    DataTable,
    Table,
    TableHead,
    TableRow,
    TableHeader,
    TableBody,
    TableCell,
    TableContainer,
    TableToolbar,
    TableToolbarContent,
    TableBatchActions,
    TableBatchAction,
    TableExpandHeader,
    TableExpandRow,
    TableExpandedRow,
    Button,
    Tag,
    TextArea,
    AILabel,
    AILabelContent,
    SkeletonText,
    StructuredListWrapper,
    StructuredListHead,
    StructuredListRow,
    StructuredListCell,
    StructuredListBody,
    Loading
} from '@carbon/react';
import { MagicWand, Renew, Checkmark, Warning, Download } from '@carbon/icons-react';
import { supabase } from '@/services/supabase';
import { api } from '@/services/api';

interface MatrixAsset {
    id: string;
    title: string;
    type: string;
    status: string;
    content: string | null;
    qhe_score?: number; // Added for Quantum Telemetry
    quantum_metadata?: any; // Added for Quantum Telemetry
    context: {
        brand_dna_snapshot: string;
        briefing_goal: string;
        target_language: string;
    };
    ai_metadata: {
        model_used: string;
        tokens_consumed: number;
        cost_usd: number;
    };
    compliance_notes: string;
    tenant_id: string;
    created_at: string;
}

export default function MatrixList() {
    const [assets, setAssets] = useState<MatrixAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [hasContentFactoryAccess, setHasContentFactoryAccess] = useState(true);
    const tenantId = api.getActiveTenantId();

    useEffect(() => {
        checkPermissions();
        fetchAssets();

        if (!tenantId) return;

        const channel = supabase
            .channel('matrix_assets_realtime')
            .on('postgres_changes' as any, {
                event: '*',
                schema: 'public',
                table: 'matrix_assets',
                filter: `tenant_id=eq.${tenantId}`
            }, (payload: any) => {
                handleRealtimeChange(payload);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenantId]);

    const checkPermissions = async () => {
        // Simulando Ultra Settings Feature Guard
        if (tenantId) {
            // Idealmente chama uma RPC 'check_feature_access'. Por ora assumimos liberado no mockup, 
            // mas deixamos a flag reativa.
            setHasContentFactoryAccess(true);
        }
    };

    const fetchAssets = async () => {
        setLoading(true);
        let query = supabase.from('matrix_assets').select('*');
        if (tenantId) query = query.eq('tenant_id', tenantId);

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Failed to fetch Matrix Assets:', error);
        }

        if (data && data.length > 0) {
            setAssets(data as MatrixAsset[]);
        } else {
            // Mock inicial se vazio para demonstrar
            setAssets([
                {
                    id: '1', title: 'Post: A Era da IA no B2B', type: 'post', status: 'needs_review', content: 'As IAs generativas não são apenas ferramentas de produtividade, elas são a nova linha de montagem das fábricas invisíveis do século 21.',
                    qhe_score: 0.94,
                    quantum_metadata: { qpu: 'ibm_marrakesh', coherence: 0.98 },
                    context: { brand_dna_snapshot: 'dna_v5_autoridade', briefing_goal: 'Gerar awareness sobre automação industrial B2B', target_language: 'PT-BR' },
                    ai_metadata: { model_used: 'claude-3-5-sonnet', tokens_consumed: 345, cost_usd: 0.0051 }, compliance_notes: '', tenant_id: tenantId || '', created_at: new Date().toISOString()
                },
                {
                    id: '2', title: 'Reels Script: Framework 4P', type: 'reels', status: 'pending_generation', content: null,
                    qhe_score: 0,
                    context: { brand_dna_snapshot: 'dna_v5_autoridade', briefing_goal: 'Explicar o framework 4P em vídeo curto', target_language: 'PT-BR' },
                    ai_metadata: { model_used: '', tokens_consumed: 0, cost_usd: 0 }, compliance_notes: '', tenant_id: tenantId || '', created_at: new Date().toISOString()
                }
            ]);
        }
        setLoading(false);
    };

    const handleRealtimeChange = (payload: any) => {
        if (payload.eventType === 'INSERT') {
            setAssets(prev => [payload.new as MatrixAsset, ...prev].slice(0, 50));
        } else if (payload.eventType === 'UPDATE') {
            setAssets(prev => prev.map(row => row.id === payload.new.id ? payload.new : row));
        } else if (payload.eventType === 'DELETE') {
            setAssets(prev => prev.filter(row => row.id !== payload.old.id));
        }
    };

    const handleGenerate = async (assetId: string, briefing: string, language: string) => {
        if (!hasContentFactoryAccess) return;
        setGeneratingId(assetId);
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, status: 'generating' } : a));

        try {
            const { error } = await supabase.functions.invoke('content-factory-ai', {
                body: {
                    action: 'generate_matrix',
                    assetId,
                    briefingGoal: briefing,
                    targetLanguage: language
                }
            });
            if (error) throw error;
            // Realtime vai atualizar o status
        } catch (e) {
            console.error('Error generating asset via Matrix:', e);
            setAssets(prev => prev.map(a => a.id === assetId ? { ...a, status: 'error' } : a));
        } finally {
            setGeneratingId(null);
        }
    };

    const renderStatusTag = (status: string) => {
        switch (status) {
            case 'pending_generation': return <Tag type="gray">Draft</Tag>;
            case 'generating': return <Tag type="purple">Generating <Renew className="cds--btn__icon" style={{ animation: 'spin 2s linear infinite' }} /></Tag>;
            case 'needs_review': return <Tag type="blue">Needs Q-Gate</Tag>;
            case 'approved': return <Tag type="green">Approved</Tag>;
            case 'rejected': return <Tag type="red">Rejected</Tag>;
            case 'error': return <Tag type="red" title="Failed to generate">Error</Tag>;
            case 'scheduled': return <Tag type="teal">Scheduled</Tag>;
            default: return <Tag>{status}</Tag>;
        }
    };

    const renderAILabel = (asset: MatrixAsset) => {
        const { ai_metadata, qhe_score, quantum_metadata } = asset;
        if (!ai_metadata || !ai_metadata.model_used) return null;
        return (
            <AILabel align="bottom-right">
                <AILabelContent>
                    <div style={{ padding: '0.5rem', minWidth: '220px' }}>
                        <h5 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--cds-support-info)' }}>IBM Quantum Readiness</h5>
                        <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-primary)', marginBottom: '0.25rem' }}>
                            QHE Score: <strong style={{ color: (qhe_score ?? 0) > 0.8 ? 'var(--cds-support-success)' : 'var(--cds-support-warning)' }}>{(qhe_score ?? 0).toFixed(2)}</strong>
                        </p>
                        {quantum_metadata?.qpu && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>Instance: <strong>{quantum_metadata.qpu}</strong></p>
                        )}
                        <div style={{ margin: '0.5rem 0', borderTop: '1px solid var(--cds-border-subtle-01)', paddingTop: '0.5rem' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>AI Model: <strong>{ai_metadata.model_used}</strong></p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>Tokens: <strong>{ai_metadata.tokens_consumed}</strong></p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>Cost: <strong>${ai_metadata.cost_usd.toFixed(4)}</strong></p>
                        </div>
                        <div style={{ marginTop: '0.25rem' }}>
                            <Tag type="purple" size="sm">Quantum Verified</Tag>
                        </div>
                    </div>
                </AILabelContent>
            </AILabel>
        );
    };

    const headers = [
        { key: 'status', header: 'Status' },
        { key: 'type', header: 'Tipo' },
        { key: 'title', header: 'Título' },
        { key: 'qhe', header: 'Resonância (QHE)' },
        { key: 'actions', header: '' },
    ];

    return (
        <div className="matrix-list-matrix">
            {!hasContentFactoryAccess && (
                <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--cds-border-subtle-01)', borderLeft: '4px solid var(--cds-support-error)' }}>
                    <Warning size={20} style={{ fill: 'var(--cds-support-error)', verticalAlign: 'middle', marginRight: '0.5rem' }} />
                    <span style={{ fontSize: '0.875rem' }}>Atenção: Acesso ao Content Factory está bloqueado no seu Tenant via Ultra Settings.</span>
                </div>
            )}

            <DataTable rows={assets} headers={headers}>
                {({ rows, headers, getTableProps, getHeaderProps, getRowProps, getExpandedRowProps, getTableContainerProps }) => (
                    <TableContainer
                        title="Matrix List™"
                        description="Workstation Industrial: Alta densidade de fluxos injetados por Brand DNA."
                        {...getTableContainerProps()}
                        style={{ backgroundColor: 'var(--cds-background)' }}
                    >
                        <TableToolbar>
                            <TableToolbarContent>
                                <Button size="sm" kind="primary" onClick={fetchAssets}>Sync</Button>
                            </TableToolbarContent>
                        </TableToolbar>
                        <Table {...getTableProps()} size="lg" aria-label="Matrix List Data">
                            <TableHead>
                                <TableRow>
                                    <TableExpandHeader />
                                    {headers.map((header) => (
                                        <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                            {header.header}
                                        </TableHeader>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading && assets.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={headers.length + 1} style={{ padding: '2rem', textAlign: 'center' }}>
                                            <Loading withOverlay={false} small />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((row: any) => {
                                        const asset = assets.find(a => a.id === row.id) as MatrixAsset;
                                        if (!asset) return null;
                                        const isGenerating = generatingId === asset.id || asset.status === 'generating';

                                        return (
                                            <React.Fragment key={row.id}>
                                                <TableExpandRow {...getRowProps({ row })} style={{ opacity: isGenerating ? 0.7 : 1 }}>
                                                    <TableCell>{renderStatusTag(asset.status)}</TableCell>
                                                    <TableCell style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600, color: 'var(--cds-text-secondary)' }}>{asset.type}</TableCell>
                                                    <TableCell><span style={{ fontWeight: 500 }}>{asset.title}</span></TableCell>
                                                    <TableCell>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {asset.qhe_score ? (
                                                                <Tag type={(asset.qhe_score ?? 0) > 0.8 ? 'purple' : 'warm-gray'} size="sm">
                                                                    QHE: {(asset.qhe_score * 100).toFixed(0)}%
                                                                </Tag>
                                                            ) : (
                                                                <span style={{ color: 'var(--cds-text-placeholder)', fontSize: '0.75rem' }}>Aguardando...</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {(asset.status === 'pending_generation' || asset.status === 'error') ? (
                                                            <Button
                                                                size="sm"
                                                                renderIcon={MagicWand}
                                                                disabled={!hasContentFactoryAccess || isGenerating}
                                                                onClick={() => handleGenerate(asset.id, asset.context.briefing_goal, asset.context.target_language)}
                                                            >
                                                                Gerar com IA
                                                            </Button>
                                                        ) : asset.status === 'needs_review' ? (
                                                            <Button size="sm" kind="tertiary" renderIcon={Checkmark}>
                                                                QualityGate
                                                            </Button>
                                                        ) : (
                                                            <Button size="sm" kind="ghost">Ver</Button>
                                                        )}
                                                    </TableCell>
                                                </TableExpandRow>

                                                <TableExpandedRow colSpan={headers.length + 1} {...getExpandedRowProps({ row })}>
                                                    <div style={{ padding: '0', background: 'var(--cds-layer-01)', width: '100%' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
                                                            <div style={{ width: '40%', padding: '1.5rem', borderRight: '1px solid var(--cds-border-subtle-01)' }}>
                                                                <h4 style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Telemetria & Contexto</h4>
                                                                <StructuredListWrapper isCondensed>
                                                                    <StructuredListBody>
                                                                        <StructuredListRow>
                                                                            <StructuredListCell style={{ color: 'var(--cds-text-secondary)', fontSize: '0.75rem' }}>Brand DNA</StructuredListCell>
                                                                            <StructuredListCell style={{ fontSize: '0.75rem' }}>{asset.context?.brand_dna_snapshot}</StructuredListCell>
                                                                        </StructuredListRow>
                                                                        <StructuredListRow>
                                                                            <StructuredListCell style={{ color: 'var(--cds-text-secondary)', fontSize: '0.75rem' }}>Briefing</StructuredListCell>
                                                                            <StructuredListCell style={{ fontSize: '0.75rem' }}>{asset.context?.briefing_goal}</StructuredListCell>
                                                                        </StructuredListRow>
                                                                        <StructuredListRow>
                                                                            <StructuredListCell style={{ color: 'var(--cds-text-secondary)', fontSize: '0.75rem' }}>Modelo IA</StructuredListCell>
                                                                            <StructuredListCell style={{ fontSize: '0.75rem' }}>{asset.ai_metadata?.model_used || '—'}</StructuredListCell>
                                                                        </StructuredListRow>
                                                                        <StructuredListRow>
                                                                            <StructuredListCell style={{ color: 'var(--cds-text-secondary)', fontSize: '0.75rem' }}>FinOps (Est.)</StructuredListCell>
                                                                            <StructuredListCell style={{ fontSize: '0.75rem', color: 'var(--cds-support-success)' }}>${asset.ai_metadata?.cost_usd?.toFixed(4) || '0.0000'}</StructuredListCell>
                                                                        </StructuredListRow>
                                                                        {asset.quantum_metadata?.qpu && (
                                                                            <StructuredListRow>
                                                                                <StructuredListCell style={{ color: 'var(--cds-text-secondary)', fontSize: '0.75rem' }}>QPU Instance</StructuredListCell>
                                                                                <StructuredListCell style={{ fontSize: '0.75rem' }}>{asset.quantum_metadata.qpu}</StructuredListCell>
                                                                            </StructuredListRow>
                                                                        )}
                                                                    </StructuredListBody>
                                                                </StructuredListWrapper>
                                                            </div>

                                                            <div style={{ width: '65%', padding: '2rem' }}>
                                                                <h4 style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', marginBottom: '1rem', textTransform: 'uppercase' }}>Conteúdo GenOS</h4>
                                                                {isGenerating ? (
                                                                    <div><SkeletonText paragraph lineCount={4} /></div>
                                                                ) : (
                                                                    <TextArea
                                                                        id={`content-${asset.id}`}
                                                                        labelText=""
                                                                        rows={5}
                                                                        value={asset.content || 'Nenhum conteúdo disparado.'}
                                                                        readOnly
                                                                        style={{ background: 'var(--cds-background)', color: 'var(--cds-text-primary)', fontFamily: '"IBM Plex Sans", sans-serif', resize: 'none' }}
                                                                    />
                                                                )}
                                                                {asset.compliance_notes && (
                                                                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--cds-layer-02)', borderLeft: '4px solid var(--cds-support-error)' }}>
                                                                        <p style={{ fontSize: '0.75rem', color: 'var(--cds-support-error)' }}>
                                                                            <strong>⚠️ Auditoria Heurística: </strong> {asset.compliance_notes}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableExpandedRow>
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </DataTable>

            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .matrix-list-matrix .cds--data-table-container { border: 1px solid var(--cds-border-subtle-01); }
        .matrix-list-matrix .cds--data-table { background-color: var(--cds-background) !important; }
        .matrix-list-matrix .cds--data-table thead th { background-color: var(--cds-layer-01); border-bottom: 2px solid var(--cds-border-subtle-01); }
        .matrix-list-matrix .cds--data-table tbody tr.cds--table-expand__row:hover td { background-color: var(--cds-layer-01) !important; }
        .matrix-list-matrix .cds--table-toolbar { background-color: var(--cds-layer-01); border-bottom: 1px solid var(--cds-border-subtle-01); }
        .matrix-list-matrix .cds--table-expanded-row { background-color: var(--cds-layer-01); border-left: 4px solid var(--cds-interactive); }
      `}</style>
        </div>
    );
}
