import { useEffect, useMemo, useState, useCallback, useRef, type MouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AILabel,
  AILabelContent,
  Button,
  Content,
  Header,
  HeaderContainer,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderName,
  HeaderPanel,
  Modal,
  Select,
  SelectItem,
  SideNav,
  SideNavDivider,
  SideNavItems,
  SideNavLink,
  SideNavMenu,
  SideNavMenuItem,
  SkipToContent,
  Tag,
  InlineLoading,
} from '@carbon/react';
import {
  Calendar,
  ChartColumn,
  Chemistry,
  Dashboard,
  DataEnrichment,
  Notification,
  Purchase,
  Settings,
  TableSplit,
  Task,
  UserAvatar,
  CloudSatellite,
  DataShare,
  Chat,
  Earth,
  Logout,
  View,
  CheckmarkFilled,
} from '@carbon/icons-react';
import { hasPermission } from '../contexts/AuthContext';
import { api, type MeResponse, type Tenant } from '../services/api';
import { supabase } from '../services/supabase';
import LocaleSelectorModal from './LocaleSelectorModal';

// ─── Notification Types ──────────────────────────────────────────────────────
interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  category: string;
  source: 'popup' | 'activity';
  created_at: string;
  read: boolean;
  metadata?: any;
}

const SEVERITY_TAG: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'yellow',
  error: 'red',
};

const CATEGORY_LABEL: Record<string, string> = {
  system: 'Sistema',
  sync: 'Sincronização',
  quality_gate: 'Qualidade',
  sentiment: 'Sentimento',
  ai_generation: 'IA',
  feedback: 'Feedback',
  schedule: 'Agendamento',
  compliance: 'Compliance',
  autonomous_content: 'Conteúdo',
  insights_analytics: 'Insights',
  maintenance: 'Manutenção',
  commercial: 'Comercial',
  system_onboarding: 'Onboarding',
  social_proof: 'Social',
};

interface ShellProps {
  children: ReactNode;
  me: MeResponse;
}

const USER_OPTIONS = [
  { email: 'mail@cestari.studio', label: 'Master - Cestari' },
  { email: 'ocestari89@gmail.com', label: 'Agency Operator' },
  { email: 'cliente@tenant.com', label: 'Client User' },
];

