// Carga de treino (7.4).
//
// - sRPE (Foster et al., 2001): carga = esforço (0–10) × duração em minutos.
// - ACWR "desacoplado": carga dos últimos 7 dias ÷ média semanal dos 28 dias
//   anteriores a eles (Windt e Gabbett, 2019, recomendam não incluir a semana
//   aguda na crônica). Só indicador — nunca bloqueia nada.
// - Pico de sessão (Frandsen et al., BJSM 2025, 5.200 corredores): o risco de
//   lesão sobe quando um treino passa 10% do mais longo dos últimos 30 dias.
// - 80/20 (Seiler): fração do tempo de corrida em intensidade baixa.

import { addDays, daysBetween } from "./dates";
import { round1 } from "./format";
import { TIPOS_LEVES, TIPOS_QUALIDADE, zonePace } from "./plan";
import type { Segmento, WorkoutLog, Zona, Zonas } from "./types";

export function sessionLoad(rpe: number, tempo_s: number): number {
  return Math.round(rpe * (tempo_s / 60));
}

function inRange(iso: string, from: string, to: string) {
  return iso >= from && iso <= to;
}

export function loadBetween(logs: WorkoutLog[], from: string, to: string): number {
  return logs.filter((l) => inRange(l.data, from, to)).reduce((s, l) => s + sessionLoad(l.rpe, l.tempo_s), 0);
}

export interface Acwr {
  agudo: number;
  cronico_semanal: number;
  acwr: number | null;
}

/** Mínimo de histórico antes da semana aguda para o ACWR fazer sentido. */
export const ACWR_MIN_DIAS_CRONICO = 14;

/**
 * ACWR no dia `ref` (inclusive). Com menos de 28 dias de histórico, a média
 * semanal crônica usa só os dias que existem (dividir por 4 inflaria o índice
 * nas primeiras semanas); com menos de 14 dias, devolve null.
 */
export function acwr(logs: WorkoutLog[], ref: string): Acwr {
  const agudo = loadBetween(logs, addDays(ref, -6), ref);
  const inicioCronico = addDays(ref, -34);
  const fimCronico = addDays(ref, -7);
  const primeiro = logs.reduce<string | null>((m, l) => (l.data <= ref && (!m || l.data < m) ? l.data : m), null);
  if (!primeiro || primeiro > fimCronico) return { agudo, cronico_semanal: 0, acwr: null };
  const desde = primeiro > inicioCronico ? primeiro : inicioCronico;
  const dias = daysBetween(desde, fimCronico) + 1;
  if (dias < ACWR_MIN_DIAS_CRONICO) return { agudo, cronico_semanal: 0, acwr: null };
  // usa semanas inteiras (de 2 a 4) logo antes da semana aguda
  const semanas = Math.min(4, Math.floor(dias / 7));
  const cronico_semanal = loadBetween(logs, addDays(fimCronico, -(semanas * 7 - 1)), fimCronico) / semanas;
  return {
    agudo,
    cronico_semanal: Math.round(cronico_semanal),
    acwr: cronico_semanal > 0 ? Math.round((agudo / cronico_semanal) * 100) / 100 : null,
  };
}

export const ACWR_FAIXA = { min: 0.8, max: 1.3, alerta: 1.5 };

export interface SessionSpike {
  /** Maior treino de corrida dos últimos 30 dias (km). */
  maior_km: number;
  /** 1,10 × maior treino. */
  limite_km: number;
  planejado_km: number;
  passa: boolean;
  /** % acima do maior treino. */
  pico_pct: number;
}

/**
 * Pico de sessão para um treino planejado no dia `ref`. Sem histórico nos
 * últimos 30 dias não há referência e retorna null.
 */
export function sessionSpike(logs: WorkoutLog[], ref: string, planejado_km: number): SessionSpike | null {
  const from = addDays(ref, -30);
  const to = addDays(ref, -1);
  const corridas = logs.filter((l) => l.atividade === "corrida" && inRange(l.data, from, to));
  if (corridas.length === 0) return null;
  const maior = Math.max(...corridas.map((l) => l.distancia_km));
  if (!(maior > 0)) return null;
  const limite = round1(maior * 1.1);
  return {
    maior_km: maior,
    limite_km: limite,
    planejado_km,
    passa: planejado_km > maior * 1.1 + 1e-9,
    pico_pct: Math.round(((planejado_km - maior) / maior) * 100),
  };
}

// ---------- 80/20 ----------

const ZONAS_LEVES: Zona[] = ["leve", "regenerativo", "corrida", "caminhada", "caminhada_livre", "confortavel"];

/** Fração do tempo planejado em zonas leves (pausas contam como leve). */
export function easyShareOfSegments(segmentos: Segmento[], zonas: Zonas): number {
  let leve = 0;
  let total = 0;
  const add = (km: number, zona: Zona) => {
    const p = zonePace(zona, zonas).pace_s ?? zonas.leve ?? zonas.corrida ?? 400;
    const t = km * p;
    total += t;
    if (ZONAS_LEVES.includes(zona)) leve += t;
  };
  for (const s of segmentos) {
    if (s.tipo === "corrida") add(s.distancia_km, s.zona);
    else if (s.tipo === "caminhada") add(s.distancia_km, "caminhada");
    else if (s.tipo === "repeticao") {
      for (const b of s.blocos) add(b.distancia_km * s.vezes, b.zona);
      if (s.pausa) {
        const p = Math.max(0, s.vezes - 1) * s.pausa.minutos * 60;
        leve += p;
        total += p;
      }
    }
  }
  if (total === 0) return 1;
  return leve / total;
}

/**
 * Quanto de um treino registrado foi em intensidade baixa (0 a 1).
 * - Treinos leves: contam como leves, salvo esforço ≥ 7 ou pace mais de 15 s/km
 *   mais rápido que o alvo (aí foram leves "rápidos demais").
 * - Treinos de qualidade/teste: proporção planejada de tempo em zona leve.
 * - Treino livre: pelo esforço (≤ 4 leve, ≥ 7 forte, meio-termo 50%).
 */
export function easyShareOfLog(log: WorkoutLog, segmentos: Segmento[] | null, zonas: Zonas): number {
  if (TIPOS_LEVES.includes(log.tipo_treino)) {
    const rapido = log.pace_alvo_s != null && log.pace_s_por_km != null && log.pace_s_por_km < log.pace_alvo_s - 15;
    return log.rpe >= 7 || rapido ? 0 : 1;
  }
  if ((TIPOS_QUALIDADE.includes(log.tipo_treino) || log.tipo_treino === "Teste") && segmentos) {
    return easyShareOfSegments(segmentos, zonas);
  }
  if (log.rpe <= 4) return 1;
  if (log.rpe >= 7) return 0;
  return 0.5;
}

export function easyFraction(
  logs: WorkoutLog[],
  ref: string,
  segmentsOf: (planWorkoutId: string) => Segmento[] | null,
  zonas: Zonas,
  dias = 28,
): number | null {
  const from = addDays(ref, -(dias - 1));
  const corridas = logs.filter((l) => l.atividade === "corrida" && inRange(l.data, from, ref));
  let leve = 0;
  let total = 0;
  for (const l of corridas) {
    const segs = l.plan_workout_id ? segmentsOf(l.plan_workout_id) : null;
    const share = easyShareOfLog(l, segs, zonas);
    leve += share * l.tempo_s;
    total += l.tempo_s;
  }
  return total > 0 ? leve / total : null;
}
