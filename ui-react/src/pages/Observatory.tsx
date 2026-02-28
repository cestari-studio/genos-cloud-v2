import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Column,
  Grid,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  Tile,
  Section,
  Stack,
} from '@carbon/react';
import { Renew, Save } from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';
import { api } from '../services/api';

type FeedCategory =
  | 'system'
  | 'sync'
  | 'quality_gate'
  | 'sentiment'
  | 'ai_generation'
  | 'feedback'
  | 'schedule'
  | 'compliance';

const FEED_CATEGORIES: FeedCategory[] = [
  'system',
  'sync',
  'quality_gate',
  'sentiment',
  'ai_generation',
  'feedback',
  'schedule',
  'compliance',
];

type VisibilityMap = Record<FeedCategory, boolean>;

function createDefaultVisibility(): VisibilityMap {
  return {
    system: true,
    sync: true,
    quality_gate: true,
    sentiment: true,
    ai_generation: true,
    feedback: true,
    schedule: true,
    compliance: true,
  };
}

function statusTag(status: string) {
  if (status === 'ok') return 'green';
  if (status === 'warning') return 'magenta';
  return 'red';
}

export default function Observatory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [prefsTenantId, setPrefsTenantId] = useState('');
  const [visibility, setVisibility] = useState<VisibilityMap>(createDefaultVisibility());
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const tenantsData = await api.get<any[]>('/observatory/tenants');
      setTenants(tenantsData || []);

      if ((tenantsData || []).length > 0) {
        const firstTenant = tenantsData[0].id;
        setPrefsTenantId((current) => current || firstTenant);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadPrefs = async (tenantId: string) => {
    if (!tenantId) return;
    try {
      const data = await api.get<{ visibility: VisibilityMap }>(
        `/activity-feed/preferences?tenant_id=${tenantId}`
      );
      setVisibility(data.visibility || createDefaultVisibility());
    } catch {
      setVisibility(createDefaultVisibility());
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (prefsTenantId) {
      loadPrefs(prefsTenantId);
    }
  }, [prefsTenantId]);

  const savePreferences = async () => {
    if (!prefsTenantId) return;
    setSavingPrefs(true);
    setPrefsSaved(false);
    try {
      await api.put(`/activity-feed/preferences?tenant_id=${prefsTenantId}`, { visibility });
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2500);
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
        <InlineLoading description="Conectando à camada global do Hub Multi-Tenant..." />
      </div>
    );
  }

  return (
    <PageLayout
      title="Observatory (Master Dashboard)"
      subtitle="Painel Administrativo da Cestari Studio para Roteamento, Frequências Quânticas e Faturamento."
      actions={
        <Button kind="tertiary" size="sm" renderIcon={Renew} onClick={loadData}>
          Atualizar Sinais
        </Button>
      }
    >
      <Section>
        {error && (
          <Grid>
            <Column lg={16}>
              <Tile style={{ backgroundColor: '#262626', border: '1px solid #fa4d56', marginBottom: '1rem' }}>
                <InlineNotification kind="error" title="Erro no Observatory" subtitle={error} hideCloseButton />
              </Tile>
            </Column>
          </Grid>
        )}

        <Grid>
          <Column lg={16}>
            <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', marginTop: '1rem' }}>
              <h3 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '0.5rem' }}>Visibilidade do Activity Feed</h3>
              <p className="cds--type-body-short-01" style={{ color: '#c6c6c6', marginBottom: '1.5rem' }}>
                Controle autoral dos pacotes de eventos expostos aos seus clientes no dashboard deles.
              </p>

              {prefsSaved && (
                <InlineNotification
                  kind="success"
                  title="Governança Expandida"
                  subtitle="A matrix de notificações foi modificada neste Tenant."
                  hideCloseButton
                  style={{ marginBottom: '1rem' }}
                />
              )}

              <Stack gap={5}>
                <Select
                  id="prefs-tenant"
                  labelText="Tenant Alvo"
                  value={prefsTenantId}
                  onChange={(e: any) => setPrefsTenantId(e.target.value)}
                  style={{ backgroundColor: '#393939', color: '#f4f4f4', width: '300px' }}
                >
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id} text={tenant.name} />
                  ))}
                </Select>

                <Grid fullWidth>
                  {FEED_CATEGORIES.map((category) => (
                    <Column key={category} sm={4} md={4} lg={8}>
                      <Checkbox
                        id={`cat-${category}`}
                        labelText={category}
                        checked={visibility[category]}
                        onChange={(_, { checked }) => {
                          setVisibility((prev) => ({ ...prev, [category]: Boolean(checked) }));
                        }}
                      />
                    </Column>
                  ))}
                </Grid>

                <div>
                  <Button
                    kind="primary"
                    size="sm"
                    renderIcon={Save}
                    disabled={savingPrefs || !prefsTenantId}
                    onClick={savePreferences}
                  >
                    {savingPrefs ? 'Injetando Regras...' : 'Atrelar Permissões'}
                  </Button>
                </div>
              </Stack>
            </Tile>
          </Column>
        </Grid>
      </Section>
    </PageLayout>
  );
}
