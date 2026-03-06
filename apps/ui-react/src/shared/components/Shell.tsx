import { useEffect, useRef, useMemo, useState, useCallback, type MouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SYSTEM_VERSIONS } from '@/config/versions';
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
import { SidePanel } from '@carbon/ibm-products';
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
  Building,
  UserFollow,
  Wallet,
  Finance,
  Launch,
  Notification as NotificationIcon,
  WatsonHealthStatusResolved,
  Chat
} from '@carbon/icons-react';
import { api, type MeResponse, type Tenant } from '@/services/api';
import { supabase } from '@/services/supabase';
import LocaleSelectorModal from '@/components/LocaleSelectorModal';
import TermsAcknowledgmentModal from '@/components/ContentFactory/TermsAcknowledgmentModal';
import { t, getLocale } from '@/config/locale';
import { useCanGenerate } from '@/hooks/useCanGenerate';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useGenOSVersion } from '@/shared/contexts/VersionProvider';
import { PLATFORM_ROUTES } from '../app-router';

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const { me, logout, switchTenant } = useAuth();
  const { version: genOSVersion } = useGenOSVersion();
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
    api.loadTenants().then((list: Tenant[]) => {
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
  const isAgency = depthLevel === 1;
  const isClient = depthLevel >= 2;

  const { isLowBalance, tokensRemaining } = useCanGenerate();

  const currentTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === activeTenant),
    [activeTenant, tenants]
  );

  const handleLogout = async () => {
    await logout();
    window.location.href = PLATFORM_ROUTES.HOME;
  };

  return (
    <HeaderContainer
      render={({ isSideNavExpanded, onClickSideNavExpand }: any) => (
        <>
          <Header aria-label="Cestari Studio" className="genos-header-gs100">
            <HeaderMenuButton
              aria-label={isSideNavExpanded ? 'Fechar menu' : 'Abrir menu'}
              onClick={onClickSideNavExpand}
              isActive={isSideNavExpanded}
            />
            <HeaderName href="/" prefix="genOS™">v5.0.0 [GS100]</HeaderName>

            {me.user && (
              <div className="header-telemetry-strip" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto', marginRight: '1rem' }}>
                <Tag type="blue" size="sm" title="Token Intelligence">
                  TK: {(me.usage?.tokens_used || 0).toLocaleString()} / {(me.usage?.tokens_limit || 5000).toLocaleString()}
                </Tag>
                <Tag type="green" size="sm" title="Content Production">
                  Posts: {me.usage?.posts_used || 0} / {me.usage?.posts_limit || 24}
                </Tag>

                <div style={{ borderLeft: '1px solid #393939', height: '20px', margin: '0 0.5rem' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f4f4f4' }}>
                  <Wallet size={16} />
                  <span className="cds--type-label-01" style={{ whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 600 }}>US$ 4,2000 (MTD)</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#24a148', marginLeft: '0.5rem' }}>
                  <WatsonHealthStatusResolved size={16} />
                  <span className="cds--type-label-01" style={{ whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 600 }}>ibm_fez: ONLINE</span>
                </div>
              </div>
            )}

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

            <HeaderPanel aria-label="User Profile" expanded={isUserModalOpen}>
              <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 className="cds--type-productive-heading-02">{t('profile')}</h4>
                  <Button kind="ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription="Fechar" onClick={() => setIsUserModalOpen(false)} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <UserAvatar size={32} />
                  <div>
                    <p className="cds--type-body-short-02 bold">Master</p>
                    <p className="cds--type-label-01" style={{ color: 'var(--cds-text-secondary)' }}>mail@cestari.studio</p>
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

                <div style={{ marginTop: 'auto' }}>
                  <Button kind="danger--tertiary" onClick={handleLogout} style={{ width: '100%' }} renderIcon={Logout}>
                    {t('logout')}
                  </Button>
                </div>
              </div>
            </HeaderPanel>
          </Header>

          {me.user && (
            <SideNav
              aria-label="Side navigation"
              isRail
              expanded={isSideNavExpanded}
              onOverlayClick={onClickSideNavExpand}
              isChildOfHeader={true}
            >
              <SideNavItems>
                {/* SEÇÃO 1: CORE genOS™ - Operação e IA */}
                <div style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '10px', fontWeight: 600, color: '#6f6f6f', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {isSideNavExpanded ? 'CORE genOS™' : 'CORE'}
                </div>

                <SideNavLink
                  renderIcon={Platforms}
                  href={PLATFORM_ROUTES.WORKSTATION}
                  isActive={location.pathname === PLATFORM_ROUTES.HOME || location.pathname === PLATFORM_ROUTES.WORKSTATION}
                  onClick={(e: any) => {
                    e.preventDefault();
                    navigate(PLATFORM_ROUTES.HOME);
                    if (isSideNavExpanded) onClickSideNavExpand();
                  }}
                >
                  Workstation
                </SideNavLink>

                <SideNavLink
                  renderIcon={Dashboard}
                  href={PLATFORM_ROUTES.CONSOLE}
                  isActive={location.pathname === PLATFORM_ROUTES.CONSOLE}
                  onClick={(e: any) => {
                    e.preventDefault();
                    navigate(PLATFORM_ROUTES.CONSOLE);
                    if (isSideNavExpanded) onClickSideNavExpand();
                  }}
                >
                  Dashboard
                </SideNavLink>

                <SideNavMenu renderIcon={DataEnrichment} title="Content Factory" isActive={location.pathname.startsWith('/content-factory')}>
                  <SideNavMenuItem
                    href={PLATFORM_ROUTES.FACTORY.POSTS}
                    isActive={location.pathname === PLATFORM_ROUTES.FACTORY.POSTS}
                    onClick={(e: any) => {
                      e.preventDefault();
                      navigate(PLATFORM_ROUTES.FACTORY.POSTS);
                      if (isSideNavExpanded) onClickSideNavExpand();
                    }}
                  >
                    Fila Operacional
                  </SideNavMenuItem>
                  <SideNavMenuItem
                    href={PLATFORM_ROUTES.FACTORY.QUALITY_GATE}
                    isActive={location.pathname === PLATFORM_ROUTES.FACTORY.QUALITY_GATE}
                    onClick={(e: any) => {
                      e.preventDefault();
                      navigate(PLATFORM_ROUTES.FACTORY.QUALITY_GATE);
                      if (isSideNavExpanded) onClickSideNavExpand();
                    }}
                  >
                    QualityGate™
                  </SideNavMenuItem>
                </SideNavMenu>

                <SideNavLink
                  renderIcon={DataView}
                  href={PLATFORM_ROUTES.WORKSTATION + "#matrix"}
                  isActive={location.hash === "#matrix"}
                  onClick={() => navigate(PLATFORM_ROUTES.WORKSTATION + "#matrix")}
                >
                  Matrix List™
                </SideNavLink>

                <SideNavLink
                  renderIcon={Cognitive}
                  href={PLATFORM_ROUTES.WORKSTATION + "#intelligence"}
                  isActive={location.hash === "#intelligence"}
                  onClick={() => navigate(PLATFORM_ROUTES.WORKSTATION + "#intelligence")}
                >
                  GEO Intelligence™
                </SideNavLink>

                <SideNavDivider />

                {/* SEÇÃO 2: CESTARI AGENCY - Páginas da Agência */}
                <div style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '10px', fontWeight: 600, color: '#6f6f6f', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {isSideNavExpanded ? 'CESTARI AGENCY' : 'AGENCY'}
                </div>

                <SideNavLink renderIcon={Launch} href="/agency/home">
                  Agency Home
                </SideNavLink>

                <SideNavLink renderIcon={Wallet} href="/agency/pricelist">
                  Pricelist
                </SideNavLink>

                <SideNavLink renderIcon={Building} href="/agency/portal">
                  Agency Portal
                </SideNavLink>

                <SideNavDivider />

                <div className="shell-sidenav-footer">
                  <p className="cds--type-helper-text-01" style={{ padding: '1rem', color: '#6f6f6f' }}>
                    &copy; 2026 Cestari Studio | v5.0.0
                  </p>
                </div>
              </SideNavItems>
            </SideNav>
          )}

          <Content
            id="main-content"
            className={`shell-content-container ${(!me.user || !isSideNavExpanded) ? 'shell-content-collapsed' : 'shell-content-expanded'}`}
          >
            <div className="shell-content-inner">
              {tokensRemaining <= 0 ? (
                <div style={{ position: 'fixed', top: '4rem', right: '1rem', zIndex: 10000, maxWidth: '20rem' }}>
                  <ToastNotification
                    kind="error"
                    title="Tokens Esgotados"
                    subtitle="Adquira um pacote agora para continuar gerando conteúdo."
                    caption={new Date().toLocaleTimeString()}
                    timeout={0}
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

          <ComposedModal
            open={isAboutModalOpen}
            onClose={() => setIsAboutModalOpen(false)}
            size="md"
          >
            <ModalHeader title="Sobre o genOS™ Cloud Platform" label={`v${genOSVersion}`} />
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
      )}
    />
  );
}








