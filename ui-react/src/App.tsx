import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Theme, InlineLoading, Button } from '@carbon/react';
import { Logout } from '@carbon/icons-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components & Layout
import Shell from './components/Shell';

// Pages
import MasterLogin from './pages/MasterLogin';
import Console from './pages/Console';
import Factory from './pages/Factory';
import ContentFactory from './pages/ContentFactory';
import CsvBrowser from './pages/CsvBrowser';
import WixPasswordRecovery from './pages/WixPasswordRecovery';

// ─── Client-Only Layout (depth_level >= 2) ──────────────────────────────────
function ClientOnlyLayout() {
  const { me, logout } = useAuth();
  const location = useLocation();

  // Redirect any non-content-factory route
  if (location.pathname !== '/content-factory') {
    return <Navigate to="/content-factory" replace />;
  }

  return (
    <div className="client-only-layout">
      <header className="client-only-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="4" fill="#0f62fe" />
            <text x="6" y="22" fill="white" fontSize="16" fontWeight="700" fontFamily="IBM Plex Sans, sans-serif">C</text>
          </svg>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--cds-text-primary, #f4f4f4)' }}>
            {me.tenant?.name || 'Content Factory'}
          </span>
        </div>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={Logout}
          onClick={() => { logout(); window.location.href = '/login'; }}
          style={{ color: 'var(--cds-text-secondary, #c6c6c6)' }}
        >
          Sair
        </Button>
      </header>
      <main className="client-only-content">
        <ContentFactory />
      </main>
    </div>
  );
}

// ─── Full Layout (depth 0 and 1) ────────────────────────────────────────────
function FullLayout({ me }: { me: ReturnType<typeof useAuth>['me'] }) {
  return (
    <Shell me={me}>
      <Routes>
        <Route path="/" element={<Console />} />
        <Route path="/console" element={<Console />} />
        <Route path="/factory" element={<Factory />} />
        <Route path="/content-factory" element={<ContentFactory />} />
        <Route path="/csv-browser" element={<CsvBrowser />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
  const isClientOnly = authenticated && (me.tenant?.depth_level ?? 0) >= 2;

  return (
    <Theme theme="g100">
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={<MasterLogin authenticated={authenticated} onLogin={login} />}
        />
        <Route path="/auth/forgot" element={<WixPasswordRecovery />} />

        {/* Protected Routes */}
        <Route
          path="/*"
          element={
            authenticated ? (
              isClientOnly ? <ClientOnlyLayout /> : <FullLayout me={me} />
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
