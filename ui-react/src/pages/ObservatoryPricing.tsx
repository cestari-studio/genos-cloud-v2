import { useEffect, useState } from 'react';
import {
  AILabel,
  AILabelContent,
  Button,
  Column,
  DataTable,
  Grid,
  InlineLoading,
  InlineNotification,
  NumberInput,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from '@carbon/react';
import { Renew } from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';
import { api } from '../services/api';
import { supabase } from '../services/supabase';

export default function ObservatoryPricing() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [simInput, setSimInput] = useState(1000);
  const [simOutput, setSimOutput] = useState(500);
  const [simulation, setSimulation] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pricingRes, tenantsRes] = await Promise.all([
        supabase.from('pricing_rules').select('*').order('created_at', { ascending: false }),
        supabase.from('tenants').select('id, name, slug, plan').order('name'),
      ]);
      setRows(pricingRes.data || []);
      setTenants(tenantsRes.data || []);
      if ((tenantsRes.data || []).length > 0) {
        setTenantId((current) => current || tenantsRes.data![0].id);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const runSimulation = async () => {
    if (!tenantId) return;
    try {
      const data = await api.edgeFn('pricing-simulate', {
        tenant_id: tenantId,
        provider: 'google',
        model: 'gemini-2.0-flash',
        input_tokens: simInput,
        output_tokens: simOutput,
      });
      setSimulation(data);
    } catch (err) {
      setError(String(err));
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <InlineLoading description="Carregando pricing..." />
      </div>
    );
  }

  return (
    <PageLayout
      pageSubtitle="Pricing — Configuração de Custos"
      helpMode
      actions={
        <Button kind="tertiary" size="sm" renderIcon={Renew} onClick={loadData}>
          Atualizar
        </Button>
      }
    >
      {error && <InlineNotification kind="error" title="Erro de pricing" subtitle={error} />}

      <div className="page-section">
        <DataTable
          rows={rows.map((row, idx) => ({ id: String(idx), ...row }))}
          headers={[
            { key: 'strategy', header: 'Estratégia' },
            { key: 'tenant_id', header: 'Tenant' },
            { key: 'provider', header: 'Provider' },
            { key: 'model', header: 'Model' },
            { key: 'markup_pct', header: 'Markup %' },
            { key: 'flat_fee_per_1k_tokens', header: 'Flat Fee /1k' },
            { key: 'is_active', header: 'Status' },
          ]}
        >
          {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
            <Table {...getTableProps()} size="sm">
              <TableHead>
                <TableRow>
                  {headers.map((header: any) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((row: any) => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map((cell: any) => {
                      if (cell.info.header === 'is_active') {
                        return (
                          <TableCell key={cell.id}>
                            <Tag type={cell.value ? 'green' : 'red'} size="sm">
                              {cell.value ? 'Ativo' : 'Inativo'}
                            </Tag>
                          </TableCell>
                        );
                      }
                      return <TableCell key={cell.id}>{String(cell.value ?? '')}</TableCell>;
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataTable>

        <Grid fullWidth>
          <Column sm={4} md={8} lg={10}>
            <Tile className="page-card">
              <h3 className="section-title">Simulação de custo</h3>

              <div className="section-stack">
                <Select
                  id="sim-tenant"
                  labelText="Tenant"
                  value={tenantId}
                  onChange={(e: any) => setTenantId(e.target.value)}
                >
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id} text={tenant.name} />
                  ))}
                </Select>

                <NumberInput
                  id="sim-input"
                  label="Input tokens"
                  min={1}
                  step={100}
                  value={simInput}
                  onChange={(_, { value }) => setSimInput(Number(value || 0))}
                />

                <NumberInput
                  id="sim-output"
                  label="Output tokens"
                  min={1}
                  step={100}
                  value={simOutput}
                  onChange={(_, { value }) => setSimOutput(Number(value || 0))}
                />

                <Button kind="primary" size="sm" onClick={runSimulation}>
                  Simular
                </Button>
              </div>
            </Tile>
          </Column>

          <Column sm={4} md={8} lg={6}>
            <Tile className="page-card">
              <h3 className="section-title">Resumo de simulação</h3>
              {simulation ? (
                <div className="section-stack">
                  <div className="inline-ai-badge">
                    <Tag type="blue" size="sm">estimativa</Tag>
                    <AILabel
                      size="mini"
                      kind="inline"
                      AILabelContent={<AILabelContent>Simulação calculada pelo motor de pricing do genOS.</AILabelContent>}
                    />
                  </div>
                  <p className="no-margin">
                    Agência: <strong>USD {Number(simulation.agencyCostUsd || 0).toFixed(6)}</strong>
                  </p>
                  <p className="no-margin">
                    Cliente: <strong>USD {Number(simulation.clientCostUsd || 0).toFixed(6)}</strong>
                  </p>
                  <p className="no-margin">
                    Margem: <strong>{Number(simulation.marginUsd || 0).toFixed(6)}</strong>
                  </p>
                </div>
              ) : (
                <p className="section-description">Execute uma simulação para visualizar o resumo.</p>
              )}
            </Tile>
          </Column>
        </Grid>
      </div>
    </PageLayout>
  );
}
