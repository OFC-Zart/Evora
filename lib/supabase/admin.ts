import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Cliente com a service role (ignora o RLS). Só para o agendador
 * (/api/cron/tick) e para enviar pushes. Nunca importar em código de cliente.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient(publicEnv().supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
