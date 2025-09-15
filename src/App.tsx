import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { PackageProvider } from '@/contexts/PackageContext';
import ReactGA from 'react-ga4';

// Pages
import Index from './pages/Index';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProfessionalDashboard from './pages/ProfessionalDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Upload from './pages/Upload';
import Pricing from './pages/Pricing';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import ProjectView from './pages/ProjectView';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Faq from './pages/Faq';

const queryClient = new QueryClient();

// --- COMPONENTE DE RASTREAMENTO GA ---
const RouteTracker = () => {
  const location = useLocation();
  useEffect(() => {
    if (import.meta.env.PROD) {
      ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
    }
  }, [location]);
  return null;
};

// --- NOVO COMPONENTE DE TESTE SENTRY ---
// Este botão só aparecerá em produção e servirá para gerar um erro de teste.
const SentryTestButton = () => {
  // Se não estivermos em produção, o botão não renderiza nada.
  if (!import.meta.env.PROD) {
    return null;
  }

  const triggerError = () => {
    throw new Error(`Sentry Production Test - MelhoraFotoAI - ${new Date().toISOString()}`);
  };

  const buttonStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 9999,
    backgroundColor: '#ef4444', // red-500
    color: 'white',
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: '0 4px 14px 0 rgba(0,0,0,0.25)',
  };

  return (
    <button style={buttonStyle} onClick={triggerError}>
      Testar Sentry
    </button>
  );
};
// --- FIM DO COMPONENTE DE TESTE SENTRY ---


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PackageProvider>
          <Toaster />
          <BrowserRouter>
            <RouteTracker />
            <SentryTestButton /> {/* <-- Botão de teste adicionado aqui */}
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/professional" element={<ProtectedRoute><ProfessionalDashboard /></ProtectedRoute>} />
              <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/project/:projectId" element={<ProtectedRoute><ProjectView /></ProtectedRoute>} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/privacidade" element={<Privacy />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </PackageProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
