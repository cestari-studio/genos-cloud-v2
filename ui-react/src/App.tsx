import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Theme, InlineLoading } from '@carbon/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components & Layout
import Shell from './components/Shell';

// Pages — eager (critical path)
import MasterLogin from './pages/MasterLogin';
import Console from './pages/Console';
import ContentFactory from './pages/ContentFactory';
import WixPasswordRecovery from './pages/WixPasswordRecovery';

// Pages — lazy loaded (non-critical)
const Factory = lazy(() => import('./pages/Factory'));
const CsvBrowser = lazy(() => import('./pages/CsvBrowser'));
const BrandDna = lazy(() => import('./pages/BrandDna'));
const SemanticMapPage = lazy(() => import('./pages/SemanticMapPage'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Settings = lazy(() => import('./pages/Settings'));
const MatrixGridPage = lazy(() => import('./pages/MatrixGridPage'));
const ComplianceAuditPage = lazy(() => import('./pages/ComplianceAuditPage'));
const ObservatoryPricing = lazy(() => import('./pages/ObservatoryPricing'));
const QuantumObservabilityPage = lazy(() => import('./pages/QuantumObservabilityPage'));
const HandoverHubPage = lazy(() => import('./pages/HandoverHubPage'));

// Admin pages — lazy loaded
const GlobalHealthDashboard = lazy(() => import('./pages/admin/GlobalHealthDashboard'));
const TenantMasterList = lazy(() => import('./pages/admin/TenantMasterList'));
const APIConnectorHub = lazy(() => import('./pages/admin/APIConnectorHub'));
const SystemTopologyHub = lazy(() => import('./pages/admin/SystemTopologyHub'));
const CommerceCatalog = lazy(() => import('./pages/admin/CommerceCatalog'));
const CarbonComponentsShowcase = lazy(() => import('./pages/admin/CarbonComponentsShowcase'));

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
  const isMaster = depthLevel === 0;
  const defaultRoute = isClient ? '/content-factory' : '/';

  // Helper: restrict route to non-client, redirect client to content-factory
  const guard = (element: React.ReactNode) =>
    isClient ? <Navigate to="/content-factory" replace /> : element;
  const masterOnly = (element: React.ReactNode) =>
    isMaster ? element : <Navigate to={defaultRoute} replace />;

  return (
    <Shell me={me}>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Dashboard (Console) — Master & Agency */}
          <Route path="/" element={guard(<Console />)} />
          <Route path="/console" element={guard(<Console />)} />

          {/* Content Factory — ALL levels */}
          <Route path="/content-factory" element={<ContentFactory />} />

          {/* Factory sub-routes */}
          <Route path="/factory" element={guard(<Factory />)} />
          <Route path="/factory/matrix" element={masterOnly(<MatrixGridPage />)} />
          <Route path="/factory/audit" element={masterOnly(<ComplianceAuditPage />)} />

          {/* CSV Browser — Master only */}
          <Route path="/csv-browser" element={masterOnly(<CsvBrowser />)} />

          {/* Intelligence Pipeline — Master & Agency */}
          <Route path="/brand-dna" element={guard(<BrandDna />)} />
          <Route path="/brand-dna/semantic" element={masterOnly(<SemanticMapPage />)} />

          {/* Schedule — Master & Agency */}
          <Route path="/schedule" element={guard(<Schedule />)} />

          {/* Settings — Master & Agency */}
          <Route path="/settings" element={guard(<Settings />)} />

          {/* Observatory — permission-gated (client blocked) */}
          <Route path="/observatory" element={guard(<QuantumObservabilityPage />)} />
          <Route path="/observatory/quantum" element={guard(<QuantumObservabilityPage />)} />
          <Route path="/observatory/pricing" element={masterOnly(<ObservatoryPricing />)} />

          {/* Architect Canvas — Master only */}
          <Route path="/architect" element={masterOnly(<HandoverHubPage />)} />

          {/* Admin pages — Master super_admin only */}
          <Route path="/admin/health" element={masterOnly(<GlobalHealthDashboard />)} />
          <Route path="/admin/tenants" element={masterOnly(<TenantMasterList />)} />
          <Route path="/admin/api-hub" element={masterOnly(<APIConnectorHub />)} />
          <Route path="/admin/topology" element={masterOnly(<SystemTopologyHub />)} />
          <Route path="/admin/commerce" element={masterOnly(<CommerceCatalog />)} />
          <Route path="/admin/components" element={masterOnly(<CarbonComponentsShowcase />)} />

          {/* Tasks — redirect to factory for now */}
          <Route path="/tasks" element={masterOnly(<Factory />)} />

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
