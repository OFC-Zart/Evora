// Variáveis de ambiente. Só as NEXT_PUBLIC_ vão para o navegador.

export const APP_NAME = "Evora";
export const APP_TAGLINE = "Seu treino, ajustado a cada passo";

export function publicEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  };
}

export function isSupabaseConfigured() {
  const e = publicEnv();
  return Boolean(e.supabaseUrl && e.supabaseAnonKey);
}
