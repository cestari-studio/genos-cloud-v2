import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './config/ibmProducts';
import './i18n'; // Initialize genOS™ i18n Engine
import './styles/global.scss';
import '@carbon/charts-react/styles.css';
import '@carbon/ibm-products/css/index.min.css';

import { GenOSThemeProvider } from './shared/contexts/ThemeProvider';
import { VersionProvider } from './shared/contexts/VersionProvider';
import { AuthProvider } from '@/shared/contexts/AuthContext';
import { GlobalErrorBoundary } from './shared/components/ErrorBoundary';
import config from './genos-config.json';

// Inject Global Config into window for easy access
(window as any).__GENOS_VERSION__ = config.version;
(window as any).__GENOS_CONFIG__ = config;

console.log(`genOS main.tsx: Initializing genOS™ v${config.version}...`);

const container = document.getElementById('root');
if (!container) {
  console.error('genOS main.tsx: Root container not found!');
} else {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <VersionProvider>
          <AuthProvider>
            <GenOSThemeProvider theme="g100">
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <App />
              </BrowserRouter>
            </GenOSThemeProvider>
          </AuthProvider>
        </VersionProvider>
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
  console.log('genOS main.tsx: ReactDOM.render call completed.');
}
