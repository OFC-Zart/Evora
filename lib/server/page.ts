import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { loadState, type AthleteState } from "./state";
import { ensureWeeksClosed } from "./weeks";
import { demoState, demoSupabase, isDemo } from "./demo";

export type PageContext = { supabase: Awaited<ReturnType<typeof createClient>>; s: AthleteState };

/**
 * Carrega o estado do atleta logado para uma página. Fecha semanas vencidas
 * antes de mostrar (o agendador faz o mesmo no domingo às 20h; aqui é a rede
 * de segurança caso ele não rode).
 */
export async function getPageContext(): Promise<PageContext | { semPerfil: true }> {
  await connection(); // sempre dinâmico: dados do usuário, nunca pré-renderizado
  if (!isSupabaseConfigured() && isDemo()) return { supabase: demoSupabase(), s: demoState() };
  if (!isSupabaseConfigured()) redirect("/entrar");
  const supabase = await createClient();
  // getClaims confere o JWT localmente (chaves assimétricas); o proxy já renovou a sessão.
  // O perfil vem junto com o resto numa única ida ao banco.
  const [{ data: auth }, s] = await Promise.all([supabase.auth.getClaims(), loadState(supabase)]);
  if (!auth?.claims?.sub) redirect("/entrar");
  if (!s) return { semPerfil: true };
  // primeiro acesso: troca a senha provisória (e cadastra o e-mail real) antes de tudo
  if (s.profile.trocar_senha || s.profile.precisa_email) redirect("/primeiro-acesso");
  try {
    const fechadas = await ensureWeeksClosed(supabase, s, { push: true });
    if (fechadas.length) {
      const novo = await loadState(supabase);
      if (novo) return { supabase, s: novo };
    }
  } catch (err) {
    console.error("fechamento de semana:", err);
  }
  return { supabase, s };
}
