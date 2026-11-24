// Estimativa atual, projeção com prazo e classificação de metas (seção 11).

import { addMonths, daysBetween, monthsBetween } from "./dates";
import { FRACAO_LEVE, timeForVdot, vdotFromPaceAtFraction, vdotFromRace } from "./vdot";
import type { AthleteId, Estimate, Nivel, Zonas } from "./types";

export interface CurrentEstimate {
  vdot: number;
  est_5k_s: number;
  fonte: Estimate["fonte"] | "pace_leve";
  data: string | null;
  /** true quando vem só do pace leve (menos confiável). */
  aproximada: boolean;
}

/**
 * 11.1: teste mais recente (até 8 semanas) → treino de esforço ≥ 8 mais
 * recente → pace leve (VDOT com fração leve, marcada como estimativa).
 */
export function currentEstimate(estimates: Estimate[], zonas: Zonas, athlete: AthleteId, hoje: string): CurrentEstimate | null {
  const ord = [...estimates].sort((a, b) => (a.data < b.data ? 1 : -1));
  const teste = ord.find((e) => e.fonte === "teste" && daysBetween(e.data, hoje) <= 56);
  if (teste) return { ...teste, aproximada: false };
  const treino = ord.find((e) => e.fonte === "treino");
  if (treino) return { ...treino, aproximada: false };
  const { zona, fracao } = FRACAO_LEVE[athlete];
  const p = zonas[zona];
  if (!p) return null;
  const vdot = vdotFromPaceAtFraction(p, fracao);
  return { vdot, est_5k_s: Math.round(timeForVdot(vdot, 5)), fonte: "pace_leve", data: null, aproximada: true };
}

// ---------- ganho de VDOT ----------

/**
 * Heurística inicial (corrigida pelos dados): iniciante +1,5 VDOT/mês nos 3
 * primeiros meses e +0,8 depois; intermediário +1,0 e +0,5.
 */
export function monthlyGain(nivel: Nivel, mes: number): number {
  const ini = nivel === "iniciante_sedentaria";
  if (mes < 3) return ini ? 1.5 : 1.0;
  return ini ? 0.8 : 0.5;
}

/** Tendência real (regressão linear em VDOT/mês), limitada a [0, 2]. */
export function trendPerMonth(estimates: Estimate[]): number | null {
  if (estimates.length < 3) return null;
  const ord = [...estimates].sort((a, b) => (a.data < b.data ? -1 : 1));
  const span = daysBetween(ord[0].data, ord[ord.length - 1].data);
  if (span < 28) return null;
  const xs = ord.map((e) => monthsBetween(ord[0].data, e.data));
  const ys = ord.map((e) => e.vdot);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return Math.max(0, Math.min(2, num / den));
}

export interface ProjectionInput {
  vdotAtual: number;
  nivel: Nivel;
  /** Meses de treino já feitos (para os retornos decrescentes). */
  mesesTreinados: number;
  estimates: Estimate[];
}

/** VDOT projetado daqui a `meses` meses. */
export function projectVdot(input: ProjectionInput, meses: number): number {
  const trend = trendPerMonth(input.estimates);
  if (trend != null) return input.vdotAtual + trend * meses;
  let v = input.vdotAtual;
  let m = input.mesesTreinados;
  let restante = meses;
  while (restante > 1e-9) {
    const ateFimDoMes = 1 - (m - Math.floor(m));
    const passo = Math.min(restante, ateFimDoMes > 1e-9 ? ateFimDoMes : 1);
    v += monthlyGain(input.nivel, Math.floor(m)) * passo;
    m += passo;
    restante -= passo;
  }
  return v;
}

export function projectedTimes(input: ProjectionInput, distancia_km = 5, meses = [3, 4, 6]) {
  return meses.map((m) => {
    const vdot = projectVdot(input, m);
    return { meses: m, vdot, tempo_s: Math.round(timeForVdot(vdot, distancia_km)) };
  });
}

// ---------- metas ----------

export type Classificacao = "Realista" | "Ambiciosa" | "Muito ambiciosa";

export interface GoalAnalysis {
  vdotNecessario: number;
  vdotNoPrazo: number;
  mesesAtePrazo: number;
  classificacao: Classificacao;
  /** Meses até a meta, pela projeção (null se passar de 36 meses). */
  mesesProvaveis: number | null;
  dataProvavel: string | null;
  intermediarias: { tempo_s: number; data: string }[];
  jaAtingida: boolean;
}

export function analyzeGoal(
  goal: { distancia_km: number; tempo_alvo_s: number; prazo: string },
  input: ProjectionInput,
  hoje: string,
): GoalAnalysis {
  const vdotNecessario = vdotFromRace(goal.distancia_km, goal.tempo_alvo_s);
  const mesesAtePrazo = Math.max(0, monthsBetween(hoje, goal.prazo));
  const vdotNoPrazo = projectVdot(input, mesesAtePrazo);
  const jaAtingida = input.vdotAtual >= vdotNecessario;

  let classificacao: Classificacao;
  if (vdotNecessario <= vdotNoPrazo) classificacao = "Realista";
  else if (vdotNecessario <= vdotNoPrazo + 3) classificacao = "Ambiciosa";
  else classificacao = "Muito ambiciosa";

  let mesesProvaveis: number | null = null;
  if (jaAtingida) mesesProvaveis = 0;
  else {
    for (let m = 0.25; m <= 36; m += 0.25) {
      if (projectVdot(input, m) >= vdotNecessario) {
        mesesProvaveis = m;
        break;
      }
    }
  }

  // metas intermediárias: a cada 3 meses até a meta, arredondadas para 30 s
  // até 3 metas intermediárias igualmente espaçadas no caminho (ex.: 25:00 → 22:00 → 19:00)
  const intermediarias: { tempo_s: number; data: string }[] = [];
  if (!jaAtingida && mesesProvaveis != null && mesesProvaveis > 3) {
    const n = Math.min(3, Math.floor(mesesProvaveis / 3));
    for (let i = 1; i <= n; i++) {
      const m = (mesesProvaveis * i) / (n + 1);
      const t = Math.round(timeForVdot(projectVdot(input, m), goal.distancia_km) / 30) * 30;
      const anterior = intermediarias.at(-1)?.tempo_s ?? Infinity;
      if (t > goal.tempo_alvo_s && t < anterior) intermediarias.push({ tempo_s: t, data: addMonths(hoje, m) });
    }
  }
  if (!jaAtingida) intermediarias.push({ tempo_s: goal.tempo_alvo_s, data: mesesProvaveis != null ? addMonths(hoje, mesesProvaveis) : goal.prazo });

  return {
    vdotNecessario,
    vdotNoPrazo,
    mesesAtePrazo,
    classificacao,
    mesesProvaveis,
    dataProvavel: mesesProvaveis != null ? addMonths(hoje, mesesProvaveis) : null,
    intermediarias,
    jaAtingida,
  };
}

