import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/error/ErrorBoundary';
import { AppPreferencesProvider } from './providers/AppPreferencesProvider';
import './styles/globals.css';
import './styles/redesign.css';
import './styles/market.css';
import './styles/terminal.css';
import './styles/mini.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppPreferencesProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </AppPreferencesProvider>
  </React.StrictMode>,
);
