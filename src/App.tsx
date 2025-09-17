import { useEffect, useState } from 'react'; // Adicionado useState
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { PackageProvider } from '@/contexts/PackageContext';
import ReactGA from 'react-ga4';
import { supabase } from '@/lib/supabase'; // <-- ✅ NOVA IMPORTAÇÃO

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
import ResetPassword from './pages/ResetPassword'; // <-- ✅ NOVA IMPORTAÇÃO

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
  // ✅ --- LÓGICA PARA ROTA DE RECUPERAÇÃO DE SENHA --- ✅
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Se for uma recuperação de senha, mostramos apenas essa página.
  if (isPasswordRecovery) {
    return <ResetPassword />;
  }
  // --- FIM DA LÓGICA ---

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
                {/* A rota de reset não é mais necessária aqui, pois o App a controla */}
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
