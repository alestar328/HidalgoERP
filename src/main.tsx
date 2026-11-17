import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@ui5/webcomponents-react';
import { setTheme } from '@ui5/webcomponents-base/dist/config/Theme.js';
import { setLanguage } from '@ui5/webcomponents-base/dist/config/Language.js';
import '@ui5/webcomponents-react/dist/Assets.js';
import './icons';
import './styles.css';
import { APP } from './config/app';
import { App } from './App';
import { AuthProvider } from './features/auth/AuthProvider';
import { ToastProvider } from './components/Toast';

void setTheme('sap_horizon');
void setLanguage('es');
document.title = APP.name;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
