import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Theme, InlineLoading } from '@carbon/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

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

// Suspense fallback for lazy pages
const PageLoading = () => (
  <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
    <InlineLoading description="Carregando página..." />
  </div>
);

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
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Dashboard — ALL levels */}
          <Route path="/" element={<Console />} />
          <Route path="/console" element={<Console />} />

          {/* Content Factory > Posts — ALL levels */}
          <Route path="/content-factory" element={<ContentFactory />} />

          {/* Content Factory > Compliance Auditor — ALL levels */}
          <Route path="/factory/audit" element={<ComplianceAuditPage />} />

          {/* Content Factory > Brand DNA — ALL levels (view-only for clients handled inside component) */}
          <Route path="/brand-dna" element={<BrandDna />} />

          {/* Content Factory > Semantic Map — ALL levels */}
          <Route path="/brand-dna/semantic" element={<SemanticMapPage />} />

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
      <AppContent />
    </AuthProvider>
  );
}
