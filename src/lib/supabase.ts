import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is missing. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // --- ADIÇÃO ESTRATÉGICA PARA COMPATIBILIDADE COM O CHROME ---
    flowType: 'pkce', 
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'melhora-foto-ai'
    }
  }
});
