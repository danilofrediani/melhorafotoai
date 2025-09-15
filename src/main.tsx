import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ReactGA from 'react-ga4';
import * as Sentry from "@sentry/react";

// --- INICIALIZAÇÃO DOS SERVIÇOS DE PRODUÇÃO ---

if (import.meta.env.PROD) {
  
  // 1. Inicializa o Google Analytics a partir da variável de ambiente
  const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID);
  }

  // 2. Inicializa o Sentry com a configuração MÍNIMA e SEGURA via variável de ambiente
  const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
