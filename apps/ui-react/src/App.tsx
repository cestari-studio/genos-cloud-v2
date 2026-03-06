import React, { useState, useEffect, lazy, Suspense, Component, ReactNode } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { InlineLoading } from '@carbon/react';
import { useAuth } from './shared/contexts/AuthContext';
import { useGenOSVersion } from './shared/contexts/VersionProvider';
import { PLATFORM_ROUTES, MARKETING_ROUTES, AUTH_ROUTES } from './shared/app-router';
import PageSkeleton from './components/PageSkeleton';
import UpdateBanner from './components/UpdateBanner';

// Components & Layout
import Shell from './shared/components/Shell';
import { HardBlockModal } from './components/HardBlockModal';

// Pages — eager (critical path)
import MasterLogin from './apps/platform/MasterLogin';
import Factory from './apps/platform/Factory';
import WixPasswordRecovery from './apps/platform/WixPasswordRecovery';
import ResetPassword from './apps/platform/ResetPassword';

// Pages — lazy loaded
const Workstation = lazy(() => import('./apps/platform/Workstation'));
const Console = lazy(() => import('./apps/platform/Console'));
const BrandDna = lazy(() => import('./apps/platform/BrandDna'));
const SemanticMapPage = lazy(() => import('./apps/platform/SemanticMapPage'));
const Settings = lazy(() => import('./apps/platform/Settings'));
const ComplianceAuditPage = lazy(() => import('./apps/platform/ComplianceAuditPage'));
const QualityGatePage = lazy(() => import('./apps/platform/QualityGatePage'));
const Schedule = lazy(() => import('./apps/platform/Schedule'));
const AnalyticsPage = lazy(() => import('./apps/platform/AnalyticsPage'));
const SocialCallbackPage = lazy(() => import('./apps/platform/auth/SocialCallback'));
const MasterAdmin = lazy(() => import('./apps/platform/MasterAdmin'));
const WixCallback = lazy(() => import('./apps/platform/auth/WixCallback'));
const Observatory = lazy(() => import('./apps/platform/Observatory'));
const OnboardingWizard = lazy(() => import('./apps/platform/OnboardingWizard'));
const Plans = lazy(() => import('./apps/platform/Plans'));
const AgencyPortfolio = lazy(() => import('./apps/platform/AgencyPortfolio'));
const ClientHome = lazy(() => import('./apps/platform/ClientHome'));
const TeamManagement = lazy(() => import('./apps/platform/TeamManagement'));
const BillingUsage = lazy(() => import('./apps/platform/BillingUsage'));
import SocialHub from './apps/platform/SocialHub';
import NotFound from './apps/platform/NotFound';
import ErrorPage from './apps/platform/ErrorPage';

// Marketing Pages
const HomePage = lazy(() => import('./apps/marketing/HomePage'));
const PricingPage = lazy(() => import('./apps/marketing/PricingPage'));


