import { useEffect, useRef, useMemo, useState, useCallback, type MouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AILabel,
  AILabelContent,
  AILabelActions,
  Button,
  Content,
  Header,
  HeaderContainer,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderName,
  HeaderPanel,
  IconButton,
  Modal,
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
import LocaleSelectorModal from './LocaleSelectorModal';
import { t, getLocale } from '../config/locale';

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
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isNotificationPanelExpanded, setIsNotificationPanelExpanded] = useState(false);
  const [isLocaleModalOpen, setIsLocaleModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

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
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch from popup_events (all statuses for history)
      const { data: popupData } = await supabase
        .from('popup_events')
        .select('id, title, message, severity, category, status, created_at, trigger_data')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
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
    setIsNotificationPanelExpanded(false);
  }, []);

  const toggleNotificationPanel = () => {
    setIsNotificationPanelExpanded(prev => {
      if (!prev) fetchNotifications();
      return !prev;
    });
  };

  const markAllAsRead = async () => {
    const tenantId = api.getActiveTenantId();
    if (!tenantId) return;

    // Optimistically update UI
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      // Background sync to db where source === activity -> update activity_log (not fully required if we just update local, but good for persistence)
      await supabase
        .from('activity_log')
        .update({
          metadata: {
            ...(notifications.find(n => n.source === 'activity')?.metadata || {}),
            readAt: new Date().toISOString() // Just a flag trick if full read/unread schema isn't robust
          }
        })
        .eq('tenant_id', tenantId);

      // You could also update popup_events to 'completed'
      await supabase
        .from('popup_events')
        .update({ status: 'completed' })
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .eq('status', 'pending');

    } catch (err) {
      console.error('Failed to mark notifications as read', err);
    }
  };

  const toggleUserModal = () => setIsUserModalOpen(prev => !prev);

  const showBackdrop = isNotificationPanelExpanded;

  // ─── Refs for panel elements ────────────────────────────────────
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const notifBtnRef = useRef<HTMLButtonElement>(null);

  // ─── Close notification panel on outside click ───────────────────
  useEffect(() => {
    if (!showBackdrop) return;

    const handleOutsideClick = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;

      if (
        notifPanelRef.current?.contains(target) ||
        notifBtnRef.current?.contains(target)
      ) {
        return;
      }

      closePanels();
    };

    const raf = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleOutsideClick);
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showBackdrop, closePanels]);

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
                ref={notifBtnRef}
              >
                <Notification size={20} />
                {unreadCount > 0 && (
                  <span className="shell-notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </HeaderGlobalAction>
              <HeaderGlobalAction
                aria-label={isUserModalOpen ? 'Fechar perfil' : 'Abrir perfil'}
                isActive={isUserModalOpen}
                onClick={toggleUserModal}
              >
                <UserAvatar size={20} />
              </HeaderGlobalAction>
            </HeaderGlobalBar>
          </Header>

          {/* ─── Notification Panel ──────────────────────────────────── */}
          <HeaderPanel
            aria-label="Painel de notificações"
            expanded={isNotificationPanelExpanded}
            className="shell-notification-panel"
          >
            <div ref={notifPanelRef} className="shell-notif-panel-inner">
              <div className="shell-notif-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h4 className="shell-notif-panel-title">{t('notifications')}</h4>
                  {notifications.length > 0 && (
                    <Tag type="blue" size="sm">{notifications.length}</Tag>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button
                    kind="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    style={{ padding: '0 0.5rem', minHeight: '1.5rem', color: '#78a9ff' }}
                  >
                    Marcar todas lidas
                  </Button>
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


          {/* ─── User Profile Modal (Carbon Modal with AI Label decorator) ──── */}
          <Modal
            open={isUserModalOpen}
            onRequestClose={() => setIsUserModalOpen(false)}
            onRequestSubmit={handleLogout}
            modalHeading={me.user?.email?.split('@')[0] || t('profile')}
            modalLabel={currentTenant?.name || 'genOS Cloud'}
            primaryButtonText={t('logout')}
            secondaryButtonText={t('cancel')}
            size="sm"
            danger
            preventCloseOnClickOutside={false}
            decorator={
              <AILabel autoAlign kind="default">
                <AILabelContent>
                  <div className="ai-badge-popover">
                    <div className="ai-badge-popover__header">
                      <span className="ai-badge-popover__eyebrow">{t('aiBadgeLabel')}</span>
                      <h4 className="ai-badge-popover__title">genOS Content Factory</h4>
                    </div>
                    {me.usage && (
                      <>
                        <div className="ai-badge-popover__meter-block" style={{ marginTop: '0.5rem' }}>
                          <div className="ai-badge-popover__big-number">
                            {Math.round(((me.usage.tokens_limit - me.usage.tokens_used) / Math.max(1, me.usage.tokens_limit)) * 100)}%
                          </div>
                          <p className="ai-badge-popover__status" data-ok={me.usage.tokens_used < me.usage.tokens_limit}>
                            {me.usage.tokens_used < me.usage.tokens_limit
                              ? `${(me.usage.tokens_limit - me.usage.tokens_used).toLocaleString(getLocale())} ${t('aiTokensRemaining')}`
                              : t('aiTokensLimitReached')}
                          </p>
                          <div className="ai-badge-popover__progress-track">
                            <div className="ai-badge-popover__progress-fill"
                              style={{ width: `${Math.min(100, Math.round((me.usage.tokens_used / Math.max(1, me.usage.tokens_limit)) * 100))}%` }}
                            />
                          </div>
                        </div>
                        <div className="ai-badge-popover__divider" />
                        <div className="ai-badge-popover__stats">
                          <div className="ai-badge-popover__stat">
                            <span className="ai-badge-popover__stat-label">{t('aiTokensUsed')}</span>
                            <span className="ai-badge-popover__stat-value">{me.usage.tokens_used.toLocaleString(getLocale())} / {me.usage.tokens_limit.toLocaleString(getLocale())}</span>
                          </div>
                          <div className="ai-badge-popover__stat">
                            <span className="ai-badge-popover__stat-label">{t('aiPostsUsed')}</span>
                            <span className="ai-badge-popover__stat-value">{me.usage.posts_used} / {me.usage.posts_limit}</span>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="ai-badge-popover__divider" />
                    <p className="ai-badge-popover__features">{t('aiContentFactoryDesc')}</p>
                  </div>
                  <AILabelActions>
                    <Button kind="ghost" onClick={() => setIsUserModalOpen(false)}>{t('cancel')}</Button>
                  </AILabelActions>
                </AILabelContent>
              </AILabel>
            }
          >
            {/* User data */}
            <div className="user-modal-body">
              <div className="user-modal-avatar">
                <UserAvatar size={32} />
              </div>
              <div className="user-modal-info">
                <p className="user-modal-name">{me.user?.email?.split('@')[0] || '—'}</p>
                <p className="user-modal-email">{me.user?.email || '—'}</p>
                <p className="user-modal-tenant">{currentTenant?.name || 'genOS Cloud'}</p>
              </div>

              {me.usage && (
                <div className="user-modal-badges">
                  <AILabel autoAlign kind="inline" size="sm"
                    textLabel={`${me.usage.tokens_used.toLocaleString(getLocale())} / ${me.usage.tokens_limit.toLocaleString(getLocale())} tokens`}
                  >
                    <AILabelContent>
                      <div className="ai-badge-popover">
                        <div className="ai-badge-popover__header">
                          <span className="ai-badge-popover__eyebrow">{t('aiBadgeLabel')}</span>
                          <h4 className="ai-badge-popover__title">{t('aiTokensTitle')}</h4>
                        </div>
                        <p className="ai-badge-popover__desc">{t('aiTokensDesc')}</p>
                      </div>
                    </AILabelContent>
                  </AILabel>

                  <AILabel autoAlign kind="inline" size="sm"
                    textLabel={`${me.usage.posts_used} / ${me.usage.posts_limit} posts`}
                  >
                    <AILabelContent>
                      <div className="ai-badge-popover">
                        <div className="ai-badge-popover__header">
                          <span className="ai-badge-popover__eyebrow">{t('aiBadgeLabel')}</span>
                          <h4 className="ai-badge-popover__title">{t('aiPostsTitle')}</h4>
                        </div>
                        <p className="ai-badge-popover__desc">{t('aiPostsDesc')}</p>
                      </div>
                    </AILabelContent>
                  </AILabel>
                </div>
              )}
            </div>
          </Modal>



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
                isActive={location.pathname.startsWith('/content-factory')}
                defaultExpanded
              >
                <SideNavMenuItem
                  href="/content-factory/posts"
                  isActive={location.pathname === '/content-factory/posts' || location.pathname === '/content-factory'}
                  onClick={goTo('/content-factory/posts')}
                >
                  {t('posts')}
                </SideNavMenuItem>
                <SideNavMenuItem
                  href="/content-factory/audit"
                  isActive={location.pathname === '/content-factory/audit'}
                  onClick={goTo('/content-factory/audit')}
                >
                  {t('complianceAuditor')}
                </SideNavMenuItem>
                <SideNavMenuItem
                  href="/content-factory/brand-dna"
                  isActive={location.pathname === '/content-factory/brand-dna'}
                  onClick={goTo('/content-factory/brand-dna')}
                >
                  {t('brandDna')}
                </SideNavMenuItem>
                <SideNavMenuItem
                  href="/content-factory/brand-dna/semantic"
                  isActive={location.pathname === '/content-factory/brand-dna/semantic'}
                  onClick={goTo('/content-factory/brand-dna/semantic')}
                >
                  {t('semanticMap')}
                </SideNavMenuItem>

                {/* Settings integrated into Content Factory — Master & Agency only */}
                {!isClient && (
                  <SideNavMenuItem
                    href="/content-factory/settings"
                    isActive={location.pathname === '/content-factory/settings' || location.pathname === '/settings'}
                    onClick={goTo('/content-factory/settings')}
                  >
                    {t('settings')}
                  </SideNavMenuItem>
                )}
              </SideNavMenu>
            </SideNavItems>

            {/* ─── Menu Lateral Footer (Copyright & About) ────────────────────── */}
            <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid #393939' }}>
              <p style={{ fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                &copy; {new Date().getFullYear()} Cestari Studio<br />
                Todos os direitos reservados.
              </p>
              <Button
                kind="ghost"
                size="sm"
                onClick={() => {
                  setIsAboutModalOpen(true);
                  if (isSideNavExpanded) onClickSideNavExpand();
                }}
                style={{ width: '100%', justifyContent: 'flex-start', paddingLeft: '0.4rem', color: '#c6c6c6' }}
              >
                Sobre o genOS™
              </Button>
            </div>
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
          {
            selectedNotification && (
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
            )
          }

          {/* ─── About genOS™ Modal ─────────────────────────────────────── */}
          <Modal
            open={isAboutModalOpen}
            passiveModal
            modalHeading="genOS™ Cloud Platform"
            modalLabel={import.meta.env.VITE_APP_VERSION ? `v${import.meta.env.VITE_APP_VERSION}` : 'v1.0.0'}
            onRequestClose={() => setIsAboutModalOpen(false)}
            size="sm"
          >
            <div style={{ paddingBlockEnd: '2rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#c6c6c6', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                O genOS™ Cloud Platform é o ecossistema definitivo para planejamento estratégico, autoria criativa e compliance de conteúdo utilizando Inteligência Artificial de ponta. Desenvolvido para marcas que exigem excelência.
              </p>

              <hr style={{ border: 'none', borderTop: '1px solid #393939', marginBottom: '1.5rem' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <a
                  href="https://suporte.cestari.studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.875rem', color: '#78a9ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  Termos de Serviço e Privacidade →
                </a>
                <a
                  href="mailto:suporte@cestari.studio?subject=Suporte genOS"
                  style={{ fontSize: '0.875rem', color: '#78a9ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  Contatar o Suporte →
                </a>
                <a
                  href="/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.875rem', color: '#78a9ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  Documentação da API e Guias →
                </a>
              </div>

              <p style={{ fontSize: '0.75rem', color: '#8d8d8d', marginTop: '2rem', fontStyle: 'italic' }}>
                Engineered with ♥ by Cestari Studio | São Paulo, SP
              </p>
            </div>
          </Modal>

        </>
      )
      }
    />
  );
}
