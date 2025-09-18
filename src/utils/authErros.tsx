// src/utils/authErros.ts
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

// Política alinhada ao Supabase: mínimo 6 + ao menos 1 letra + 1 número
export function validatePasswordPolicy(pw: string): string[] {
  const issues: string[] = [];
  if (!pw || pw.length < 6) issues.push('Use pelo menos 6 caracteres.');
  if (!/[A-Za-z]/.test(pw)) issues.push('Inclua ao menos 1 letra (A–Z).');
  if (!/[0-9]/.test(pw)) issues.push('Inclua ao menos 1 número (0–9).');
  return issues;
}

// Códigos que usamos nas telas
export function mapAuthCodeToMessage(code?: string): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'E-mail ou senha incorretos.';
    case 'EMAIL_ALREADY_IN_USE':
      return 'Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.';
    case 'REGISTRATION_FAILED':
      return 'Não foi possível criar sua conta agora. Tente novamente em instantes.';
    case 'UNKNOWN_ERROR':
    default:
      return 'Não foi possível completar a ação. Verifique sua conexão e tente novamente.';
  }
}

// Erros inesperados (rede/timeouts)
export function friendlyFromUnknown(err: unknown): string {
  const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('timeout') || msg.includes('dns')) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  }
  if (msg.includes('rate') && msg.includes('limit')) {
    return 'Muitas tentativas. Tente novamente em instantes.';
  }
  return 'Erro inesperado. Tente novamente.';
}

