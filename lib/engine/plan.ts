// Montagem dos treinos: texto dos segmentos, tempo total, km, modos de semana
// (repetida, leve −30% sem tiros, leve −20%) e redução por pico de sessão.

import { formatDistance, formatDuration, formatPace, round1 } from "./format";
import type { AthleteId, Bloco, ModoSemana, Segmento, TipoTreino, Zona, Zonas } from "./types";

export const MIN_POR_VOLTA_FORCA = 10;
const PACE_CAMINHADA_PADRAO = 600; // 10:00/km quando o atleta não tem zona de caminhada

export const TIPOS_QUALIDADE: TipoTreino[] = ["Tiros", "Ritmo", "Fartlek"];
export const TIPOS_LEVES: TipoTreino[] = ["Leve", "Longão", "Regenerativo", "Corre/anda", "Corrida"];

export function isRunType(tipo: TipoTreino): boolean {
  return tipo !== "Força" && tipo !== "Futebol";
}

export interface ZonePace {
  pace_s: number | null;
  /** true quando a zona não tem meta e o pace é só uma estimativa para o tempo total. */
  estimado: boolean;
}

/** Tempo de 100 m na zona "solto": pace forte ÷ 10 − 3 s (7.1). */
export function soltoPer100(forte_s: number): number {
  return forte_s / 10 - 3;
}

export function zonePace(zona: Zona, zonas: Zonas, est5kPace?: number | null): ZonePace {
  switch (zona) {
    case "solto":
      return zonas.forte ? { pace_s: soltoPer100(zonas.forte) * 10, estimado: false } : { pace_s: null, estimado: true };
    case "confortavel":
      return { pace_s: zonas.leve ?? zonas.corrida ?? null, estimado: true };
    case "caminhada_livre":
      return { pace_s: zonas.caminhada ?? PACE_CAMINHADA_PADRAO, estimado: true };
    case "maximo":
      return {
        pace_s: est5kPace ?? (zonas.forte ? zonas.forte * 1.03 : zonas.corrida ? zonas.corrida * 0.95 : null),
        estimado: true,
      };
    default:
      return { pace_s: zonas[zona] ?? null, estimado: false };
  }
}

function walkPace(zonas: Zonas): number {
  return zonas.caminhada ?? PACE_CAMINHADA_PADRAO;
}

// ---------- km ----------

export function blocksKm(blocos: Bloco[]): number {
  return blocos.reduce((s, b) => s + b.distancia_km, 0);
}

/** Km somados dos segmentos (sem o aquecimento andando da Letícia). */
export function segmentsKm(segmentos: Segmento[]): number {
  let km = 0;
  for (const s of segmentos) {
    if (s.tipo === "corrida" || s.tipo === "caminhada") km += s.distancia_km;
    else if (s.tipo === "repeticao") km += s.vezes * blocksKm(s.blocos);
  }
  return Math.round(km * 100) / 100;
}

/** Km de corrida e de caminhada separados (para calorias e 80/20). */
export function splitKm(segmentos: Segmento[]): { corrida: number; caminhada: number } {
  let corrida = 0;
  let caminhada = 0;
  const add = (km: number, zona: Zona | "andar") => {
    if (zona === "andar" || zona === "caminhada" || zona === "caminhada_livre") caminhada += km;
    else corrida += km;
  };
  for (const s of segmentos) {
    if (s.tipo === "corrida") add(s.distancia_km, s.zona);
    else if (s.tipo === "caminhada") add(s.distancia_km, "andar");
    else if (s.tipo === "repeticao") for (const b of s.blocos) add(b.distancia_km * s.vezes, b.zona);
  }
  return { corrida: round1(corrida), caminhada: round1(caminhada) };
}

/** Aquecimento e desaquecimento andando (Letícia): 500 m antes e depois. */
export function warmupWalkKm(athlete: AthleteId, segmentos: Segmento[]): number {
  if (athlete !== "leticia") return 0;
  const corre = segmentos.some(
    (s) =>
      (s.tipo === "corrida" && (s.zona === "corrida" || s.zona === "maximo")) ||
      (s.tipo === "repeticao" && s.blocos.some((b) => b.zona === "corrida" || b.zona === "maximo")),
  );
  return corre ? 0.5 : 0;
}

// ---------- tempo ----------

export interface WorkoutTime {
  /** Tempo total previsto (s), incluindo pausas. */
  total_s: number;
  /** Só o tempo em movimento nos segmentos (s). */
  movimento_s: number;
  /** Aquecimento + desaquecimento andando (Letícia), fora do total. */
  aquecimento_s: number;
  /** true se alguma parte usa zona sem meta (o tempo é aproximado). */
  estimado: boolean;
}

