import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calendarWeekOf,
  isoDateInTz,
  type AthleteId,
  type EngineContext,
  type Estimate,
  type Override,
  type PlanWorkout,
  type ScheduleWeek,
  type WorkoutLog,
  type ZoneHistory,
  type Zonas,
} from "@/lib/engine";
import { ATHLETES, type AthleteSeed } from "@/lib/plan-data";

export interface ProfileRow {
  athlete_id: AthleteId;
  user_id: string | null;
  nome: string;
  nivel: "intermediario" | "iniciante_sedentaria";
  altura_m: number | null;
  peso_kg: number | null;
  idade: number | null;
  fc_max: number | null;
  fc_repouso: number | null;
  plan_inicio: string;
  calibrado: boolean;
  bloqueio_dor: boolean;
  lat: number | null;
  lon: number | null;
  hora_treino: string | null;
  lembrete_diario: boolean;
  lembrete_diario_hora: string;
  lembrete_diario_ultimo: string | null;
  notif_ajustes: boolean;
  notif_semana: boolean;
  trocar_senha?: boolean;
  precisa_email?: boolean;
}

export interface GoalRow {
  id: string;
  distancia_km: number;
  tempo_alvo_s: number | null;
  prazo: string | null;
  status: string;
  created_at: string;
}

export interface CoachRow {
  id: string;
  semana: number | null;
  texto: string;
  dicas: string[];
  sugestoes: { zona: string; delta_s: number; motivo: string }[];
  repetir_semana: boolean;
  fonte: "regras" | "ia";
  aplicado: boolean;
  created_at: string;
}

export interface ClosureRow {
  semana_calendario: number;
  resumo: {
    feitos: number;
    planejados: number;
    adesao: number;
    km_feitos: number;
    km_planejados: number;
    rpe_medio: number | null;
    carga: number;
    dor: boolean;
    decisao?: string;
    motivo?: string;
  };
  closed_at: string;
}

export interface AthleteState {
  athlete: AthleteId;
  profile: ProfileRow;
  seed: AthleteSeed;
  plan: PlanWorkout[];
  schedule: ScheduleWeek[];
  overrides: Override[];
  zonas: Zonas;
  history: ZoneHistory[];
  logs: WorkoutLog[];
  estimates: Estimate[];
  goals: GoalRow[];
  closures: ClosureRow[];
  coach: CoachRow[];
  hoje: string;
  semanaAtual: number;
}

export async function currentAthleteId(supabase: SupabaseClient): Promise<AthleteId | null> {
  const { data } = await supabase.from("profiles").select("athlete_id").maybeSingle();
  return (data?.athlete_id as AthleteId) ?? null;
}

/**
 * Carrega tudo de um atleta numa única ida ao banco (todas as consultas em
 * paralelo). Com o cliente do usuário (sem `athlete`) o RLS já limita as
 * tabelas próprias ao atleta logado; plano e agenda do plano são legíveis por
 * todos, então vêm dos dois atletas e são filtrados aqui. Com o cliente admin
 * (agendador) é obrigatório passar `athlete`.
 */
export async function loadState(supabase: SupabaseClient, athlete?: AthleteId): Promise<AthleteState | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doAtleta = <Q,>(q: Q): Q => (athlete ? (q as any).eq("athlete_id", athlete) : q);
  const [prof, plan, schedule, overrides, zones, history, logs, estimates, goals, closures, coach] = await Promise.all([
    doAtleta(supabase.from("profiles").select("*")).maybeSingle(),
    doAtleta(supabase.from("plan_workouts").select("*")).order("semana").order("ordem"),
    doAtleta(supabase.from("plan_schedule").select("*")).order("semana_calendario"),
    doAtleta(supabase.from("plan_overrides").select("*")),
    doAtleta(supabase.from("zones").select("*")),
    doAtleta(supabase.from("zone_history").select("*")).order("created_at", { ascending: true }),
    doAtleta(supabase.from("workout_logs").select("*")).order("data", { ascending: true }).order("created_at", { ascending: true }),
    doAtleta(supabase.from("estimates").select("*")).order("data", { ascending: true }),
    doAtleta(supabase.from("goals").select("*")).order("created_at", { ascending: false }),
    doAtleta(supabase.from("week_closures").select("*")).order("semana_calendario"),
    doAtleta(supabase.from("coach_messages").select("*")).order("created_at", { ascending: false }).limit(10),
  ]);
  const profile = prof.data;
  if (!profile) return null;
  const id = profile.athlete_id as AthleteId;
  const meu = <T extends { athlete_id?: string }>(rows: T[] | null): T[] => (rows ?? []).filter((r) => r.athlete_id === id);
  plan.data = meu(plan.data);
  schedule.data = meu(schedule.data);

  const seed = ATHLETES[id];
  const zonas: Zonas = { ...seed.zonasIniciais };
  for (const z of zones.data ?? []) (zonas as Record<string, number>)[z.zona] = z.pace_s_por_km;

  const hoje = isoDateInTz();
  return {
    athlete: id,
    profile: profile as ProfileRow,
    seed,
    plan: ((plan.data ?? []) as PlanWorkout[]).length ? (plan.data as PlanWorkout[]) : seed.treinos,
    schedule: (schedule.data ?? []) as ScheduleWeek[],
    overrides: (overrides.data ?? []) as Override[],
    zonas,
    history: (history.data ?? []) as ZoneHistory[],
    logs: ((logs.data ?? []) as WorkoutLog[]).map(normalizeLog),
    estimates: (estimates.data ?? []) as Estimate[],
    goals: (goals.data ?? []) as GoalRow[],
    closures: (closures.data ?? []) as ClosureRow[],
    coach: (coach.data ?? []) as CoachRow[],
    hoje,
    semanaAtual: calendarWeekOf(profile.plan_inicio, hoje),
  };
}

function normalizeLog(l: WorkoutLog): WorkoutLog {
  return {
    ...l,
    distancia_km: Number(l.distancia_km),
    pace_s_por_km: l.pace_s_por_km == null ? null : Number(l.pace_s_por_km),
    pace_alvo_s: l.pace_alvo_s == null ? null : Number(l.pace_alvo_s),
    rep_alvo_s: l.rep_alvo_s == null ? null : Number(l.rep_alvo_s),
    rep_dist_km: l.rep_dist_km == null ? null : Number(l.rep_dist_km),
    teste_dist_km: l.teste_dist_km == null ? null : Number(l.teste_dist_km),
    temp_c: l.temp_c == null ? null : Number(l.temp_c),
    orvalho_c: l.orvalho_c == null ? null : Number(l.orvalho_c),
    reps: Array.isArray(l.reps) ? l.reps.map(Number) : null,
  };
}

export function engineContext(s: AthleteState): EngineContext {
  return {
    athlete: s.athlete,
    nivel: s.profile.nivel,
    fc_max: s.profile.fc_max,
    zonas: s.zonas,
    zonasIniciais: s.seed.zonasIniciais,
    history: s.history,
    logs: s.logs,
  };
}
