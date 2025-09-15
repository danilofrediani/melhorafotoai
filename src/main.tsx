import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ReactGA from 'react-ga4';
import * as Sentry from "@sentry/react";

// --- INICIALIZAÇÃO DOS SERVIÇOS DE PRODUÇÃO ---

// Mantém a lógica de inicializar somente em ambiente de produção (Vercel)
if (import.meta.env.PROD) {
  
  // 1. Inicializa o Google Analytics a partir da variável de ambiente
  const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID);
  }

  // 2. Inicializa o Sentry para monitoramento de erros a partir da variável de ambiente
  const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay({
          maskAllText: true, // Protege a privacidade do usuário
          blockAllMedia: true, // Protege a privacidade do usuário
        }),
      ],
      // Ajuste as taxas de amostragem conforme necessário após o lançamento
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0, 
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
