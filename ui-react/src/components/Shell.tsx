import { useEffect, useMemo, useState, useCallback, type MouseEvent, type ReactNode } from 'react';
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
  SideNav,
  SideNavDivider,
  SideNavItems,
  SideNavLink,
  SideNavMenu,
  SideNavMenuItem,
  SkipToContent,
  Switcher,
  SwitcherDivider,
  SwitcherItem,
  Tag,
  InlineLoading,
} from '@carbon/react';
import {
  Dashboard,
  DataEnrichment,
  Notification,
  Settings,
  UserAvatar,
  Earth,
  Logout,
  View,
} from '@carbon/icons-react';
import { api, type MeResponse, type Tenant } from '../services/api';
import { supabase } from '../services/supabase';
import LocaleSelectorModal, { t, getLocale } from './LocaleSelectorModal';

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

export default function Shell({ children, me }: ShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<string>(api.getActiveTenantId() || '');
  const [isUserPanelExpanded, setIsUserPanelExpanded] = useState(false);
  const [isNotificationPanelExpanded, setIsNotificationPanelExpanded] = useState(false);
  const [isLocaleModalOpen, setIsLocaleModalOpen] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  useEffect(() => {
    console.log('genOS Shell: Effect triggered [loadTenants]');
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
    console.log('genOS Shell: Effect triggered [fetchNotifications polling]');
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closePanels = useCallback(() => {
    setIsUserPanelExpanded(false);
    setIsNotificationPanelExpanded(false);
  }, []);

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

  const showBackdrop = isUserPanelExpanded || isNotificationPanelExpanded;

  const depthLevel = me.tenant?.depth_level ?? 0;
  const isMaster = depthLevel === 0;
  const isClient = depthLevel >= 2;

  const currentTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === activeTenant),
    [activeTenant, tenants]
  );

  const handleLogout = () => {
    api.logout();
    window.location.href = '/login';
  };

  const goTo = (path: string) => (event?: MouseEvent<HTMLElement>) => {
    event?.preventDefault();
    navigate(path);
  };

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
              <HeaderGlobalAction
                aria-label="Idioma e Região"
                onClick={() => setIsLocaleModalOpen(true)}
              >
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

            {showBackdrop && (
              <div
                className="shell-panel-backdrop"
                onClick={closePanels}
                aria-hidden="true"
              />
            )}
          </Header>

          {/* ─── Notification Panel (Carbon HeaderPanel) ──────────────── */}
          <HeaderPanel
            aria-label="Painel de notificações"
            expanded={isNotificationPanelExpanded}
            className="shell-notification-panel"
          >
            <div className="shell-notif-panel-inner">
              <div className="shell-notif-panel-header">
                <h4 className="shell-notif-panel-title">{t('notifications')}</h4>
                {notifications.length > 0 && (
                  <Tag type="blue" size="sm">{notifications.length}</Tag>
                )}
              </div>

              {loadingNotifications && notifications.length === 0 ? (
                <div style={{ padding: '1rem' }}>
                  <InlineLoading description={t('loading')} />
                </div>
              ) : notifications.length === 0 ? (
                <div className="shell-notif-empty">
                  <Notification size={32} style={{ opacity: 0.3 }} />
                  <p>{t('noNotifications')}</p>
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
                          {new Date(n.created_at).toLocaleDateString(getLocale(), {
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
                        {t('viewDetail')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </HeaderPanel>

          {/* ─── User Panel (Carbon HeaderPanel + Switcher) ────────────── */}
          <HeaderPanel
            aria-label="Painel do usuário"
            expanded={isUserPanelExpanded}
            className="shell-user-header-panel"
          >
            <Switcher aria-label="Opções do usuário">
              <SwitcherItem aria-label="Usuário" className="shell-user-panel-info-item">
                <UserAvatar size={20} />
                <span>{me.user?.email?.split('@')[0] || 'Usuário'}</span>
              </SwitcherItem>
              <SwitcherItem aria-label="Email" className="shell-user-panel-detail">
                {me.user?.email || '—'}
              </SwitcherItem>
              <SwitcherItem aria-label="Empresa" className="shell-user-panel-detail">
                {currentTenant?.name || 'genOS Cloud'}
              </SwitcherItem>
              <SwitcherDivider />
              {me.usage && (
                <>
                  <SwitcherItem aria-label="Tokens" className="shell-user-panel-tokens-item">
                    <AILabel autoAlign kind="inline" size="sm" textLabel={`${me.usage.tokens_used.toLocaleString(getLocale())} / ${me.usage.tokens_limit.toLocaleString(getLocale())} tokens`}>
                      <AILabelContent>
                        <div style={{ padding: '1rem' }}>
                          <p className="secondary">AI Explained</p>
                          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0.25rem 0' }}>
                            {Math.round(((me.usage.tokens_limit - me.usage.tokens_used) / me.usage.tokens_limit) * 100)}%
                          </h2>
                          <p className="secondary" style={{ fontWeight: 600 }}>{t('tokensRemaining')}</p>
                          <p className="secondary" style={{ marginTop: '0.5rem' }}>
                            Consumo de tokens do ciclo atual. {me.usage.tokens_used.toLocaleString(getLocale())} tokens utilizados de {me.usage.tokens_limit.toLocaleString(getLocale())} disponíveis neste período de faturamento.
                          </p>
                          <hr style={{ margin: '0.75rem 0', borderColor: '#525252' }} />
                          <p className="secondary">{t('currentCycle')}</p>
                          <p style={{ fontWeight: 600 }}>{new Date().toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' })}</p>
                        </div>
                      </AILabelContent>
                    </AILabel>
                  </SwitcherItem>
                  <SwitcherDivider />
                </>
              )}
              <SwitcherItem aria-label="Logout">
                <Button
                  kind="danger--tertiary"
                  size="sm"
                  renderIcon={Logout}
                  onClick={handleLogout}
                  style={{ width: '100%' }}
                >
                  {t('logout')}
                </Button>
              </SwitcherItem>
            </Switcher>
          </HeaderPanel>

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
              {/* Dashboard — ALL levels */}
              <SideNavLink
                href="/"
                renderIcon={Dashboard}
                isActive={location.pathname === '/' || location.pathname === '/console'}
                onClick={goTo('/')}
              >
                {t('dashboard')}
              </SideNavLink>

              {/* Content Factory — ALL levels */}
              <SideNavMenu
                renderIcon={DataEnrichment}
                title={t('contentFactory')}
                isActive={
                  location.pathname.startsWith('/factory') ||
                  location.pathname === '/content-factory' ||
                  location.pathname.startsWith('/brand-dna')
                }
                defaultExpanded
              >
                <SideNavMenuItem
                  href="/content-factory"
                  isActive={location.pathname === '/content-factory'}
                  onClick={goTo('/content-factory')}
                >
                  {t('posts')}
                </SideNavMenuItem>
                <SideNavMenuItem
                  href="/factory/audit"
                  isActive={location.pathname === '/factory/audit'}
                  onClick={goTo('/factory/audit')}
                >
                  {t('complianceAuditor')}
                </SideNavMenuItem>
                <SideNavMenuItem
                  href="/brand-dna"
                  isActive={location.pathname === '/brand-dna'}
                  onClick={goTo('/brand-dna')}
                >
                  {t('brandDna')}
                </SideNavMenuItem>
                <SideNavMenuItem
                  href="/brand-dna/semantic"
                  isActive={location.pathname === '/brand-dna/semantic'}
                  onClick={goTo('/brand-dna/semantic')}
                >
                  {t('semanticMap')}
                </SideNavMenuItem>
              </SideNavMenu>

              <SideNavDivider />

              {/* Configurações — Master & Agency only */}
              {!isClient && (
                <SideNavLink
                  href="/settings"
                  renderIcon={Settings}
                  isActive={location.pathname === '/settings'}
                  onClick={goTo('/settings')}
                >
                  {t('settings')}
                </SideNavLink>
              )}
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
              modalHeading={t('notifDetail')}
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
                    {new Date(selectedNotification.created_at).toLocaleString(getLocale())}
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
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>{t('additionalData')}</p>
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
