import React, { useState, useEffect } from 'react';
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
    AILabel,
    AILabelContent,
    TableExpandedRow,
    TableExpandHeader,
    TableExpandRow,
    TableSlugRow,
    FluidForm,
    TextInput,
    TextArea,
    Modal,
    Select,
    SelectItem,
    InlineLoading,
    OverflowMenu,
    OverflowMenuItem,
} from '@carbon/react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { Play, CheckmarkOutline, Restart, View } from '@carbon/icons-react';

// Interfaces for our Content Items mapped to the DataTable format
interface PostRow {
    id: string;
    name: string;
    type: string;
    date: string;
    status: string;
    complianceScore: number;
    heuristics: string | null;
    content: {
        title: string;
        body: string;
    };
    coverImage?: string;
    isRegenerating?: boolean;
}

const headers = [
    { key: 'name', header: 'Post Name' },
    { key: 'type', header: 'Format' },
    { key: 'date', header: 'Scheduled Date' },
    { key: 'status', header: 'Status' },
    { key: 'complianceScore', header: 'Compliance' },
    { key: 'actions', header: '' }, // New column for OverflowMenu
];

export default function MatrixList() {
    const { tenant, wallet, isPayPerUse, activeApp } = useAuth();
    const [posts, setPosts] = useState<PostRow[]>([]);
    const [loading, setLoading] = useState(true);

    // Selected state for Modal and Heuristics
    const [activeItem, setActiveItem] = useState<PostRow | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // New Post Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newPostTopic, setNewPostTopic] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const fetchPosts = async () => {
        if (!tenant?.id) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('content_items')
                .select('*')
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedPosts: PostRow[] = (data || []).map((item: any) => ({
                id: item.id,
                name: item.name || 'Untitled Post',
                type: item.type || 'Social Post',
                date: item.scheduled_at ? new Date(item.scheduled_at).toLocaleDateString() : 'N/A',
                status: item.status || 'Draft',
                complianceScore: item.quality_score || 0,
                heuristics: item.heuristics || '',
                content: {
                    title: item.title || '',
                    body: item.body || '',
                },
                coverImage: item.media_url || '',
                isRegenerating: item.status === 'Generating...',
            }));

            setPosts(mappedPosts);
        } catch (error: any) {
            console.error('genOS ContentFactory: Supabase fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPosts();

        // Realtime Subscription
        const channel = supabase
            .channel('content_items_changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'content_items', filter: `tenant_id=eq.${tenant?.id}` },
                () => {
                    fetchPosts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenant?.id]);

    const handleRegenerate = async (id: string, feedback?: string) => {
        // Optimistic UI update
        setPosts(r => r.map(post => post.id === id ? { ...post, isRegenerating: true, status: 'Generating...' } : post));
        setIsModalOpen(false);

        try {
            const { error } = await supabase.functions.invoke('ai-router', {
                body: { postId: id, action: 'regenerate', feedback }
            });

            if (error) throw error;
        } catch (error) {
            console.error("Regeneration Failed", error);
            fetchPosts();
        }
    };

    const handleCreatePost = async () => {
        if (!newPostTopic.trim() || !tenant?.id) return;

        setIsCreating(true);
        try {
            const { error } = await supabase.functions.invoke('content-generator', {
                body: { topic: newPostTopic, tenantId: tenant.id }
            });

            if (error) throw error;
            setIsCreateModalOpen(false);
            setNewPostTopic('');
        } catch (error) {
            console.error("Creation Failed", error);
        } finally {
            setIsCreating(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': return 'green';
            case 'Needs Revision': return 'red';
            case 'Generating...': return 'blue';
            default: return 'gray';
        }
    };

    if (loading) return <div style={{ padding: '2rem' }}><InlineLoading description="Carregando Console do Content Factory..." /></div>;

    return (
        <div style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* Wallet Status Header */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                {isPayPerUse ? (
                    <AILabel className="pay-per-use-warning">
                        Você está operando em modo Overage. Cobranças serão adicionadas à próxima fatura.
                    </AILabel>
                ) : (
                    <Tag type="green" title="Créditos Pré-Pagos">
                        Créditos Disponíveis: {wallet?.credits || 0}
                    </Tag>
                )}
            </div>

            <DataTable rows={posts} headers={headers}>
                {({
                    rows,
                    headers,
                    getHeaderProps,
                    getRowProps,
                    getTableProps,
                    getToolbarProps,
                    onInputChange,
                }) => (
                    <TableContainer title="Content Factory - Matrix List" description={`Operando no App: ${activeApp} | Workspace: ${tenant?.name}`}>
                        <TableToolbar {...getToolbarProps()}>
                            <TableToolbarContent>
                                <TableToolbarSearch onChange={(e) => onInputChange(e as any)} persistent />
                                <Button onClick={() => setIsCreateModalOpen(true)}>Novo Post</Button>
                            </TableToolbarContent>
                        </TableToolbar>

                        <Table {...getTableProps()} className="matrix-list-table">
                            <TableHead>
                                <TableRow>
                                    <TableExpandHeader />
                                    {headers.map((header) => {
                                        const { key, ...headerProps } = getHeaderProps({ header });
                                        return (
                                            <TableHeader key={key} {...headerProps}>
                                                {header.header}
                                            </TableHeader>
                                        );
                                    })}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.map((row) => {
                                    const dataRow = row as any;
                                    const originalState = posts.find(p => p.id === row.id) as unknown as PostRow;
                                    const isRegen = originalState?.isRegenerating;

                                    return (
                                        <React.Fragment key={row.id}>
                                            <TableExpandRow
                                                {...(function () {
                                                    const { key, ...rest } = getRowProps({ row });
                                                    return rest;
                                                })()}
                                                className={isRegen ? 'ai-glow-row disabled-row' : ''}
                                                key={row.id}
                                            >
                                                <TableSlugRow slug={
                                                    <AILabel size="xs">
                                                        <AILabelContent>
                                                            <div>
                                                                <p className="secondary">AI Validated</p>
                                                                <h2 className="ai-label-heading">{originalState?.complianceScore}%</h2>
                                                                <p className="secondary bold">Score de Compliance</p>
                                                                <p className="secondary">{originalState?.heuristics || "Validação em tempo real do MasterCompliance."}</p>
                                                            </div>
                                                        </AILabelContent>
                                                    </AILabel>
                                                } />
                                                {row.cells.map((cell) => {
                                                    if (cell.info.header === 'status') {
                                                        return (
                                                            <TableCell key={cell.id}>
                                                                <Tag type={getStatusColor(cell.value)}>{isRegen ? 'AI Generating...' : cell.value}</Tag>
                                                            </TableCell>
                                                        );
                                                    }
                                                    if (cell.info.header === 'complianceScore') {
                                                        return (
                                                            <TableCell key={cell.id}>
                                                                {cell.value}%
                                                            </TableCell>
                                                        )
                                                    }
                                                    if (cell.info.header === 'actions') {
                                                        return (
                                                            <TableCell key={cell.id}>
                                                                <OverflowMenu flipped aria-label="Ações do Post" iconDescription="Ações do Post" disabled={isRegen}>
                                                                    <OverflowMenuItem itemText="Visualizar Post" onClick={() => console.log('Visualizar:', row.id)} />
                                                                    <OverflowMenuItem itemText="Editar Post" />
                                                                    <OverflowMenuItem itemText="Excluir" isDelete hasDivider />
                                                                </OverflowMenu>
                                                            </TableCell>
                                                        )
                                                    }
                                                    return <TableCell key={cell.id}>{cell.value}</TableCell>;
                                                })}
                                            </TableExpandRow>

                                            {/* Expanded Workstation */}
                                            <TableExpandedRow colSpan={headers.length + 1} className="workstation-expanded-row">
                                                <div style={{ display: 'flex', gap: '2rem', padding: '1rem', backgroundColor: 'var(--cds-layer-01)' }}>

                                                    <div style={{ flex: '0 0 300px', height: '200px', backgroundColor: '#393939', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                                        {originalState?.coverImage ? (
                                                            <img
                                                                src={originalState.coverImage}
                                                                alt="Post Cover"
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            />
                                                        ) : (
                                                            <>
                                                                <View size={32} style={{ opacity: 0.5 }} />
                                                                <p style={{ marginLeft: '1rem', opacity: 0.5 }}>Media Asset</p>
                                                            </>
                                                        )}
                                                    </div>

                                                    <div style={{ flex: 1 }}>
                                                        <FluidForm>
                                                            <TextInput
                                                                id={`title-${row.id}`}
                                                                labelText="Título Otimizado"
                                                                value={originalState?.content?.title || ''}
                                                                readOnly
                                                            />
                                                            <TextArea
                                                                id={`body-${row.id}`}
                                                                labelText="Corpo do Post"
                                                                value={originalState?.content?.body || ''}
                                                                rows={5}
                                                                readOnly
                                                            />
                                                        </FluidForm>
                                                        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                                                            <Button
                                                                kind="secondary"
                                                                renderIcon={Restart}
                                                                onClick={() => {
                                                                    setActiveItem(originalState);
                                                                    setIsModalOpen(true);
                                                                }}
                                                                disabled={isRegen}
                                                            >
                                                                Ver Heurística & Regenerar
                                                            </Button>
                                                            <Button renderIcon={CheckmarkOutline} disabled={isRegen}>
                                                                Aprovar Conteúdo
                                                            </Button>
                                                        </div>
                                                    </div>

                                                </div>
                                            </TableExpandedRow>
                                        </React.Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </DataTable>

            {/* Modal Novo Post */}
            <Modal
                open={isCreateModalOpen}
                modalHeading="Gerar Nova Ideia com IA"
                primaryButtonText={isCreating ? "Gerando..." : "Gerar Agora"}
                secondaryButtonText="Cancelar"
                onRequestClose={() => setIsCreateModalOpen(false)}
                onRequestSubmit={handleCreatePost}
                primaryButtonDisabled={isCreating || !newPostTopic.trim()}
            >
                <div style={{ padding: '1rem 0' }}>
                    <p style={{ marginBottom: '1.5rem' }}>O genOS Creative Master irá gerar um post completo (título, texto e heurística) baseado no tema que você sugerir abaixo.</p>
                    <TextArea
                        id="new-post-topic"
                        labelText="Sobre o que será o post?"
                        placeholder="Ex: Lançamento da nova coleção de outono de luxo..."
                        value={newPostTopic}
                        onChange={(e) => setNewPostTopic(e.target.value)}
                        rows={3}
                    />
                    {isCreating && <InlineLoading description="IA processando DNA da Marca e gerando conteúdo..." style={{ marginTop: '1rem' }} />}
                </div>
            </Modal>

            {/* Heuristics Expressive Modal */}
            {activeItem && (
                <Modal
                    open={isModalOpen}
                    preventCloseOnClickOutside
                    modalHeading={`Relatório de Heurística: ${activeItem.name}`}
                    primaryButtonText={isPayPerUse ? "Regenerar (Cobrança Pay-Per-Use)" : "Regenerar com IA"}
                    secondaryButtonText="Cancelar"
                    onRequestSubmit={() => {
                        const feedback = (document.getElementById('client-feedback') as HTMLTextAreaElement)?.value;
                        handleRegenerate(activeItem.id, feedback);
                    }}
                    onRequestClose={() => setIsModalOpen(false)}
                    size="lg"
                    slug={
                        <AILabel className="ai-modal-badge">
                            Análise Baseada no DNA da Marca e Conhecimentos da Atualidade.
                        </AILabel>
                    }
                >
                    <div style={{ paddingBottom: '1rem' }}>
                        <h4 style={{ marginBottom: '1rem' }}>Análise do Agente (genOS)</h4>
                        <p style={{ backgroundColor: 'var(--cds-layer-accent-01)', padding: '1rem', borderRadius: '4px', fontStyle: 'italic', marginBottom: '2rem' }}>
                            "{activeItem.heuristics}"
                        </p>

                        <h4 style={{ marginBottom: '1rem' }}>Feedback do Cliente</h4>
                        <TextArea
                            id="client-feedback"
                            labelText="Instruções para nova geração"
                            placeholder="Ex: Altere o tom para ficar mais agressivo na conversão..."
                            rows={3}
                        />

                        <div style={{ marginTop: '2rem' }}>
                            <Select id="status-select" labelText="Status da Revisão" defaultValue={activeItem.status}>
                                <SelectItem value="Approved" text="Aprovado" />
                                <SelectItem value="Needs Revision" text="Requer Revisão" />
                                <SelectItem value="Rejected" text="Rejeitado" />
                            </Select>
                        </div>

                        {isPayPerUse && (
                            <div style={{ marginTop: '2rem', padding: '1rem', borderLeft: '4px solid var(--cds-support-warning)' }}>
                                <strong>Atenção:</strong> Como sua carteira de créditos pré-pagos está zerada, a regeneração deste texto gerará uma cobrança pay-per-use na próxima fatura (estimada: $0.02 USD).
                            </div>
                        )}
                    </div>
                </Modal>
            )}

        </div>
    );
}
