import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Theme, InlineLoading } from '@carbon/react';
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

// ─── Unified Layout — all authenticated users share Shell ─────────────────
function FullLayout({ me }: { me: ReturnType<typeof useAuth>['me'] }) {
  const isClient = (me.tenant?.depth_level ?? 0) >= 2;
  const defaultRoute = isClient ? '/content-factory' : '/';

  return (
    <Shell me={me}>
      <Routes>
        <Route path="/" element={isClient ? <Navigate to="/content-factory" replace /> : <Console />} />
        <Route path="/console" element={isClient ? <Navigate to="/content-factory" replace /> : <Console />} />
        <Route path="/factory" element={isClient ? <Navigate to="/content-factory" replace /> : <Factory />} />
        <Route path="/content-factory" element={<ContentFactory />} />
        <Route path="/csv-browser" element={isClient ? <Navigate to="/content-factory" replace /> : <CsvBrowser />} />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
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
