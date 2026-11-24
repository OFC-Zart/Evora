// Motor de autoajuste (seção 8). Determinístico: recebe o estado e devolve as
// mudanças com um motivo curto em português. Quem grava no banco é o servidor.
//
// Limites gerais:
//  - cada zona muda no máximo 10 s/km por semana (regra e IA somadas);
//  - nunca muda com base num treino só, exceto num teste;
//  - dor na articulação sempre tem prioridade.

import { addDays } from "./dates";
import { formatPace } from "./format";
import { heatAdjustment, heatNormalizedPace } from "./physiology";
import { TIPOS_LEVES, TIPOS_QUALIDADE } from "./plan";
import { logFor, type ScheduledWorkout } from "./schedule";
import { FRACOES, timeForVdot, vdotFromPaceAtFraction, vdotFromRace, zonesFromVdot } from "./vdot";
import type {
  AthleteId,
  Estimate,
  ModoSemana,
  Nivel,
  WorkoutLog,
  ZoneChange,
  ZoneHistory,
  ZonaComPace,
  Zonas,
} from "./types";

export const LIMITE_SEMANAL_S = 10;
export const LIMITE_CALIBRACAO_S = 60;

export interface EngineContext {
  athlete: AthleteId;
  nivel: Nivel;
  fc_max?: number | null;
  zonas: Zonas;
  zonasIniciais: Zonas;
  history: ZoneHistory[];
  logs: WorkoutLog[];
}

// ---------- utilidades ----------

