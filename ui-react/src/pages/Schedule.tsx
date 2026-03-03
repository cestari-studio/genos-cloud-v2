// genOS Lumina — Cronograma / Schedule (Premium)
import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Breadcrumb,
  BreadcrumbItem,
  ProgressIndicator,
  ProgressStep,
  Modal,
  Select,
  SelectItem,
  DatePicker,
  DatePickerInput,
  Checkbox,
  NumberInput,
  DataTableSkeleton,
  Layer,
  InlineNotification,
  IconButton
} from '@carbon/react';
import {
  Add,
  Calendar,
  ChevronRight,
  Information,
  WarningAltFilled,
  CheckmarkFilled,
  RowDelete,
  Edit,
  Restart,
  Launch
} from '@carbon/icons-react';
import { SidePanel } from '@carbon/ibm-products';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../config/locale';
import PageLayout from '../components/PageLayout';
import { useNotifications } from '../components/NotificationProvider';

const STATUS_TAG: Record<string, string> = {
  queued: 'blue',
  processing: 'yellow',
  published: 'green',
  failed: 'red',
  cancelled: 'cool-gray',
};

const PLATFORM_COLOR: Record<string, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  instagram_stories: '#E1306C',
  instagram_reels: '#E1306C',
  whatsapp: '#25D366',
};

