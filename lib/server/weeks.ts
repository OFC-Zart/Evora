import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  closeWeek,
  logFor,
  rebuildSchedule,
  weekRange,
  workoutsOfCalendarWeek,
  type ScheduleWeek,
  type WeekCloseResult,
  type ZoneChange,
  type ZoneHistory,
} from "@/lib/engine";
import { engineContext, type AthleteState } from "./state";
import { generateAiCoach, templateWeekMessage } from "./coach";
import { sendPushToAthlete } from "./push";

/** Grava mudanças de zona (histórico + zona atual) e atualiza o estado em memória. */
export async function applyZoneChanges(
  supabase: SupabaseClient,
  s: AthleteState,
  changes: ZoneChange[],
  semana: number | null,
): Promise<void> {
  if (!changes.length) return;
  const agora = new Date().toISOString();
  const rows = changes.map((c) => ({ ...c, athlete_id: s.athlete, semana_calendario: semana }));
  const { error } = await supabase.from("zone_history").insert(rows);
  if (error) throw new Error(`zone_history: ${error.message}`);
  const { error: e2 } = await supabase.from("zones").upsert(
    changes.map((c) => ({ athlete_id: s.athlete, zona: c.zona, pace_s_por_km: c.depois_s, updated_at: agora })),
  );
  if (e2) throw new Error(`zones: ${e2.message}`);
  for (const c of changes) {
    s.zonas[c.zona] = c.depois_s;
    s.history.push({ ...c, athlete_id: s.athlete, created_at: agora, revertido: false, semana_calendario: semana } as ZoneHistory);
  }
}

export async function replaceScheduleAfter(supabase: SupabaseClient, s: AthleteState, semana: number, novo: ScheduleWeek[]) {
  await supabase.from("plan_schedule").delete().eq("athlete_id", s.athlete).gt("semana_calendario", semana);
  const futuras = novo.filter((w) => w.semana_calendario > semana).map((w) => ({ ...w, athlete_id: s.athlete }));
  if (futuras.length) {
    const { error } = await supabase.from("plan_schedule").insert(futuras);
    if (error) throw new Error(`plan_schedule: ${error.message}`);
  }
  s.schedule = novo;
}

function closesAt(fim: string): Date {
  // domingo às 20h em São Paulo (UTC−3, sem horário de verão desde 2019)
  return new Date(`${fim}T20:00:00-03:00`);
}

export interface ClosedWeek {
  semana: number;
  result: WeekCloseResult;
}

/**
 * Fecha as semanas vencidas (domingo 20h) ou a semana atual quando o último
 * treino planejado já foi registrado. Idempotente: semanas fechadas ficam em
 * week_closures.
 */
export async function ensureWeeksClosed(
  supabase: SupabaseClient,
  s: AthleteState,
  opts: { now?: Date; useAi?: boolean; push?: boolean } = {},
): Promise<ClosedWeek[]> {
  if (!s.planoIniciado) return [];
  const now = opts.now ?? new Date();
  const fechadas = new Set(s.closures.map((c) => c.semana_calendario));
  const out: ClosedWeek[] = [];

  for (let w = 1; w <= s.semanaAtual; w++) {
    if (fechadas.has(w)) continue;
    const row = s.schedule.find((x) => x.semana_calendario === w);
    if (!row) break; // plano terminou
    const { inicio, fim } = weekRange(s.profile.plan_inicio, w);
    const planejados = workoutsOfCalendarWeek(s.plan, s.schedule, w, s.profile.plan_inicio, s.athlete, s.overrides);
    const obrigatorios = planejados.filter((p) => !p.workout.opcional);
    const tudoRegistrado = obrigatorios.length > 0 && obrigatorios.every((p) => logFor(p, s.logs));
    if (!(now >= closesAt(fim) || tudoRegistrado)) break;

    const result = closeWeek({
      ctx: engineContext(s),
      semana: w,
      semana_plano: row.semana_plano,
      modo: row.modo,
      inicio,
      fim,
      planejados,
      calibrado: s.profile.calibrado,
      bloqueioDor: s.profile.bloqueio_dor,
    });

    await applyZoneChanges(supabase, s, result.changes, w);
    await replaceScheduleAfter(supabase, s, w, rebuildSchedule(s.schedule, w, result.proxima));

    const calibrado = s.profile.calibrado || result.calibrou;
    await supabase
      .from("profiles")
      .update({ calibrado, bloqueio_dor: result.decisao.bloqueioDor })
      .eq("athlete_id", s.athlete);
    s.profile.calibrado = calibrado;
    s.profile.bloqueio_dor = result.decisao.bloqueioDor;

    const resumo = { ...result.resumo, decisao: result.decisao.acao, motivo: result.decisao.motivo };
    const { error } = await supabase.from("week_closures").insert({ athlete_id: s.athlete, semana_calendario: w, resumo });
    if (error && !error.message.includes("duplicate")) throw new Error(`week_closures: ${error.message}`);
    s.closures.push({ semana_calendario: w, resumo, closed_at: now.toISOString() });

    // recado do coach: IA quando disponível e pedido, senão regras
    const ai = opts.useAi ? await generateAiCoach(s) : null;
    const tpl = templateWeekMessage(s, result, result.changes);
    const coachRow = {
      athlete_id: s.athlete,
      semana: w,
      texto: ai?.mensagem ?? tpl.texto,
      dicas: ai?.dicas ?? tpl.dicas,
      sugestoes: ai?.sugestoes ?? [],
      repetir_semana: ai?.repetir_semana ?? result.decisao.acao === "repetir",
      fonte: ai ? "ia" : "regras",
    };
    const { data: msg } = await supabase.from("coach_messages").insert(coachRow).select().single();
    if (msg) s.coach.unshift(msg);

    if (opts.push !== false && s.profile.notif_semana) {
      await sendPushToAthlete(supabase, s.athlete, {
        title: `Semana ${w} fechada`,
        body: `${result.resumo.feitos} de ${result.resumo.planejados} treinos. ${result.decisao.acao === "seguir" ? "Seguindo o plano." : result.decisao.acao === "repetir" ? "A semana vai ser repetida." : "Próxima semana leve."}`,
        url: "/hoje",
        tag: `semana-${w}`,
      });
    }
    out.push({ semana: w, result });
  }
  return out;
}
