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
  InlineNotification,
  ToastNotification,
  Dropdown
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
  CalendarHeatMap
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
    setIsUserModalOpen(prev => !prev);
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
            </HeaderGlobalBar>

            {/* ─── User Profile Reacting as Right Panel ──── */}
            <HeaderPanel aria-label="User Profile" expanded={isUserModalOpen} className="user-header-panel">
              <div style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h4 className="cds--type-productive-heading-02">{t('profile')}</h4>
                  <IconButton kind="ghost" size="sm" onClick={() => setIsUserModalOpen(false)} label="Fechar">
                    <Close size={16} />
                  </IconButton>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <UserAvatar size={32} />
                  <div>
                    <p className="cds--type-body-short-02 bold">{me.user?.email?.split('@')[0] || '—'}</p>
                    <p className="cds--type-label-01" style={{ color: 'var(--cds-text-secondary)' }}>{me.user?.email || '—'}</p>
                  </div>
                </div>

                {/* ─── WORKSPACE SWITCHER ─── */}
                <div style={{ marginBottom: '2rem' }}>
                  <p className="cds--type-label-01" style={{ marginBottom: '0.5rem', color: 'var(--cds-text-secondary)' }}>
                    Workspace Atual
                  </p>
                  {tenants.length > 1 ? (
                    <Dropdown
                      id="workspace-switcher"
                      titleText="Alternar Workspace"
                      label="Selecione..."
                      items={tenants.map(t => ({ id: t.id, text: t.name }))}
                      itemToString={(item: any) => (item ? item.text : '')}
                      selectedItem={tenants.find(t => t.id === activeTenant) ? { id: activeTenant, text: tenants.find(t => t.id === activeTenant)?.name } : null}
                      onChange={({ selectedItem }: any) => {
                        if (selectedItem?.id) {
                          setActiveTenant(selectedItem.id);
                          switchTenant(selectedItem.id);
                        }
                      }}
                      size="sm"
                    />
                  ) : (
                    <p className="cds--type-body-short-01 bold">{currentTenant?.name || 'genOS Cloud'}</p>
                  )}
                </div>

                {me.usage && (
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className="cds--type-label-01">{t('aiTokensUsed')}</span>
                      <span className="cds--type-label-01">{me.usage.tokens_used.toLocaleString(getLocale())} / {me.usage.tokens_limit.toLocaleString(getLocale())}</span>
                    </div>
                    <div className="ai-badge-popover__progress-track" style={{ marginBottom: '1rem' }}>
                      <div className="ai-badge-popover__progress-fill"
                        style={{ width: `${Math.min(100, Math.round((me.usage.tokens_used / Math.max(1, me.usage.tokens_limit)) * 100))}%` }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className="cds--type-label-01">{t('aiPostsUsed')}</span>
                      <span className="cds--type-label-01">{me.usage.posts_used} / {me.usage.posts_limit}</span>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 'auto' }}>
                  <Button kind="danger--tertiary" onClick={handleLogout} style={{ width: '100%' }}>
                    {t('logout')}
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


          {/* ─── About genOS™ Modal ─────────────────────────────────────── */}
          <Modal
            open={isAboutModalOpen}
            passiveModal
            modalHeading="genOS™ Cloud Platform"
            modalLabel={`v${SYSTEM_VERSIONS.genOS}`}
            onRequestClose={() => setIsAboutModalOpen(false)}
            size="sm"
          >
            <div className="shell-about-modal-body">
              <p className="cds--type-body-short-01">
                O genOS™ Cloud Platform é o ecossistema definitivo para planejamento estratégico, autoria criativa e compliance de conteúdo utilizando Inteligência Artificial de ponta. Desenvolvido para marcas que exigem excelência.
              </p>

              <hr className="shell-about-modal-divider" />

              <div className="shell-about-links">
                <a
                  href="https://suporte.cestari.studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shell-about-link"
                >
                  Termos de Serviço e Privacidade →
                </a>
                <a
                  href="mailto:suporte@cestari.studio?subject=Suporte genOS"
                  className="shell-about-link"
                >
                  Contatar o Suporte →
                </a>
                <a
                  href="/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shell-about-link"
                >
                  Documentação da API e Guias →
                </a>
              </div>

              <p className="cds--type-helper-text-01 shell-about-footer">
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
