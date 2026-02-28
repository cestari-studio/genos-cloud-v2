// genOS Lumina — CSV Browser (Addendum H §8.5)
import { useEffect, useState } from 'react';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Tile,
  Tag,
  Button,
  InlineLoading,
  Accordion,
  AccordionItem,
  Section,
  Grid,
  Column,
  Stack,
} from '@carbon/react';
import {
  Renew,
  Upload,
  DataTable as CsvIcon,
} from '@carbon/icons-react';
import { api } from '../services/api';
import PageLayout from '../components/PageLayout';

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

export default function CsvBrowser() {
  const [registries, setRegistries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>('/csv-registry');
      setRegistries(data || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const headers = [
    { key: 'csv_slug', header: 'CSV Slug' },
    { key: 'sync_direction', header: 'Direção' },
    { key: 'row_count', header: 'Linhas Sincronizadas' },
    { key: 'last_sync_at', header: 'Última Instância (Sync)' },
  ];

  const rows = registries.map((r: any) => ({
    id: r.id,
    csv_slug: r.csv_slug,
    sync_direction: r.sync_direction,
    row_count: r.row_count ?? '—',
    last_sync_at: r.last_sync_at,
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
        <InlineLoading description="Varrendo tensores CSV..." />
      </div>
    );
  }

  return (
    <PageLayout
      title="CSV Browser"
      subtitle="Fontes de dados brutas e vetores sincronizados para o Kernel."
      actions={(
        <Stack orientation="horizontal" gap={3}>
          <Button kind="tertiary" size="sm" renderIcon={Renew} onClick={loadData}>Atualizar Matriz</Button>
          <Button kind="primary" size="sm" renderIcon={Upload}>Ingerir CSV</Button>
        </Stack>
      )}
    >
      <Section>
        {error ? (
          <Grid>
            <Column lg={16}>
              <Tile style={{ backgroundColor: '#262626', border: '1px solid #fa4d56' }}>
                <Stack gap={4}>
                  <p className="cds--type-productive-heading-03" style={{ color: '#fa4d56' }}>Falha no Roteamento de Dados</p>
                  <p style={{ color: '#c6c6c6' }}>{error}</p>
                </Stack>
              </Tile>
            </Column>
          </Grid>
        ) : registries.length === 0 ? (
          <Grid>
            <Column lg={16}>
              <Tile style={{ backgroundColor: '#262626', border: '1px dashed #525252', textAlign: 'center', padding: '3rem' }}>
                <CsvIcon size={48} fill="#525252" style={{ marginBottom: '1rem' }} />
                <h3 className="cds--type-productive-heading-03" style={{ color: '#c6c6c6' }}>Nenhum Vetor CSV Identificado</h3>
                <p style={{ color: '#8d8d8d' }}>Carregue arquivos CSV para treinar parâmetros contextuais da conta.</p>
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
                                if (cell.info.header === 'sync_direction') {
                                  content = <Tag type={cell.value === 'push' ? 'green' : cell.value === 'pull' ? 'blue' : 'cool-gray'} size="sm">{cell.value}</Tag>;
                                } else if (cell.info.header === 'last_sync_at') {
                                  content = timeAgo(cell.value);
                                } else if (cell.info.header === 'row_count') {
                                  content = typeof cell.value === 'number' ? new Intl.NumberFormat('pt-BR').format(cell.value) : cell.value;
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
      </Section>
    </PageLayout>
  );
}
