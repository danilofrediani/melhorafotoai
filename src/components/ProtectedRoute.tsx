import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth(); // Usando 'loading' para consistência com o context

  // A nova regra: se JÁ TEMOS um usuário, mostre a página, não importa o que.
  // O 'loading' de uma simples atualização de dados não deve remover a página da tela.
  if (user) {
    return <>{children}</>;
  }

  // Se NÃO TEMOS um usuário, aí sim verificamos o 'loading' inicial.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se não está carregando e ainda não temos um usuário, aí sim redirecionamos.
  return <Navigate to="/login" replace />;
};

export default ProtectedRoute;
