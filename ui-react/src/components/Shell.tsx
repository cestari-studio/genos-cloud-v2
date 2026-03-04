import { useEffect, useRef, useMemo, useState, useCallback, type MouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SYSTEM_VERSIONS } from '../config/versions';
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
  SideNav,
  SideNavDivider,
  SideNavItems,
  SideNavLink,
  SideNavMenu, SideNavMenuItem,
  Theme, Dropdown, InlineNotification, ToastNotification,
  ComposedModal, ModalHeader, ModalBody, ModalFooter, Stack, ProgressBar, Link,
  SkipToContent, Tag
} from '@carbon/react';
import {
  Dashboard,
  DataEnrichment,
  Settings,
  UserAvatar,
  Earth,
  Close,
  Logout,
  View,
  Calendar,
  Security,
  Analytics,
  DataView,
  Cognitive,
  DataCheck,
  AiObservability,
  DocumentSigned,
  FolderTree,
  DataAnalytics,
  Platforms,
  Development,
  Async,
  CalendarHeatMap,
  VirtualMachine,
  Identification,
  WorkflowAutomation,
  Help,
  Document,
  Notification as NotificationIcon,
  WatsonHealthStatusResolved
} from '@carbon/icons-react';
import { api, type MeResponse, type Tenant } from '../services/api';
import { supabase } from '../services/supabase';
import LocaleSelectorModal from './LocaleSelectorModal';
import TermsAcknowledgmentModal from './ContentFactory/TermsAcknowledgmentModal';
import { t, getLocale } from '../config/locale';
import { useCanGenerate } from '../hooks/useCanGenerate';
import { useAuth } from '../contexts/AuthContext';

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const { me, logout, switchTenant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tenants, setTenants] = useState<Tenant[]>(api.getTenants());
  const [activeTenant, setActiveTenant] = useState<string>(api.getActiveTenantId() || '');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isLocaleModalOpen, setIsLocaleModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);

  useEffect(() => {
    console.log('genOS Shell: Effect triggered [loadTenants]');
    api.loadTenants().then((list) => {
      setTenants(list);
      const current = api.getActiveTenantId();
      if (current) setActiveTenant(current);
    });
  }, []);

  const closePanels = useCallback(() => {
    setIsUserModalOpen(false);
  }, []);

  const toggleUserModal = () => {
    setIsNotifPanelOpen(false);
    setIsUserModalOpen(prev => !prev);
  };

  const toggleNotifPanel = () => {
    setIsUserModalOpen(false);
    setIsNotifPanelOpen(prev => !prev);
  };

  const notifPanelRef = useRef<HTMLDivElement>(null);
  // (click-outside handled by backdrop overlay below — no document listeners needed)

  const depthLevel = me.tenant?.depth_level ?? 0;
  const isMaster = depthLevel === 0;
  const isClient = depthLevel >= 2;

  const { isLowBalance, tokensRemaining } = useCanGenerate();

  const currentTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === activeTenant),
    [activeTenant, tenants]
  );

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  // goTo logic moved inside HeaderContainer render prop below for access to toggle state

  return (
    <HeaderContainer
      render={({ isSideNavExpanded, onClickSideNavExpand }: any) => (
        <>
          <Header aria-label="Cestari Studio">
            <SkipToContent />
            {me.user && (
              <HeaderMenuButton
                aria-label={isSideNavExpanded ? 'Fechar menu' : 'Abrir menu'}
                isActive={isSideNavExpanded}
                onClick={onClickSideNavExpand}
                isCollapsible
              />
            )}
            <HeaderName prefix={me.user ? 'Cestari Studio | ' : ''}>
              {me.user ? 'genOS™ Cloud Platform' : 'Cestari Studio'}
            </HeaderName>

            <HeaderGlobalBar>
              <HeaderGlobalAction
                aria-label="Idioma e Região"
                onClick={() => setIsLocaleModalOpen(true)}
              >
                <Earth size={20} />
              </HeaderGlobalAction>
              {me.user && (
                <HeaderGlobalAction
                  aria-label={isUserModalOpen ? 'Fechar perfil' : 'Abrir perfil'}
                  isActive={isUserModalOpen}
                  onClick={toggleUserModal}
                  tooltipAlignment="end"
                >
                  <UserAvatar size={20} />
                </HeaderGlobalAction>
              )}
              {me.user && (
                <HeaderGlobalAction
                  aria-label={isNotifPanelOpen ? 'Fechar notificações' : 'Abrir notificações'}
                  isActive={isNotifPanelOpen}
                  onClick={toggleNotifPanel}
                  tooltipAlignment="end"
                >
                  <NotificationIcon size={20} />
                </HeaderGlobalAction>
              )}
            </HeaderGlobalBar>

            {/* ─── Profile & Workspace HeaderPanel ──── */}
            <HeaderPanel aria-label="User Profile" expanded={isUserModalOpen}>
              <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 className="cds--type-productive-heading-02">{t('profile')}</h4>
                  <Button kind="ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription="Fechar" onClick={() => setIsUserModalOpen(false)} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <UserAvatar size={32} />
                  <div>
                    <p className="cds--type-body-short-02 bold">{me.user?.email?.split('@')[0] || '—'}</p>
                    <p className="cds--type-label-01" style={{ color: 'var(--cds-text-secondary)' }}>{me.user?.email || '—'}</p>
                  </div>
                </div>

                <div className="shell-panel-section">
                  <p className="cds--type-label-01" style={{ marginBottom: '0.5rem', color: 'var(--cds-text-secondary)' }}>
                    Workspace Atual
                  </p>
                  {tenants.length > 1 ? (
                    <Dropdown
                      id="shell-workspace-switcher"
                      titleText=""
                      label="Alternar Workspace"
                      items={tenants.map(t => ({ id: t.id, text: t.name }))}
                      itemToString={(item: any) => (item ? item.text : '')}
                      selectedItem={tenants.find(t => t.id === activeTenant) ? { id: activeTenant, text: tenants.find(t => t.id === activeTenant)?.name } : null}
                      onChange={({ selectedItem }: any) => {
                        if (selectedItem?.id) {
                          setActiveTenant(selectedItem.id);
                          switchTenant(selectedItem.id);
                        }
                      }}
                      size="md"
                    />
                  ) : (
                    <p className="cds--type-body-short-01 bold">{currentTenant?.name || 'genOS Cloud'}</p>
                  )}
                </div>

                {me.usage && (
                  <div className="shell-panel-section">
                    <p className="cds--type-label-01" style={{ marginBottom: '0.75rem', color: 'var(--cds-text-secondary)' }}>Status da Conta</p>
                    <Stack gap={4}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span className="cds--type-caption-01">{t('aiTokensUsed')}</span>
                          <span className="cds--type-caption-01">{me.usage.tokens_used.toLocaleString()} / {me.usage.tokens_limit.toLocaleString()}</span>
                        </div>
                        <ProgressBar
                          label={t('aiTokensUsed')}
                          value={Math.min(100, Math.round((me.usage.tokens_used / Math.max(1, me.usage.tokens_limit)) * 100))}
                          max={100}
                          size="small"
                          hideLabel
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span className="cds--type-caption-01">{t('aiPostsUsed')}</span>
                          <span className="cds--type-caption-01">{me.usage.posts_used} / {me.usage.posts_limit}</span>
                        </div>
                        <ProgressBar
                          label={t('aiPostsUsed')}
                          value={Math.min(100, Math.round((me.usage.posts_used / Math.max(1, me.usage.posts_limit)) * 100))}
                          max={100}
                          size="small"
                          hideLabel
                        />
                      </div>
                    </Stack>
                  </div>
                )}

                <div style={{ marginTop: 'auto' }}>
                  <Button kind="danger--tertiary" onClick={handleLogout} style={{ width: '100%' }} renderIcon={Logout}>
                    {t('logout')}
                  </Button>
                </div>
              </div>
            </HeaderPanel>

            {/* ─── Global Notifications Panel ──── */}
            <HeaderPanel aria-label="Notifications" expanded={isNotifPanelOpen}>
              <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 className="cds--type-productive-heading-02">Notificações</h4>
                  <Button kind="ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription="Fechar" onClick={() => setIsNotifPanelOpen(false)} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ padding: '1rem', border: '1px solid var(--cds-border-subtle-01)', background: 'var(--cds-layer-01)' }}>
                    <p className="cds--type-label-01" style={{ color: 'var(--cds-link-primary)', marginBottom: '0.25rem' }}>SISTEMA</p>
                    <p className="cds--type-body-short-01">genOS Cloud v{SYSTEM_VERSIONS.genOS} implantado com sucesso.</p>
                    <p className="cds--type-caption-01" style={{ marginTop: '0.5rem', color: 'var(--cds-text-helper)' }}>Hoje, 16:45</p>
                  </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <Button kind="ghost" size="sm" onClick={() => setIsNotifPanelOpen(false)} style={{ width: '100%' }}>
                    Limpar Notificações
                  </Button>
                </div>
              </div>
            </HeaderPanel>
          </Header>







          {me.user && (
            <SideNav
              aria-label="Navegação principal"
              isRail
              expanded={isSideNavExpanded}
              onOverlayClick={onClickSideNavExpand}
            >
              <SideNavItems>
                {/* Dashboard — ALL levels */}
                <SideNavLink
                  href="/"
                  renderIcon={Dashboard}
                  isActive={location.pathname === '/' || location.pathname === '/console'}
                  onClick={(e: any) => {
                    e.preventDefault();
                    navigate('/');
                    if (isSideNavExpanded) onClickSideNavExpand();
                  }}
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
                    onClick={(e: any) => {
                      e.preventDefault();
                      navigate('/content-factory/posts');
                      if (isSideNavExpanded) onClickSideNavExpand();
                    }}
                  >
                    {t('posts')}
                  </SideNavMenuItem>

                  <SideNavMenuItem
                    href="/content-factory/quality-gate"
                    isActive={location.pathname === '/content-factory/quality-gate'}
                    renderIcon={AiObservability}
                    onClick={(e: any) => {
                      e.preventDefault();
                      navigate('/content-factory/quality-gate');
                      if (isSideNavExpanded) onClickSideNavExpand();
                    }}
                  >
                    {t('qualityGate') || 'Quality Gate'}
                  </SideNavMenuItem>

                  {/* Cronograma (Premium) */}
                  {(isMaster || me.config?.schedule_enabled) && (
                    <SideNavMenuItem
                      href="/content-factory/schedule"
                      isActive={location.pathname === '/content-factory/schedule'}
                      renderIcon={CalendarHeatMap}
                      onClick={(e: any) => {
                        e.preventDefault();
                        navigate('/content-factory/schedule');
                        if (isSideNavExpanded) onClickSideNavExpand();
                      }}
                    >
                      {t('schedule') || 'Cronograma'}
                    </SideNavMenuItem>
                  )}
                  <SideNavMenuItem
                    href="/content-factory/audit"
                    isActive={location.pathname === '/content-factory/audit'}
                    renderIcon={DocumentSigned}
                    onClick={(e: any) => {
                      e.preventDefault();
                      navigate('/content-factory/audit');
                      if (isSideNavExpanded) onClickSideNavExpand();
                    }}
                  >
                    {t('complianceAuditor')}
                  </SideNavMenuItem>
                  <SideNavMenuItem
                    href="/content-factory/brand-dna"
                    isActive={location.pathname === '/content-factory/brand-dna'}
                    renderIcon={Cognitive}
                    onClick={(e: any) => {
                      e.preventDefault();
                      navigate('/content-factory/brand-dna');
                      if (isSideNavExpanded) onClickSideNavExpand();
                    }}
                  >
                    {t('brandDna')}
                  </SideNavMenuItem>
                  <SideNavMenuItem
                    href="/content-factory/brand-dna/semantic"
                    isActive={location.pathname === '/content-factory/brand-dna/semantic'}
                    renderIcon={FolderTree}
                    onClick={(e: any) => {
                      e.preventDefault();
                      navigate('/content-factory/brand-dna/semantic');
                      if (isSideNavExpanded) onClickSideNavExpand();
                    }}
                  >
                    {t('semanticMap')}
                  </SideNavMenuItem>

                  {/* Settings integrated into Content Factory — Master & Agency only */}
                  {!isClient && (
                    <SideNavMenuItem
                      href="/content-factory/settings"
                      isActive={location.pathname === '/content-factory/settings' || location.pathname === '/settings'}
                      onClick={(e: any) => {
                        e.preventDefault();
                        navigate('/content-factory/settings');
                        if (isSideNavExpanded) onClickSideNavExpand();
                      }}
                    >
                      {t('settings')}
                    </SideNavMenuItem>
                  )}

                  {/* Analytics — Agency & Master only */}
                  {!isClient && (
                    <SideNavMenuItem
                      href="/content-factory/analytics"
                      isActive={location.pathname === '/content-factory/analytics'}
                      renderIcon={DataAnalytics}
                      onClick={(e: any) => {
                        e.preventDefault();
                        navigate('/content-factory/analytics');
                        if (isSideNavExpanded) onClickSideNavExpand();
                      }}
                    >
                      {t('analytics') || 'Analytics'}
                    </SideNavMenuItem>
                  )}

                  {/* Observatory — Master & Agency only */}
                  {!isClient && (
                    <SideNavMenuItem
                      href="/content-factory/observatory"
                      isActive={location.pathname === '/content-factory/observatory'}
                      renderIcon={View}
                      onClick={(e: any) => {
                        e.preventDefault();
                        navigate('/content-factory/observatory');
                        if (isSideNavExpanded) onClickSideNavExpand();
                      }}
                    >
                      {t('observatory') || 'Observatório'}
                    </SideNavMenuItem>
                  )}
                </SideNavMenu>

                {/* ─── Menu Lateral Footer (Copyright & About) ────────────────────── */}
                <div className="shell-sidenav-footer">
                  <p className="cds--type-helper-text-01 shell-sidenav-footer__copy">
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
                    className="shell-sidenav-footer__about-btn"
                  >
                    Sobre o genOS™
                  </Button>
                </div>
              </SideNavItems>
            </SideNav>
          )}

          <Content id="main-content" className={(!me.user || !isSideNavExpanded) ? 'content-collapsed' : ''}>
            <div className="shell-content-inner">
              {tokensRemaining <= 0 ? (
                <div style={{ position: 'fixed', top: '4rem', right: '1rem', zIndex: 10000, maxWidth: '20rem' }}>
                  <ToastNotification
                    kind="error"
                    title="Tokens Esgotados"
                    subtitle="Adquira um pacote agora para continuar gerando conteúdo."
                    caption={new Date().toLocaleTimeString()}
                    timeout={0}
                    onCloseButtonClick={() => { }}
                  />
                </div>
              ) : isLowBalance && (
                <div style={{ marginBottom: '1rem' }}>
                  <InlineNotification
                    kind="warning"
                    title="Saldo Crítico"
                    subtitle={`Saldo de ${tokensRemaining} tokens restantes.`}
                    lowContrast
                    hideCloseButton
                  />
                </div>
              )}
              {children}
            </div>
          </Content>

          <LocaleSelectorModal
            open={isLocaleModalOpen}
            onClose={() => setIsLocaleModalOpen(false)}
            tenantName={currentTenant?.name || 'Cestari Master Tenant'}
          />

          <TermsAcknowledgmentModal />




          {/* ─── About genOS™ Modal — Pure Carbon ────────────────────────── */}
          <ComposedModal
            open={isAboutModalOpen}
            onClose={() => setIsAboutModalOpen(false)}
            size="md"
          >
            <ModalHeader title="Sobre o genOS™ Cloud Platform" label={`v${SYSTEM_VERSIONS.genOS}`} />
            <ModalBody>
              <Stack gap={5}>
                <p className="cds--type-body-short-01">
                  O genOS™ Cloud Platform é o sistema operacional da marca — unindo IA Generativa e Compliance Estratégico em um único ambiente multi-tenant isolado.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <h5 className="cds--type-heading-01">Arquitetura</h5>
                    <p className="cds--type-body-short-01">Engineered with Carbon Design System | Supabase Cloud.</p>
                  </div>
                  <div>
                    <h5 className="cds--type-heading-01">Compliance</h5>
                    <p className="cds--type-body-short-01">Row-Level Security v{SYSTEM_VERSIONS.genOS}.</p>
                  </div>
                </div>
              </Stack>
            </ModalBody>
            <ModalFooter>
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="cds--type-caption-01">© 2026 Cestari Studio</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <Link href="mailto:suporte@cestari.studio">Suporte</Link>
                  <Button kind="primary" onClick={() => setIsAboutModalOpen(false)}>Fechar</Button>
                </div>
              </div>
            </ModalFooter>
          </ComposedModal>

        </>
      )
      }
    />
  );
}
