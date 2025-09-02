import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { User as SupaUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { userService } from '@/lib/database';
import type { User as DbUser } from '@/lib/types';
import { toast } from 'sonner';

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
  isLoadingProfile: boolean;
  refetchProfile: () => Promise<void>;
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
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoadingProfile(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoadingProfile(false);

        if (_event === 'SIGNED_IN') {
          // Após o login, acionamos a busca do perfil e a verificação de compra pendente
          refetchProfile(); 
          await handlePostLogin();
        }
        if (_event === 'SIGNED_OUT') {
          setProfile(null);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const refetchProfile = async () => {
    if (user) {
      setIsLoadingProfile(true);
      try {
        const dbUser = await userService.ensureUserRecord(user);
        setProfile(dbUser);
      } catch (err) {
        console.error('Erro ao recarregar o perfil do usuário:', err);
        setProfile(null);
      } finally {
        setIsLoadingProfile(false);
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
      const dbUser = await userService.getUserById(data.user.id);
      return { success: true, role: dbUser?.user_type };
    }
    return { success: false, error: 'UNKNOWN_ERROR' };
  };

  const register = async (email: string, password: string, name: string, userType: DbUser['user_type']): Promise<{ success: boolean; error?: RegisterError }> => {
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email.trim().toLowerCase()).single();
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
  const resetPassword = async (email: string): Promise<boolean> => { const { error } = await supabase.auth.resetPasswordForEmail(email); return !error; };

  const value = { user, session, profile, isLoadingProfile, refetchProfile, login, register, logout, resetPassword };

  return (<AuthContext.Provider value={value}>{children}</AuthContext.Provider>);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) { throw new Error('useAuth must be used within an AuthProvider'); }
  return context;
}
