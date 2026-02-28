import React, { useState } from 'react';
import {
    Grid,
    Column,
    Tile,
    Accordion,
    AccordionItem,
    Dropdown,
    TextInput,
    Button,
    Tag,
    StructuredListWrapper,
    StructuredListHead,
    StructuredListRow,
    StructuredListCell,
    StructuredListBody,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    InlineLoading,
    Search,
    Theme
} from '@carbon/react';
import {
    Add,
    PlayOutline,
    Save,
    Data_1,
    Api,
    WatsonHealthAiStatus,
    ArrowRight,
    Draggable,
    TrashCan
} from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';

interface NodeItem {
    id: string;
    type: 'llm' | 'tool' | 'vectordb' | 'trigger';
    name: string;
    config: Record<string, any>;
}

export default function Architect() {
    const [pipeline, setPipeline] = useState<NodeItem[]>([
        { id: 'start-1', type: 'trigger', name: 'HTTP Webhook Trigger', config: { route: '/api/v1/invoke' } },
        { id: 'db-1', type: 'vectordb', name: 'Pinecone Retrieval', config: { index: 'genos-knowledge' } },
        { id: 'llm-1', type: 'llm', name: 'WatsonX Granite Model', config: { temperature: 0.7 } }
    ]);

    const [saving, setSaving] = useState(false);

    const availableNodes = {
        Triggers: [
            { name: 'Cron Schedule', icon: PlayOutline },
            { name: 'HTTP Webhook', icon: Api },
        ],
        Models: [
            { name: 'IBM Granite-13b', icon: WatsonHealthAiStatus },
            { name: 'Meta Llama-3', icon: WatsonHealthAiStatus },
            { name: 'OpenAI GPT-4o', icon: WatsonHealthAiStatus },
        ],
        Databases: [
            { name: 'Milvus Vector', icon: Data_1 },
            { name: 'Pinecone', icon: Data_1 },
        ]
    };

    const handleSave = () => {
        setSaving(true);
        setTimeout(() => setSaving(false), 1500);
    };

    const handleRemoveNode = (id: string) => {
        setPipeline(pipeline.filter(n => n.id !== id));
    };

    return (
        <PageLayout
            title="Agentic Architect"
            subtitle="Canvas visual de componentes de orquestração AI. Construa fluxos ligando LLMs, Banco de Dados e Ferramentas."
        >
            <Theme theme="g100">
                <Grid>
                    {/* Left Sidebar - Available Tools */}
                    <Column lg={4} md={3} sm={4}>
                        <div style={{ backgroundColor: '#161616', padding: '1rem', border: '1px solid #393939', height: 'calc(100vh - 12rem)', overflowY: 'auto' }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <Search size="sm" placeholder="Buscar nodes..." id="search-nodes" labelText="Buscar nodes" />
                            </div>

                            <Accordion align="start" size="lg">
                                <AccordionItem title="Triggers (Entradas)" open>
                                    <StructuredListWrapper selection>
                                        <StructuredListBody>
                                            {availableNodes.Triggers.map((tool, i) => (
                                                <StructuredListRow key={i} tabIndex={0} className="node-draggable">
                                                    <StructuredListCell style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <tool.icon size={20} fill="#0f62fe" />
                                                        <span>{tool.name}</span>
                                                    </StructuredListCell>
                                                    <StructuredListCell>
                                                        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Add} iconDescription="Adicionar ao Canvas" />
                                                    </StructuredListCell>
                                                </StructuredListRow>
                                            ))}
                                        </StructuredListBody>
                                    </StructuredListWrapper>
                                </AccordionItem>
                                <AccordionItem title="LLM Models (WatsonX)" open>
                                    <StructuredListWrapper selection>
                                        <StructuredListBody>
                                            {availableNodes.Models.map((tool, i) => (
                                                <StructuredListRow key={i} tabIndex={0} className="node-draggable">
                                                    <StructuredListCell style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <tool.icon size={20} fill="#8a3ffc" />
                                                        <span>{tool.name}</span>
                                                    </StructuredListCell>
                                                    <StructuredListCell>
                                                        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Add} iconDescription="Adicionar ao Canvas" />
                                                    </StructuredListCell>
                                                </StructuredListRow>
                                            ))}
                                        </StructuredListBody>
                                    </StructuredListWrapper>
                                </AccordionItem>
                                <AccordionItem title="Vector Databases (RAG)" open>
                                    <StructuredListWrapper selection>
                                        <StructuredListBody>
                                            {availableNodes.Databases.map((tool, i) => (
                                                <StructuredListRow key={i} tabIndex={0} className="node-draggable">
                                                    <StructuredListCell style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <tool.icon size={20} fill="#08bdba" />
                                                        <span>{tool.name}</span>
                                                    </StructuredListCell>
                                                    <StructuredListCell>
                                                        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Add} iconDescription="Adicionar ao Canvas" />
                                                    </StructuredListCell>
                                                </StructuredListRow>
                                            ))}
                                        </StructuredListBody>
                                    </StructuredListWrapper>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    </Column>

                    {/* Canvas Main Area */}
                    <Column lg={12} md={5} sm={4}>
                        <div style={{ backgroundColor: '#262626', border: '1px solid #393939', height: 'calc(100vh - 12rem)', display: 'flex', flexDirection: 'column' }}>
                            {/* Canvas Toolbar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #393939', backgroundColor: '#161616' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span className="cds--type-productive-heading-02">Pipeline: <span style={{ fontWeight: 400, color: '#0f62fe' }}>Assistant_RAG_V1</span></span>
                                    <Tag type="green" size="sm">Deployed</Tag>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <Button kind="secondary" size="sm" renderIcon={PlayOutline}>
                                        Testar no Console
                                    </Button>
                                    {saving ? (
                                        <InlineLoading description="Salvando pipeline..." />
                                    ) : (
                                        <Button kind="primary" size="sm" renderIcon={Save} onClick={handleSave}>
                                            Salvar Arquitetura
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Node Graph Area (Simulated List Flow) */}
                            <div style={{ padding: '3rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                                {pipeline.map((node, idx) => (
                                    <React.Fragment key={node.id}>
                                        {/* The Node Block */}
                                        <Tile style={{ width: '100%', maxWidth: '600px', backgroundColor: '#161616', border: '1px solid #525252', padding: 0, position: 'relative' }}>
                                            <div style={{ display: 'flex', backgroundColor: '#393939', padding: '0.5rem 1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Draggable size={16} fill="#c6c6c6" style={{ cursor: 'grab' }} />
                                                    <span style={{ fontWeight: 600, color: '#f4f4f4', fontSize: '0.875rem' }}>
                                                        {node.name}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <Tag type={node.type === 'llm' ? 'purple' : node.type === 'trigger' ? 'blue' : 'teal'} size="sm" style={{ margin: 0 }}>
                                                        {node.type.toUpperCase()}
                                                    </Tag>
                                                    <Button kind="ghost" size="sm" hasIconOnly renderIcon={TrashCan} iconDescription="Deletar" onClick={() => handleRemoveNode(node.id)} />
                                                </div>
                                            </div>

                                            <div style={{ padding: '1rem' }}>
                                                {node.type === 'trigger' && (
                                                    <TextInput id={`cfg-${node.id}`} labelText="Webhook Endpoint Route" value={node.config.route} />
                                                )}
                                                {node.type === 'vectordb' && (
                                                    <Dropdown
                                                        id={`cfg-${node.id}`}
                                                        titleText="Knowledge Base Index"
                                                        label="Selecione..."
                                                        items={['genos-knowledge', 'wix-customers', 'public-docs']}
                                                        initialSelectedItem={node.config.index}
                                                    />
                                                )}
                                                {node.type === 'llm' && (
                                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                                        <TextInput id={`cfg-temp-${node.id}`} labelText="Temperature" value={node.config.temperature} style={{ flex: 1 }} />
                                                        <TextInput id={`cfg-tokens-${node.id}`} labelText="Max Tokens" value="2048" style={{ flex: 1 }} />
                                                    </div>
                                                )}
                                            </div>
                                        </Tile>

                                        {/* Connection Arrow */}
                                        {idx < pipeline.length - 1 && (
                                            <div style={{ display: 'flex', height: '3rem', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                                                <div style={{ width: '2px', height: '1.5rem', backgroundColor: '#525252' }} />
                                                <ArrowRight size={20} fill="#8d8d8d" style={{ transform: 'rotate(90deg)' }} />
                                            </div>
                                        )}
                                    </React.Fragment>
                                ))}

                                {/* Drop Zone Placeholder */}
                                <div style={{ height: '3rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    <div style={{ width: '2px', height: '1.5rem', backgroundColor: '#525252', borderStyle: 'dashed' }} />
                                </div>
                                <Tile style={{ width: '100%', maxWidth: '600px', backgroundColor: 'transparent', border: '1px dashed #525252', textAlign: 'center', padding: '1.5rem', cursor: 'pointer' }}>
                                    <span style={{ color: '#8d8d8d' }}>+ Arraste um componente ou clique para adicionar</span>
                                </Tile>

                            </div>
                        </div>
                    </Column>
                </Grid>
            </Theme>
        </PageLayout>
    );
}