export function workoutTime(
  segmentos: Segmento[],
  zonas: Zonas,
  athlete: AthleteId,
  est5kPace?: number | null,
): WorkoutTime {
  let movimento = 0;
  let pausas = 0;
  let estimado = false;
  const blockTime = (b: Bloco) => {
    const zp = zonePace(b.zona, zonas, est5kPace);
    if (zp.estimado) estimado = true;
    return b.distancia_km * (zp.pace_s ?? walkPace(zonas));
  };
  for (const s of segmentos) {
    if (s.tipo === "corrida") movimento += blockTime(s);
    else if (s.tipo === "caminhada") movimento += s.distancia_km * walkPace(zonas);
    else if (s.tipo === "repeticao") {
      movimento += s.vezes * s.blocos.reduce((t, b) => t + blockTime(b), 0);
      if (s.pausa) pausas += Math.max(0, s.vezes - 1) * s.pausa.minutos * 60;
    } else if (s.tipo === "forca") {
      movimento += s.voltas * MIN_POR_VOLTA_FORCA * 60;
    }
  }
  const aq = warmupWalkKm(athlete, segmentos);
  return {
    total_s: movimento + pausas,
    movimento_s: movimento,
    aquecimento_s: aq * 2 * walkPace(zonas),
    estimado,
  };
}

/**
 * Pace médio planejado (s/km) nos trechos em movimento, ou null quando o treino
 * não tem meta (zonas sem pace). É o alvo comparado com o pace médio registrado.
 */
export function plannedAvgPace(segmentos: Segmento[], zonas: Zonas, athlete: AthleteId): number | null {
  const km = segmentsKm(segmentos);
  if (!(km > 0)) return null;
  const hasUnpaced = segmentos.some(
    (s) =>
      (s.tipo === "corrida" && zonePace(s.zona, zonas).estimado) ||
      (s.tipo === "repeticao" && s.blocos.some((b) => zonePace(b.zona, zonas).estimado)),
  );
  if (hasUnpaced) return null;
  const t = workoutTime(segmentos, zonas, athlete);
  return t.movimento_s / km;
}

/** Alvo das repetições de qualidade (1º bloco forte/moderado/solto). */
export function repTarget(segmentos: Segmento[], zonas: Zonas): { dist_km: number; alvo_s: number; zona: Zona; vezes: number } | null {
  for (const s of segmentos) {
    if (s.tipo !== "repeticao") continue;
    const b = s.blocos.find((x) => x.zona === "forte" || x.zona === "moderado" || x.zona === "solto");
    if (!b) continue;
    const zp = zonePace(b.zona, zonas);
    if (zp.pace_s == null) continue;
    return { dist_km: b.distancia_km, alvo_s: b.distancia_km * zp.pace_s, zona: b.zona, vezes: s.vezes };
  }
  return null;
}

// ---------- texto ----------

export interface SegmentLine {
  texto: string;
  detalhe?: string;
  zona?: Zona;
}

const SEM_META = "Sem meta";

function blockLabel(b: Bloco, zonas: Zonas, athlete: AthleteId): { texto: string; tempo?: string } {
  const dist = formatDistance(b.distancia_km);
  const zp = zonePace(b.zona, zonas);
  switch (b.zona) {
    case "caminhada":
      return { texto: `${dist} andando` };
    case "caminhada_livre":
      return { texto: `${dist} caminhando rápido · ${SEM_META}` };
    case "confortavel":
      return { texto: `${dist} confortável, dá pra conversar · ${SEM_META}` };
    case "maximo":
      return { texto: `${dist} no máximo que der · ${SEM_META}` };
    case "solto": {
      const per100 = zonas.forte ? soltoPer100(zonas.forte) : null;
      const tempo = per100 != null ? (b.distancia_km * 10 * per100) : null;
      return {
        texto: `${dist} soltos`,
        tempo: tempo != null ? `~${Math.round(tempo)} s` : undefined,
      };
    }
    case "corrida": {
      const verbo = b.distancia_km <= 0.15 ? "trotando" : "correndo";
      return {
        texto: `${dist} ${verbo} a ${formatPace(zp.pace_s)}`,
        tempo: zp.pace_s ? formatDuration(b.distancia_km * zp.pace_s) : undefined,
      };
    }
    default:
      return {
        texto: `${dist} a ${formatPace(zp.pace_s)}`,
        tempo: zp.pace_s ? formatDuration(b.distancia_km * zp.pace_s) : undefined,
      };
  }
}

