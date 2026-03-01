import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Content,
  Header,
  HeaderContainer,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderName,
  HeaderPanel,
  Select,
  SelectItem,
  SideNav,
  SideNavDivider,
  SideNavItems,
  SideNavLink,
  SideNavMenu,
  SideNavMenuItem,
  SkipToContent,
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
} from '@carbon/icons-react';
import { hasPermission } from '../contexts/AuthContext';
import { api, type MeResponse, type Tenant } from '../services/api';
import LocaleSelectorModal from './LocaleSelectorModal';

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
  const [isLocaleModalOpen, setIsLocaleModalOpen] = useState(false);

  useEffect(() => {
    api.loadTenants().then((list) => {
      setTenants(list);
      const current = api.getActiveTenantId();
      if (current) setActiveTenant(current);
    });
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
              <HeaderGlobalAction aria-label="Notificações">
                <Notification size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction
                aria-label={isUserPanelExpanded ? 'Fechar menu de perfil' : 'Abrir menu de perfil'}
                isActive={isUserPanelExpanded}
                onClick={() => setIsUserPanelExpanded((prev) => !prev)}
              >
                <UserAvatar size={20} />
              </HeaderGlobalAction>
            </HeaderGlobalBar>

            <HeaderPanel
              expanded={isUserPanelExpanded}
              onHeaderPanelFocus={() => setIsUserPanelExpanded(false)}
              aria-label="Painel do usuário"
            >
              <div className="shell-user-panel">
                <p className="shell-user-panel-email">{me.user?.email || activeUserEmail || 'Usuário'}</p>
                <Button kind="ghost" size="sm" onClick={handleLogout}>
                  Logout
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
              <div className="shell-tenant-inline">
                <span className="shell-tenant-inline-label">Tenant:</span> {currentTenant?.name || 'N/A'}
              </div>
              {children}
            </div>
          </Content>

          <LocaleSelectorModal
            open={isLocaleModalOpen}
            onClose={() => setIsLocaleModalOpen(false)}
            tenantName={currentTenant?.name || 'Cestari Master Tenant'}
          />
        </>
      )}
    />
  );
}
