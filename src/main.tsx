import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ReactGA from 'react-ga4';
// import * as Sentry from "@sentry/react"; // Sentry DESATIVADO TEMPORARIAMENTE

// --- INICIALIZAÇÃO DOS SERVIÇOS DE PRODUÇÃO ---

if (import.meta.env.PROD) {
  
  // 1. Inicializa o Google Analytics a partir da variável de ambiente
  const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID);
  }

  // 2. Sentry DESATIVADO TEMPORARIAMENTE para estabilizar a aplicação
  /*
  const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0, 
    });
  }
  */
}

createRoot(document.getElementById('root')!).render(<App />);
