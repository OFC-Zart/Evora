import "server-only";
import {
  TIPOS_LEVES,
  acwr,
  formatDateShort,
  loadBetween,
  normalizedPace,
  weekRange,
  workoutsOfCalendarWeek,
} from "@/lib/engine";
import type { AthleteState } from "./state";

export interface WeekPoint {
  semana: string;
  km_plan: number;
  km_feito: number;
  pace_leve: number | null;
  fc_leve: number | null;
  carga: number;
  acwr: number | null;
}

/** Séries semanais para os gráficos do Perfil (semanas do calendário). */
export function weeklySeries(s: AthleteState): WeekPoint[] {
  const ultima = Math.max(1, Math.min(s.semanaAtual, Math.max(...s.schedule.map((w) => w.semana_calendario), 1)));
  const out: WeekPoint[] = [];
  for (let w = 1; w <= ultima; w++) {
    const { inicio, fim } = weekRange(s.profile.plan_inicio, w);
    const plan = workoutsOfCalendarWeek(s.plan, s.schedule, w, s.profile.plan_inicio, s.athlete, s.overrides).filter((p) => !p.workout.opcional);
    const logs = s.logs.filter((l) => l.data >= inicio && l.data <= fim);
    const corridas = logs.filter((l) => l.atividade === "corrida");
    const leves = corridas.filter((l) => TIPOS_LEVES.includes(l.tipo_treino) && l.pace_s_por_km);
    const kmLeve = leves.reduce((a, l) => a + l.distancia_km, 0);
    const paceLeve = kmLeve > 0 ? leves.reduce((a, l) => a + (normalizedPace(l) as number) * l.distancia_km, 0) / kmLeve : null;
    const comFc = leves.filter((l) => l.fc_media);
    const ref = fim < s.hoje ? fim : s.hoje;
    out.push({
      semana: `S${w} ${formatDateShort(inicio)}`,
      km_plan: Math.round(plan.reduce((a, p) => a + (p.km ?? 0), 0) * 10) / 10,
      km_feito: Math.round(corridas.reduce((a, l) => a + l.distancia_km, 0) * 10) / 10,
      pace_leve: paceLeve ? Math.round(paceLeve) : null,
      fc_leve: comFc.length ? Math.round(comFc.reduce((a, l) => a + (l.fc_media as number), 0) / comFc.length) : null,
      carga: loadBetween(s.logs, inicio, fim),
      acwr: acwr(s.logs, ref).acwr,
    });
  }
  return out;
}

export function estimateSeries(s: AthleteState) {
  return s.estimates.map((e) => ({
    data: formatDateShort(e.data),
    est_5k_s: e.est_5k_s,
    vdot: Math.round(Number(e.vdot) * 10) / 10,
    fonte: e.fonte,
  }));
}

export function rpeByType(s: AthleteState) {
  const map = new Map<string, { soma: number; n: number }>();
  for (const l of s.logs) {
    const k = l.tipo_treino;
    const v = map.get(k) ?? { soma: 0, n: 0 };
    v.soma += l.rpe;
    v.n++;
    map.set(k, v);
  }
  return [...map.entries()].map(([tipo, v]) => ({ tipo, rpe: Math.round((v.soma / v.n) * 10) / 10, n: v.n })).sort((a, b) => b.rpe - a.rpe);
}
