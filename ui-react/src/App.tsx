import React, { useState, useEffect, lazy, Suspense, Component, ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Theme, InlineLoading } from '@carbon/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { VersionProvider } from './contexts/VersionContext';
import PageSkeleton from './components/PageSkeleton';
import UpdateBanner from './components/UpdateBanner';

// Components & Layout
import Shell from './components/Shell';

// Pages — eager (critical path)
import MasterLogin from './pages/MasterLogin';
import ContentFactory from './pages/ContentFactory';
import WixPasswordRecovery from './pages/WixPasswordRecovery';

// Pages — lazy loaded
const Console = lazy(() => import('./pages/Console'));
const BrandDna = lazy(() => import('./pages/BrandDna'));
const SemanticMapPage = lazy(() => import('./pages/SemanticMapPage'));
const Settings = lazy(() => import('./pages/Settings'));
const ComplianceAuditPage = lazy(() => import('./pages/ComplianceAuditPage'));


class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("genOS Runtime Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#111', color: '#fff', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <h2 style={{ marginBottom: '1rem' }}>Algo deu errado.</h2>
          <p style={{ marginBottom: '2rem' }}>O genOS encontrou um erro inesperado que impediu a renderização.</p>
          <button
            onClick={() => window.location.href = '/'}
            style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', backgroundColor: '#0f62fe', color: '#fff', border: 'none', borderRadius: '4px' }}
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
    <Shell me={me}>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Dashboard — ALL levels */}
          <Route path="/" element={<Console />} />
          <Route path="/console" element={<Navigate to="/" replace />} />

          {/* Content Factory > Posts — ALL levels */}
          <Route path="/content-factory" element={<ContentFactory />} />

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
          {/* Redirect old path */}
          <Route path="/brand-dna/semantic" element={<Navigate to="/content-factory/brand-dna/semantic" replace />} />

          {/* Configurações — Master & Agency only */}
          <Route path="/settings" element={guard(<Settings />)} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}

// ─── App Content ─────────────────────────────────────────────────────────────
function AppContent() {
  const { me, login, refreshMe } = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    console.log('genOS AppContent: Mount effect triggered [refreshMe]');
    const init = async () => {
      await refreshMe();
      setIsInitializing(false);
    };
    init();
  }, []);

  if (isInitializing) {
    return (
      <Theme theme="g100">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111' }}>
          <InlineLoading description="genOS Loading..." />
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

        {/* Protected Routes — unified Shell for all depth levels */}
        <Route
          path="/*"
          element={
            authenticated ? (
              <FullLayout me={me} />
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
      <VersionProvider>
        <ErrorBoundary>
          <AppContent />
          <UpdateBanner />
        </ErrorBoundary>
      </VersionProvider>
    </AuthProvider>
  );
}
