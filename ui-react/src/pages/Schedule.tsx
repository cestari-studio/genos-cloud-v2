// genOS Lumina — Cronograma / Schedule (Addendum H §8.7)
import { useEffect, useState } from 'react';
import {
  AILabel,
  AILabelContent,
  ButtonSet,
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
  Tag,
  Button,
  OverflowMenu,
  OverflowMenuItem,
  InlineLoading,
  Tile,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  TextArea,
  Section,
  Grid,
  Column,
  Stack,
} from '@carbon/react';
import {
  Add,
  Calendar,
} from '@carbon/icons-react';
import { SidePanel } from '@carbon/ibm-products';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import PageLayout from '../components/PageLayout';

const STATUS_TAG: Record<string, string> = {
  draft: 'cool-gray',
  scheduled: 'blue',
  published: 'green',
  cancelled: 'red',
};

export default function Schedule() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const tenantId = api.getActiveTenantId();
      if (!tenantId) { setItems([]); return; }
      const { data, error: e } = await supabase
        .from('posts')
        .select('*')
        .eq('tenant_id', tenantId)
        .or('scheduled_date.not.is.null,status.eq.approved')
        .order('scheduled_date', { ascending: true });
      if (e) throw new Error(e.message);
      setItems(data || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const headers = [
    { key: 'title', header: 'Título' },
    { key: 'content_type', header: 'Formato' },
    { key: 'platform', header: 'Plataforma' },
    { key: 'status', header: 'Status Quântico' },
    { key: 'scheduled_at', header: 'Disparo Agendado' },
    { key: 'actions', header: '' },
  ];

  const rows = items.map((item: any) => ({
    id: item.id,
    title: item.title || '—',
    content_type: item.content_type || '—',
    platform: item.platform || '—',
    status: item.status,
    scheduled_at: item.scheduled_date
      ? `${new Date(item.scheduled_date).toLocaleDateString('pt-BR')} ${item.time_slot || ''}`.trim()
      : '—',
    actions: '',
  }));

  const openDetails = (id: string) => {
    const item = items.find((entry) => entry.id === id) || null;
    setSelectedItem(item);
    setPanelOpen(Boolean(item));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
        <InlineLoading description="Computando cronograma de inferência..." />
      </div>
    );
  }

  return (
    <PageLayout
      pageSubtitle="Terminal de Agendamento"
      helpMode
    >
      <Section>
        {error ? (
          <Grid>
            <Column lg={16}>
              <Tile style={{ backgroundColor: '#262626', border: '1px solid #fa4d56' }}>
                <p className="cds--type-productive-heading-03" style={{ color: '#fa4d56' }}>Falha no Roteamento</p>
                <p style={{ color: '#c6c6c6' }}>{error}</p>
              </Tile>
            </Column>
          </Grid>
        ) : items.length === 0 ? (
          <Grid>
            <Column lg={16}>
              <Tile style={{ backgroundColor: '#262626', border: '1px dashed #525252', textAlign: 'center', padding: '3rem' }}>
                <Calendar size={48} fill="#525252" style={{ marginBottom: '1rem' }} />
                <h3 className="cds--type-productive-heading-03" style={{ color: '#c6c6c6' }}>Filas Ociosas</h3>
                <p style={{ color: '#8d8d8d' }}>Não há tokens aguardando publicação. Envie artefatos pela Content Factory.</p>
              </Tile>
            </Column>
          </Grid>
        ) : (
          <Grid>
            <Column lg={16}>
              <div style={{ border: '1px solid #393939' }}>
                <DataTable rows={rows} headers={headers}>
                  {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }: any) => (
                    <TableContainer style={{ margin: 0 }}>
                      <TableToolbar style={{ backgroundColor: '#262626' }}>
                        <TableToolbarContent>
                          <TableToolbarSearch placeholder="Buscar lotes de conteúdo..." />
                          <Button kind="primary" size="sm" renderIcon={Add}>Forçar Disparo</Button>
                        </TableToolbarContent>
                      </TableToolbar>
                      <Table {...getTableProps()} size="sm">
                        <TableHead>
                          <TableRow>
                            {tableHeaders.map((h: any) => (
                              <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {tableRows.map((row: any) => (
                            <TableRow {...getRowProps({ row })} key={row.id}>
                              {row.cells.map((cell: any) => {
                                let content: any = cell.value;
                                if (cell.info.header === 'status') {
                                  content = <Tag type={(STATUS_TAG[cell.value] || 'cool-gray') as any} size="sm">{cell.value}</Tag>;
                                } else if (cell.info.header === 'actions') {
                                  content = (
                                    <OverflowMenu size="sm" flipped>
                                      <OverflowMenuItem itemText="Ver detalhes (Helian AI)" onClick={() => openDetails(row.id)} />
                                      <OverflowMenuItem itemText="Re-escrever Prompt" />
                                      <OverflowMenuItem itemText="Publicar Instantaneamente" />
                                      <OverflowMenuItem hasDivider isDelete itemText="Cancelar Fluxo" />
                                    </OverflowMenu>
                                  );
                                }
                                return <TableCell key={cell.id}>{content}</TableCell>;
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </DataTable>
              </div>
            </Column>
          </Grid>
        )}

        <SidePanel
          open={panelOpen}
          onRequestClose={() => setPanelOpen(false)}
          title={selectedItem?.title || 'Detalhes do Lote de Inferência'}
          subtitle="Governança de Pós-Publicação"
          size="md"
          aiLabel={(
            <div style={{ padding: '0 1rem 1rem' }}>
              <AILabel
                size="sm"
                AILabelContent={(
                  <AILabelContent>
                    <div style={{ padding: '0.5rem', minWidth: '250px' }}>
                      <p style={{ marginBottom: '0.5rem' }}><strong>MasterCompliance Tensor</strong></p>
                      <p style={{ margin: 0, fontSize: '0.875rem' }}>Padrão IBM Granite-13B aplicado neste artefato.</p>
                      <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>Feedback:</strong> Pontuação e aderência válidas.</p>
                    </div>
                  </AILabelContent>
                )}
              />
            </div>
          )}
        >
          {selectedItem ? (
            <div style={{ padding: '1rem' }}>
              <Stack gap={5}>
                <StructuredListWrapper isCondensed>
                  <StructuredListBody>
                    <StructuredListRow>
                      <StructuredListCell>Status</StructuredListCell>
                      <StructuredListCell>
                        <Tag type={(STATUS_TAG[selectedItem.status] || 'cool-gray') as any} size="sm">
                          {selectedItem.status}
                        </Tag>
                      </StructuredListCell>
                    </StructuredListRow>
                    <StructuredListRow>
                      <StructuredListCell>Formato Alvo</StructuredListCell>
                      <StructuredListCell>{selectedItem.content_type || '—'}</StructuredListCell>
                    </StructuredListRow>
                    <StructuredListRow>
                      <StructuredListCell>Plataforma Externa</StructuredListCell>
                      <StructuredListCell>{selectedItem.platform || '—'}</StructuredListCell>
                    </StructuredListRow>
                    <StructuredListRow>
                      <StructuredListCell>Timeline</StructuredListCell>
                      <StructuredListCell>{selectedItem.scheduled_date ? new Date(selectedItem.scheduled_date).toLocaleDateString('pt-BR') : '—'}</StructuredListCell>
                    </StructuredListRow>
                  </StructuredListBody>
                </StructuredListWrapper>

                <TextArea
                  id="schedule-feedback"
                  labelText="Sinal de Correção do LLM (Feedback Opcional)"
                  placeholder="Se necessário, adicione um prompt de refinamento..."
                  rows={3}
                />

                <ButtonSet>
                  <Button kind="primary" size="sm">Aprovar Envio</Button>
                  <Button kind="danger" size="sm">Barrar Artefato</Button>
                  <Button kind="tertiary" size="sm">Regenerar Node</Button>
                </ButtonSet>
              </Stack>
            </div>
          ) : null}
        </SidePanel>
      </Section>
    </PageLayout>
  );
}
