// Variáveis de ambiente. Só as NEXT_PUBLIC_ vão para o navegador.
// Aceita os nomes antigos e os novos da integração Vercel ↔ Supabase.

export const APP_NAME = "Evora";
export const APP_TAGLINE = "Seu treino, ajustado a cada passo";

/** Domínio dos e-mails provisórios (reservado, nunca entrega e-mail). */
export const EMAIL_PROVISORIO_DOMINIO = "example.com";

export function isEmailProvisorio(email: string | null | undefined) {
  return !email || email.toLowerCase().endsWith(`@${EMAIL_PROVISORIO_DOMINIO}`);
}

export function publicEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
  };
}

export function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

export function isSupabaseConfigured() {
  const e = publicEnv();
  return Boolean(e.supabaseUrl && e.supabaseAnonKey);
}
