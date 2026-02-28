// genOS Lumina — Settings / Configuracoes (Addendum H §8.8)
import { useEffect, useState, useMemo } from 'react';
import {
  TabsVertical,
  TabListVertical,
  Tab,
  TabPanels,
  TabPanel,
  Tile,
  TextInput,
  TextArea,
  Toggle,
  Button,
  InlineLoading,
  InlineNotification,
  Accordion,
  AccordionItem,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
  Section,
  Grid,
  Column,
  Stack,
  ProgressIndicator,
  ProgressStep,
  PasswordInput,
  AILabel,
  AILabelContent,
  Select,
  SelectItem,
} from '@carbon/react';
import {
  Save,
  Settings as SettingsIcon,
} from '@carbon/icons-react';
import { DonutChart, StackedBarChart } from '@carbon/charts-react';
import { ScaleTypes } from '@carbon/charts';
import { api } from '../services/api';
import PageLayout from '../components/PageLayout';

export default function Settings() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [tokenSummary, setTokenSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, r, t] = await Promise.all([
        api.get<any[]>('/system-prompts'),
        api.get<any[]>('/compliance-rules'),
        api.get<any[]>('/observatory/token-summary'),
      ]);
      setPrompts(p || []);
      setRules(r || []);
      setTokenSummary(t || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
        <InlineLoading description="Computando tensores do Kernel Configuration..." />
      </div>
    );
  }

  const promptHeaders = [
    { key: 'name', header: 'Diretiva Limiar' },
    { key: 'description', header: 'Parâmetro Comportamental' },
    { key: 'is_active', header: 'Sinal Ativo' },
  ];

  const promptRows = prompts.map((p: any) => ({
    id: p.id,
    name: p.name,
    description: (p.description || '').substring(0, 80),
    is_active: p.is_active ? 'Sim' : 'Não',
  }));

  const ruleHeaders = [
    { key: 'rule_type', header: 'Tipo Estrutural' },
    { key: 'name', header: 'Constraint Name' },
    { key: 'severity', header: 'Severidade de Drift' },
    { key: 'is_active', header: 'Sinal Ativo' },
  ];

  const ruleRows = rules.map((r: any) => ({
    id: r.id,
    rule_type: r.rule_type,
    name: r.name || r.description?.substring(0, 40) || '—',
    severity: r.severity || 'medium',
    is_active: r.is_active ? 'Sim' : 'Não',
  }));

  const topTenants = useMemo(() => (tokenSummary || []).slice(0, 6), [tokenSummary]);

  const costByTenantData = useMemo(
    () =>
      topTenants.flatMap((tenant: any) => [
        {
          group: 'Custo',
          tenant: tenant.tenant_name,
          value: Number(tenant.total_agency_cost || 0),
        },
        {
          group: 'Receita',
          tenant: tenant.tenant_name,
          value: Number(tenant.total_client_revenue || 0),
        },
      ]),
    [topTenants]
  );

  const tokenShareData = useMemo(
    () =>
      topTenants.map((tenant: any) => ({
        group: tenant.tenant_name,
        value: Number(tenant.total_tokens || 0),
      })),
    [topTenants]
  );

  return (
    <PageLayout
      title="Configurações (Kernel Settings)"
      subtitle="System Prompts Fundamentais e Regras Base de Compliance para Agentes Autônomos"
    >
      <Section>
        {error && (
          <Grid>
            <Column lg={16}>
              <Tile style={{ backgroundColor: '#262626', border: '1px solid #fa4d56', marginBottom: '1rem' }}>
                <InlineNotification
                  kind="error"
                  title="Erro de Leitura de Matriz"
                  subtitle={error}
                  lowContrast
                  hideCloseButton
                />
              </Tile>
            </Column>
          </Grid>
        )}

        <Grid>
          <Column lg={16}>
            <TabsVertical>
              <TabListVertical aria-label="Settings configuration tabs">
                <Tab>System Prompts</Tab>
                <Tab>Constraint Rules</Tab>
                <Tab>Framework Metadata</Tab>
                <Tab>Billing & Tokens</Tab>
              </TabListVertical>

              <TabPanels>
                {/* System Prompts */}
                <TabPanel>
                  <Tile style={{ backgroundColor: '#161616', border: '1px solid #393939', padding: '1rem 0' }}>
                    {prompts.length === 0 ? (
                      <Tile style={{ backgroundColor: '#262626', margin: '0 1rem', textAlign: 'center', padding: '2rem' }}>
                        <h3 className="cds--type-productive-heading-03" style={{ color: '#c6c6c6' }}>Nenhum Prompt Agêntico Parametrizado.</h3>
                      </Tile>
                    ) : (
                      <div style={{ border: '1px solid #393939', margin: '0 1rem' }}>
                        <DataTable rows={promptRows} headers={promptHeaders}>
                          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
                            <Table {...getTableProps()} size="sm">
                              <TableHead>
                                <TableRow>
                                  {headers.map((h: any) => (
                                    <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {rows.map((row: any) => (
                                  <TableRow {...getRowProps({ row })} key={row.id}>
                                    {row.cells.map((cell: any) => (
                                      <TableCell key={cell.id}>{cell.value}</TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </DataTable>
                      </div>
                    )}
                  </Tile>
                </TabPanel>

                {/* Compliance Rules */}
                <TabPanel>
                  <Tile style={{ backgroundColor: '#161616', border: '1px solid #393939', padding: '1rem' }}>
                    {rules.length === 0 ? (
                      <Tile style={{ backgroundColor: '#262626', textAlign: 'center', padding: '2rem' }}>
                        <h3 className="cds--type-productive-heading-03" style={{ color: '#c6c6c6' }}>Nenhuma Regra de Compliance Cadastrada no Kernel.</h3>
                      </Tile>
                    ) : (
                      <div style={{ border: '1px solid #393939' }}>
                        <DataTable rows={ruleRows} headers={ruleHeaders}>
                          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
                            <Table {...getTableProps()} size="sm">
                              <TableHead>
                                <TableRow>
                                  {headers.map((h: any) => (
                                    <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {rows.map((row: any) => (
                                  <TableRow {...getRowProps({ row })} key={row.id}>
                                    {row.cells.map((cell: any) => {
                                      let content: any = cell.value;
                                      if (cell.info.header === 'severity') {
                                        const tagType = cell.value === 'high' ? 'red' : cell.value === 'medium' ? 'magenta' : 'cool-gray';
                                        content = <Tag type={tagType as any} size="sm">{cell.value}</Tag>;
                                      }
                                      return <TableCell key={cell.id}>{content}</TableCell>;
                                    })}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </DataTable>
                      </div>
                    )}
                  </Tile>
                </TabPanel>

                {/* General */}
                <TabPanel>
                  <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', marginTop: '1rem' }}>
                    <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>Core System Framework</h4>
                    <Stack gap={4}>
                      <div>
                        <span className="cds--type-label-01" style={{ color: '#8d8d8d' }}>Build Version</span>
                        <p className="cds--type-productive-heading-01" style={{ color: '#0f62fe' }}>v1.0.0 Lumina (Enterprise-Hacker)</p>
                      </div>
                      <div>
                        <span className="cds--type-label-01" style={{ color: '#8d8d8d' }}>Design Specification</span>
                        <p className="cds--type-productive-heading-01" style={{ color: '#c6c6c6' }}>IBM Carbon for AI g100</p>
                      </div>
                      <div>
                        <span className="cds--type-label-01" style={{ color: '#8d8d8d' }}>Front-end Engine</span>
                        <p className="cds--type-productive-heading-01" style={{ color: '#c6c6c6' }}>React.js / @carbon/react / Vite</p>
                      </div>
                      <div>
                        <span className="cds--type-label-01" style={{ color: '#8d8d8d' }}>Authentication Broker</span>
                        <p className="cds--type-productive-heading-01" style={{ color: '#c6c6c6' }}>Wix Headless Proxy (Row-Level Security Active)</p>
                      </div>
                    </Stack>
                  </Tile>
                </TabPanel>

                {/* Billing & Tokens */}
                <TabPanel>
                  <Grid fullWidth style={{ marginTop: '0', marginBottom: '1.5rem', paddingLeft: 0, paddingRight: 0 }}>
                    <Column sm={4} md={4} lg={8} style={{ paddingLeft: 0 }}>
                      <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', height: '100%' }}>
                        <h3 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>Balanço Custo x Receita (USD)</h3>
                        {costByTenantData.length > 0 ? (
                          <StackedBarChart
                            data={costByTenantData}
                            options={{
                              theme: 'g100',
                              toolbar: { enabled: false },
                              height: '300px',
                              resizable: true,
                              axes: {
                                left: { mapsTo: 'value', stacked: true, title: 'Volume em USD' },
                                bottom: { mapsTo: 'tenant', scaleType: ScaleTypes.LABELS, title: 'Organização Alvo' },
                              },
                              legend: { enabled: true, position: 'bottom' },
                            }}
                          />
                        ) : (
                          <p style={{ color: '#8d8d8d' }}>Nenhum dado de transação disponível.</p>
                        )}
                      </Tile>
                    </Column>

                    <Column sm={4} md={4} lg={8} style={{ paddingRight: 0 }}>
                      <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', height: '100%' }}>
                        <h3 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>Densidade de Processamento (Tokens)</h3>
                        {tokenShareData.length > 0 ? (
                          <DonutChart
                            data={tokenShareData}
                            options={{
                              theme: 'g100',
                              toolbar: { enabled: false },
                              height: '300px',
                              resizable: true,
                              donut: { center: { label: 'LLM Tokens' } },
                              legend: { enabled: true, position: 'bottom' },
                            }}
                          />
                        ) : (
                          <p style={{ color: '#8d8d8d' }}>Nenhum dado de tokens disponível.</p>
                        )}
                      </Tile>
                    </Column>
                  </Grid>

                  <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                    <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>Current Subscriptions & Quotas</h4>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                      <div>
                        <span className="cds--type-label-01" style={{ color: '#8d8d8d' }}>Active Plan</span>
                        <p className="cds--type-productive-heading-02" style={{ color: '#0f62fe' }}>genOS Pro (Enterprise Hacker)</p>
                      </div>
                      <Tag type="purple" size="md">50M Tokens Limit</Tag>
                    </div>

                    <div style={{ marginBottom: '3rem' }}>
                      <p className="cds--type-label-01" style={{ color: '#8d8d8d', marginBottom: '1rem' }}>Token Usage Evolution (LLM API)</p>
                      <ProgressIndicator currentIndex={1} spaceEqually>
                        <ProgressStep label="Free Tier" secondaryLabel="1M Tokens" />
                        <ProgressStep label="Pro Tier" secondaryLabel="10M Tokens" />
                        <ProgressStep label="Enterprise" secondaryLabel="50M Tokens" />
                        <ProgressStep label="Overage Risk" secondaryLabel="> 50M Tokens" />
                      </ProgressIndicator>
                    </div>

                    <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1rem' }}>Billing Invoices (Wix Integration)</h4>
                    <div style={{ border: '1px solid #393939' }}>
                      <Table size="sm">
                        <TableHead>
                          <TableRow>
                            <TableHeader>Data</TableHeader>
                            <TableHeader>Descrição</TableHeader>
                            <TableHeader>Valor (USD)</TableHeader>
                            <TableHeader>Status</TableHeader>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>25/02/2026</TableCell>
                            <TableCell>genOS Pro (Mensal)</TableCell>
                            <TableCell>$ 99.00</TableCell>
                            <TableCell><Tag type="green" size="sm" style={{ margin: 0 }}>Pago</Tag></TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>25/01/2026</TableCell>
                            <TableCell>genOS Pro (Mensal) + Extra Tokens</TableCell>
                            <TableCell>$ 124.50</TableCell>
                            <TableCell><Tag type="green" size="sm" style={{ margin: 0 }}>Pago</Tag></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Stripe Agentic Commerce & Crypto */}
                    <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem', marginTop: '3rem' }}>Stripe Agentic Commerce & Crypto</h4>
                    <div style={{ backgroundColor: '#161616', border: '1px solid #393939', padding: '1.5rem', borderRadius: '4px' }}>
                      <Stack gap={5}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h5 className="cds--type-productive-heading-02" style={{ color: '#f4f4f4' }}>API Connection (Live Mode)</h5>
                          <AILabel size="sm">
                            <AILabelContent>Secured via Stripe Shared Payment Tokens</AILabelContent>
                          </AILabel>
                        </div>
                        <PasswordInput
                          id="stripe-secret"
                          labelText="Stripe Secret Key (sk_live_...)"
                          value="sk_live_1234567890abcdef"
                          showPasswordLabel="Show"
                          hidePasswordLabel="Hide"
                        />

                        <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #393939' }}>
                          <h5 className="cds--type-productive-heading-02" style={{ color: '#f4f4f4', marginBottom: '1rem' }}>Accept Stablecoins & Crypto Globally</h5>
                          <p className="cds--type-body-short-01" style={{ color: '#c6c6c6', marginBottom: '1.5rem' }}>
                            Receba e envie remessas em USDC, Solana e Polygon utilizando a infraestrutura de Crypto da Stripe sem fricção com blockchain via Agentic Checkouts.
                          </p>
                          <Grid>
                            <Column lg={8}>
                              <Toggle
                                id="crypto-stablecoin"
                                labelText="Aceitar USDC (Stablecoin)"
                                labelA="Off"
                                labelB="On"
                                defaultToggled
                              />
                            </Column>
                            <Column lg={8}>
                              <Toggle
                                id="crypto-payout"
                                labelText="Repasses instantâneos em Crypto (Payouts)"
                                labelA="Off"
                                labelB="On"
                              />
                            </Column>
                          </Grid>
                        </div>

                        <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #393939', display: 'flex', justifyContent: 'flex-end' }}>
                          <Button kind="primary">Validar Conexão com Stripe</Button>
                        </div>
                      </Stack>
                    </div>

                    {/* Stripe Climate */}
                    <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem', marginTop: '3rem' }}>Stripe Climate Compliance</h4>
                    <div style={{ backgroundColor: '#161616', border: '1px solid #393939', padding: '1.5rem', borderRadius: '4px' }}>
                      <Stack gap={5}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h5 className="cds--type-productive-heading-02" style={{ color: '#f4f4f4' }}>Remoção de Carbono via Frontier</h5>
                          <Tag type="green" size="sm">ESG Partner</Tag>
                        </div>
                        <p className="cds--type-body-short-01" style={{ color: '#c6c6c6', marginBottom: '1rem' }}>
                          O Stripe Climate permite que você destine uma fração da sua receita de assinaturas e vendas In-App para ajudar a escalonar tecnologias promissoras de remoção permanente de carbono.
                        </p>

                        <Grid>
                          <Column lg={8}>
                            <Toggle
                              id="climate-toggle"
                              labelText="Ativar Contribuição Stripe Climate"
                              labelA="Pausado"
                              labelB="Ativo"
                              defaultToggled
                            />
                          </Column>
                          <Column lg={8}>
                            <Select id="climate-percentage" defaultValue="1" labelText="Porcentagem da Receita Destinada">
                              <SelectItem value="0.5" text="0.5% da Receita (Silver)" />
                              <SelectItem value="1" text="1.0% da Receita (Gold)" />
                              <SelectItem value="2" text="2.0% da Receita (Platinum)" />
                              <SelectItem value="5" text="5.0% da Receita (Diamond Pioneer)" />
                            </Select>
                          </Column>
                        </Grid>
                      </Stack>
                    </div>

                    {/* Stripe In-App Payments */}
                    <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem', marginTop: '3rem' }}>In-App Subscription Upgrade (Stripe)</h4>
                    <div style={{ backgroundColor: '#161616', border: '1px solid #0f62fe', padding: '2rem', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ marginBottom: '1rem' }}>
                        <AILabel size="md" kind="inline">
                          <AILabelContent>
                            Motor de Pagamento In-App ativo via Stripe. Reter clientes sem redirecionamentos é fundamental para a conversão fluida.
                          </AILabelContent>
                        </AILabel>
                      </div>

                      <Grid narrow>
                        <Column lg={10}>
                          <h5 className="cds--type-productive-heading-02" style={{ color: '#f4f4f4', marginBottom: '0.5rem' }}>Upgrade para genOS Supreme Architecture</h5>
                          <p className="cds--type-body-short-01" style={{ color: '#c6c6c6', marginBottom: '1.5rem' }}>
                            Integração Nativa de Quantum Computing e limite expandido de 500M de Tokens LLM (Roteamento Privado).
                          </p>
                        </Column>
                        <Column lg={6} style={{ display: 'flex', justifyContent: 'flex-end', flexDirection: 'column' }}>
                          <p className="cds--type-productive-heading-03" style={{ color: '#ffffff', textAlign: 'right' }}>$ 499.00 <span style={{ fontSize: '1rem', color: '#8d8d8d' }}>/mês</span></p>
                        </Column>
                      </Grid>

                      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#262626', border: '1px solid #393939' }}>
                        <h6 className="cds--type-label-01" style={{ color: '#8d8d8d', marginBottom: '1rem' }}>Checkout Rápido Integrado (Embutido no App)</h6>
                        <Grid>
                          <Column lg={16} md={8} sm={4}>
                            <TextInput id="cc-name" labelText="Nome no Cartão" placeholder="Octavio M." />
                          </Column>
                          <Column lg={12} md={6} sm={4} style={{ marginTop: '1rem' }}>
                            <TextInput id="cc-number" labelText="Número do Cartão" placeholder="**** **** **** 4242" />
                          </Column>
                          <Column lg={4} md={2} sm={4} style={{ marginTop: '1rem' }}>
                            <TextInput id="cc-cvv" labelText="CVV" placeholder="123" />
                          </Column>
                        </Grid>
                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                          <Button kind="primary">Processar Pagamento de Upgrade In-App</Button>
                        </div>
                      </div>
                    </div>

                  </Tile>
                </TabPanel>
              </TabPanels>
            </TabsVertical>
          </Column>
        </Grid>
      </Section>
    </PageLayout>
  );
}
