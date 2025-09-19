// src/lib/reward.ts
import { supabase } from '@/lib/supabase';

type RewardResponse =
  | { ok: true; amount: number; newBalance?: number }
  | { ok: false; reason?: string; error?: string; details?: unknown };

export async function grantReward(amount = 1, deviceHint = 'web-rewarded'): Promise<RewardResponse> {
  // garante sessão (evita 401 silencioso)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: 'NO_SESSION' };

  const { data, error } = await supabase.functions.invoke('ad-reward', {
    body: { amount, device_hint: deviceHint },
  });

  if (error) {
    // supabase-js retorna FunctionsHttpError em status não-2xx
    try {
      const parsed = typeof (error as any).message === 'string'
        ? JSON.parse((error as any).message)
        : null;
      if (parsed && typeof parsed === 'object') return parsed as RewardResponse;
    } catch { /* segue abaixo */ }

    return { ok: false, error: (error as any)?.message ?? 'FUNCTION_ERROR' };
  }

  return data as RewardResponse;
}

