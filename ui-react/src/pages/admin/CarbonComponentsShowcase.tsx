import React, { useState } from 'react';
import {
    Grid,
    Column,
    Section,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Button,
    Search,
    TextInput,
    PasswordInput,
    ComboBox,
    ComboButton,
    FormGroup,
    Modal,
    ToastNotification,
    AILabel,
    AILabelContent,
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
    TableToolbarSearch,
    TableToolbarMenu,
    TableToolbarAction,
    TableBatchActions,
    TableBatchAction,
    TableSelectAll,
    TableSelectRow
} from '@carbon/react';
import { Chemistry, Catalog, Download, TrashCan, Add } from '@carbon/icons-react';
import PageLayout from '../../components/PageLayout';

// Mock data for Data Table
const headerData = [
    { header: 'ID', key: 'id' },
    { header: 'Name', key: 'name' },
    { header: 'Protocol', key: 'protocol' },
    { header: 'Port', key: 'port' },
    { header: 'Rule', key: 'rule' },
    { header: 'Status', key: 'status' }
];

const rowData = [
    { "id": "load-balancer-1", "name": "Load Balancer 1", "protocol": "HTTP", "port": 80, "rule": "Round Robin", "status": "Active" },
    { "id": "load-balancer-2", "name": "Load Balancer 2", "protocol": "HTTP", "port": 80, "rule": "Round Robin", "status": "Active" },
    { "id": "load-balancer-3", "name": "Load Balancer 3", "protocol": "HTTP", "port": 80, "rule": "Round Robin", "status": "Active" }
];

