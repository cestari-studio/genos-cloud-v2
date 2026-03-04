import React, { useState, useEffect, lazy, Suspense, Component, ReactNode } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Theme, InlineLoading } from '@carbon/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { VersionProvider } from './contexts/VersionContext';
import PageSkeleton from './components/PageSkeleton';
import UpdateBanner from './components/UpdateBanner';

// Components & Layout
import Shell from './components/Shell';
import { HardBlockModal } from './components/HardBlockModal';

// Pages — eager (critical path)
import MasterLogin from './pages/MasterLogin';
import Factory from './pages/Factory';
import WixPasswordRecovery from './pages/WixPasswordRecovery';
import ResetPassword from './pages/ResetPassword';

// Pages — lazy loaded
const Console = lazy(() => import('./pages/Console'));
const BrandDna = lazy(() => import('./pages/BrandDna'));
const SemanticMapPage = lazy(() => import('./pages/SemanticMapPage'));
const Settings = lazy(() => import('./pages/Settings'));
const ComplianceAuditPage = lazy(() => import('./pages/ComplianceAuditPage'));
const QualityGatePage = lazy(() => import('./pages/QualityGatePage'));
const Schedule = lazy(() => import('./pages/Schedule'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SocialCallbackPage = lazy(() => import('./pages/auth/SocialCallback'));
const Observatory = lazy(() => import('./pages/Observatory'));
const OnboardingWizard = lazy(() => import('./pages/OnboardingWizard'));


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
  const defaultRoute = isClient ? '/content-factory' : '/';

  // Helper: restrict route to non-client users
  const guard = (element: React.ReactNode) =>
    isClient ? <Navigate to="/content-factory" replace /> : element;

  return (
    <Shell>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Dashboard — ALL levels */}
          <Route path="/" element={<Console />} />
          <Route path="/console" element={<Navigate to="/" replace />} />

          {/* Content Factory > Posts — ALL levels */}
          <Route path="/content-factory/posts" element={<Factory />} />
          <Route path="/content-factory" element={<Navigate to="/content-factory/posts" replace />} />

          {/* Content Factory > Schedule — ALL levels (Gated inside component) */}
          <Route path="/content-factory/schedule" element={<Schedule />} />

          {/* Content Factory > Compliance Auditor — unified path */}
          <Route path="/content-factory/audit" element={<ComplianceAuditPage />} />
          {/* Redirect old path */}
          <Route path="/factory/audit" element={<Navigate to="/content-factory/audit" replace />} />

          {/* Content Factory > Brand DNA — unified path */}
          <Route path="/content-factory/brand-dna" element={<BrandDna />} />
          {/* Redirect old path */}
          <Route path="/brand-dna" element={<Navigate to="/content-factory/brand-dna" replace />} />

          {/* Content Factory > Semantic Map — unified path */}
          <Route path="/content-factory/brand-dna/semantic" element={<SemanticMapPage />} />
          {/* Redirect old paths */}
          <Route path="/brand-dna/semantic" element={<Navigate to="/content-factory/brand-dna/semantic" replace />} />
          <Route path="/semantic-map" element={<Navigate to="/content-factory/brand-dna/semantic" replace />} />

          {/* Content Factory > Settings (Configurações) — Master & Agency only */}
          <Route path="/content-factory/settings" element={guard(<Settings />)} />
          <Route path="/settings" element={<Navigate to="/content-factory/settings" replace />} />

          {/* Content Factory > Quality Gate — unified path */}
          <Route path="/content-factory/quality-gate" element={<QualityGatePage />} />
          {/* Content Factory > Schedule */}
          <Route path="/content-factory/schedule" element={<Schedule />} />

          {/* Content Factory > Analytics */}
          <Route path="/content-factory/analytics" element={<AnalyticsPage />} />

          {/* Content Factory > Observatory (Real-time Topology) */}
          <Route path="/content-factory/observatory" element={<Observatory />} />

          {/* OAuth Callbacks */}
          <Route path="/auth/callback/meta" element={<SocialCallbackPage />} />

          {/* Redirect old path */}
          <Route path="/content-factory/matrix" element={<Navigate to="/content-factory/quality-gate" replace />} />
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
    console.log('genOS AppContent: Mount effect triggered [refreshMe]');
    const init = async () => {
      // 1. Check if we just landed from a Supabase Password Recovery link
      // Supabase appends #access_token=...&type=recovery
      if (window.location.hash.includes('type=recovery')) {
        navigate('/reset-password', { replace: true });
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
      <Theme theme="g100">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--cds-background, #161616)',
          gap: '1rem',
        }}>
          <InlineLoading
            description="genOS Loading..."
            style={{ justifyContent: 'center', width: 'auto' }}
          />
        </div>
      </Theme>
    );
  }

  const authenticated = me.authenticated;

  return (
    <Theme theme="g100">
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={<MasterLogin authenticated={authenticated} onLogin={login} />}
        />
        <Route path="/auth/forgot" element={<WixPasswordRecovery />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Routes — unified Shell for all depth levels */}
        <Route
          path="/onboarding"
          element={
            authenticated ? (
              me.config?.onboarding_completed === false ? (
                <Suspense fallback={<PageSkeleton />}>
                  <OnboardingWizard />
                </Suspense>
              ) : (
                <Navigate to="/" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/*"
          element={
            authenticated ? (
              me.config?.onboarding_completed === false ? (
                <Navigate to="/onboarding" replace />
              ) : (
                <FullLayout me={me} />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Theme>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <AppContent />
        <HardBlockModal />
      </ErrorBoundary>
    </AuthProvider>
  );
}
