// genOS Lumina — Cronograma / Schedule (Premium)
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  AILabel,
  AILabelContent,
  ButtonSet,
  ClickableTile,
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
  ChevronLeft,
  ChevronRight,
  Close,
  Information,
  WarningAltFilled,
  CheckmarkFilled,
  RowDelete,
  Edit,
  Restart,
  Launch
} from '@carbon/icons-react';
import { SidePanel } from '@carbon/ibm-products';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/shared/contexts/AuthContext';
import { t } from '@/config/locale';
import PageLayout from '@/components/PageLayout';
import { useNotifications } from '@/components/NotificationProvider';

import './Schedule.scss';

const STATUS_TAG: Record<string, string> = {
  queued: 'blue',
  processing: 'yellow',
  published: 'green',
  failed: 'red',
  cancelled: 'cool-gray',
};

// Maps platform ID to Carbon Tag type — NO hex colors
const PLATFORM_TAG_TYPE: Record<string, string> = {
  instagram: 'magenta',
  facebook: 'blue',
  instagram_stories: 'purple',
  instagram_reels: 'warm-gray',
  whatsapp: 'green',
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
  const [stripeLoading, setStripeLoading] = useState<string | null>(null);

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

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [daySidePanelOpen, setDaySidePanelOpen] = useState(false);

  const calPrev = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const calNext = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };
  const calToday = () => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); };

  // Build 6-row × 7-col calendar cells
  const buildCalendarCells = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrev = new Date(calYear, calMonth, 0).getDate();
    const cells: { date: Date; isCurrentMonth: boolean }[] = [];
    // Fill from prev month
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ date: new Date(calYear, calMonth - 1, daysInPrev - i), isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(calYear, calMonth, d), isCurrentMonth: true });
    }
    // Fill to complete grid (max 42)
    let nextDay = 1;
    while (cells.length < 42) {
      cells.push({ date: new Date(calYear, calMonth + 1, nextDay++), isCurrentMonth: false });
    }
    return cells;
  };

  const slotsForDay = (date: Date) =>
    slots.filter(s => {
      const d = new Date(s.scheduled_at);
      return d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate();
    });

  const selectedDaySlots = selectedDay ? slotsForDay(selectedDay) : [];

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
      <Stack gap={1}>
        <span className="cds--type-productive-heading-01">{slot.posts?.title}</span>
        <span className="cds--type-helper-text-01">{slot.posts?.format}</span>
      </Stack>
    ),
    platform: (
      <Tag size="sm" type={(PLATFORM_TAG_TYPE[slot.platform] || 'cool-gray') as any}>
        {slot.platform.toUpperCase().replace('_', ' ')}
      </Tag>
    ),
    scheduled_at: new Date(slot.scheduled_at).toLocaleString(me.config?.region || 'pt-BR'),
    status: (
      <Tag type={STATUS_TAG[slot.status] as any} size="sm">
        {slot.status.toUpperCase()}
      </Tag>
    ),
    actions: slot
  }));

  const rows = useMemo(() => formatRows(slots.filter(s => s.status !== 'published' && s.status !== 'failed')), [slots]);
  const historyRows = useMemo(() => formatRows(slots.filter(s => s.status === 'published' || s.status === 'failed')), [slots]);

  // Stripe Schedule Checkout
  const handleStripeSchedule = async (tier: string) => {
    if (!me?.tenant) return;
    setStripeLoading(tier);
    try {
      const res = await api.edgeFn<{ success: boolean; url: string }>('stripe-checkout', {
        action: 'create_schedule_subscription',
        tenantId: me.tenant.id,
        tier
      });
      if (res.success && res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      showToast('Erro', err.message || 'Não foi possível iniciar o checkout Stripe', 'error');
    } finally {
      setStripeLoading(null);
    }
  };

  // Premium Gate
  if (!me.config?.schedule_enabled && me.tenant?.depth_level !== 0) {
    return (
      <PageLayout
        pageName={t('scheduleTitle')}
        pageDescription={t('scheduleSubtitle')}
        aiExplanation={t('scheduleAiExplanation') || "Recurso premium para publicação automática nas redes conectadas. Disponível nos planos Starter, Growth e Scale."}
        helpMode
      >
        <Grid>
          <Column lg={16}>
            <Tile>
              <Stack gap={5} className="schedule-premium-gate">
                <Stack orientation="horizontal" gap={3} className="schedule-premium-gate__icon-row">
                  <Calendar size={64} className="schedule-premium-gate__icon" />
                  <Tag type="warm-gray" size="sm">PREMIUM</Tag>
                </Stack>
                <h1 className="cds--type-productive-heading-05">{t('schedulePremiumTitle')}</h1>
                <p className="cds--type-body-long-01">{t('schedulePremiumDesc')}</p>

                <Grid>
                  {[
                    { tier: 'starter', label: 'Starter', price: '290', posts: '12', priceId: 'starter' },
                    { tier: 'growth', label: 'Growth', price: '490', posts: '24', priceId: 'growth' },
                    { tier: 'scale', label: 'Scale', price: '890', posts: '50', priceId: 'scale' }
                  ].map(plan => (
                    <Column lg={5} md={4} sm={4} key={plan.tier}>
                      <Tile>
                        <Stack gap={3}>
                          <h4 className="cds--type-productive-heading-03">{plan.label}</h4>
                          <Stack orientation="horizontal" gap={1}>
                            <h2 className="cds--type-productive-heading-05">R$ {plan.price}</h2>
                            <span className="cds--type-body-short-01">/mês</span>
                          </Stack>
                          <p className="cds--type-body-short-01">{plan.posts} agendamentos inclusos</p>
                          <Button
                            kind="primary"
                            size="sm"
                            disabled={stripeLoading !== null}
                            onClick={() => handleStripeSchedule(plan.tier)}
                          >
                            {stripeLoading === plan.tier ? 'Redirecionando...' : `Assinar ${plan.label}`}
                          </Button>
                        </Stack>
                      </Tile>
                    </Column>
                  ))}
                </Grid>
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
      aiExplanation={t('scheduleAiExplanationPremium') || "Recurso premium para publicação automática nas redes conectadas. Processador CRON executa no horário agendado com retry automático (máx. 3 tentativas)."}
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
      <Section>
        <Stack gap={6}>
          {usage && (
            <Stack orientation="horizontal" gap={2}>
              <AILabel autoAlign>
                <AILabelContent>
                  <p>Slots processados pelo engine CRON com retry automático. Cada slot consome 1 unidade do plano mensal. Processador CRON executa no horário agendado com retry (máx. 3 tentativas).</p>
                </AILabelContent>
              </AILabel>
              <Tag type={usage.remaining < 3 ? 'red' : 'blue'} size="md">
                {usage.used} / {usage.limit} {t('scheduleUsageLabel') || 'agendamentos utilizados este mês'}
              </Tag>
            </Stack>
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
                              <TableRow><TableCell colSpan={5} className="schedule-empty-cell">{t('scheduleEmptyQueue')}</TableCell></TableRow>
                            ) : tableRows.map((row: any) => (
                              <TableRow {...getRowProps({ row })}>
                                {row.cells.map((cell: any) => {
                                  if (cell.info.header === 'actions') {
                                    const slotData = cell.value;
                                    return (
                                      <TableCell key={cell.id} className="cds--table-column-menu">
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

              {/* Tab 2: Calendário (100% Carbon Grid) */}
              <TabPanel>
                <Stack gap={4}>
                  {/* Month nav */}
                  <Stack orientation="horizontal" gap={3}>
                    <IconButton label={t('schedulePrevMonth') || "Mês anterior"} kind="ghost" size="sm" onClick={calPrev}><ChevronLeft /></IconButton>
                    <h4 className="cds--type-productive-heading-03 schedule-cal-month-nav">
                      {new Date(calYear, calMonth).toLocaleString(me.config?.region || 'pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}
                    </h4>
                    <IconButton label={t('scheduleNextMonth') || "Próximo mês"} kind="ghost" size="sm" onClick={calNext}><ChevronRight /></IconButton>
                    <Button kind="ghost" size="sm" onClick={calToday}>{t('scheduleToday') || "Hoje"}</Button>
                  </Stack>

                  {/* Weekday headers */}
                  <Grid condensed>
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                      <Column key={d} lg={2} md={1} sm={1}>
                        <p className="cds--type-label-01 schedule-cal-weekday">{d}</p>
                      </Column>
                    ))}
                  </Grid>

                  {/* Calendar grid */}
                  <Grid condensed>
                    {buildCalendarCells().map((cell, idx) => {
                      const daySlots = slotsForDay(cell.date);
                      const isToday = cell.date.toDateString() === today.toDateString();
                      return (
                        <Column key={idx} lg={2} md={1} sm={1}>
                          <ClickableTile
                            className={[
                              'schedule-day',
                              isToday ? 'schedule-day--today' : '',
                              !cell.isCurrentMonth ? 'schedule-day--other' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => { setSelectedDay(cell.date); setDaySidePanelOpen(true); }}
                          >
                            <Stack gap={2}>
                              <span className="cds--type-label-01">{cell.date.getDate()}</span>
                              <Stack gap={1}>
                                {daySlots.slice(0, 3).map((s, i) => (
                                  <Tag key={i} size="sm" type={(PLATFORM_TAG_TYPE[s.platform] || 'cool-gray') as any}>
                                    {s.platform.split('_')[0]}
                                  </Tag>
                                ))}
                                {daySlots.length > 3 && (
                                  <Tag size="sm" type="cool-gray">+{daySlots.length - 3}</Tag>
                                )}
                              </Stack>
                            </Stack>
                          </ClickableTile>
                        </Column>
                      );
                    })}
                  </Grid>
                </Stack>

                {/* Day Detail SidePanel */}
                <SidePanel
                  open={daySidePanelOpen}
                  onRequestClose={() => setDaySidePanelOpen(false)}
                  size="sm"
                  title={selectedDay ? selectedDay.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : ''}
                  subtitle={`${selectedDaySlots.length} agendamento(s)`}
                >
                  <Stack gap={4} className="schedule-day-panel">
                    {selectedDaySlots.length === 0 ? (
                      <p className="cds--type-body-short-01">Nenhum agendamento neste dia.</p>
                    ) : (
                      selectedDaySlots.map((s: any) => (
                        <Layer key={s.id}>
                          <Tile>
                            <Stack gap={3}>
                              <Stack orientation="horizontal" gap={2}>
                                <Tag size="sm" type={(PLATFORM_TAG_TYPE[s.platform] || 'cool-gray') as any}>
                                  {s.platform.replace('_', ' ')}
                                </Tag>
                                <Tag size="sm" type={(STATUS_TAG[s.status] || 'cool-gray') as any}>
                                  {s.status}
                                </Tag>
                              </Stack>
                              <p className="cds--type-productive-heading-01">{s.posts?.title}</p>
                              <p className="cds--type-helper-text-01">
                                {new Date(s.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <Stack orientation="horizontal" gap={2}>
                                <Button
                                  size="sm"
                                  kind="ghost"
                                  renderIcon={Edit}
                                  disabled={s.status === 'processing' || s.status === 'published'}
                                >
                                  Reagendar
                                </Button>
                                <Button
                                  size="sm"
                                  kind="danger--ghost"
                                  renderIcon={Close}
                                  disabled={s.status === 'processing' || s.status === 'published' || s.status === 'cancelled'}
                                  onClick={() => { handleCancelSlot(s.id); setDaySidePanelOpen(false); }}
                                >
                                  Cancelar
                                </Button>
                              </Stack>
                            </Stack>
                          </Tile>
                        </Layer>
                      ))
                    )}
                  </Stack>
                </SidePanel>
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
                                    <TableCell key={cell.id} className="cds--table-column-menu">
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
        </Stack>
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
          <Stack gap={6} className="schedule-side-panel__body">
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

            <Tile>
              <Breadcrumb noTrailingSlash>
                <BreadcrumbItem>
                  <Stack orientation="horizontal" gap={2}>
                    <CheckmarkFilled className="icon--success" /> {t('matrixPendingReview')}
                  </Stack>
                </BreadcrumbItem>
                <BreadcrumbItem>
                  <Stack orientation="horizontal" gap={2}>
                    {selectedSlot.status === 'published' ? <CheckmarkFilled className="icon--success" /> : <Restart className="icon--info" />} Fila Processamento
                  </Stack>
                </BreadcrumbItem>
                <BreadcrumbItem isCurrentPage={selectedSlot.status === 'published'}>
                  <Stack orientation="horizontal" gap={2}>
                    {selectedSlot.status === 'published' ? <CheckmarkFilled className="icon--success" /> : <ChevronRight />} Publicação
                  </Stack>
                </BreadcrumbItem>
              </Breadcrumb>
            </Tile>
          </Stack>
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

          <Layer>
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
                <p className="cds--type-productive-heading-01">Canais de Destino</p>
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
                <Stack gap={3}>
                  <p className="cds--type-helper-text-01">Resumo do Agendamento</p>
                  <h4 className="cds--type-productive-heading-03">{availablePosts.find(p => p.id === newSlotData.postId)?.title}</h4>
                  <Stack orientation="horizontal" gap={2}>
                    {newSlotData.platforms.map(p => <Tag key={p} size="sm" type={(PLATFORM_TAG_TYPE[p] || 'cool-gray') as any}>{p.toUpperCase()}</Tag>)}
                  </Stack>
                  <p className="cds--type-body-short-01">
                    <strong>Disparo:</strong> {newSlotData.scheduledAt} às {newSlotData.time}
                  </p>
                </Stack>
              </Tile>
            )}
          </Layer>

          {saving && <InlineLoading description={t('scheduleProcessing')} />}
        </Stack>
      </Modal>
    </PageLayout>
  );
}
