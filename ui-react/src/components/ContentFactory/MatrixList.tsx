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

    useEffect(() => {
        // Mock data fetch for the module (simulating Supabase connection)
        setTimeout(() => {
            setPosts([
                {
                    id: '1',
                    name: 'Campanha Black Friday',
                    type: 'Carrossel',
                    date: '2026-11-20',
                    status: 'Draft',
                    complianceScore: 85,
                    heuristics: 'O post usa termos da marca, mas o CTA poderia ser mais engajador considerando a sazonalidade e o foco de conversão.',
                    content: { title: 'Chegou a hora', body: 'Confira as nossas ofertas exclusivas.' },
                    coverImage: 'https://images.unsplash.com/photo-1593642532744-d377ab507dc8?q=80&w=400&fit=crop',
                    isRegenerating: false,
                },
                {
                    id: '2',
                    name: 'Lançamento Produto X',
                    type: 'Reel',
                    date: '2026-03-01',
                    status: 'Needs Revision',
                    complianceScore: 60,
                    heuristics: 'Falta energia no tom de voz. Palavras proibidas detectadas (ex: "barato").',
                    content: { title: 'Nova linha!', body: 'Conheça nossos formatos' },
                    coverImage: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=400&fit=crop',
                    isRegenerating: true,
                }
            ]);
            setLoading(false);
        }, 1000);
    }, []);

    const handleRegenerate = async (id: string) => {
        // Set the specific row into regenerating state "glow effect"
        setPosts(r => r.map(post => post.id === id ? { ...post, isRegenerating: true } : post));
        setIsModalOpen(false);

        try {
            // Simulando chamada Serverless (Supabase Edge Function)
            // ex: await supabase.functions.invoke('content-factory-ai-router', { body: { postId: id, tenantId: tenant.id } })
            await new Promise(r => setTimeout(r, 1500));

            // Simulando desconto da carteira
            const costPerToken = 0.02; // AI Router usage calculated cost
            if (isPayPerUse && wallet) {
                wallet.overage += costPerToken;
            } else if (wallet) {
                wallet.credits = Math.max(0, wallet.credits - 150);
            }

            await new Promise(r => setTimeout(r, 2000)); // Tempo restante da "IA" gerando

            setPosts(r => r.map(post => {
                if (post.id === id) {
                    return {
                        ...post,
                        isRegenerating: false,
                        complianceScore: 98,
                        heuristics: `[Edge Function: Success] Regeneração concluída via Cloud Serverless. O tom de voz agora está alinhado com as diretrizes Cestari Studio. Custo debitado: ${isPayPerUse ? '$0.02 USD overage' : '150 tokens'}.`,
                        content: { title: `Novo: ${post.name}`, body: 'Texto regenerado estrategicamente pela AI e validado pelo MasterCompliance.' }
                    }
                }
                return post;
            }));
        } catch (error) {
            console.error("Edge Funtion Falhou", error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': return 'green';
            case 'Needs Revision': return 'red';
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
                                <Button onClick={() => { }}>Novo Post</Button>
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
                                    // Look up our extended state to check for 'isRegenerating'
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
                                                                <Tag type={getStatusColor(cell.value)}>{isRegen ? 'AI Regenerating...' : cell.value}</Tag>
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

                                                    {/* Slider Gallery Placehoder */}
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

                                                    {/* Content TextAreas */}
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

            {/* Heuristics Expressive Modal */}
            {activeItem && (
                <Modal
                    open={isModalOpen}
                    preventCloseOnClickOutside
                    modalHeading={`Relatório de Heurística: ${activeItem.name}`}
                    primaryButtonText={isPayPerUse ? "Regenerar (Cobrança Pay-Per-Use)" : "Regenerar com IA"}
                    secondaryButtonText="Cancelar"
                    onRequestSubmit={() => handleRegenerate(activeItem.id)}
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