class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("genOS Runtime Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <h2>Algo deu errado.</h2>
          <p>O genOS encontrou um erro inesperado que impediu a renderização.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="error-boundary-fallback__btn"
          >
            Recarregar Plataforma
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Unified Layout — all authenticated users share Shell ─────────────────
function FullLayout({ me }: { me: ReturnType<typeof useAuth>['me'] }) {
  const depthLevel = me.tenant?.depth_level ?? 0;
  const isClient = depthLevel >= 2;

  // Helper: restrict route to non-client users
  const guard = (element: React.ReactNode) =>
    isClient ? <Navigate to={PLATFORM_ROUTES.FACTORY.ROOT} replace /> : element;

  // Helper: ProtectedRoute for authenticated users
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { me } = useAuth();
    if (!me.authenticated) {
      return <Navigate to={AUTH_ROUTES.LOGIN} replace />;
    }
    return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
  };

  return (
    <Shell>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Dashboard — ALL levels */}
          <Route path={PLATFORM_ROUTES.HOME} element={<Workstation />} />
          <Route path={PLATFORM_ROUTES.WORKSTATION} element={<Navigate to={PLATFORM_ROUTES.HOME} replace />} />
          <Route path={PLATFORM_ROUTES.CONSOLE} element={<Console />} />

          {/* Content Factory > Posts — ALL levels */}
          <Route path={PLATFORM_ROUTES.FACTORY.POSTS} element={<Factory />} />
          <Route path={PLATFORM_ROUTES.FACTORY.ROOT} element={<Navigate to={PLATFORM_ROUTES.FACTORY.POSTS} replace />} />

          {/* Content Factory > Schedule — ALL levels */}
          <Route path={PLATFORM_ROUTES.FACTORY.SCHEDULE} element={<Schedule />} />

          {/* Content Factory > Compliance Auditor — unified path */}
          <Route path={PLATFORM_ROUTES.FACTORY.AUDIT} element={<ComplianceAuditPage />} />

          {/* Content Factory > Brand DNA — unified path */}
          <Route path={PLATFORM_ROUTES.FACTORY.BRAND_DNA} element={<BrandDna />} />

          {/* Content Factory > Semantic Map — unified path */}
          <Route path={PLATFORM_ROUTES.FACTORY.SEMANTIC} element={<SemanticMapPage />} />

          {/* Content Factory > Settings — Master & Agency only */}
          <Route path={PLATFORM_ROUTES.FACTORY.SETTINGS} element={guard(<Settings />)} />

          {/* Content Factory > Quality Gate — unified path */}
          <Route path={PLATFORM_ROUTES.FACTORY.QUALITY_GATE} element={<QualityGatePage />} />

          {/* Content Factory > Analytics */}
          <Route path={PLATFORM_ROUTES.FACTORY.ANALYTICS} element={<AnalyticsPage />} />

          {/* Content Factory > Observatory (Real-time Topology) */}
          <Route path={PLATFORM_ROUTES.FACTORY.OBSERVATORY} element={<Observatory />} />

          {/* Content Factory > Plans & Pricing */}
          <Route path={PLATFORM_ROUTES.FACTORY.PLANS} element={<Plans />} />

          {/* OAuth Callbacks */}
          <Route path={AUTH_ROUTES.SOCIAL_CALLBACK} element={<SocialCallbackPage />} />

          {/* Client Cockpit */}
          <Route path={PLATFORM_ROUTES.CLIENT.HOME} element={<ClientHome />} />
          <Route path={PLATFORM_ROUTES.CLIENT.TEAM} element={<TeamManagement />} />
          <Route path={PLATFORM_ROUTES.CLIENT.BILLING} element={<ProtectedRoute><BillingUsage /></ProtectedRoute>} />
          <Route path={PLATFORM_ROUTES.SOCIAL_HUB} element={<ProtectedRoute><SocialHub /></ProtectedRoute>} />

          {/* Error/404 Routes */}
          <Route path="/500" element={<ErrorPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}

// ─── App Content ─────────────────────────────────────────────────────────────
function AppContent() {
  const { me, login, refreshMe } = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      if (window.location.hash.includes('type=recovery')) {
        navigate(AUTH_ROUTES.RESET, { replace: true });
        setIsInitializing(false);
        return;
      }

      await refreshMe();
      setIsInitializing(false);
    };
    init();
  }, []);

  if (isInitializing) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#161616', // Enforce GS100
        gap: '1rem',
      }}>
        <InlineLoading
          description="genOS Loading..."
          style={{ justifyContent: 'center', width: 'auto' }}
        />
      </div>
    );
  }

  const authenticated = me.authenticated;

  return (
    <>
      <UpdateBanner />
      <Routes>
        {/* Public Routes */}
        <Route path={AUTH_ROUTES.LOGIN} element={<MasterLogin authenticated={authenticated} onLogin={login} />} />
        <Route path={AUTH_ROUTES.FORGOT} element={<WixPasswordRecovery />} />
        <Route path={AUTH_ROUTES.RESET} element={<ResetPassword />} />

        {/* Wix Auth Bridge Callback */}
        <Route path={AUTH_ROUTES.WIX_CALLBACK} element={<Suspense fallback={<PageSkeleton />}><WixCallback /></Suspense>} />

        {/* External Marketing Routes */}
        <Route path={MARKETING_ROUTES.HOME} element={<Suspense fallback={<PageSkeleton />}><HomePage /></Suspense>} />
        <Route path={MARKETING_ROUTES.PRICING} element={<Suspense fallback={<PageSkeleton />}><PricingPage /></Suspense>} />
        <Route path={MARKETING_ROUTES.MARKETING} element={<Navigate to={MARKETING_ROUTES.HOME} replace />} />

        {/* Protected Routes — unified Shell for all depth levels */}
        <Route
          path={PLATFORM_ROUTES.ONBOARDING}
          element={
            authenticated ? (
              me.config?.onboarding_completed === false ? (
                <Suspense fallback={<PageSkeleton />}>
                  <OnboardingWizard />
                </Suspense>
              ) : (
                <Navigate to={PLATFORM_ROUTES.HOME} replace />
              )
            ) : (
              <Navigate to={AUTH_ROUTES.LOGIN} replace />
            )
          }
        />
        <Route
          path={PLATFORM_ROUTES.MASTER_ADMIN}
          element={
            authenticated && me.user?.role === 'super_admin' ? (
              <Suspense fallback={<PageSkeleton />}>
                <MasterAdmin />
              </Suspense>
            ) : (
              <Navigate to={PLATFORM_ROUTES.HOME} replace />
            )
          }
        />
        <Route
          path={PLATFORM_ROUTES.AGENCY.PORTFOLIO}
          element={
            authenticated && (me.user?.role === 'agency_operator' || me.user?.role === 'super_admin') ? (
              <Suspense fallback={<PageSkeleton />}>
                <AgencyPortfolio />
              </Suspense>
            ) : (
              <Navigate to={PLATFORM_ROUTES.HOME} replace />
            )
          }
        />
        <Route
          path="/*"
          element={
            authenticated ? (
              me.config?.onboarding_completed === false ? (
                <Navigate to={PLATFORM_ROUTES.ONBOARDING} replace />
              ) : (
                <FullLayout me={me} />
              )
            ) : (
              <Navigate to={AUTH_ROUTES.LOGIN} replace />
            )
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
      <HardBlockModal />
    </ErrorBoundary>
  );
}