export default function CarbonComponentsShowcase() {
    const [isDefaultModalOpen, setIsDefaultModalOpen] = useState(false);
    const [isFluidModalOpen, setIsFluidModalOpen] = useState(false);

    // ComboBox usage
    const comboItems = [
        { id: '1', text: 'Option 1' },
        { id: '2', text: 'Option 2' },
        { id: '3', text: 'Option 3' }
    ];

    return (
        <PageLayout
            title="Cestari Studio Carbon | Components Foundry"
            subtitle="Exibição oficial e orquestração dos 16 subsistemas de Design Figma do IBM Carbon v11 (Community)."
        >
            <Section>
                <Grid>
                    <Column lg={16}>
                        <Tabs>
                            <TabList aria-label="Component categories">
                                <Tab>1. Data Tables & Batch</Tab>
                                <Tab>2. Modals (Default & Fluid)</Tab>
                                <Tab>3. Inputs & Fluid Search</Tab>
                                <Tab>4. AI Explainability & Buttons</Tab>
                                <Tab>5. Notifications</Tab>
                            </TabList>

                            <TabPanels>
                                {/* Panel 1: Data Tables & Batch Actions */}
                                <TabPanel>
                                    <Section className="foundry-section">
                                        <h3 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem' }}>Componentes 3 e 4: Data Table & Batch Actions Bar Item</h3>
                                        <p style={{ marginBottom: '2rem' }}>A implementação canônica de Table com seleção em massa (Batch Actions).</p>
                                        <DataTable rows={rowData} headers={headerData} isSortable>
                                            {({
                                                rows,
                                                headers,
                                                getHeaderProps,
                                                getRowProps,
                                                getSelectionProps,
                                                getToolbarProps,
                                                getBatchActionProps,
                                                onInputChange,
                                                selectedRows,
                                            }: any) => (
                                                <TableContainer title="Tabela de Conexões" description="Demonstrativo de Batch Actions e Toolbar.">
                                                    <TableToolbar {...getToolbarProps()}>
                                                        <TableBatchActions {...getBatchActionProps()}>
                                                            <TableBatchAction
                                                                tabIndex={getBatchActionProps().shouldShowBatchActions ? 0 : -1}
                                                                renderIcon={TrashCan}
                                                                onClick={() => alert('Apagando Linhas selecionadas: ' + selectedRows.map((r: any) => r.id))}
                                                            >
                                                                Apagar Seleção
                                                            </TableBatchAction>
                                                            <TableBatchAction
                                                                tabIndex={getBatchActionProps().shouldShowBatchActions ? 0 : -1}
                                                                renderIcon={Download}
                                                                onClick={() => alert('Baixando dados')}
                                                            >
                                                                Exportar
                                                            </TableBatchAction>
                                                        </TableBatchActions>
                                                        <TableToolbarContent>
                                                            <TableToolbarSearch tabIndex={getBatchActionProps().shouldShowBatchActions ? -1 : 0} onChange={onInputChange} />
                                                            <TableToolbarMenu tabIndex={getBatchActionProps().shouldShowBatchActions ? -1 : 0}>
                                                                <TableToolbarAction onClick={() => { }}>Ação Rápida 1</TableToolbarAction>
                                                                <TableToolbarAction onClick={() => { }}>Ação Rápida 2</TableToolbarAction>
                                                            </TableToolbarMenu>
                                                            <Button
                                                                tabIndex={getBatchActionProps().shouldShowBatchActions ? -1 : 0}
                                                                size="sm"
                                                                kind="primary"
                                                            >
                                                                Novo Cadastro
                                                            </Button>
                                                        </TableToolbarContent>
                                                    </TableToolbar>
                                                    <Table>
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableSelectAll {...getSelectionProps()} />
                                                                {headers.map((header: any, i: number) => (
                                                                    <TableHeader key={i} {...getHeaderProps({ header })}>
                                                                        {header.header}
                                                                    </TableHeader>
                                                                ))}
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {rows.map((row: any, i: number) => (
                                                                <TableRow key={i} {...getRowProps({ row })}>
                                                                    <TableSelectRow {...getSelectionProps({ row })} />
                                                                    {row.cells.map((cell: any) => (
                                                                        <TableCell key={cell.id}>{cell.value}</TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            )}
                                        </DataTable>
                                    </Section>
                                </TabPanel>

                                {/* Panel 2: Modals */}
                                <TabPanel>
                                    <Section className="foundry-section">
                                        <h3 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem' }}>Componentes 6 e 9: Form Modal Default & Form Modal Fluid</h3>
                                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                                            <Button onClick={() => setIsDefaultModalOpen(true)}>Abrir Default Modal</Button>
                                            <Button onClick={() => setIsFluidModalOpen(true)} kind="tertiary">Abrir Fluid Modal</Button>
                                        </div>

                                        <Modal
                                            open={isDefaultModalOpen}
                                            modalHeading="Form Modal - Default"
                                            primaryButtonText="Salvar Alterações"
                                            secondaryButtonText="Cancelar"
                                            onRequestClose={() => setIsDefaultModalOpen(false)}
                                            onRequestSubmit={() => setIsDefaultModalOpen(false)}
                                        >
                                            <p style={{ marginBottom: '1rem' }}>Formulários default do Carbon com inputs tradicionais de fundo cinza.</p>
                                            <FormGroup legendText="">
                                                <TextInput id="default-input-1" labelText="Nome do Projeto" style={{ marginBottom: '1rem' }} />
                                                <TextInput id="default-input-2" labelText="Ambiente" />
                                            </FormGroup>
                                        </Modal>

                                        <Modal
                                            open={isFluidModalOpen}
                                            modalHeading="Form Modal - Fluid"
                                            primaryButtonText="Gerar Chave"
                                            secondaryButtonText="Fechar"
                                            onRequestClose={() => setIsFluidModalOpen(false)}
                                            onRequestSubmit={() => setIsFluidModalOpen(false)}
                                            hasScrollingContent
                                        >
                                            <p style={{ marginBottom: '1rem' }}>Modais Fluid utilizam forms que se mesclam no fundo sem contorno escuro e operam com validações inline.</p>
                                            <div className="cds--form-item">
                                                <TextInput id="fluid-input-1" labelText="Variável de Sistema" placeholder="Digite..." />
                                            </div>
                                            <div className="cds--form-item" style={{ marginTop: '2px' }}>
                                                <TextInput id="fluid-input-2" labelText="Caminho Relativo" placeholder="/var/www/..." />
                                            </div>
                                        </Modal>
                                    </Section>
                                </TabPanel>

                                {/* Panel 3: Inputs & Fluid Search */}
                                <TabPanel>
                                    <Section className="foundry-section">
                                        <h3 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem' }}>Componentes 7, 10, 11 e 13: ComboBox, Password Fluid, Fluid Search e AI Field</h3>
                                        <Grid narrow>
                                            <Column lg={8}>
                                                <FormGroup legendText="Fluid Components">
                                                    <Search size="lg" placeholder="Fluid Search Component" labelText="Search" />
                                                    <br />
                                                    <PasswordInput id="fluid-password" labelText="Password Input Fluid" placeholder="*******" />
                                                </FormGroup>
                                                <br />
                                                <FormGroup legendText="ComboBox (Busca com Auto-completar)">
                                                    <ComboBox
                                                        id="carbon-combobox"
                                                        items={comboItems}
                                                        itemToString={(item) => (item ? item.text : '')}
                                                        placeholder="Filtre as opções..."
                                                        titleText="Selecione ou Pesquise"
                                                        onChange={() => { }}
                                                    />
                                                </FormGroup>
                                            </Column>
                                        </Grid>
                                    </Section>
                                </TabPanel>

                                {/* Panel 4: AI Explainability & Buttons */}
                                <TabPanel>
                                    <Section className="foundry-section">
                                        <h3 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem' }}>Componentes 1, 8, 14: AI Explainability, Combo Button e Matrix Buttons</h3>
                                        <p style={{ marginBottom: '2rem' }}>A interface WatsonX com Slugs nativos do Carbon explicando as origens dos dados ou gerando textos autônomos.</p>

                                        <Grid narrow>
                                            <Column lg={8}>
                                                <FormGroup legendText="AI Layer Content Field">
                                                    <TextInput
                                                        id="ai-text-input"
                                                        labelText="Sumário Corporativo (Autogerado)"
                                                        value="A inteligência artificial resumiu essa métrica."
                                                        readOnly
                                                        decorator={
                                                            <AILabel
                                                                className="ai-label-decorator"
                                                                size="sm"
                                                                AILabelContent={
                                                                    <AILabelContent>
                                                                        <div style={{ padding: '0.5rem' }}>
                                                                            <p>Conteúdo gerado via <strong>Watsonx Granite-13b</strong>.</p>
                                                                        </div>
                                                                    </AILabelContent>
                                                                }
                                                            />
                                                        }
                                                    />
                                                </FormGroup>

                                                <br /><br />

                                                <h4 className="cds--type-productive-heading-01" style={{ marginBottom: '1rem' }}>Variáveis de Botões</h4>
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                                    <Button>Primary Button</Button>
                                                    <Button kind="secondary">Secondary Button</Button>
                                                    <Button kind="tertiary">Tertiary Button</Button>
                                                    <Button kind="ghost">Ghost Button</Button>
                                                    <ComboButton label="Primary Combo Button">
                                                        <Button kind="ghost">Secondary Action 1</Button>
                                                        <Button kind="ghost">Secondary Action 2</Button>
                                                        <Button kind="ghost">Secondary Action 3</Button>
                                                    </ComboButton>
                                                </div>
                                            </Column>
                                        </Grid>
                                    </Section>
                                </TabPanel>

                                {/* Panel 5: Notifications */}
                                <TabPanel>
                                    <Section className="foundry-section">
                                        <h3 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem' }}>Componente 12: Notification Toasts</h3>
                                        <p style={{ marginBottom: '2rem' }}>Notificações isoladas do Carbon designadas para aparecerem flutuantes ("Toast").</p>
                                        <Grid narrow>
                                            <Column lg={8} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <ToastNotification
                                                    kind="error"
                                                    title="Cluster Offline"
                                                    subtitle="Nenhum response vindo da interface LLM."
                                                    caption="Agora mesmo"
                                                    lowContrast
                                                />
                                                <ToastNotification
                                                    kind="success"
                                                    title="Dados Inseridos"
                                                    subtitle="As pipelines foram atualizadas com sucesso."
                                                    caption="Há 2 minutos"
                                                    lowContrast
                                                />
                                                <ToastNotification
                                                    kind="info"
                                                    title="Nova Versão do Carbon"
                                                    subtitle="A versão v11.39 está rodando nesta interface."
                                                    caption="Há 1 hora"
                                                    lowContrast
                                                />
                                            </Column>
                                        </Grid>
                                    </Section>
                                </TabPanel>
                            </TabPanels>
                        </Tabs>
                    </Column>
                </Grid>
            </Section>
        </PageLayout>
    );
}
