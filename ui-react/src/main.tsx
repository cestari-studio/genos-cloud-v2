import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './config/ibmProducts';
import './styles/global.scss';
import '@carbon/charts-react/styles.css';
import '@carbon/ibm-products/css/index.min.css';

console.log('genOS main.tsx: Initializing ReactDOM root...');
const container = document.getElementById('root');
if (!container) {
  console.error('genOS main.tsx: Root container not found!');
} else {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
  console.log('genOS main.tsx: ReactDOM.render call completed.');
}