export default function Schedule() {
  const { me, refreshWallet } = useAuth();
  const { showToast } = useNotifications();

  const [slots, setSlots] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(0);
  const [availablePosts, setAvailablePosts] = useState<any[]>([]);
  const [newSlotData, setNewSlotData] = useState({
    postId: '',
    platforms: [] as string[],
    scheduledAt: '',
    time: '12:00'
  });
  const [saving, setSaving] = useState(false);

  // Fetch Slots
  const fetchSlots = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const tenantId = api.getActiveTenantId();
      if (!tenantId) return;

      const response = await api.edgeFn('schedule-manager', {
        action: 'list_slots',
        filters: { tenant_id: tenantId }
      }) as any;

      if (response.success) {
        setSlots(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Usage
  const fetchUsage = useCallback(async () => {
    setLoadingUsage(true);
    try {
      const tenantId = api.getActiveTenantId();
      const response = await api.edgeFn('schedule-manager', { action: 'get_usage', tenantId }) as any;
      if (response.success) setUsage(response.data);
    } catch (err) {
      console.error('Usage fetch error:', err);
    } finally {
      setLoadingUsage(false);
    }
  }, []);

  useEffect(() => {
    if (me.config?.schedule_enabled) {
      fetchSlots();
      fetchUsage();

      // Polling status
      const interval = setInterval(() => fetchSlots(true), 30000);
      return () => clearInterval(interval);
    }
  }, [me.config?.schedule_enabled, fetchSlots, fetchUsage]);

  // Available Posts for Modal
  const fetchAvailablePosts = async () => {
    const tenantId = api.getActiveTenantId();
    const { data } = await supabase
      .from('posts')
      .select('id, title, format')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved');
    setAvailablePosts(data || []);
  };

  const handleCreateSlot = async () => {
    setSaving(true);
    try {
      const tenantId = api.getActiveTenantId();
      const fullDateTime = `${newSlotData.scheduledAt}T${newSlotData.time}:00Z`;

      for (const platform of newSlotData.platforms) {
        await api.edgeFn('schedule-manager', {
          action: 'create_slot',
          tenantId,
          postId: newSlotData.postId,
          platform,
          scheduledAt: fullDateTime
        });
      }

      showToast(t('scheduleSuccess'), '', 'success');
      setIsModalOpen(false);
      fetchSlots();
      fetchUsage();
      refreshWallet();
    } catch (err: any) {
      showToast('Erro ao agendar', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSlot = async (id: string) => {
    try {
      await api.edgeFn('schedule-manager', { action: 'cancel_slot', slotId: id });
      showToast('Agendamento cancelado', '', 'info');
      fetchSlots(true);
    } catch (err: any) {
      showToast('Erro', err.message, 'error');
    }
  };

  // Table Data
  const headers = [
    { key: 'post', header: t('scheduleTablePost') },
    { key: 'platform', header: t('scheduleTablePlatform') },
    { key: 'scheduled_at', header: t('scheduleTableScheduled') },
    { key: 'status', header: t('scheduleTableStatus') },
    { key: 'actions', header: '' },
  ];

  const formatRows = (items: any[]) => items.map(slot => ({
    id: slot.id,
    post: (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 600 }}>{slot.posts?.title}</span>
        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{slot.posts?.format}</span>
      </div>
    ),
    platform: (
      <Tag size="sm" style={{ borderLeft: `4px solid ${PLATFORM_COLOR[slot.platform] || '#333'}` }}>
        {slot.platform.toUpperCase().replace('_', ' ')}
      </Tag>
    ),
    scheduled_at: new Date(slot.scheduled_at).toLocaleString('pt-BR'),
    status: (
      <Tag type={STATUS_TAG[slot.status] as any} size="sm">
        {slot.status.toUpperCase()}
      </Tag>
    ),
    actions: slot
  }));

  const rows = useMemo(() => formatRows(slots.filter(s => s.status !== 'published' && s.status !== 'failed')), [slots]);
  const historyRows = useMemo(() => formatRows(slots.filter(s => s.status === 'published' || s.status === 'failed')), [slots]);

  // Premium Gate
  if (!me.config?.schedule_enabled && me.tenant?.depth_level !== 0) {
    return (
      <PageLayout pageName={t('scheduleTitle')} pageDescription={t('scheduleSubtitle')} helpMode>
        <Grid style={{ marginTop: '2rem' }}>
          <Column lg={16}>
            <Tile style={{ padding: '4rem', textAlign: 'center', backgroundColor: '#161616', border: '1px solid #393939' }}>
              <Stack gap={5}>
                <div style={{ position: 'relative', width: 'fit-content', margin: '0 auto' }}>
                  <Calendar size={64} fill="#8d8d8d" />
                  <Tag type="warm-gray" size="sm" style={{ position: 'absolute', top: -10, right: -20, fontWeight: 700 }}>PREMIUM</Tag>
                </div>
                <h1 className="cds--type-productive-heading-05">{t('schedulePremiumTitle')}</h1>
                <p style={{ color: '#c6c6c6', maxWidth: '500px', margin: '0 auto' }}>{t('schedulePremiumDesc')}</p>

                <Grid style={{ marginTop: '2rem' }}>
                  {[
                    { tier: 'Starter', price: '290', posts: '12' },
                    { tier: 'Growth', price: '490', posts: '24' },
                    { tier: 'Scale', price: '890', posts: '50' }
                  ].map(plan => (
                    <Column lg={5} md={4} sm={4} key={plan.tier}>
                      <Tile style={{ padding: '1.5rem', textAlign: 'left', border: '1px solid #333' }}>
                        <h4 style={{ color: '#f4f4f4' }}>{plan.tier}</h4>
                        <h2 style={{ margin: '1rem 0' }}>R$ {plan.price}<span style={{ fontSize: '0.875rem', fontWeight: 400 }}>/mês</span></h2>
                        <p style={{ fontSize: '0.875rem', color: '#a8a8a8' }}>{plan.posts} agendamentos inclusos</p>
                      </Tile>
                    </Column>
                  ))}
                </Grid>

                <div style={{ marginTop: '2rem' }}>
                  <Button kind="primary" onClick={() => window.location.href = 'mailto:suporte@cestari.studio'}>
                    {t('schedulePremiumCta')}
                  </Button>
                </div>
              </Stack>
            </Tile>
          </Column>
        </Grid>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      pageName={t('scheduleTitle')}
      pageDescription={t('scheduleSubtitle')}
      actions={
        <Button
          kind="primary"
          size="sm"
          renderIcon={Add}
          onClick={() => {
            fetchAvailablePosts();
            setIsModalOpen(true);
          }}
        >
          {t('scheduleNew')}
        </Button>
      }
    >
      <Section style={{ marginTop: '1.5rem' }}>
        {usage && (
          <div style={{ marginBottom: '2rem' }}>
            <Tag type={usage.remaining < 3 ? 'red' : 'blue'} size="md">
              {usage.used} / {usage.limit} agendamentos utilizados este mês
            </Tag>
          </div>
        )}

        <Tabs>
          <TabList aria-label="Schedule Views" activation="manual">
            <Tab>{t('scheduleTabQueue')}</Tab>
            <Tab>{t('scheduleTabCalendar')}</Tab>
            <Tab>{t('scheduleTabHistory')}</Tab>
          </TabList>
          <TabPanels>
            {/* Tab 1: Fila */}
            <TabPanel>
              {loading ? <DataTableSkeleton headers={headers} rowCount={5} /> : (
                <DataTable rows={rows} headers={headers}>
                  {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps, onInputChange }: any) => (
                    <TableContainer>
                      <TableToolbar>
                        <TableToolbarContent>
                          <TableToolbarSearch onChange={onInputChange} placeholder="Buscar post ou plataforma..." />
                        </TableToolbarContent>
                      </TableToolbar>
                      <Table {...getTableProps()} size="sm">
                        <TableHead>
                          <TableRow>
                            {tableHeaders.map((h: any) => (
                              <TableHeader {...getHeaderProps({ header: h })}>{h.header}</TableHeader>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {tableRows.length === 0 ? (
                            <TableRow><TableCell colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>{t('scheduleEmptyQueue')}</TableCell></TableRow>
                          ) : tableRows.map((row: any) => (
                            <TableRow {...getRowProps({ row })}>
                              {row.cells.map((cell: any) => {
                                if (cell.info.header === 'actions') {
                                  const slotData = cell.value;
                                  return (
                                    <TableCell key={cell.id} style={{ textAlign: 'right' }}>
                                      <OverflowMenu size="sm" flipped>
                                        <OverflowMenuItem itemText="Ver Detalhes" onClick={() => { setSelectedSlot(slotData); setPanelOpen(true); }} />
                                        <OverflowMenuItem itemText="Alterar Horário" disabled={slotData.status === 'processing'} />
                                        <OverflowMenuItem
                                          itemText="Cancelar"
                                          isDelete
                                          hasDivider
                                          onClick={() => handleCancelSlot(slotData.id)}
                                          disabled={slotData.status === 'processing' || slotData.status === 'cancelled'}
                                        />
                                      </OverflowMenu>
                                    </TableCell>
                                  );
                                }
                                return <TableCell key={cell.id}>{cell.value}</TableCell>;
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </DataTable>
              )}
            </TabPanel>

            {/* Tab 2: Calendário Placeholder */}
            <TabPanel>
              <Tile style={{ padding: '4rem', textAlign: 'center', backgroundColor: '#161616', border: '1px dashed #333' }}>
                <Calendar size={48} fill="#525252" style={{ marginBottom: '1rem' }} />
                <h4>Em Breve: Visualização em Calendário</h4>
                <p style={{ color: '#8d8d8d' }}>Estamos preparando uma interface interativa para você arrastar e soltar seus posts.</p>
              </Tile>
            </TabPanel>

            {/* Tab 3: Histórico */}
            <TabPanel>
              <DataTable rows={historyRows} headers={headers}>
                {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }: any) => (
                  <TableContainer>
                    <Table {...getTableProps()} size="sm">
                      <TableHead>
                        <TableRow>
                          {tableHeaders.map((h: any) => (
                            <TableHeader {...getHeaderProps({ header: h })}>{h.header}</TableHeader>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tableRows.map((row: any) => (
                          <TableRow {...getRowProps({ row })}>
                            {row.cells.map((cell: any) => {
                              if (cell.info.header === 'actions') {
                                const slotData = cell.value;
                                return (
                                  <TableCell key={cell.id} style={{ textAlign: 'right' }}>
                                    <IconButton label="Ver Detalhes" kind="ghost" size="sm" onClick={() => { setSelectedSlot(slotData); setPanelOpen(true); }}>
                                      <ChevronRight />
                                    </IconButton>
                                  </TableCell>
                                );
                              }
                              return <TableCell key={cell.id}>{cell.value}</TableCell>;
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </DataTable>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Section>

      {/* Side Panel: Slot Details */}
      <SidePanel
        open={panelOpen}
        onRequestClose={() => setPanelOpen(false)}
        title={selectedSlot?.posts?.title || 'Detalhes do Agendamento'}
        subtitle={`${selectedSlot?.platform.toUpperCase() || ''} | ${new Date(selectedSlot?.scheduled_at).toLocaleString() || ''}`}
        size="md"
        actions={[
          {
            label: 'Republicar',
            onClick: () => { },
            kind: 'ghost',
            icon: Restart,
            disabled: selectedSlot?.status !== 'failed'
          },
          {
            label: 'Ver na Plataforma',
            onClick: () => { },
            kind: 'primary',
            icon: Launch,
            disabled: !selectedSlot?.external_post_id
          }
        ]}
      >
        {selectedSlot && (
          <div style={{ padding: '1rem' }}>
            <Stack gap={6}>
              <StructuredListWrapper isCondensed>
                <StructuredListBody>
                  <StructuredListRow>
                    <StructuredListCell noWrap>Status</StructuredListCell>
                    <StructuredListCell>
                      <Tag type={STATUS_TAG[selectedSlot.status] as any} size="sm">{selectedSlot.status.toUpperCase()}</Tag>
                    </StructuredListCell>
                  </StructuredListRow>
                  <StructuredListRow>
                    <StructuredListCell noWrap>Alvo</StructuredListCell>
                    <StructuredListCell>{selectedSlot.platform}</StructuredListCell>
                  </StructuredListRow>
                  <StructuredListRow>
                    <StructuredListCell noWrap>Tentativas</StructuredListCell>
                    <StructuredListCell>{selectedSlot.retry_count || 0} / 3</StructuredListCell>
                  </StructuredListRow>
                </StructuredListBody>
              </StructuredListWrapper>

              {selectedSlot.last_error && (
                <InlineNotification
                  kind="error"
                  title="Erro no Último Disparo"
                  subtitle={selectedSlot.last_error}
                  lowContrast
                  hideCloseButton
                />
              )}

              <div style={{ padding: '1rem', backgroundColor: '#262626', borderRadius: '4px' }}>
                <Breadcrumb noTrailingSlash>
                  <BreadcrumbItem>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckmarkFilled fill="#24a148" /> {t('matrixPendingReview')}
                    </div>
                  </BreadcrumbItem>
                  <BreadcrumbItem>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectedSlot.status === 'published' ? <CheckmarkFilled fill="#24a148" /> : <Restart fill="#0f62fe" />} Fila Processamento
                    </div>
                  </BreadcrumbItem>
                  <BreadcrumbItem isCurrentPage={selectedSlot.status === 'published'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectedSlot.status === 'published' ? <CheckmarkFilled fill="#24a148" /> : <ChevronRight />} Publicação
                    </div>
                  </BreadcrumbItem>
                </Breadcrumb>
              </div>
            </Stack>
          </div>
        )}
      </SidePanel>

      {/* Modal: Novo Agendamento */}
      <Modal
        open={isModalOpen}
        modalHeading={t('scheduleModalNew')}
        primaryButtonText={modalStep === 3 ? t('scheduleStepConfirm') : t('dashboard') + ' >'}
        secondaryButtonText={modalStep === 0 ? t('cancel') : '< Voltar'}
        onRequestClose={() => setIsModalOpen(false)}
        onRequestSubmit={() => {
          if (modalStep < 3) setModalStep(s => s + 1);
          else handleCreateSlot();
        }}
        onSecondarySubmit={() => {
          if (modalStep > 0) setModalStep(s => s - 1);
          else setIsModalOpen(false);
        }}
        primaryButtonDisabled={saving || (modalStep === 0 && !newSlotData.postId) || (modalStep === 1 && newSlotData.platforms.length === 0) || (modalStep === 2 && !newSlotData.scheduledAt)}
      >
        <Stack gap={6}>
          <ProgressIndicator currentIndex={modalStep} spaceEqually>
            <ProgressStep label={t('scheduleStepPost')} />
            <ProgressStep label={t('scheduleStepPlatform')} />
            <ProgressStep label={t('scheduleStepTime')} />
            <ProgressStep label={t('scheduleStepConfirm')} />
          </ProgressIndicator>

          <Layer style={{ padding: '1rem 0' }}>
            {modalStep === 0 && (
              <Select
                id="select-post"
                labelText={t('scheduleSelectPost')}
                onChange={(e) => setNewSlotData(d => ({ ...d, postId: e.target.value }))}
                value={newSlotData.postId}
              >
                <SelectItem value="" text="Selecione um post..." />
                {availablePosts.map(p => (
                  <SelectItem key={p.id} value={p.id} text={`${p.title} (${p.format})`} />
                ))}
              </Select>
            )}

            {modalStep === 1 && (
              <Stack gap={4}>
                <p style={{ fontWeight: 600 }}>Canais de Destino</p>
                <Checkbox
                  id="ig"
                  labelText="Instagram Feed"
                  checked={newSlotData.platforms.includes('instagram')}
                  onChange={(_, { checked }) => setNewSlotData(d => ({ ...d, platforms: checked ? [...d.platforms, 'instagram'] : d.platforms.filter(p => p !== 'instagram') }))}
                />
                <Checkbox
                  id="fb"
                  labelText="Facebook Feed"
                  checked={newSlotData.platforms.includes('facebook')}
                  onChange={(_, { checked }) => setNewSlotData(d => ({ ...d, platforms: checked ? [...d.platforms, 'facebook'] : d.platforms.filter(p => p !== 'facebook') }))}
                />
                <Checkbox
                  id="igs"
                  labelText="Instagram Stories"
                  checked={newSlotData.platforms.includes('instagram_stories')}
                  onChange={(_, { checked }) => setNewSlotData(d => ({ ...d, platforms: checked ? [...d.platforms, 'instagram_stories'] : d.platforms.filter(p => p !== 'instagram_stories') }))}
                />
              </Stack>
            )}

            {modalStep === 2 && (
              <Stack gap={5}>
                <DatePicker datePickerType="single" onChange={([d]) => d && setNewSlotData(prev => ({ ...prev, scheduledAt: d.toISOString().split('T')[0] }))}>
                  <DatePickerInput id="sched-date" labelText="Data do Disparo" placeholder="dd/mm/aaaa" />
                </DatePicker>
                <Select id="sched-time" labelText="Horário (Fuso Local)" value={newSlotData.time} onChange={(e) => setNewSlotData(d => ({ ...d, time: e.target.value }))}>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <SelectItem key={i} value={`${String(i).padStart(2, '0')}:00`} text={`${String(i).padStart(2, '0')}:00`} />
                  ))}
                </Select>
              </Stack>
            )}

            {modalStep === 3 && (
              <Tile>
                <p style={{ color: '#8d8d8d', fontSize: '0.875rem' }}>Resumo do Agendamento</p>
                <h4 style={{ marginTop: '0.5rem' }}>{availablePosts.find(p => p.id === newSlotData.postId)?.title}</h4>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {newSlotData.platforms.map(p => <Tag key={p} size="sm">{p.toUpperCase()}</Tag>)}
                </div>
                <p style={{ marginTop: '1rem' }}>
                  <strong>Disparo:</strong> {newSlotData.scheduledAt} às {newSlotData.time}
                </p>
              </Tile>
            )}
          </Layer>

          {saving && <InlineLoading description={t('scheduleProcessing')} />}
        </Stack>
      </Modal>
    </PageLayout>
  );
}
