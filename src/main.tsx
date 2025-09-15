import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ReactGA from 'react-ga4';
import * as Sentry from "@sentry/react";

// --- INICIALIZAÇÃO DOS SERVIÇOS DE PRODUÇÃO ---

if (import.meta.env.PROD) {
  
  // 1. Inicializa o Google Analytics
  const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID);
  }

  // 2. TESTE DE DIAGNÓSTICO: Chave DSN inserida diretamente no código
  const SENTRY_DSN_HARDCODED = "https://633844a962ca3691088b695bbbd32bd5@o4510017940357120.ingest.us.sentry.io/4510017947369477"; // <-- COLE SUA CHAVE AQUI

  if (SENTRY_DSN_HARDCODED !== "https://633844a962ca3691088b695bbbd32bd5@o4510017940357120.ingest.us.sentry.io/4510017947369477") {
    Sentry.init({
      dsn: SENTRY_DSN_HARDCODED,
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
