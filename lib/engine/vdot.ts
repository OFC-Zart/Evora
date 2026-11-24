// VDOT de Jack Daniels e Jimmy Gilbert (Oxygen Power, 1979) — seção 7.2.
//
//   v = velocidade em m/min, t = duração em minutos
//   VO2(v)  = −4,60 + 0,182258·v + 0,000104·v²            (custo de O2, ml/kg/min)
//   %max(t) = 0,8 + 0,1894393·e^(−0,012778·t) + 0,2989558·e^(−0,1932605·t)
//   VDOT    = VO2(v) / %max(t)
//
// Para achar o pace de uma zona resolvemos VO2(v) = VDOT × fração (2º grau em v).
// Para achar o tempo de prova de um VDOT, resolvemos em t por bisseção
// (VDOT(d, t) é estritamente decrescente em t).

import type { AthleteId, Zonas, ZonaComPace } from "./types";

const A = 0.000104;
const B = 0.182258;
const C = -4.6;

export function vo2AtVelocity(v_m_min: number): number {
  return C + B * v_m_min + A * v_m_min * v_m_min;
}

export function percentMax(t_min: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * t_min) +
    0.2989558 * Math.exp(-0.1932605 * t_min)
  );
}

/** VDOT de uma prova: distância em km, tempo em segundos. */
export function vdotFromRace(distancia_km: number, tempo_s: number): number {
  const t = tempo_s / 60;
  const v = (distancia_km * 1000) / t;
  return vo2AtVelocity(v) / percentMax(t);
}

/** Velocidade (m/min) cujo custo de O2 é `vo2` (raiz positiva da quadrática). */
export function velocityForVo2(vo2: number): number {
  const disc = B * B - 4 * A * (C - vo2);
  return (-B + Math.sqrt(disc)) / (2 * A);
}

/** Pace (s/km) para correr a uma fração do VDOT. */
export function paceForFraction(vdot: number, fracao: number): number {
  const v = velocityForVo2(vdot * fracao);
  return 60000 / v;
}

/** VDOT implícito num pace (s/km) assumindo que ele está a `fracao` do VDOT. */
export function vdotFromPaceAtFraction(pace_s: number, fracao: number): number {
  const v = 60000 / pace_s;
  return vo2AtVelocity(v) / fracao;
}

/** Tempo (s) previsto para uma distância a partir do VDOT. */
export function timeForVdot(vdot: number, distancia_km: number): number {
  let lo = 0.5; // minutos
  let hi = 900;
  const d = distancia_km * 1000;
  const f = (t: number) => vo2AtVelocity(d / t) / percentMax(t) - vdot;
  // f(lo) > 0 (rápido demais), f(hi) < 0 (lento demais)
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-7) break;
  }
  return ((lo + hi) / 2) * 60;
}

/**
 * Frações do VDOT por zona.
 * Danilo (seção 7.2): regenerativo 0,60 · leve 0,70 · moderado 0,86 · forte 0,98.
 * Letícia: a fórmula de Daniels subestima a velocidade do pace leve em VDOT
 * muito baixo, então usamos o topo da faixa leve de Daniels (74%) para "corrida".
 */
export const FRACOES: Record<AthleteId, Partial<Record<ZonaComPace, number>>> = {
  danilo: { regenerativo: 0.6, leve: 0.7, moderado: 0.86, forte: 0.98 },
  leticia: { corrida: 0.74 },
};

/** Fração usada para estimar o VDOT pelo pace leve (11.1). */
export const FRACAO_LEVE: Record<AthleteId, { zona: ZonaComPace; fracao: number }> = {
  danilo: { zona: "leve", fracao: 0.7 },
  leticia: { zona: "corrida", fracao: 0.74 },
};

/** Zonas (s/km, inteiros) a partir de um VDOT. */
export function zonesFromVdot(vdot: number, athlete: AthleteId): Zonas {
  const out: Zonas = {};
  for (const [zona, frac] of Object.entries(FRACOES[athlete]) as [ZonaComPace, number][]) {
    out[zona] = Math.round(paceForFraction(vdot, frac));
  }
  return out;
}

export const DISTANCIAS_PROVA = [
  { km: 1, nome: "1 km" },
  { km: 3, nome: "3 km" },
  { km: 5, nome: "5 km" },
  { km: 10, nome: "10 km" },
  { km: 21.0975, nome: "Meia maratona" },
  { km: 42.195, nome: "Maratona" },
];

/** Tempos equivalentes para várias distâncias, pelo VDOT. */
export function raceEquivalents(vdot: number) {
  return DISTANCIAS_PROVA.map((d) => ({ ...d, tempo_s: timeForVdot(vdot, d.km) }));
}
