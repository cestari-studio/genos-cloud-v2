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

        {/* Protected Routes inside Shell */}
        <Route
          path="/*"
          element={
            authenticated ? (
              <Shell me={me}>
                <Routes>
                  <Route path="/" element={<Console />} />
                  <Route path="/console" element={<Console />} />
                  <Route path="/factory" element={<Factory />} />
                  <Route path="/content-factory" element={<ContentFactory />} />
                  <Route path="/csv-browser" element={<CsvBrowser />} />

                  {/* Fallback within shell */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Shell>
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
