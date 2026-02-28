// genOS Lumina — Content Factory (Addendum H §8.4)
import { useEffect, useState } from 'react';
import {
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
  TableToolbarSearch,
  TableToolbarContent,
  Tag,
  Button,
  OverflowMenu,
  OverflowMenuItem,
  Tile,
  Pagination,
  Select,
  SelectItem,
  Section,
  Grid,
  Column,
  Stack,
  preview__IconIndicator as IconIndicator,
  DataTableSkeleton,
} from '@carbon/react';
import {
  Add,
  Renew,
} from '@carbon/icons-react';
import { api } from '../services/api';
import PageLayout from '../components/PageLayout';
import { useNotifications } from '../components/NotificationProvider';

const STATUS_TAG: Record<string, string> = {
  draft: 'cool-gray',
  review: 'magenta',
  pending_review: 'magenta',
  approved: 'blue',
  published: 'green',
  archived: 'purple',
  rejected: 'red',
};

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function Factory() {
  const { showToast } = useNotifications();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ items: any[]; total: number }>('/content');
      setItems(data?.items || []);
    } catch (err: any) {
      const msg = String(err.message || err);
      setError(msg);
      showToast('Falha na Engine de Conteúdo', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = statusFilter
    ? items.filter(i => i.status === statusFilter)
    : items;

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const headers = [
    { key: 'title', header: 'Titulo' },
    { key: 'content_type', header: 'Tipo' },
    { key: 'platform', header: 'Plataforma' },
    { key: 'status', header: 'Status' },
    { key: 'compliance_score', header: 'DNA Score' },
    { key: 'ai_provider_used', header: 'Agente LLM' },
    { key: 'updated_at', header: 'Atualizado' },
    { key: 'actions', header: '' },
  ];

  const rows = paginated.map((item: any) => ({
    id: item.id,
    title: item.title || '—',
    content_type: item.content_type || '—',
    platform: item.platform || '—',
    status: item.status,
    compliance_score: item.compliance_score,
    ai_provider_used: item.ai_provider_used || '—',
    updated_at: item.updated_at,
    actions: '',
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem', padding: '0 2rem' }}>
        <DataTableSkeleton
          headers={headers.map(h => ({ header: h.header, key: h.key }))}
          rowCount={5}
          columnCount={headers.length}
          showHeader={false}
        />
        <p className="cds--type-label-01" style={{ color: '#0f62fe' }}>Calibrando tensores na Matrix Grid...</p>
      </div>
    );
  }

  return (
    <PageLayout
      title="Content Factory: Editor & Builder"
      subtitle="Esteira de geração massiva governada pelo genOS Constraint Kernel."
    >
      <Section>
        {error ? (
          <Grid>
            <Column lg={16}>
              <Tile style={{ backgroundColor: '#262626', border: '1px solid #fa4d56' }}>
                <Stack gap={4}>
                  <p className="cds--type-productive-heading-03" style={{ color: '#fa4d56' }}>Falha na orquestração dos dados</p>
                  <p style={{ color: '#c6c6c6' }}>{error}</p>
                  <Button kind="tertiary" size="sm" onClick={loadData} renderIcon={Renew}>Repetir Chamada</Button>
                </Stack>
              </Tile>
            </Column>
          </Grid>
        ) : (
          <Grid>
            <Column lg={16}>
              <div style={{ border: '1px solid #393939' }}>
                <DataTable rows={rows} headers={headers}>
                  {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }: any) => (
                    <TableContainer
                      title="Content Generation Metrics"
                      description="Gestão de todo conteúdo sintetizado via IA."
                      decorator={
                        <AILabel size="sm">
                          <AILabelContent>
                            <div style={{ padding: '0.5rem', maxWidth: '250px' }}>
                              <p className="secondary">AI Assisted Operation</p>
                              <p className="secondary">Gestão preditiva e auditoria contínua de DNA de marca via Constraint Kernel.</p>
                            </div>
                          </AILabelContent>
                        </AILabel>
                      }
                      style={{ margin: 0 }}
                    >
                      <TableToolbar style={{ backgroundColor: '#262626' }}>
                        <TableToolbarContent>
                          <TableToolbarSearch
                            onChange={(e: any) => {
                              const q = e.target?.value?.toLowerCase() || '';
                              if (!q) { loadData(); return; }
                              setItems(prev => prev.filter(i =>
                                (i.title || '').toLowerCase().includes(q) ||
                                (i.content_type || '').toLowerCase().includes(q)
                              ));
                            }}
                            placeholder="Buscar ativos..."
                          />
                          <Select
                            id="status-filter"
                            size="sm"
                            hideLabel
                            value={statusFilter}
                            onChange={(e: any) => { setStatusFilter(e.target.value); setPage(1); }}
                            style={{ width: '200px', backgroundColor: '#393939', color: '#f4f4f4' }}
                          >
                            <SelectItem value="" text="Status Quântico (Todos)" />
                            {Object.keys(STATUS_TAG).map(s => (
                              <SelectItem key={s} value={s} text={s} />
                            ))}
                          </Select>
                          <Button
                            kind="primary"
                            size="sm"
                            renderIcon={Add}
                            onClick={() => showToast('Workflow Acionado', 'Iniciando ingestão de dados para MasterCompliance...', 'info')}
                          >
                            Orquestrar Criação
                          </Button>
                        </TableToolbarContent>
                      </TableToolbar>
                      <Table {...getTableProps()} size="sm">
                        <TableHead>
                          <TableRow>
                            {tableHeaders.map((h: any) => (
                              <TableHeader {...getHeaderProps({ header: h })} key={h.key}>
                                {h.header}
                              </TableHeader>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {tableRows.map((row: any) => (
                            <TableRow {...getRowProps({ row })} key={row.id}>
                              {row.cells.map((cell: any) => {
                                let content: any = cell.value;

                                if (cell.info.header === 'status') {
                                  const kindMap: Record<string, any> = {
                                    draft: 'not-started',
                                    review: 'in-progress',
                                    pending_review: 'pending',
                                    approved: 'normal',
                                    published: 'succeeded',
                                    archived: 'unknown',
                                    rejected: 'failed',
                                  };
                                  content = <IconIndicator kind={kindMap[cell.value] || 'unknown'} label={cell.value} />;
                                } else if (cell.info.header === 'compliance_score') {
                                  const score = Number(cell.value || 0);
                                  const scoreType = score >= 75 ? 'green' : score >= 40 ? 'blue' : 'red';
                                  content = (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <Tag type={scoreType as any} size="sm">{score ? `${score}%` : '—'}</Tag>
                                      <AILabel
                                        size="mini"
                                        kind="inline"
                                        AILabelContent={(
                                          <AILabelContent>
                                            <div style={{ padding: '0.5rem', minWidth: '250px' }}>
                                              <p style={{ marginBottom: '0.5rem' }}><strong>Auditoria de Conformidade</strong></p>
                                              <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>Heurística:</strong> MasterCompliance (Constraint Kernel).</p>
                                              <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>Agente:</strong> IBM Granite & AuraHelian.</p>
                                            </div>
                                          </AILabelContent>
                                        )}
                                      />
                                    </div>
                                  );
                                } else if (cell.info.header === 'updated_at') {
                                  content = timeAgo(cell.value);
                                } else if (cell.info.header === 'actions') {
                                  content = (
                                    <OverflowMenu size="sm" flipped>
                                      <OverflowMenuItem itemText="Editar Texto" />
                                      <OverflowMenuItem itemText="Inspecionar (Auditor)" />
                                      <OverflowMenuItem itemText="Trigger Publicar" />
                                      <OverflowMenuItem hasDivider isDelete itemText="Remover" />
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

                <Pagination
                  totalItems={filtered.length}
                  pageSize={pageSize}
                  page={page}
                  pageSizes={[10, 25, 50]}
                  onChange={({ page: p, pageSize: ps }: any) => {
                    setPage(p);
                    setPageSize(ps);
                  }}
                  style={{ backgroundColor: '#262626', borderTop: '1px solid #393939' }}
                />
              </div>
            </Column>
          </Grid>
        )}
      </Section>
    </PageLayout>
  );
}
