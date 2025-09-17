import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { PackageProvider } from '@/contexts/PackageContext';
import ReactGA from 'react-ga4';
import { supabase } from '@/lib/supabase';

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
import ExclusaoDeConta from './pages/ExclusaoDeConta';
import ResetPassword from './pages/ResetPassword';

const queryClient = new QueryClient();

const RouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.PROD) {
      ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
    }
  }, [location]);

  return null;
};

const App = () => {
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    // ✅ --- ESPIÃO INVISÍVEL ADICIONADO AQUI --- ✅
    // Este log só será visível para você durante a depuração remota.
    console.log('--- DIAGNÓSTICO DE URL ---');
    console.log('URL Completa (href):', window.location.href);
    console.log('Fragmento Hash (#):', window.location.hash);
    console.log('--------------------------');
    
    const isRecovery = window.location.hash.includes('type=recovery');
    if (isRecovery) {
      setIsPasswordRecovery(true);
      return; // Se já detectamos, não precisamos do listener
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Roda apenas uma vez, no carregamento inicial.

  if (isPasswordRecovery) {
    return <ResetPassword />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PackageProvider>
            <Toaster />
            <BrowserRouter>
              <RouteTracker />
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
                <Route path="/exclusao-de-conta" element={<ExclusaoDeConta />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </PackageProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