export function segmentLines(segmentos: Segmento[], zonas: Zonas, athlete: AthleteId): SegmentLine[] {
  const lines: SegmentLine[] = [];
  const aq = warmupWalkKm(athlete, segmentos);
  if (aq > 0) lines.push({ texto: `${formatDistance(aq)} andando para aquecer`, detalhe: "Fora do km total", zona: "caminhada" });

  for (const s of segmentos) {
    if (s.tipo === "forca") {
      lines.push({
        texto: `Circuito de força: ${s.voltas} ${s.voltas === 1 ? "volta" : "voltas"}`,
        detalhe: `≈ ${s.voltas * MIN_POR_VOLTA_FORCA} min`,
      });
    } else if (s.tipo === "caminhada") {
      lines.push({ texto: `${formatDistance(s.distancia_km)} andando`, zona: "caminhada" });
    } else if (s.tipo === "corrida") {
      const l = blockLabel(s, zonas, athlete);
      lines.push({ texto: l.texto, detalhe: l.tempo ? `≈ ${l.tempo}` : undefined, zona: s.zona });
    } else {
      const pausa = s.pausa ? ` · pausa ${formatMin(s.pausa.minutos)} ${s.pausa.como}` : "";
      if (s.blocos.length === 1) {
        const l = blockLabel(s.blocos[0], zonas, athlete);
        const cada = l.tempo ? ` (${l.tempo} cada)` : "";
        lines.push({ texto: `${s.vezes}× ${l.texto}${cada}${pausa}`, zona: s.blocos[0].zona });
      } else {
        const parts = s.blocos.map((b) => blockLabel(b, zonas, athlete));
        const tempos = parts.map((p) => p.tempo).filter(Boolean);
        lines.push({
          texto: `${s.vezes}× (${parts.map((p) => p.texto).join(" + ")})${pausa}`,
          detalhe: tempos.length === parts.length ? `cada bloco: ${tempos.join(" + ")}` : tempos.length ? `${tempos[0]} correndo em cada bloco` : undefined,
          zona: s.blocos[0].zona,
        });
      }
    }
  }
  if (aq > 0) lines.push({ texto: `${formatDistance(aq)} andando para desaquecer`, detalhe: "Fora do km total", zona: "caminhada" });
  return lines;
}

function formatMin(m: number): string {
  return Number.isInteger(m) ? `${m} min` : `${formatDuration(m * 60)}`;
}

// ---------- modos de semana ----------

const QUALIDADE: Zona[] = ["moderado", "forte", "solto"];

function scaleDist(km: number, f: number): number {
  return Math.max(0.3, round1(km * f));
}

/**
 * Semana leve30 (dor na articulação): −30% de volume e sem tiros (zonas de
 * qualidade viram leve, educativos soltos saem). Semana leve20 (queda de
 * rendimento): −20% de volume, intensidade mantida.
 */
export function applyMode(segmentos: Segmento[], modo: ModoSemana, athlete: AthleteId): Segmento[] {
  if (modo === "normal" || modo === "repetida") return segmentos;
  const f = modo === "leve30" ? 0.7 : 0.8;
  const semTiros = modo === "leve30";
  const easyZoneFor = (): Zona => (athlete === "leticia" ? "corrida" : "leve");
  const out: Segmento[] = [];
  for (const s of segmentos) {
    if (s.tipo === "forca") {
      out.push({ ...s, voltas: Math.max(1, s.voltas - 1) });
    } else if (s.tipo === "caminhada") {
      out.push({ ...s });
    } else if (s.tipo === "corrida") {
      const zona = semTiros && (QUALIDADE.includes(s.zona) || s.zona === "maximo") ? easyZoneFor() : s.zona;
      out.push({ ...s, zona, distancia_km: scaleDist(s.distancia_km, f) });
    } else {
      if (semTiros && s.blocos.every((b) => b.zona === "solto")) continue;
      const blocos = semTiros
        ? s.blocos.map((b) => (QUALIDADE.includes(b.zona) || b.zona === "maximo" ? { ...b, zona: easyZoneFor() } : b))
        : s.blocos;
      out.push({ ...s, blocos, vezes: Math.max(1, Math.round(s.vezes * f)) });
    }
  }
  return out;
}

/**
 * Reduz um treino até `alvoKm` (pico de sessão, 7.4): primeiro encurta os
 * trechos contínuos (o maior primeiro, mínimo 0,5 km), depois tira repetições.
 */
export function reduceToKm(segmentos: Segmento[], alvoKm: number): Segmento[] {
  const out: Segmento[] = segmentos.map((s) => ({ ...s })) as Segmento[];
  let excesso = round1(segmentsKm(out) - alvoKm);
  if (excesso <= 0) return out;

  const corridas = out
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s.tipo === "corrida")
    .sort((a, b) => (b.s as { distancia_km: number }).distancia_km - (a.s as { distancia_km: number }).distancia_km);

  for (const { i } of corridas) {
    if (excesso <= 0) break;
    const seg = out[i] as Extract<Segmento, { tipo: "corrida" }>;
    const podeTirar = Math.max(0, round1(seg.distancia_km - 0.5));
    const tira = Math.min(podeTirar, excesso);
    out[i] = { ...seg, distancia_km: round1(seg.distancia_km - tira) };
    excesso = round1(excesso - tira);
  }
  for (let i = 0; i < out.length && excesso > 0; i++) {
    const seg = out[i];
    if (seg.tipo !== "repeticao") continue;
    const porRep = blocksKm(seg.blocos);
    const tirar = Math.min(seg.vezes - 1, Math.ceil(excesso / porRep));
    out[i] = { ...seg, vezes: seg.vezes - tirar };
    excesso = round1(excesso - tirar * porRep);
  }
  return out;
}

/** Km total para mostrar: o do plano quando nada mudou, senão o recalculado. */
export function displayKm(original: Segmento[], atual: Segmento[], km_total: number | null): number | null {
  if (km_total == null) return null;
  const a = segmentsKm(original);
  const b = segmentsKm(atual);
  if (Math.abs(a - b) < 1e-9) return km_total;
  if (a <= 0) return b;
  return round1(km_total * (b / a));
}
