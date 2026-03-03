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
  InlineNotification,
  ToastNotification,
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
} from '@carbon/icons-react';
import { api, type MeResponse, type Tenant } from '../services/api';
import { supabase } from '../services/supabase';
import LocaleSelectorModal from './LocaleSelectorModal';
import { t, getLocale } from '../config/locale';
import { useCanGenerate } from '../hooks/useCanGenerate';

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

  const handleLogout = () => {
    api.logout();
    window.location.href = '/login';
  };

  // goTo logic moved inside HeaderContainer render prop below for access to toggle state

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
            <HeaderName prefix="Cestari Studio | ">genOS™ Cloud Platform</HeaderName>

            <HeaderGlobalBar>
              <HeaderGlobalAction
                aria-label="Idioma e Região"
                onClick={() => setIsLocaleModalOpen(true)}
              >
                <Earth size={20} />
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
            isPersistent={true}
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
                  onClick={(e: any) => {
                    e.preventDefault();
                    navigate('/content-factory/quality-gate');
                    if (isSideNavExpanded) onClickSideNavExpand();
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Security size={16} />
                    <span>{t('qualityGate') || 'Quality Gate'}</span>
                  </div>
                </SideNavMenuItem>

                {/* Cronograma (Premium) */}
                {(isMaster || me.config?.schedule_enabled) && (
                  <SideNavMenuItem
                    href="/content-factory/schedule"
                    isActive={location.pathname === '/content-factory/schedule'}
                    onClick={(e: any) => {
                      e.preventDefault();
                      navigate('/content-factory/schedule');
                      if (isSideNavExpanded) onClickSideNavExpand();
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                      <Calendar size={16} />
                      <span style={{ flex: 1 }}>{t('schedule') || 'Cronograma'}</span>
                      {me.config?.schedule_enabled && (
                        <Tag type="warm-gray" size="sm" style={{ height: '1.25rem', padding: '0 0.5rem', fontSize: '0.65rem', marginLeft: 'auto' }}>
                          PREMIUM
                        </Tag>
                      )}
                    </div>
                  </SideNavMenuItem>
                )}
                <SideNavMenuItem
                  href="/content-factory/audit"
                  isActive={location.pathname === '/content-factory/audit'}
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
