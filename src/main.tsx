import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ReactGA from 'react-ga4';
import * as Sentry from "@sentry/react"; // Sentry REATIVADO

// --- INICIALIZAÇÃO DOS SERVIÇOS DE PRODUÇÃO ---

if (import.meta.env.PROD) {
  
  // 1. Inicializa o Google Analytics
  const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID);
  }

  // 2. FASE 1: Reativando Sentry com configuração MÍNIMA e SEGURA
  const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      // Integrações avançadas (que causaram o erro) foram removidas.
      // Serão adicionadas na Fase 2, após validarmos esta conexão básica.
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
