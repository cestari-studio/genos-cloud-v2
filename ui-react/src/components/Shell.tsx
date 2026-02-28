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
  DataFormat,
  ConnectionSignal,
  Earth,
  Chat,
  DataShare,
  Store,
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
              <SideNavLink
                href="/"
                renderIcon={Dashboard}
                isActive={location.pathname === '/'}
                onClick={goTo('/')}
              >
                Dashboard
              </SideNavLink>
              <SideNavLink
                href="/console"
                renderIcon={Chat}
                isActive={location.pathname === '/console'}
                onClick={goTo('/console')}
              >
                WatsonX Console
              </SideNavLink>
              <SideNavLink
                href="/architect"
                renderIcon={DataShare}
                isActive={location.pathname === '/architect'}
                onClick={goTo('/architect')}
              >
                Architect Canvas
              </SideNavLink>
              <SideNavMenu
                renderIcon={DataEnrichment}
                title="Content Factory"
                isActive={location.pathname.startsWith('/factory')}
              >
                <SideNavMenuItem
                  href="/content-factory"
                  onClick={goTo('/content-factory')}
                >
                  Matrix List (Modular)
                </SideNavMenuItem>
                <SideNavMenuItem
                  href="/factory/matrix"
                  onClick={goTo('/factory/matrix')}
                >
                  Matrix Grid
                </SideNavMenuItem>
                <SideNavMenuItem
                  href="/factory/audit"
                  onClick={goTo('/factory/audit')}
                >
                  Compliance Auditor
                </SideNavMenuItem>
              </SideNavMenu>
              <SideNavLink
                href="/csv-browser"
                renderIcon={TableSplit}
                isActive={location.pathname === '/csv-browser'}
                onClick={goTo('/csv-browser')}
              >
                CSV Browser
              </SideNavLink>
              <SideNavMenu
                renderIcon={Chemistry}
                title="Intelligence Pipeline"
                isActive={location.pathname.startsWith('/brand-dna')}
              >
                <SideNavMenuItem
                  href="/brand-dna"
                  onClick={goTo('/brand-dna')}
                >
                  Brand DNA (Core)
                </SideNavMenuItem>
                <SideNavMenuItem
                  href="/brand-dna/semantic"
                  onClick={goTo('/brand-dna/semantic')}
                >
                  Semantic Map
                </SideNavMenuItem>
              </SideNavMenu>
              <SideNavLink
                href="/schedule"
                renderIcon={Calendar}
                isActive={location.pathname === '/schedule'}
                onClick={goTo('/schedule')}
              >
                Cronograma
              </SideNavLink>

              <SideNavDivider />

              {canViewObservatory && (
                <SideNavMenu
                  renderIcon={ChartColumn}
                  title="Observatory"
                  isActive={location.pathname.startsWith('/observatory')}
                >
                  <SideNavMenuItem href="/observatory" onClick={goTo('/observatory')}>
                    Dashboard
                  </SideNavMenuItem>
                  <SideNavMenuItem href="/observatory/quantum" onClick={goTo('/observatory/quantum')}>
                    Quantum (Drift)
                  </SideNavMenuItem>
                  {canViewPricing && (
                    <SideNavMenuItem href="/observatory/pricing" onClick={goTo('/observatory/pricing')}>
                      Pricing
                    </SideNavMenuItem>
                  )}
                </SideNavMenu>
              )}

              <SideNavDivider />

              {canViewPricing && (
                <SideNavLink
                  href="/observatory/pricing"
                  renderIcon={Purchase}
                  isActive={location.pathname === '/observatory/pricing'}
                  onClick={goTo('/observatory/pricing')}
                >
                  Pricing Config
                </SideNavLink>
              )}

              {isSysAdmin && (
                <>
                  <SideNavDivider />
                  <SideNavMenu
                    renderIcon={CloudSatellite}
                    title="Master Admin"
                    isActive={location.pathname.startsWith('/admin')}
                  >
                    <SideNavMenuItem href="/admin/health" onClick={goTo('/admin/health')}>
                      Global Health
                    </SideNavMenuItem>
                    <SideNavMenuItem href="/admin/tenants" onClick={goTo('/admin/tenants')}>
                      Tenant Master List
                    </SideNavMenuItem>
                    <SideNavMenuItem href="/admin/api-hub" onClick={goTo('/admin/api-hub')}>
                      API Connector Hub
                    </SideNavMenuItem>
                    <SideNavMenuItem href="/admin/topology" onClick={goTo('/admin/topology')}>
                      System Topology Hub
                    </SideNavMenuItem>
                    <SideNavMenuItem href="/admin/commerce" onClick={goTo('/admin/commerce')}>
                      Agentic Commerce
                    </SideNavMenuItem>
                    <SideNavMenuItem href="/admin/components" onClick={goTo('/admin/components')}>
                      Carbon Foundry
                    </SideNavMenuItem>
                  </SideNavMenu>
                </>
              )}

              <SideNavLink
                href="/factory"
                renderIcon={Task}
                isActive={location.pathname === '/tasks'}
                onClick={goTo('/factory')}
              >
                Tasks
              </SideNavLink>

              <SideNavLink
                href="/settings"
                renderIcon={Settings}
                isActive={location.pathname === '/settings'}
                onClick={goTo('/settings')}
              >
                Settings
              </SideNavLink>
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
