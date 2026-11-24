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

/** Carrega tudo de um atleta. Com o cliente do usuário o RLS garante que é o próprio. */
export async function loadState(supabase: SupabaseClient, athlete?: AthleteId): Promise<AthleteState | null> {
  const profileQ = supabase.from("profiles").select("*");
  const { data: profile } = athlete ? await profileQ.eq("athlete_id", athlete).maybeSingle() : await profileQ.maybeSingle();
  if (!profile) return null;
  const id = profile.athlete_id as AthleteId;

  const [plan, schedule, overrides, zones, history, logs, estimates, goals, closures, coach] = await Promise.all([
    supabase.from("plan_workouts").select("*").eq("athlete_id", id).order("semana").order("ordem"),
    supabase.from("plan_schedule").select("*").eq("athlete_id", id).order("semana_calendario"),
    supabase.from("plan_overrides").select("*").eq("athlete_id", id),
    supabase.from("zones").select("*").eq("athlete_id", id),
    supabase.from("zone_history").select("*").eq("athlete_id", id).order("created_at", { ascending: true }),
    supabase.from("workout_logs").select("*").eq("athlete_id", id).order("data", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("estimates").select("*").eq("athlete_id", id).order("data", { ascending: true }),
    supabase.from("goals").select("*").eq("athlete_id", id).order("created_at", { ascending: false }),
    supabase.from("week_closures").select("*").eq("athlete_id", id).order("semana_calendario"),
    supabase.from("coach_messages").select("*").eq("athlete_id", id).order("created_at", { ascending: false }).limit(10),
  ]);

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
