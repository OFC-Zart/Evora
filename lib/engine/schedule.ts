// Mapa semana do calendário → semana do plano. Quando uma semana é repetida ou
// vira semana leve, o resto do plano é deslocado para a frente.

import { addDays, calendarWeekOf, dateOfDay, dayKey, weekRange } from "./dates";
import { applyMode, displayKm } from "./plan";
import type { AthleteId, ModoSemana, PlanWorkout, ScheduleWeek, Segmento, WorkoutLog } from "./types";

export const TOTAL_SEMANAS_PLANO = 8;

export function defaultSchedule(total = TOTAL_SEMANAS_PLANO): ScheduleWeek[] {
  return Array.from({ length: total }, (_, i) => ({
    semana_calendario: i + 1,
    semana_plano: i + 1,
    modo: "normal" as ModoSemana,
    motivo: null,
  }));
}

/** Refaz as semanas depois de `semanaAtual` começando por `proxima`. */
export function rebuildSchedule(
  schedule: ScheduleWeek[],
  semanaAtual: number,
  proxima: { semana_plano: number; modo: ModoSemana; motivo: string | null },
  total = TOTAL_SEMANAS_PLANO,
): ScheduleWeek[] {
  const kept = schedule.filter((w) => w.semana_calendario <= semanaAtual);
  const out = [...kept];
  if (proxima.semana_plano > total) return out;
  out.push({ semana_calendario: semanaAtual + 1, ...proxima });
  let cal = semanaAtual + 2;
  for (let p = proxima.semana_plano + 1; p <= total; p++) {
    out.push({ semana_calendario: cal++, semana_plano: p, modo: "normal", motivo: null });
  }
  return out;
}

export interface Override {
  plan_workout_id: string;
  semana_calendario: number | null;
  segmentos: Segmento[];
  motivo: string;
}

export interface ScheduledWorkout {
  workout: PlanWorkout;
  semana_calendario: number;
  data: string;
  modo: ModoSemana;
  /** Segmentos já com modo da semana e override aplicados. */
  segmentos: Segmento[];
  km: number | null;
  override?: Override;
}

export function resolveWorkout(
  w: PlanWorkout,
  week: ScheduleWeek,
  plan_inicio: string,
  athlete: AthleteId,
  overrides: Override[] = [],
): ScheduledWorkout {
  const ov = overrides.find(
    (o) => o.plan_workout_id === w.id && (o.semana_calendario == null || o.semana_calendario === week.semana_calendario),
  );
  const base = applyMode(w.segmentos, week.modo, athlete);
  const segmentos = ov ? ov.segmentos : base;
  return {
    workout: w,
    semana_calendario: week.semana_calendario,
    data: dateOfDay(plan_inicio, week.semana_calendario, w.dia),
    modo: week.modo,
    segmentos,
    km: displayKm(w.segmentos, segmentos, w.km_total),
    override: ov,
  };
}

export function workoutsOfCalendarWeek(
  plan: PlanWorkout[],
  schedule: ScheduleWeek[],
  semana: number,
  plan_inicio: string,
  athlete: AthleteId,
  overrides: Override[] = [],
): ScheduledWorkout[] {
  const week = schedule.find((w) => w.semana_calendario === semana);
  if (!week) return [];
  return plan
    .filter((w) => w.semana === week.semana_plano)
    .sort((a, b) => a.ordem - b.ordem)
    .map((w) => resolveWorkout(w, week, plan_inicio, athlete, overrides))
    .filter((sw) => sw.data >= plan_inicio); // plano começando no meio da semana
}

export function workoutsOnDate(
  plan: PlanWorkout[],
  schedule: ScheduleWeek[],
  date: string,
  plan_inicio: string,
  athlete: AthleteId,
  overrides: Override[] = [],
): ScheduledWorkout[] {
  const semana = calendarWeekOf(plan_inicio, date);
  const dia = dayKey(date);
  return workoutsOfCalendarWeek(plan, schedule, semana, plan_inicio, athlete, overrides).filter(
    (s) => s.workout.dia === dia,
  );
}

/** Treinos planejados entre duas datas (inclusive). */
export function plannedBetween(
  plan: PlanWorkout[],
  schedule: ScheduleWeek[],
  from: string,
  to: string,
  plan_inicio: string,
  athlete: AthleteId,
  { incluirOpcionais = false } = {},
): ScheduledWorkout[] {
  const out: ScheduledWorkout[] = [];
  const w1 = Math.max(1, calendarWeekOf(plan_inicio, from));
  const w2 = calendarWeekOf(plan_inicio, to);
  for (let s = w1; s <= w2; s++) {
    for (const sw of workoutsOfCalendarWeek(plan, schedule, s, plan_inicio, athlete)) {
      if (sw.data < from || sw.data > to) continue;
      if (!incluirOpcionais && sw.workout.opcional) continue;
      out.push(sw);
    }
  }
  return out;
}

/** Log que corresponde a um treino agendado (mesmo treino e mesma semana). */
export function logFor(sw: ScheduledWorkout, logs: WorkoutLog[]): WorkoutLog | undefined {
  return logs.find(
    (l) =>
      l.plan_workout_id === sw.workout.id &&
      (l.semana_calendario == null || l.semana_calendario === sw.semana_calendario),
  );
}

export type StatusTreino = "feito" | "parcial" | "pulado" | "hoje" | "futuro";

export function statusOf(sw: ScheduledWorkout, logs: WorkoutLog[], hoje: string): StatusTreino {
  const l = logFor(sw, logs);
  if (l) return l.completou === "sim" ? "feito" : l.completou === "parcial" ? "parcial" : "pulado";
  if (sw.data < hoje) return "pulado";
  if (sw.data === hoje) return "hoje";
  return "futuro";
}

/** Último dia com treino planejado da semana (para fechar a semana cedo). */
export function lastPlannedDate(sws: ScheduledWorkout[]): string | null {
  const ds = sws.filter((s) => !s.workout.opcional).map((s) => s.data).sort();
  return ds.length ? ds[ds.length - 1] : null;
}

export { weekRange, addDays };
