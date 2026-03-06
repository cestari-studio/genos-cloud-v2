import React, { useState, useEffect } from 'react';
import {
    DataTable,
    Table,
    TableHead,
    TableRow,
    TableHeader,
    TableBody,
    TableCell,
    TableExpandHeader,
    TableExpandRow,
    TableExpandedRow,
    Toggle,
    Tooltip,
    AILabel,
    SkeletonText,
    Button
} from '@carbon/react';
import { supabase } from '@/services/supabase';

interface Feature {
    id: string;
    slug: string;
    name: string;
    description: string;
    category: string;
    is_beta: boolean;
    parent_feature_id: string | null;
    is_dependency_only: boolean;
    base_cost?: number; // UI metadata for deep tech costs
}

interface FeatureNode extends Feature {
    children: FeatureNode[];
}

export const TierManagement: React.FC = () => {
    const [features, setFeatures] = useState<FeatureNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [masterToggles, setMasterToggles] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadFeatures();
    }, []);

    const buildTree = (data: Feature[]): FeatureNode[] => {
        const map = new Map<string, FeatureNode>();
        const roots: FeatureNode[] = [];

        data.forEach(item => {
            map.set(item.id, { ...item, children: [] });
        });

        data.forEach(item => {
            if (item.parent_feature_id) {
                const parent = map.get(item.parent_feature_id);
                if (parent) {
                    parent.children.push(map.get(item.id)!);
                }
            } else {
                roots.push(map.get(item.id)!);
            }
        });

        return roots;
    };

    const loadFeatures = async () => {
        setLoading(true);
        // Em um cenário real, o master consultaria a tabela agency_features_config filtrada por agência.
        // Aqui listamos o catálogo inteiro com um toggle local para simular o "Master View".

        // Fallback data para visualização enquanto a migração não povoa a tabela.
        const mockToggled: Record<string, boolean> = {};

        const { data, error } = await supabase.from('genos_features_catalog').select('*');
        let dbData: Feature[] = data || [];

        if (error || dbData.length === 0) {
            dbData = [
                { id: '1', slug: 'content-factory', name: 'Content Factory™', description: 'Motor de Geração de Conteúdo', category: 'AI', is_beta: false, parent_feature_id: null, is_dependency_only: false },
                { id: '2', slug: 'brand-dna', name: 'Brand DNA™', description: 'Engine de Identidade Semântica', category: 'Core', is_beta: false, parent_feature_id: '1', is_dependency_only: true },
                { id: '3', slug: 'scheduler', name: 'Scheduler Hub', description: 'Logística e Publicação', category: 'Ops', is_beta: false, parent_feature_id: null, is_dependency_only: false },
                { id: '4', slug: 'quantum-pulse', name: 'Quantum Pulse', description: 'Simulação de Heurística Avançada via Qiskit', category: 'Quantum', is_beta: true, parent_feature_id: '1', is_dependency_only: false, base_cost: 0.15 },
                { id: '5', slug: 'watson-analytics', name: 'Watson Analytics', description: 'NLP de Sentimento e Extração', category: 'Deep Tech', is_beta: true, parent_feature_id: null, is_dependency_only: false, base_cost: 0.08 },
            ];
        }

        dbData.forEach(f => mockToggled[f.id] = false); // All off by default
        setMasterToggles(mockToggled);

        const tree = buildTree(dbData);
        setFeatures(tree);
        setLoading(false);
    };

    // Lógica recursiva: useFeatureManager concept
    const handleToggle = (node: FeatureNode, newState: boolean) => {
        const updated = { ...masterToggles, [node.id]: newState };

        // Cascata Inteligente
        if (newState) {
            // Ativar pai obrigatoriamente ativa Core Dependencies filhas
            node.children.forEach(child => {
                if (child.is_dependency_only) {
                    updated[child.id] = true;
                }
            });
        } else {
            // Desativar pai desativa Core Dependencies filhas (simplificação pro demo)
            node.children.forEach(child => {
                if (child.is_dependency_only) {
                    updated[child.id] = false;
                }
            });
        }

        setMasterToggles(updated);

        // In a real app, you would batch update 'agency_features_config' here.
    };

    const aILabelProps = (cost: number) => ({
        autoAlign: true,
        size: 'mini' as any,
        labelText: `Cost: $${cost}/call`,
        children: <span>High Value Compute</span>
    });

    if (loading) {
        return (
            <div style={{ padding: '2rem' }}>
                <SkeletonText heading width="30%" />
                <SkeletonText paragraph lineCount={5} />
            </div>
        );
    }

    const headers = [
        { key: 'name', header: 'Produto / Serviço' },
        { key: 'category', header: 'Categoria' },
        { key: 'deep_tech', header: 'Premium Engine' },
        { key: 'status', header: 'Status Master' }
    ];

    return (
        <div className="tier-management-container" style={{ padding: '2rem', background: '#161616', color: '#f4f4f4', minHeight: '100vh' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.5px' }}>Ultra Settings</h2>
                <p style={{ color: '#c6c6c6', marginTop: '0.5rem' }}>Gestão Granular de Tiers, Dependências e Custos de IAs (Master View).</p>
            </div>

            <DataTable rows={features} headers={headers}>
                {({ rows, headers, getTableProps, getHeaderProps, getRowProps, getExpandedRowProps }) => (
                    <Table {...getTableProps()} size="lg" className="gs100-table">
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
                            {rows.map((row: any) => {
                                const node = features.find(f => f.id === row.id) as FeatureNode;
                                if (!node) return null;

                                const isParentActive = masterToggles[node.id];

                                return (
                                    <React.Fragment key={row.id}>
                                        <TableExpandRow {...getRowProps({ row })} isExpanded={node.children.length > 0}>
                                            <TableCell>
                                                <strong style={{ fontSize: '1rem' }}>{node.name}</strong>
                                                {node.is_beta && <span style={{ marginLeft: '0.5rem', background: '#393939', padding: '2px 6px', fontSize: '0.75rem', borderRadius: '4px' }}>BETA</span>}
                                                <div style={{ fontSize: '0.875rem', color: '#a8a8a8', marginTop: '4px' }}>{node.description}</div>
                                            </TableCell>
                                            <TableCell>{node.category}</TableCell>
                                            <TableCell>
                                                {node.base_cost ? <AILabel {...aILabelProps(node.base_cost)} /> : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Toggle
                                                    id={`toggle-${node.id}`}
                                                    aria-label={`Toggle ${node.name}`}
                                                    toggled={masterToggles[node.id]}
                                                    onToggle={(checked: boolean) => handleToggle(node, checked)}
                                                    size="sm"
                                                />
                                            </TableCell>
                                        </TableExpandRow>

                                        {/* Render Children (Sub-serviços e Dependências) */}
                                        {node.children.length > 0 && (
                                            <TableExpandedRow colSpan={headers.length + 1} {...getExpandedRowProps({ row })}>
                                                <div style={{ padding: '1rem 2rem 1rem 4rem', background: '#262626' }}>
                                                    <h4 style={{ fontSize: '0.875rem', marginBottom: '1rem', color: '#c6c6c6' }}>Braços e Dependências</h4>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                        {node.children.map(child => (
                                                            <div key={child.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #393939' }}>
                                                                <div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                        <span style={{ fontWeight: 500 }}>{child.name}</span>
                                                                        {child.is_dependency_only && <span style={{ fontSize: '0.75rem', color: '#fff', background: '#0f62fe', padding: '2px 6px', borderRadius: '4px' }}>CORE</span>}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#a8a8a8' }}>{child.description}</div>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                                    {child.base_cost && <AILabel {...aILabelProps(child.base_cost)} />}
                                                                    {child.is_dependency_only ? (
                                                                        <Tooltip align="bottom" label={`Ativado automaticamente pelo nó pai (${node.name}).`}>
                                                                            <Toggle
                                                                                id={`toggle-child-${child.id}`}
                                                                                aria-label={`Toggle Core ${child.name}`}
                                                                                toggled={masterToggles[child.id]}
                                                                                readOnly
                                                                                size="sm"
                                                                                labelA="Requerido"
                                                                                labelB="Ativo via Pai"
                                                                            />
                                                                        </Tooltip>
                                                                    ) : (
                                                                        <Toggle
                                                                            id={`toggle-child-${child.id}`}
                                                                            aria-label={`Toggle ${child.name}`}
                                                                            toggled={masterToggles[child.id]}
                                                                            onToggle={(checked: boolean) => handleToggle(child, checked)}
                                                                            size="sm"
                                                                            disabled={!isParentActive} // Only add-ons require parent active to be manipulated
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </TableExpandedRow>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </DataTable>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <Button>Aplicar Políticas de Permissão</Button>
            </div>
        </div>
    );
};
