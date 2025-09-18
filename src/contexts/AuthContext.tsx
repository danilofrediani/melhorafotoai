import React from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User as SupaUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { userService } from '@/lib/database';
import type { User as DbUser } from '@/lib/types';
import { toast } from 'sonner';

// Interfaces (sem alteração)
interface AuthLoginResult {
  success: boolean;
  error?: 'EMAIL_NOT_CONFIRMED' | 'INVALID_CREDENTIALS' | 'UNKNOWN_ERROR';
  role?: DbUser['user_type'];
}
type RegisterError = 'REGISTRATION_FAILED' | 'EMAIL_ALREADY_IN_USE' | 'EMAIL_CONFIRMATION_REQUIRED';
interface AuthContextType {
  user: SupaUser | null;
  session: Session | null;
  profile: DbUser | null;
  isLoading: boolean; // Único estado de loading para o consumidor
  refreshProfile: () => Promise<DbUser | undefined>;
  login: (email: string, password: string) => Promise<AuthLoginResult>;
  register: (email: string, password: string, name: string, userType: DbUser['user_type']) => Promise<{ success: boolean; error?: RegisterError }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupaUser | null>(null);
  const [profile, setProfile] = useState<DbUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Efeito 1: Apenas gerencia o estado de autenticação do Supabase (user e session)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoadingUser(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoadingUser(false);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // Efeito 2: Busca o perfil do banco de dados SOMENTE quando o usuário muda.
  useEffect(() => {
    if (user && !profile) {
      setIsLoadingProfile(true);
      userService.ensureUserRecord(user)
        .then((dbUser) => {
          setProfile(dbUser);
        })
        .catch((err) => {
          console.error("Erro ao buscar o perfil do usuário:", err);
          setProfile(null);
        })
        .finally(() => {
          setIsLoadingProfile(false);
        });
    } else if (!user) {
      setProfile(null);
    }
  }, [user]);

  const handlePostLogin = async () => {
    const pendingPackageId = localStorage.getItem('pendingPurchasePackageId');
    if (pendingPackageId) {
      localStorage.removeItem('pendingPurchasePackageId');
      toast.info('Finalizando sua compra...');
      try {
        const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: { package_id: pendingPackageId } });
        if (error || (data && data.error)) throw new Error(error?.message || data?.error);
        if (data?.checkout_url) window.location.href = data.checkout_url;
      } catch (err: any) {
        toast.error(`Falha ao redirecionar para o pagamento: ${err.message}`);
      }
    }
  };

  const login = async (email: string, password: string): Promise<AuthLoginResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      if (error.message?.includes('Email not confirmed')) return { success: false, error: 'EMAIL_NOT_CONFIRMED' };
      if (error.message?.includes('Invalid login credentials')) return { success: false, error: 'INVALID_CREDENTIALS' };
      return { success: false, error: 'UNKNOWN_ERROR' };
    }
    if (data.user) {
      await handlePostLogin();
      const dbUser = await userService.getUserById(data.user.id);
      return { success: true, role: dbUser?.user_type };
    }
    return { success: false, error: 'UNKNOWN_ERROR' };
  };
  
  const refreshProfile = useCallback(async (): Promise<DbUser | undefined> => {
    if (!user) return undefined;
    setIsLoadingProfile(true);
    try {
      const dbUser = await userService.ensureUserRecord(user);
      setProfile(dbUser);
      return dbUser;
    } catch (err) {
      console.error('Erro ao recarregar o perfil do usuário:', err);
      setProfile(null);
      return undefined;
    } finally {
      setIsLoadingProfile(false);
    }
  }, [user]);

  const register = async (email: string, password: string, name: string, userType: DbUser['user_type']): Promise<{ success: boolean; error?: RegisterError }> => {
    const { data: existingUser } = await supabase.from('profiles').select('id').eq('email', email.trim().toLowerCase()).single();
    if (existingUser) return { success: false, error: 'EMAIL_ALREADY_IN_USE' };
    const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { name, user_type: userType } } });
    if (error) {
      console.error('Erro no Supabase Auth SignUp:', error);
      return { success: false, error: 'REGISTRATION_FAILED' };
    }
    if (data.user && !data.session) {
      return { success: true, error: 'EMAIL_CONFIRMATION_REQUIRED' };
    }
    return { success: true };
  };

  const logout = async () => { await supabase.auth.signOut(); };

  // ✅ ÚNICA MUDANÇA: garante redirect direto para /reset-password
  const resetPassword = async (email: string): Promise<boolean> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://melhorafotoai.com.br/reset-password',
    });
    return !error;
  };

  const value = {
    user,
    session,
    profile,
    isLoading: isLoadingUser || isLoadingProfile,
    refreshProfile,
    login,
    register,
    logout,
    resetPassword,
  };

  return (<AuthContext.Provider value={value}>{children}</AuthContext.Provider>);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) { throw new Error('useAuth must be used within an AuthProvider'); }
  return context;
}

