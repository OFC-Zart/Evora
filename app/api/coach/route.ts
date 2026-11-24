import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadState } from "@/lib/server/state";
import { generateAiCoach, isAiEnabled, ruleAnalysis } from "@/lib/server/coach";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/coach — "Pedir análise". Com ANTHROPIC_API_KEY usa a IA; sem ela
// (ou se a IA falhar), devolve a análise por regras. A IA só sugere: aplicar é
// sempre decisão do atleta, e o motor limita cada sugestão (seção 8).
export async function POST() {
  const supabase = await createClient();
  const s = await loadState(supabase);
  if (!s) return NextResponse.json({ ok: false, erro: "Não autenticado" }, { status: 401 });

  const ai = isAiEnabled() ? await generateAiCoach(s) : null;
  const base = { athlete_id: s.athlete, semana: s.semanaAtual };
  const row = ai
    ? { ...base, texto: ai.mensagem, dicas: ai.dicas, sugestoes: ai.sugestoes, repetir_semana: ai.repetir_semana, fonte: "ia" }
    : { ...base, ...ruleAnalysis(s), sugestoes: [], repetir_semana: false, fonte: "regras" };

  const { data, error } = await supabase.from("coach_messages").insert(row).select().single();
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, mensagem: data, ia: Boolean(ai) });
}
