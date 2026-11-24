// Previsões e fisiologia complementar.
//
// - Riegel (1981): T2 = T1 × (D2/D1)^1,06 (seção 7.3).
// - Calor: tabela "temperatura + ponto de orvalho" (°F) usada por treinadores
//   (Mark Hadley), interpolada linearmente. Serve para (a) avisar quanto o pace
//   alvo deve ficar mais lento num dia quente e (b) normalizar o pace registrado
//   antes do motor de autoajuste comparar com o alvo.
// - FC máxima estimada: Tanaka, Monahan e Seals (2001), 208 − 0,7 × idade
//   (meta-análise de 351 estudos, erro típico ~10 bpm). Só é usada como sugestão;
//   as regras de FC (8.2) usam apenas a FC máxima informada pelo atleta.
// - Gasto calórico: correr custa ~1 kcal/kg/km, quase independente da velocidade
//   (Margaria, 1963); caminhar custa ~0,75 kcal/kg/km (bruto).

export const RIEGEL_EXPOENTE = 1.06;

export function riegel(tempo1_s: number, dist1_km: number, dist2_km: number, expoente = RIEGEL_EXPOENTE): number {
  return tempo1_s * Math.pow(dist2_km / dist1_km, expoente);
}

// ---------- calor ----------

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

const HEAT_POINTS: [number, number][] = [
  [100, 0],
  [110, 0.5],
  [120, 1],
  [130, 2],
  [140, 3],
  [150, 4.5],
  [160, 6],
  [170, 8],
  [180, 10],
];

export interface HeatAdjustment {
  soma_f: number;
  /** % que o pace deve ficar mais lento (0 a 10+). */
  pct: number;
  /** true quando passa de 180: esforço forte não é recomendado. */
  extremo: boolean;
}

export function heatAdjustment(temp_c: number, orvalho_c: number): HeatAdjustment {
  const soma = cToF(temp_c) + cToF(orvalho_c);
  if (soma <= HEAT_POINTS[0][0]) return { soma_f: soma, pct: 0, extremo: false };
  for (let i = 1; i < HEAT_POINTS.length; i++) {
    const [x1, y1] = HEAT_POINTS[i];
    if (soma <= x1) {
      const [x0, y0] = HEAT_POINTS[i - 1];
      const pct = y0 + ((soma - x0) / (x1 - x0)) * (y1 - y0);
      return { soma_f: soma, pct: Math.round(pct * 10) / 10, extremo: false };
    }
  }
  // acima de 180: extrapola de leve e marca como extremo
  const pct = 10 + (soma - 180) * 0.2;
  return { soma_f: soma, pct: Math.round(pct * 10) / 10, extremo: true };
}

/** Pace alvo corrigido para o calor (mais lento). */
export function heatAdjustedPace(pace_s: number, pct: number): number {
  return pace_s * (1 + pct / 100);
}

/** Pace registrado convertido para "pace equivalente em clima ameno". */
export function heatNormalizedPace(pace_s: number, pct: number): number {
  return pace_s / (1 + pct / 100);
}

// ---------- frequência cardíaca ----------

export function tanakaHrMax(idade: number): number {
  return Math.round(208 - 0.7 * idade);
}

/**
 * Faixas de FC por zona (% da FC máxima, Daniels): leve 65–79%,
 * moderado 80–89% e forte 88–92%. Com FC de repouso usa Karvonen (reserva).
 */
export function hrZones(fc_max: number, fc_repouso?: number | null) {
  const faixa = (lo: number, hi: number) => {
    if (fc_repouso && fc_repouso > 30 && fc_repouso < fc_max) {
      const r = fc_max - fc_repouso;
      return [Math.round(fc_repouso + r * lo), Math.round(fc_repouso + r * hi)] as const;
    }
    return [Math.round(fc_max * lo), Math.round(fc_max * hi)] as const;
  };
  return {
    leve: faixa(0.65, 0.79),
    moderado: faixa(0.8, 0.89),
    forte: faixa(0.88, 0.92),
    metodo: fc_repouso ? "Karvonen (reserva de FC)" : "% da FC máxima",
  };
}

// ---------- energia ----------

export function kcalEstimate(params: {
  peso_kg: number;
  km_corrida: number;
  km_caminhada?: number;
  minutos_futebol?: number;
  minutos_forca?: number;
}): number {
  const { peso_kg, km_corrida, km_caminhada = 0, minutos_futebol = 0, minutos_forca = 0 } = params;
  const kcal =
    1.0 * peso_kg * km_corrida +
    0.75 * peso_kg * km_caminhada +
    // MET do Compêndio de Atividades Físicas: futebol recreativo ~7, força moderada ~3,5
    7 * peso_kg * (minutos_futebol / 60) +
    3.5 * peso_kg * (minutos_forca / 60);
  return Math.round(kcal);
}

/** IMC, só informativo. */
export function bmi(peso_kg: number, altura_m: number): number {
  return Math.round((peso_kg / (altura_m * altura_m)) * 10) / 10;
}
