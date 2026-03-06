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
    Button,
    Tag,
    Modal,
    TextArea,
    Grid,
    Column,
    Loading
} from '@carbon/react';
import { Checkmark, Error, Edit, Warning } from '@carbon/icons-react';
import { supabase } from '@/services/supabase';
import { api } from '@/services/api';

interface MatrixAsset {
    id: string;
    title: string;
    type: string;
    status: string;
    content: string | null;
    compliance_notes: string;
    context: {
        brand_dna_snapshot: string;
        briefing_goal: string;
        target_language: string;
    };
    created_at: string;
}

export default function QualityGate() {
    const [items, setItems] = useState<MatrixAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAsset, setSelectedAsset] = useState<MatrixAsset | null>(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [editedContent, setEditedContent] = useState('');
    const tenantId = api.getActiveTenantId();

    useEffect(() => {
        fetchReviewQueue();

        if (!tenantId) return;

        const channel = supabase
            .channel('quality_gate_realtime')
            .on('postgres_changes' as any, {
                event: '*',
                schema: 'public',
                table: 'matrix_assets',
                filter: `tenant_id=eq.${tenantId}`
            }, (payload: any) => {
                // Only care about transitions in/out of 'needs_review'
                fetchReviewQueue();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenantId]);

    const fetchReviewQueue = async () => {
        setLoading(true);
        let query = supabase
            .from('matrix_assets')
            .select('*')
            .eq('status', 'needs_review')
            .order('created_at', { ascending: false });

        if (tenantId) query = query.eq('tenant_id', tenantId);

        const { data, error } = await query;

        if (error) {
            console.error('Failed to fetch QualityGate queue:', error);
        }

        if (data && data.length > 0) {
            setItems(data as MatrixAsset[]);
        } else {
            // Mock data for display when empty
            setItems([
                {
                    id: 'q1', title: 'Carrossel: Segurança Cloud', type: 'carousel', status: 'needs_review',
                    content: 'A segurança na nuvem é importante. [Slide 2] Não deixe suas portas abertas para hackers.',
                    compliance_notes: '⚠️ Q-Score: 65/100. Violations: Tom informal demais para B2B. Suggested edits: Substituir "hackers" por "ameaças cibernéticas".',
                    context: { brand_dna_snapshot: 'dna_v5_autoridade', briefing_goal: 'Alertar C-Levels sobre Security Posture', target_language: 'PT-BR' },
                    created_at: new Date().toISOString()
                }
            ]);
        }
        setLoading(false);
    };

    const handleOpenReview = (asset: MatrixAsset) => {
        setSelectedAsset(asset);
        setEditedContent(asset.content || '');
        setIsReviewModalOpen(true);
    };

    const handleCloseReview = () => {
        setSelectedAsset(null);
        setEditedContent('');
        setIsReviewModalOpen(false);
    };

    const submitReview = async (newStatus: 'approved' | 'rejected') => {
        if (!selectedAsset) return;

        try {
            const { error } = await supabase
                .from('matrix_assets')
                .update({
                    status: newStatus,
                    content: editedContent // Salva edições feitas na curadoria
                })
                .eq('id', selectedAsset.id);

            if (error) throw error;

            setIsReviewModalOpen(false);
            fetchReviewQueue();
        } catch (e) {
            console.error('Error submitting review:', e);
        }
    };

    const renderComplianceTag = (notes: string) => {
        if (!notes) return <Tag type="gray">N/A</Tag>;
        if (notes.includes('Violations:')) return <Tag type="red" title={notes}>⚠️ Critical Risks</Tag>;
        if (notes.includes('Q-Score:')) {
            const scoreMatch = notes.match(/Q-Score: (\d+)/);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
            if (score >= 90) return <Tag type="green">Score: {score}</Tag>;
            if (score >= 70) return <Tag type="magenta">Score: {score}</Tag>;
            return <Tag type="red">Score: {score}</Tag>;
        }
        return <Tag type="blue">Audited</Tag>;
    };

    const headers = [
        { key: 'title', header: 'Ativo' },
        { key: 'type', header: 'Tipo' },
        { key: 'compliance', header: 'Compliance (AI Auditor)' },
        { key: 'actions', header: 'Ações de Curadoria' },
    ];

    return (
        <div className="quality-gate-container" style={{ padding: '2rem', background: '#161616', color: '#f4f4f4', minHeight: '100vh', fontFamily: '"IBM Plex Sans", sans-serif' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 600 }}>QualityGate™</h2>
                <p style={{ color: '#c6c6c6', marginTop: '0.5rem' }}>Fila de Curadoria Human-in-the-Loop. Revise e aprove o conteúdo filtrado pela heurística.</p>
            </div>

            <DataTable rows={items} headers={headers}>
                {({ rows, headers, getTableProps, getHeaderProps, getRowProps, getTableContainerProps }) => (
                    <TableContainer
                        title="Review Queue"
                        description="Ativos com status 'needs_review'"
                        {...getTableContainerProps()}
                        style={{ backgroundColor: '#161616' }}
                    >
                        <TableToolbar>
                            <TableToolbarContent>
                                <Button size="sm" kind="primary" onClick={fetchReviewQueue}>Refresh Queue</Button>
                            </TableToolbarContent>
                        </TableToolbar>
                        <Table {...getTableProps()} size="lg">
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
                                {loading && items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={headers.length} style={{ padding: '2rem', textAlign: 'center' }}>
                                            <Loading withOverlay={false} small />
                                        </TableCell>
                                    </TableRow>
                                ) : items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={headers.length} style={{ padding: '2rem', textAlign: 'center', color: '#a8a8a8' }}>
                                            <Checkmark size={24} style={{ fill: '#24a148', marginBottom: '0.5rem' }} />
                                            <p>Fila zerada. Todos os ativos foram processados.</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((row: any) => {
                                        const asset = items.find(a => a.id === row.id) as MatrixAsset;
                                        if (!asset) return null;

                                        return (
                                            <TableRow {...getRowProps({ row })} key={row.id}>
                                                <TableCell><span style={{ fontFamily: '"IBM Plex Mono", monospace' }}>{asset.title}</span></TableCell>
                                                <TableCell style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600 }}>{asset.type}</TableCell>
                                                <TableCell>{renderComplianceTag(asset.compliance_notes)}</TableCell>
                                                <TableCell>
                                                    <Button size="sm" kind="secondary" renderIcon={Edit} onClick={() => handleOpenReview(asset)}>
                                                        Revisar
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </DataTable>

            {/* Audit Modal */}
            {selectedAsset && (
                <Modal
                    open={isReviewModalOpen}
                    preventCloseOnClickOutside
                    onRequestClose={handleCloseReview}
                    modalHeading={`Auditoria: ${selectedAsset.title}`}
                    modalLabel="QualityGate™ Review"
                    primaryButtonText="Aprovar Ativo"
                    secondaryButtonText="Rejeitar"
                    onSecondarySubmit={() => submitReview('rejected')}
                    onRequestSubmit={() => submitReview('approved')}
                    danger={selectedAsset.compliance_notes?.includes('Violations:')}
                    size="lg"
                    className="qgate-modal"
                >
                    <div style={{ marginBottom: '1.5rem', background: '#262626', padding: '1rem', borderLeft: '4px solid #f1c21b' }}>
                        <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#c6c6c6', marginBottom: '0.25rem' }}>Briefing Goal</p>
                        <p style={{ fontSize: '0.875rem' }}>{selectedAsset.context.briefing_goal}</p>
                    </div>

                    <Grid condensed>
                        <Column sm={4} md={8} lg={8} style={{ paddingRight: '1rem', borderRight: '1px solid #393939' }}>
                            <h5 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Conteúdo GenOS (Editável)</h5>
                            <TextArea
                                id="edit-content"
                                labelText="Edite livremente antes de aprovar"
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                rows={12}
                                style={{ background: '#161616', color: '#f4f4f4', fontFamily: '"IBM Plex Sans", sans-serif' }}
                            />
                        </Column>
                        <Column sm={4} md={4} lg={8} style={{ paddingLeft: '1rem' }}>
                            <h5 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Notas do Copilot Auditor</h5>
                            {selectedAsset.compliance_notes ? (
                                <div style={{ padding: '1rem', background: selectedAsset.compliance_notes.includes('Violations:') ? '#331e21' : '#1c2124', borderLeft: `4px solid ${selectedAsset.compliance_notes.includes('Violations:') ? '#da1e28' : '#0f62fe'}` }}>
                                    <p style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
                                        {selectedAsset.compliance_notes}
                                    </p>
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.875rem', color: '#a8a8a8' }}>Nenhuma nota de auditoria.</p>
                            )}

                            <div style={{ marginTop: '2rem' }}>
                                <p style={{ fontSize: '0.75rem', color: '#8d8d8d' }}>
                                    Aprovar este ativo o moverá para o status <strong style={{ color: '#24a148' }}>approved</strong>, autorizando sua distribuição (Social Hub).
                                </p>
                            </div>
                        </Column>
                    </Grid>
                </Modal>
            )}

            <style>{`
        .quality-gate-container .cds--data-table-container { border: 1px solid #393939; }
        .quality-gate-container .cds--data-table { background-color: #161616 !important; }
        .quality-gate-container .cds--data-table thead th { background-color: #262626; border-bottom: 2px solid #393939; }
        .quality-gate-container .cds--table-toolbar { background-color: #262626; border-bottom: 1px solid #393939; }
        .qgate-modal .cds--modal-container { background-color: #161616; color: #f4f4f4; border: 1px solid #393939; }
        .qgate-modal .cds--modal-header { background-color: #262626; }
      `}</style>
        </div>
    );
}
