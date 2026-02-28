import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AILabel, AILabelContent, AILabelActions, IconButton,
  Grid, Column, Tile, ClickableTile,
  DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell, TableContainer,
  TableToolbar, TableToolbarContent, TableToolbarSearch, TableToolbarMenu, TableToolbarAction,
  TableExpandHeader, TableExpandRow, TableExpandedRow,
  Pagination, Tag, Button, Section, Stack,
  Form, FormGroup, TextInput, Dropdown, Modal, Toggletip, ToggletipButton, ToggletipContent, Link
} from '@carbon/react';
import {
  DataEnrichment, DataShare, Chat, Settings, Activity, CloudSatellite, Network_4, View
} from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';

export default function Dashboard() {
  const navigate = useNavigate();
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [paginationParams, setPaginationParams] = useState({ page: 1, pageSize: 5 });

  const aiLabelConfig = (
    <AILabel className="ai-label-container" size="sm">
      <AILabelContent>
        <div>
          <p className="secondary">AI Suggestion</p>
          <h2 className="ai-label-heading">98%</h2>
          <p className="secondary bold">Confidence score</p>
          <p className="secondary">This action was dynamically suggested by genOS context awareness engine.</p>
        </div>
      </AILabelContent>
      <AILabelActions>
        <IconButton kind="ghost" label="Inspect Data">
          <View />
        </IconButton>
      </AILabelActions>
    </AILabel>
  );

  const hubLinks = [
    { title: 'WatsonX Console', desc: 'Engenharia de Prompts e Inferência Nativa.', to: '/console', icon: Chat },
    { title: 'Architect Canvas', desc: 'Modelagem abstrata de bancos de dados genOS.', to: '/architect', icon: DataShare },
    { title: 'Content Factory', desc: 'Geração automatizada de lotes de artigos.', to: '/factory', icon: DataEnrichment },
    { title: 'Global Health Monitor', desc: 'Gerenciamento Root de Tenants e Nodes.', to: '/admin/health', icon: CloudSatellite },
  ];

  const headers = [
    { key: 'task', header: 'Tarefa Gênesis' },
    { key: 'model', header: 'Modelo LLM' },
    { key: 'status', header: 'Status RLS' },
    { key: 'cost', header: 'Uso Estimado' }
  ];

  const rows = [
    { id: 'a', task: 'Análise de Sentimento (Wix DB)', model: 'IBM Granite-13b', status: 'Ativo', cost: '$0.04' },
    { id: 'b', task: 'Agente de Roteamento de Emails', model: 'Mistral-8x7B', status: 'Ativo', cost: '$0.12' },
    { id: 'c', task: 'Crawler Semântico (Brand DNA)', model: 'Meta LLaMa-3', status: 'Concluído', cost: '$1.40' },
    { id: 'd', task: 'Compilação RAG (CSV Sync)', model: 'AuraHelian (Quantum)', status: 'Alerta', cost: '$2.05' },
    { id: 'e', task: 'Geração de Metadados SEO', model: 'OpenAI GPT-4o', status: 'Pausado', cost: '$0.80' },
  ];

  const pagedRows = rows.slice((paginationParams.page - 1) * paginationParams.pageSize, paginationParams.page * paginationParams.pageSize);

  return (
    <PageLayout
      title="Intelligence Hub"
      subtitle="Painel mestre arquitetado nativamente com WatsonX Operations e Carbon Design AILabels."
    >
      {/* 1. Hub Tiles with AILabel */}
      <Section style={{ paddingBottom: '2rem' }}>
        <h3 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem', color: '#f4f4f4' }}>
          Módulos de Operação Sugeridos
        </h3>
        <Grid>
          {hubLinks.map((link, i) => (
            <Column key={i} sm={4} md={4} lg={4}>
              <ClickableTile
                href={link.to}
                onClick={(e) => { e.preventDefault(); navigate(link.to); }}
                decorator={
                  <AILabel size="xs">
                    <AILabelContent>
                      <p className="secondary">Predictive Access</p>
                      <p className="secondary">Baseado em sua última sessão, este módulo tem alta probabilidade de uso.</p>
                    </AILabelContent>
                  </AILabel>
                }
                style={{ backgroundColor: '#262626', border: '1px solid #393939', marginBottom: '1rem', minHeight: '140px' }}
              >
                <Stack gap={4}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f62fe' }}>
                    <link.icon size={24} />
                    <h4 className="cds--type-productive-heading-02" style={{ color: '#f4f4f4', margin: 0 }}>{link.title}</h4>
                  </div>
                  <p className="cds--type-body-short-01" style={{ color: '#c6c6c6' }}>{link.desc}</p>
                </Stack>
              </ClickableTile>
            </Column>
          ))}
        </Grid>
      </Section>

      {/* 2. Global AI Form configuration */}
      <Section style={{ paddingBottom: '2rem' }}>
        <Grid>
          <Column lg={8} md={8} sm={4}>
            <Tile style={{ backgroundColor: '#161616', border: '1px solid #393939', padding: '1.5rem' }}>
              <Form aria-label="AI Task Engine">
                <FormGroup
                  legendText={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Configuração de Agente Rápido
                      {aiLabelConfig}
                    </div>
                  }
                  style={{ marginBottom: '1.5rem', color: '#f4f4f4' }}
                >
                  <Stack gap={5}>
                    <TextInput
                      id="agent-prompt"
                      labelText="Intenção principal (Natural Language)"
                      placeholder="Ex: Crie um workflow de aprovação social para o cliente..."
                      decorator={
                        <AILabel size="sm" kind="inline">
                          <AILabelContent>
                            Autocompletar ativado pelo histórico de prompts.
                          </AILabelContent>
                        </AILabel>
                      }
                    />
                    <Dropdown
                      id="llm-select"
                      titleText="Modelo de Linguagem (Engine)"
                      label="IBM Granite-13b (Recomendado)"
                      items={['IBM Granite-13b', 'Meta LLaMa-3', 'AuraHelian (Quantum)', 'OpenAI GPT-4o']}
                      decorator={
                        <AILabel size="sm">
                          <AILabelContent>
                            <p className="secondary">Otimizado para Custo/Benefício na sua subscrição atual.</p>
                          </AILabelContent>
                        </AILabel>
                      }
                    />
                    <Button renderIcon={Network_4} onClick={() => setIsAiModalOpen(true)}>
                      Orquestrar GenOS
                    </Button>
                  </Stack>
                </FormGroup>
              </Form>
            </Tile>
          </Column>

          <Column lg={8} md={8} sm={4}>
            <Tile style={{ backgroundColor: '#161616', border: '1px solid #393939', padding: '1.5rem', height: '100%' }}>
              <h4 className="cds--type-productive-heading-02" style={{ color: '#f4f4f4', marginBottom: '1rem' }}>
                Ativos Recentes com Insights
              </h4>
              <Stack gap={4}>
                <Tile style={{ backgroundColor: '#262626', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 12, right: 12 }}>
                    <AILabel size="sm"><AILabelContent>Documento revisado e validado por Compliance Engine.</AILabelContent></AILabel>
                  </div>
                  <h5 className="cds--type-heading-01" style={{ color: '#f4f4f4' }}>Post_LinkedIn_Cestari.md</h5>
                  <p className="cds--type-helper-text-01" style={{ color: '#8d8d8d', marginTop: '0.5rem' }}>Score de DNA: 94%</p>
                </Tile>
                <Tile style={{ backgroundColor: '#262626', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 12, right: 12 }}>
                    <AILabel size="sm"><AILabelContent>Anomalia estatística detectada (Desvio de Tone of Voice).</AILabelContent></AILabel>
                  </div>
                  <h5 className="cds--type-heading-01" style={{ color: '#f4f4f4' }}>Landing_Page_Omega.html</h5>
                  <p className="cds--type-helper-text-01" style={{ color: '#8d8d8d', marginTop: '0.5rem' }}>Score de DNA: 61%</p>
                </Tile>
              </Stack>
            </Tile>
          </Column>
        </Grid>
      </Section>

      {/* 3. DataTable with Expand, Toolbar, Pagination, and AILabel */}
      <Section style={{ paddingBottom: '4rem' }}>
        <Grid>
          <Column lg={16}>
            <div style={{ border: '1px solid #393939' }}>
              <DataTable rows={pagedRows} headers={headers}>
                {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getToolbarProps }) => (
                  <TableContainer
                    title="Orquestrações em Background"
                    description="Lista de jobs gerenciados pela ponte de eventos do Wix e WatsonX."
                    decorator={aiLabelConfig}
                  >
                    <TableToolbar {...getToolbarProps()} aria-label="data table toolbar">
                      <TableToolbarContent>
                        <TableToolbarSearch persistent />
                        <TableToolbarMenu>
                          <TableToolbarAction onClick={() => { }}>Exportar LOG</TableToolbarAction>
                          <TableToolbarAction onClick={() => { }}>Forçar Sync</TableToolbarAction>
                        </TableToolbarMenu>
                        <Button onClick={() => { }} size="sm">Novo Job RAG</Button>
                      </TableToolbarContent>
                    </TableToolbar>

                    <Table {...getTableProps()}>
                      <TableHead>
                        <TableRow>
                          <TableExpandHeader />
                          {headers.map((header: any) => (
                            <TableHeader {...getHeaderProps({ header })} key={header.key}>
                              {header.header}
                            </TableHeader>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((row: any) => (
                          <React.Fragment key={row.id}>
                            <TableExpandRow {...getRowProps({ row })}>
                              {row.cells.map((cell: any) => (
                                <TableCell key={cell.id}>
                                  {cell.info.header === 'status' ? (
                                    <Tag type={cell.value === 'Ativo' ? 'green' : cell.value === 'Concluído' ? 'blue' : 'red'}>
                                      {cell.value}
                                    </Tag>
                                  ) : cell.value}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow colSpan={headers.length + 1} className="theme-gray-100" style={{ backgroundColor: '#262626' }}>
                              <div style={{ padding: '1rem', color: '#c6c6c6' }}>
                                <h5 className="cds--type-productive-heading-01" style={{ marginBottom: '0.5rem', color: '#0f62fe' }}>Telemetry Data</h5>
                                <p><strong>Tenant Invoker:</strong> Cestari Master Studio</p>
                                <p><strong>Token Offset:</strong> 12,400 T</p>
                                <p><strong>Cold Start Latency:</strong> 142ms</p>
                              </div>
                            </TableExpandedRow>
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </DataTable>
              <Pagination
                backwardText="Página Anterior"
                forwardText="Próxima Página"
                itemsPerPageText="Itens por pág:"
                pageNumberText="Número da página"
                pageSize={paginationParams.pageSize}
                pageSizes={[5, 10, 20]}
                totalItems={rows.length}
                onChange={({ page, pageSize }) => setPaginationParams({ page, pageSize })}
                size="md"
              />
            </div>
          </Column>
        </Grid>
      </Section>

      {/* 4. Modal with AILabel */}
      <Modal
        open={isAiModalOpen}
        onRequestClose={() => setIsAiModalOpen(false)}
        onRequestSubmit={() => setIsAiModalOpen(false)}
        modalHeading="Confirmação de Execução Agêntica"
        modalLabel="WatsonX Orchestrator"
        primaryButtonText="Comissionar Agentes"
        secondaryButtonText="Cancelar"
        decorator={aiLabelConfig}
      >
        <p style={{ marginBottom: '1rem' }}>
          Você está prestes a despachar um macro-agente para orquestrar dados diretamente na base do genOS via Headless API.
        </p>
        <p>
          Esse processo consumirá tokens baseados no peso do payload (Wix Webhooks) e envolverá a camada RLS. Deseja prosseguir com a inteligência alocada?
        </p>
      </Modal>

    </PageLayout>
  );
}