/** Pace do log corrigido para o calor (se houver clima registrado). */
export function normalizedPace(log: WorkoutLog): number | null {
  if (log.pace_s_por_km == null) return null;
  if (log.temp_c == null || log.orvalho_c == null) return log.pace_s_por_km;
  return heatNormalizedPace(log.pace_s_por_km, heatAdjustment(log.temp_c, log.orvalho_c).pct);
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Quanto a zona já mudou nesta semana (regra + IA, sem revertidos). */
export function deltaAlreadyThisWeek(history: ZoneHistory[], zona: ZonaComPace, semana: number): number {
  return history
    .filter(
      (h) =>
        !h.revertido &&
        h.zona === zona &&
        h.semana_calendario === semana &&
        (h.origem === "regra" || h.origem === "ia"),
    )
    .reduce((s, h) => s + (h.depois_s - h.antes_s), 0);
}

/** Aplica o limite de ±10 s/km por semana a um delta desejado. */
export function capDelta(history: ZoneHistory[], zona: ZonaComPace, delta: number, semana: number): number {
  const ja = deltaAlreadyThisWeek(history, zona, semana);
  const max = LIMITE_SEMANAL_S - ja;
  const min = -LIMITE_SEMANAL_S - ja;
  return Math.max(min, Math.min(max, delta));
}

function change(zona: ZonaComPace, antes: number, depois: number, motivo: string, origem: ZoneChange["origem"]): ZoneChange {
  return { zona, antes_s: Math.round(antes), depois_s: Math.round(depois), motivo, origem };
}

const NOME_ZONA: Record<ZonaComPace, string> = {
  regenerativo: "regenerativo",
  leve: "leve",
  moderado: "moderado",
  forte: "forte",
  corrida: "de corrida",
  caminhada: "de caminhada",
};

export function zoneName(z: ZonaComPace) {
  return NOME_ZONA[z];
}

/** Aplica mudanças a um conjunto de zonas (sem mutar). */
export function applyChanges(zonas: Zonas, changes: ZoneChange[]): Zonas {
  const out = { ...zonas };
  for (const c of changes) out[c.zona] = c.depois_s;
  return out;
}

// ---------- 8.1 calibração (fim da semana 1) ----------

export function calibrate(ctx: EngineContext, weekLogs: WorkoutLog[]): ZoneChange[] {
  const runs = weekLogs.filter((l) => l.atividade === "corrida" && l.distancia_km > 0 && l.tempo_s > 0);
  if (runs.length === 0) return [];
  const clamp = (z: ZonaComPace, v: number) => {
    const ini = ctx.zonasIniciais[z] ?? v;
    return Math.round(Math.max(ini - LIMITE_CALIBRACAO_S, Math.min(ini + LIMITE_CALIBRACAO_S, v)));
  };
  const out: ZoneChange[] = [];

  if (ctx.athlete === "danilo") {
    const rpeMedio = mean(runs.map((l) => l.rpe));
    const base = rpeMedio > 6 ? runs : runs.filter((l) => l.rpe <= 6);
    const km = base.reduce((s, l) => s + l.distancia_km, 0);
    // média ponderada pelos km = soma dos (pace × km) ÷ soma dos km
    let leve = base.reduce((s, l) => s + (normalizedPace(l) ?? l.tempo_s / l.distancia_km) * l.distancia_km, 0) / km;
    if (rpeMedio > 6) leve += 15;
    leve = clamp("leve", leve);
    const vdot = vdotFromPaceAtFraction(leve, FRACOES.danilo.leve!);
    const novas = zonesFromVdot(vdot, "danilo");
    novas.leve = leve;
    const extra = rpeMedio > 6 ? " Esforço médio acima de 6, então somei 15 s por segurança." : "";
    for (const z of ["leve", "regenerativo", "moderado", "forte"] as ZonaComPace[]) {
      const antes = ctx.zonas[z]!;
      const depois = clamp(z, novas[z]!);
      if (depois !== antes) {
        out.push(
          change(
            z,
            antes,
            depois,
            z === "leve"
              ? `Calibração da semana 1: seu pace leve foi de ${formatPace(antes)} para ${formatPace(depois)}, média dos seus treinos confortáveis.${extra}`
              : `Calibração da semana 1: pace ${zoneName(z)} recalculado pelo seu novo leve (VDOT ${vdot.toFixed(1).replace(".", ",")}): ${formatPace(antes)} → ${formatPace(depois)}.`,
            "regra",
          ),
        );
      }
    }
    return out;
  }

  // Letícia
  const teste = runs.find((l) => l.tipo_treino === "Teste");
  const caminhadaAntes = ctx.zonas.caminhada!;
  let caminhada = caminhadaAntes;
  if (teste) caminhada = clamp("caminhada", teste.tempo_s / teste.distancia_km);
  const comReps = runs.filter((l) => l.reps && l.reps.length > 0 && l.rep_dist_km);
  let corrida: number;
  let origemCorrida: string;
  if (comReps.length > 0) {
    const paces = comReps.flatMap((l) => (l.reps ?? []).map((r) => r / (l.rep_dist_km as number)));
    corrida = clamp("corrida", mean(paces));
    origemCorrida = "média dos trotes que você anotou";
  } else {
    corrida = clamp("corrida", caminhada * 0.76);
    origemCorrida = "76% do seu pace de caminhada";
  }
  if (caminhada !== caminhadaAntes)
    out.push(change("caminhada", caminhadaAntes, caminhada, `Calibração da semana 1: sua caminhada foi de ${formatPace(caminhadaAntes)} para ${formatPace(caminhada)}, pelo seu teste de terça.`, "regra"));
  const corridaAntes = ctx.zonas.corrida!;
  if (corrida !== corridaAntes)
    out.push(change("corrida", corridaAntes, corrida, `Calibração da semana 1: seu pace de corrida foi de ${formatPace(corridaAntes)} para ${formatPace(corrida)} (${origemCorrida}).`, "regra"));
  return out;
}

// ---------- 8.2 treinos leves ----------

export function easyRule(ctx: EngineContext, weekLogs: WorkoutLog[], semana: number): ZoneChange[] {
  const zona: ZonaComPace = ctx.athlete === "danilo" ? "leve" : "corrida";
  const leves = weekLogs.filter(
    (l) => l.atividade === "corrida" && TIPOS_LEVES.includes(l.tipo_treino) && l.tipo_treino !== "Regenerativo",
  );
  const comAlvo = leves.filter((l) => l.pace_alvo_s != null && l.pace_s_por_km != null);
  if (comAlvo.length < 2) return [];

  const rpe = mean(leves.map((l) => l.rpe));
  const diff = mean(comAlvo.map((l) => (normalizedPace(l) as number) - (l.pace_alvo_s as number)));
  const naoCompletou = leves.some((l) => l.completou !== "sim");
  const fcAlta =
    ctx.fc_max != null && leves.some((l) => l.fc_media != null && l.fc_media > 0.85 * (ctx.fc_max as number));
  const antes = ctx.zonas[zona]!;

  if (rpe >= 7 || fcAlta || naoCompletou) {
    const d = capDelta(ctx.history, zona, 10, semana);
    if (d === 0) return [];
    const porque = naoCompletou
      ? "um treino leve não foi completado"
      : fcAlta
        ? "sua FC média passou de 85% da máxima"
        : `o esforço médio ficou em ${rpe.toFixed(1).replace(".", ",")}`;
    return [change(zona, antes, antes + d, `Seu pace ${zoneName(zona)} foi de ${formatPace(antes)} para ${formatPace(antes + d)}: ${porque}. Mais devagar agora pra evoluir depois.`, "regra")];
  }
  if (rpe <= 4 && diff <= -10) {
    const d = capDelta(ctx.history, zona, -5, semana);
    if (d === 0) return [];
    return [
      change(
        zona,
        antes,
        antes + d,
        `Seu pace ${zoneName(zona)} foi de ${formatPace(antes)} para ${formatPace(antes + d)}: seus treinos leves saíram ${Math.round(-diff)} s/km mais rápidos com esforço baixo (${rpe.toFixed(1).replace(".", ",")}).`,
        "regra",
      ),
    ];
  }
  return [];
}

// ---------- 8.3 treinos de qualidade ----------

function repsOnTarget(l: WorkoutLog): boolean {
  if (l.reps && l.reps.length > 0 && l.rep_alvo_s && l.rep_dist_km) {
    const alvoPace = l.rep_alvo_s / l.rep_dist_km;
    return l.reps.every((r) => r / (l.rep_dist_km as number) <= alvoPace + 5);
  }
  // sem os tempos das repetições, aceita só se o pace médio bater o alvo (conservador)
  return l.pace_alvo_s != null && l.pace_s_por_km != null && (normalizedPace(l) as number) <= l.pace_alvo_s + 5;
}

export function qualityRule(ctx: EngineContext, semana: number, inicioSemana: string, fimSemana: string): ZoneChange[] {
  if (ctx.athlete !== "danilo") return [];
  const desde = addDays(fimSemana, -13);
  const janela = ctx.logs.filter(
    (l) => l.atividade === "corrida" && TIPOS_QUALIDADE.includes(l.tipo_treino) && l.data >= desde && l.data <= fimSemana,
  );
  const temNovo = janela.some((l) => l.data >= inicioSemana);
  if (janela.length < 2 || !temNovo) return [];

  const lentos = janela.filter((l) => l.completou !== "sim" || l.rpe >= 9).length;
  const rapidos = janela.filter((l) => l.completou === "sim" && l.rpe <= 7 && repsOnTarget(l)).length;
  const out: ZoneChange[] = [];

  if (lentos * 2 >= janela.length) {
    for (const z of ["moderado", "forte"] as ZonaComPace[]) {
      const antes = ctx.zonas[z]!;
      const d = capDelta(ctx.history, z, 5, semana);
      if (d !== 0)
        out.push(change(z, antes, antes + d, `Pace ${zoneName(z)} de ${formatPace(antes)} para ${formatPace(antes + d)}: os últimos treinos fortes ficaram pesados demais (não completou ou esforço ≥ 9).`, "regra"));
    }
  } else if (rapidos === janela.length) {
    for (const z of ["moderado", "forte"] as ZonaComPace[]) {
      const antes = ctx.zonas[z]!;
      const d = capDelta(ctx.history, z, -3, semana);
      if (d !== 0)
        out.push(change(z, antes, antes + d, `Pace ${zoneName(z)} de ${formatPace(antes)} para ${formatPace(antes + d)}: você completou os treinos fortes no alvo com esforço ≤ 7.`, "regra"));
    }
  }
  return out;
}

// ---------- 8.4 progressão do volume ----------

export interface VolumeDecision {
  acao: "seguir" | "repetir" | "leve_dor";
  modo: ModoSemana;
  avancar: boolean;
  motivo: string;
  bloqueioDor: boolean;
  feitos: number;
  planejados: number;
  adesao: number;
}

export const AVISO_DOR = "Se a dor continuar por mais de alguns dias, procure um profissional de saúde.";

export function volumeRule(
  athlete: AthleteId,
  semanaPlanejada: ScheduledWorkout[],
  weekLogs: WorkoutLog[],
  bloqueioDorAtual: boolean,
): VolumeDecision {
  const planejados = semanaPlanejada.filter((s) => !s.workout.opcional);
  const feitos = planejados.filter((s) => {
    const l = logFor(s, weekLogs);
    return l && l.completou !== "nao";
  }).length;
  const perdidos = planejados.length - feitos;
  const adesao = planejados.length ? feitos / planejados.length : 1;
  const corridas = weekLogs.filter((l) => l.atividade === "corrida");
  const rpeMedio = corridas.length ? mean(corridas.map((l) => l.rpe)) : 0;
  const dorArt = weekLogs.some((l) => l.dor === "articulacao");
  const semDorDepois = (() => {
    const ultimaDor = weekLogs.filter((l) => l.dor === "articulacao").map((l) => l.data).sort().pop();
    return weekLogs.some((l) => l.dor === "nenhuma" && (!ultimaDor || l.data > ultimaDor));
  })();
  const base = { feitos, planejados: planejados.length, adesao };

  if (dorArt || (bloqueioDorAtual && !semDorDepois)) {
    return {
      ...base,
      acao: "leve_dor",
      modo: "leve30",
      avancar: false,
      bloqueioDor: true,
      motivo: `${dorArt ? "Você marcou dor na articulação" : "Ainda sem um treino com “Dor: nenhuma”"}: a próxima semana fica leve (−30% de volume, sem tiros) e o plano não avança. ${AVISO_DOR}`,
    };
  }
  const naoCompletouLeticia = athlete === "leticia" && weekLogs.some((l) => l.completou === "nao");
  if (perdidos >= 2 || rpeMedio >= 8 || naoCompletouLeticia) {
    const porque =
      perdidos >= 2
        ? `faltaram ${perdidos} treinos`
        : rpeMedio >= 8
          ? `o esforço médio ficou em ${rpeMedio.toFixed(1).replace(".", ",")}`
          : "um treino não foi completado";
    return { ...base, acao: "repetir", modo: "repetida", avancar: false, bloqueioDor: false, motivo: `Repetindo a semana: ${porque}. Repetir é parte do plano, não é falhar.` };
  }
  return {
    ...base,
    acao: "seguir",
    modo: "normal",
    avancar: true,
    bloqueioDor: false,
    motivo: adesao >= 0.8 ? `Semana cumprida (${feitos} de ${planejados.length}). Seguindo o plano.` : `Semana com ${feitos} de ${planejados.length} treinos. Seguindo o plano, mas tenta não pular os próximos.`,
  };
}

// ---------- 8.5 testes ----------

export function isMaxTest(log: WorkoutLog, segmentosTemMaximo: boolean): boolean {
  if (log.tipo_treino !== "Teste" || log.atividade !== "corrida") return false;
  const dist = log.teste_dist_km ?? log.distancia_km;
  return dist >= 3 && (segmentosTemMaximo || log.rpe >= 8);
}

export function testResult(log: WorkoutLog): { dist_km: number; tempo_s: number } {
  if (log.teste_dist_km && log.teste_tempo_s) return { dist_km: log.teste_dist_km, tempo_s: log.teste_tempo_s };
  return { dist_km: log.distancia_km, tempo_s: log.tempo_s };
}

export function testRule(ctx: EngineContext, log: WorkoutLog): { changes: ZoneChange[]; estimate: Estimate } {
  const { dist_km, tempo_s } = testResult(log);
  const vdot = vdotFromRace(dist_km, tempo_s);
  const novas = zonesFromVdot(vdot, ctx.athlete);
  const changes: ZoneChange[] = [];
  for (const [z, depois] of Object.entries(novas) as [ZonaComPace, number][]) {
    const antes = ctx.zonas[z];
    if (antes == null || antes === depois) continue;
    changes.push(change(z, antes, depois, `Teste de ${dist_km.toString().replace(".", ",")} km: VDOT ${vdot.toFixed(1).replace(".", ",")}. Pace ${zoneName(z)} recalculado: ${formatPace(antes)} → ${formatPace(depois)}.`, "teste"));
  }
  return {
    changes,
    estimate: { data: log.data, vdot: round2(vdot), est_5k_s: Math.round(timeForVdot(vdot, 5)), fonte: "teste" },
  };
}

/** Estimativa a partir de um treino contínuo de esforço ≥ 8 (11.1). */
export function estimateFromHardRun(log: WorkoutLog): Estimate | null {
  const continuo = ["Leve", "Longão", "Corrida", "Regenerativo", "Livre", "Teste"].includes(log.tipo_treino);
  if (log.atividade !== "corrida" || log.rpe < 8 || !continuo || log.distancia_km < 3) return null;
  const vdot = vdotFromRace(log.distancia_km, log.tempo_s);
  return { data: log.data, vdot: round2(vdot), est_5k_s: Math.round(timeForVdot(vdot, 5)), fonte: "treino" };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ---------- fechamento da semana ----------

export interface WeekCloseInput {
  ctx: EngineContext;
  semana: number;
  semana_plano: number;
  modo: ModoSemana;
  inicio: string;
  fim: string;
  planejados: ScheduledWorkout[];
  calibrado: boolean;
  bloqueioDor: boolean;
}

export interface WeekCloseResult {
  changes: ZoneChange[];
  decisao: VolumeDecision;
  proxima: { semana_plano: number; modo: ModoSemana; motivo: string };
  calibrou: boolean;
  resumo: {
    feitos: number;
    planejados: number;
    adesao: number;
    km_feitos: number;
    km_planejados: number;
    rpe_medio: number | null;
    carga: number;
    dor: boolean;
  };
}

export function closeWeek(input: WeekCloseInput): WeekCloseResult {
  const { ctx, semana, inicio, fim, planejados } = input;
  const weekLogs = ctx.logs.filter((l) => l.data >= inicio && l.data <= fim);
  let changes: ZoneChange[] = [];
  let calibrou = false;

  if (!input.calibrado && input.semana_plano === 1) {
    changes = calibrate(ctx, weekLogs);
    calibrou = weekLogs.some((l) => l.atividade === "corrida");
  } else {
    const easy = easyRule(ctx, weekLogs, semana);
    const quality = qualityRule(ctx, semana, inicio, fim);
    changes = [...easy, ...quality];
  }

  const decisao = volumeRule(ctx.athlete, planejados, weekLogs, input.bloqueioDor);
  const proxima = {
    semana_plano: decisao.avancar ? input.semana_plano + 1 : input.semana_plano,
    modo: decisao.modo,
    motivo: decisao.motivo,
  };

  const corridas = weekLogs.filter((l) => l.atividade === "corrida");
  return {
    changes,
    decisao,
    proxima,
    calibrou,
    resumo: {
      feitos: decisao.feitos,
      planejados: decisao.planejados,
      adesao: decisao.adesao,
      km_feitos: Math.round(corridas.reduce((s, l) => s + l.distancia_km, 0) * 10) / 10,
      km_planejados: Math.round(planejados.filter((p) => !p.workout.opcional).reduce((s, p) => s + (p.km ?? 0), 0) * 10) / 10,
      rpe_medio: corridas.length ? Math.round(mean(corridas.map((l) => l.rpe)) * 10) / 10 : null,
      carga: weekLogs.reduce((s, l) => s + Math.round(l.rpe * (l.tempo_s / 60)), 0),
      dor: weekLogs.some((l) => l.dor === "articulacao"),
    },
  };
}

// ---------- sugestões da IA (9) ----------

export interface AiSuggestion {
  zona: string;
  delta_s: number;
  motivo: string;
}

/** Limita as sugestões da IA às mesmas regras do motor. */
export function clampAiSuggestions(ctx: EngineContext, sugestoes: AiSuggestion[], semana: number): ZoneChange[] {
  const out: ZoneChange[] = [];
  const hist = [...ctx.history];
  for (const s of sugestoes) {
    const zona = s.zona as ZonaComPace;
    const antes = ctx.zonas[zona];
    if (antes == null || !Number.isFinite(s.delta_s)) continue;
    const d = capDelta(hist, zona, Math.round(s.delta_s), semana);
    if (d === 0) continue;
    const c = change(zona, antes, antes + d, `Sugestão do coach: ${s.motivo}`.slice(0, 280), "ia");
    out.push(c);
    hist.push({ ...c, athlete_id: ctx.athlete, created_at: "", revertido: false, semana_calendario: semana });
  }
  return out;
}