export default function Shell({ children, me }: ShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<string>(api.getActiveTenantId() || '');
  const [activeUserEmail, setActiveUserEmail] = useState<string>(api.getActiveUserEmail());
  const [isUserPanelExpanded, setIsUserPanelExpanded] = useState(false);
  const [isNotificationPanelExpanded, setIsNotificationPanelExpanded] = useState(false);
  const [isLocaleModalOpen, setIsLocaleModalOpen] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  // Token usage for user panel
  const [tokenUsage, setTokenUsage] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    const tenantId = api.getActiveTenantId();
    if (!tenantId) return;
    (async () => {
      try {
        const { data: wallet } = await supabase
          .from('credit_wallets')
          .select('prepaid_credits')
          .eq('tenant_id', tenantId)
          .single();
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { data: usageLogs } = await supabase
          .from('usage_logs')
          .select('tokens_used')
          .eq('tenant_id', tenantId)
          .gte('created_at', startOfMonth.toISOString());
        const used = (usageLogs || []).reduce((sum: number, l: any) => sum + (l.tokens_used || 0), 0);
        const limit = wallet?.prepaid_credits ?? 5000;
        setTokenUsage({ used, limit: used + limit });
      } catch { /* optional */ }
    })();
  }, []);

  useEffect(() => {
    api.loadTenants().then((list) => {
      setTenants(list);
      const current = api.getActiveTenantId();
      if (current) setActiveTenant(current);
    });
  }, []);

  // ─── Fetch Notifications (from activity_log + popup_events) ──────────────
  const fetchNotifications = useCallback(async () => {
    const tenantId = api.getActiveTenantId();
    if (!tenantId) return;
    setLoadingNotifications(true);
    try {
      // Fetch from activity_log (recent 50)
      const { data: activityData } = await supabase
        .from('activity_log')
        .select('id, action, summary, detail, severity, category, metadata, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch from popup_events (all statuses for history)
      const { data: popupData } = await supabase
        .from('popup_events')
        .select('id, title, message, severity, category, status, created_at, trigger_data')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(30);

      const items: NotificationItem[] = [];

      // Map activity_log entries
      if (Array.isArray(activityData)) {
        activityData.forEach((a: any) => {
          items.push({
            id: a.id,
            title: a.summary || a.action,
            message: a.detail || '',
            severity: a.severity || 'info',
            category: a.category || 'system',
            source: 'activity',
            created_at: a.created_at,
            read: false,
            metadata: a.metadata,
          });
        });
      }

      // Map popup_events entries
      if (Array.isArray(popupData)) {
        popupData.forEach((p: any) => {
          // Skip if already in activity_log (by similar timestamp + title)
          const isDupe = items.some(i =>
            Math.abs(new Date(i.created_at).getTime() - new Date(p.created_at).getTime()) < 2000 &&
            i.title === p.title
          );
          if (!isDupe) {
            items.push({
              id: p.id,
              title: p.title,
              message: p.message,
              severity: p.severity || 'info',
              category: p.category || 'system',
              source: 'popup',
              created_at: p.created_at,
              read: p.status !== 'pending',
              metadata: p.trigger_data,
            });
          }
        });
      }

      // Sort by date descending
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(items.slice(0, 50));
      setUnreadCount(items.filter(i => !i.read).length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  // Poll notifications every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const toggleNotificationPanel = () => {
    setIsNotificationPanelExpanded(prev => {
      if (!prev) fetchNotifications(); // refresh when opening
      return !prev;
    });
    setIsUserPanelExpanded(false); // close user panel
  };

  const toggleUserPanel = () => {
    setIsUserPanelExpanded(prev => !prev);
    setIsNotificationPanelExpanded(false); // close notification panel
  };

  // ─── Click-outside to close panels ──────────────────────────────────────────
  const userPanelRef = useRef<HTMLDivElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside the panel or the header action button
      if (target.closest('.shell-user-header-panel') || target.closest('[aria-label="Abrir menu de perfil"]') || target.closest('[aria-label="Fechar menu de perfil"]')) return;
      if (target.closest('.shell-notification-panel') || target.closest('[aria-label="Notificações"]')) return;
      // Don't close if clicking inside an AI popover
      if (target.closest('.cds--popover')) return;

      setIsUserPanelExpanded(false);
      setIsNotificationPanelExpanded(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const canViewObservatory = hasPermission('observatory.read', me);
  const canViewPricing = hasPermission('pricing.read', me);
  const isSysAdmin = me.user?.role === 'super_admin';
  const depthLevel = me.tenant?.depth_level ?? 0;
  const isAgency = depthLevel === 1;
  const isMaster = depthLevel === 0;
  const isClient = depthLevel >= 2;

  const currentTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === activeTenant),
    [activeTenant, tenants]
  );

  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    api.setActiveTenant(id);
    setActiveTenant(id);
    window.location.reload();
  };

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const email = e.target.value;
    api.setActiveUserEmail(email);
    setActiveUserEmail(email);
    window.location.reload();
  };

  const handleLogout = () => {
    api.logout();
    window.location.href = '/login';
  };

  const goTo = (path: string) => (event?: MouseEvent<HTMLElement>) => {
    event?.preventDefault();
    navigate(path);
  };

  // For client tenants: show nav items visually but disabled (non-clickable)
  const disabledClass = isClient ? 'shell-nav-disabled' : '';
  const noOp = (event?: MouseEvent<HTMLElement>) => { event?.preventDefault(); };

  return (
    <HeaderContainer
      render={({ isSideNavExpanded, onClickSideNavExpand }: any) => (
        <>
          <Header aria-label="Cestari Studio genOS">
            <SkipToContent />
            <HeaderMenuButton
              aria-label={isSideNavExpanded ? 'Fechar menu' : 'Abrir menu'}
              isActive={isSideNavExpanded}
              onClick={onClickSideNavExpand}
              isCollapsible
            />
            <HeaderName prefix="Cestari Studio">genOS</HeaderName>

            <HeaderGlobalBar>
              {import.meta.env.DEV && (
                <div className="shell-select-wrap">
                  <Select
                    id="user-selector"
                    size="sm"
                    hideLabel
                    value={activeUserEmail}
                    onChange={handleUserChange}
                    labelText="Conta"
                  >
                    {USER_OPTIONS.map((user) => (
                      <SelectItem key={user.email} value={user.email} text={user.label} />
                    ))}
                  </Select>
                </div>
              )}

              {isMaster && (
                <div className="shell-select-wrap">
                  <Select
                    id="tenant-selector"
                    size="sm"
                    hideLabel
                    value={activeTenant}
                    onChange={handleTenantChange}
                    labelText="Tenant"
                    disabled={me.user?.role !== 'super_admin'}
                  >
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id} text={tenant.name} />
                    ))}
                  </Select>
                </div>
              )}

              <HeaderGlobalAction aria-label="Regionalização & Billing" onClick={() => setIsLocaleModalOpen(true)}>
                <Earth size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction
                aria-label="Notificações"
                isActive={isNotificationPanelExpanded}
                onClick={toggleNotificationPanel}
              >
                <Notification size={20} />
                {unreadCount > 0 && (
                  <span className="shell-notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </HeaderGlobalAction>
              <HeaderGlobalAction
                aria-label={isUserPanelExpanded ? 'Fechar menu de perfil' : 'Abrir menu de perfil'}
                isActive={isUserPanelExpanded}
                onClick={toggleUserPanel}
              >
                <UserAvatar size={20} />
              </HeaderGlobalAction>
            </HeaderGlobalBar>

            {/* ─── Backdrop to close panels on outside click ────────────── */}
            {(isUserPanelExpanded || isNotificationPanelExpanded) && (
              <div
                className="shell-panel-backdrop"
                onClick={() => {
                  setIsUserPanelExpanded(false);
                  setIsNotificationPanelExpanded(false);
                }}
              />
            )}

            {/* ─── Notification Panel ─────────────────────────────────────── */}
            <HeaderPanel
              expanded={isNotificationPanelExpanded}
              aria-label="Painel de notificações"
              className="shell-notification-panel"
            >
              <div className="shell-notif-panel-inner">
                <div className="shell-notif-panel-header">
                  <h4 className="shell-notif-panel-title">Notificações</h4>
                  {notifications.length > 0 && (
                    <span className="shell-notif-panel-count">{notifications.length}</span>
                  )}
                </div>

                {loadingNotifications && notifications.length === 0 ? (
                  <div style={{ padding: '1rem' }}>
                    <InlineLoading description="Carregando..." />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="shell-notif-empty">
                    <Notification size={32} style={{ opacity: 0.3 }} />
                    <p>Nenhuma notificação</p>
                  </div>
                ) : (
                  <div className="shell-notif-list">
                    {notifications.map(n => (
                      <div key={n.id} className={`shell-notif-item ${!n.read ? 'shell-notif-unread' : ''}`}>
                        <div className="shell-notif-item-header">
                          <Tag type={(SEVERITY_TAG[n.severity] || 'cool-gray') as any} size="sm">
                            {CATEGORY_LABEL[n.category] || n.category}
                          </Tag>
                          <span className="shell-notif-time">
                            {new Date(n.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="shell-notif-item-title">{n.title}</p>
                        {n.message && <p className="shell-notif-item-msg">{n.message.slice(0, 100)}{n.message.length > 100 ? '...' : ''}</p>}
                        <Button
                          kind="ghost"
                          size="sm"
                          renderIcon={View}
                          className="shell-notif-view-btn"
                          onClick={() => setSelectedNotification(n)}
                        >
                          Visualizar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </HeaderPanel>

            {/* ─── User Panel ────────────────────────────────────────────── */}
            <HeaderPanel
              expanded={isUserPanelExpanded}
              aria-label="Painel do usuário"
              className="shell-user-header-panel"
            >
              <div className="shell-user-panel">
                <div className="shell-user-panel-avatar">
                  <UserAvatar size={32} />
                </div>
                <div className="shell-user-panel-info">
                  <p className="shell-user-panel-name">
                    {me.user?.email?.split('@')[0] || 'Usuário'}
                  </p>
                  <p className="shell-user-panel-email">{me.user?.email || activeUserEmail || '—'}</p>
                  <p className="shell-user-panel-company">
                    {currentTenant?.name || 'genOS Cloud'}
                  </p>
                </div>
                {tokenUsage && (
                  <>
                    <div className="shell-user-panel-divider" />
                    <div className="shell-user-panel-tokens">
                      <AILabel autoAlign kind="inline" size="sm" textLabel={`${tokenUsage.used.toLocaleString('pt-BR')} / ${tokenUsage.limit.toLocaleString('pt-BR')} tokens`}>
                        <AILabelContent>
                          <div style={{ padding: '1rem' }}>
                            <p className="secondary">AI Explained</p>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0.25rem 0' }}>
                              {Math.round(((tokenUsage.limit - tokenUsage.used) / tokenUsage.limit) * 100)}%
                            </h2>
                            <p className="secondary" style={{ fontWeight: 600 }}>Tokens restantes</p>
                            <p className="secondary" style={{ marginTop: '0.5rem' }}>
                              Consumo de tokens do ciclo atual. {tokenUsage.used.toLocaleString('pt-BR')} tokens utilizados de {tokenUsage.limit.toLocaleString('pt-BR')} disponíveis neste período de faturamento.
                            </p>
                            <hr style={{ margin: '0.75rem 0', borderColor: '#525252' }} />
                            <p className="secondary">Ciclo atual</p>
                            <p style={{ fontWeight: 600 }}>{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                          </div>
                        </AILabelContent>
                      </AILabel>
                    </div>
                  </>
                )}
                <div className="shell-user-panel-divider" />
                <Button
                  kind="danger--tertiary"
                  size="sm"
                  renderIcon={Logout}
                  onClick={handleLogout}
                  className="shell-user-panel-logout"
                >
                  Sair
                </Button>
              </div>
            </HeaderPanel>
          </Header>

          <SideNav
            aria-label="Navegação principal"
            expanded={isSideNavExpanded}
            isPersistent={false}
            isRail={false}
            onOverlayClick={onClickSideNavExpand}
            onSideNavBlur={() => {
              if (isSideNavExpanded) onClickSideNavExpand();
            }}
          >
            <SideNavItems>
              {/* Dashboard — active for Master & Agency, disabled for Client */}
              <div className={isClient ? disabledClass : ''}>
                <SideNavLink
                  href="/"
                  renderIcon={Dashboard}
                  isActive={!isClient && location.pathname === '/'}
                  onClick={isClient ? noOp : goTo('/')}
                >
                  Dashboard
                </SideNavLink>
              </div>

              {/* Console — active for Master only, disabled for others */}
              <div className={!isMaster ? disabledClass : ''}>
                <SideNavLink
                  href="/console"
                  renderIcon={Chat}
                  isActive={isMaster && location.pathname === '/console'}
                  onClick={isMaster ? goTo('/console') : noOp}
                >
                  WatsonX Console
                </SideNavLink>
              </div>

              {/* Architect Canvas — Master only */}
              <div className={!isMaster ? disabledClass : ''}>
                <SideNavLink
                  href="/architect"
                  renderIcon={DataShare}
                  isActive={isMaster && location.pathname === '/architect'}
                  onClick={isMaster ? goTo('/architect') : noOp}
                >
                  Architect Canvas
                </SideNavLink>
              </div>

              {/* Content Factory — active for ALL */}
              <SideNavMenu
                renderIcon={DataEnrichment}
                title="Content Factory"
                isActive={location.pathname.startsWith('/factory') || location.pathname === '/content-factory'}
              >
                <SideNavMenuItem href="/content-factory" onClick={goTo('/content-factory')}>
                  Matrix List (Modular)
                </SideNavMenuItem>
                <div className={!isMaster ? disabledClass : ''}>
                  <SideNavMenuItem
                    href="/factory/matrix"
                    onClick={isMaster ? goTo('/factory/matrix') : noOp}
                  >
                    Matrix Grid
                  </SideNavMenuItem>
                </div>
                <div className={!isMaster ? disabledClass : ''}>
                  <SideNavMenuItem
                    href="/factory/audit"
                    onClick={isMaster ? goTo('/factory/audit') : noOp}
                  >
                    Compliance Auditor
                  </SideNavMenuItem>
                </div>
              </SideNavMenu>

              {/* CSV Browser — Master only */}
              <div className={!isMaster ? disabledClass : ''}>
                <SideNavLink
                  href="/csv-browser"
                  renderIcon={TableSplit}
                  isActive={isMaster && location.pathname === '/csv-browser'}
                  onClick={isMaster ? goTo('/csv-browser') : noOp}
                >
                  CSV Browser
                </SideNavLink>
              </div>

              {/* Intelligence Pipeline — Master & Agency */}
              <div className={isClient ? disabledClass : ''}>
                <SideNavMenu
                  renderIcon={Chemistry}
                  title="Intelligence Pipeline"
                  isActive={!isClient && location.pathname.startsWith('/brand-dna')}
                >
                  <SideNavMenuItem
                    href="/brand-dna"
                    onClick={isClient ? noOp : goTo('/brand-dna')}
                  >
                    Brand DNA (Core)
                  </SideNavMenuItem>
                  <div className={!isMaster ? disabledClass : ''}>
                    <SideNavMenuItem
                      href="/brand-dna/semantic"
                      onClick={isMaster ? goTo('/brand-dna/semantic') : noOp}
                    >
                      Semantic Map
                    </SideNavMenuItem>
                  </div>
                </SideNavMenu>
              </div>

              {/* Schedule — Master & Agency */}
              <div className={isClient ? disabledClass : ''}>
                <SideNavLink
                  href="/schedule"
                  renderIcon={Calendar}
                  isActive={!isClient && location.pathname === '/schedule'}
                  onClick={isClient ? noOp : goTo('/schedule')}
                >
                  Cronograma
                </SideNavLink>
              </div>

              <SideNavDivider />

              {/* Observatory — permission-gated */}
              <div className={(!canViewObservatory || isClient) ? disabledClass : ''}>
                {(isMaster || (!isClient && canViewObservatory)) ? (
                  <SideNavMenu
                    renderIcon={ChartColumn}
                    title="Observatory"
                    isActive={!isClient && location.pathname.startsWith('/observatory')}
                  >
                    <SideNavMenuItem href="/observatory" onClick={isClient ? noOp : goTo('/observatory')}>
                      Dashboard
                    </SideNavMenuItem>
                    <SideNavMenuItem href="/observatory/quantum" onClick={isClient ? noOp : goTo('/observatory/quantum')}>
                      Quantum (Drift)
                    </SideNavMenuItem>
                    {canViewPricing && (
                      <SideNavMenuItem href="/observatory/pricing" onClick={isClient ? noOp : goTo('/observatory/pricing')}>
                        Pricing
                      </SideNavMenuItem>
                    )}
                  </SideNavMenu>
                ) : (
                  <SideNavLink
                    href="/observatory"
                    renderIcon={ChartColumn}
                    isActive={false}
                    onClick={noOp}
                  >
                    Observatory
                  </SideNavLink>
                )}
              </div>

              <SideNavDivider />

              {/* Pricing Config — Master only */}
              <div className={(!canViewPricing || !isMaster) ? disabledClass : ''}>
                <SideNavLink
                  href="/observatory/pricing"
                  renderIcon={Purchase}
                  isActive={isMaster && canViewPricing && location.pathname === '/observatory/pricing'}
                  onClick={(isMaster && canViewPricing) ? goTo('/observatory/pricing') : noOp}
                >
                  Pricing Config
                </SideNavLink>
              </div>

              {/* Master Admin — super_admin only */}
              <div className={(!isSysAdmin || !isMaster) ? disabledClass : ''}>
                <SideNavMenu
                  renderIcon={CloudSatellite}
                  title="Master Admin"
                  isActive={isMaster && isSysAdmin && location.pathname.startsWith('/admin')}
                >
                  <SideNavMenuItem href="/admin/health" onClick={(isMaster && isSysAdmin) ? goTo('/admin/health') : noOp}>
                    Global Health
                  </SideNavMenuItem>
                  <SideNavMenuItem href="/admin/tenants" onClick={(isMaster && isSysAdmin) ? goTo('/admin/tenants') : noOp}>
                    Tenant Master List
                  </SideNavMenuItem>
                  <SideNavMenuItem href="/admin/api-hub" onClick={(isMaster && isSysAdmin) ? goTo('/admin/api-hub') : noOp}>
                    API Connector Hub
                  </SideNavMenuItem>
                  <SideNavMenuItem href="/admin/topology" onClick={(isMaster && isSysAdmin) ? goTo('/admin/topology') : noOp}>
                    System Topology Hub
                  </SideNavMenuItem>
                  <SideNavMenuItem href="/admin/commerce" onClick={(isMaster && isSysAdmin) ? goTo('/admin/commerce') : noOp}>
                    Agentic Commerce
                  </SideNavMenuItem>
                  <SideNavMenuItem href="/admin/components" onClick={(isMaster && isSysAdmin) ? goTo('/admin/components') : noOp}>
                    Carbon Foundry
                  </SideNavMenuItem>
                </SideNavMenu>
              </div>

              {/* Tasks — Master only */}
              <div className={!isMaster ? disabledClass : ''}>
                <SideNavLink
                  href="/factory"
                  renderIcon={Task}
                  isActive={isMaster && location.pathname === '/tasks'}
                  onClick={isMaster ? goTo('/factory') : noOp}
                >
                  Tasks
                </SideNavLink>
              </div>

              {/* Settings — Master & Agency */}
              <div className={isClient ? disabledClass : ''}>
                <SideNavLink
                  href="/settings"
                  renderIcon={Settings}
                  isActive={!isClient && location.pathname === '/settings'}
                  onClick={isClient ? noOp : goTo('/settings')}
                >
                  Settings
                </SideNavLink>
              </div>
            </SideNavItems>
          </SideNav>

          <Content id="main-content" className="shell-content">
            <div className="shell-content-inner">
              {children}
            </div>
          </Content>

          <LocaleSelectorModal
            open={isLocaleModalOpen}
            onClose={() => setIsLocaleModalOpen(false)}
            tenantName={currentTenant?.name || 'Cestari Master Tenant'}
          />

          {/* ─── Notification Detail Modal ─────────────────────────────── */}
          {selectedNotification && (
            <Modal
              open
              passiveModal
              modalHeading="Detalhes da Notificação"
              onRequestClose={() => setSelectedNotification(null)}
              size="sm"
            >
              <div style={{ paddingBlockEnd: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Tag type={(SEVERITY_TAG[selectedNotification.severity] || 'cool-gray') as any} size="sm">
                    {CATEGORY_LABEL[selectedNotification.category] || selectedNotification.category}
                  </Tag>
                  <Tag type="cool-gray" size="sm">
                    {selectedNotification.severity}
                  </Tag>
                  <span style={{ fontSize: '0.75rem', color: '#8d8d8d', marginInlineStart: 'auto' }}>
                    {new Date(selectedNotification.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <h5 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  {selectedNotification.title}
                </h5>
                {selectedNotification.message && (
                  <p style={{ fontSize: '0.875rem', color: '#c6c6c6', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>
                    {selectedNotification.message}
                  </p>
                )}
                {selectedNotification.metadata && Object.keys(selectedNotification.metadata).length > 0 && (
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>DADOS ADICIONAIS</p>
                    <pre style={{
                      fontSize: '0.75rem',
                      backgroundColor: '#262626',
                      padding: '0.75rem',
                      borderRadius: 4,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: '12rem',
                      overflow: 'auto',
                    }}>
                      {JSON.stringify(selectedNotification.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </Modal>
          )}
        </>
      )}
    />
  );
}
