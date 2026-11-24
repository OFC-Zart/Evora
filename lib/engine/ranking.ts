// Ranking global (11.3). Compara métricas relativas (adesão e % de melhora),
// nunca pace bruto contra pace bruto, porque os níveis são diferentes.

import { addDays, dayKey, mondayOf } from "./dates";
import { acwr, ACWR_FAIXA } from "./load";
import { logFor, plannedBetween } from "./schedule";
import type { AthleteId, Estimate, PlanWorkout, ScheduleWeek, WorkoutLog } from "./types";

export type StatusRanking = "Mandando bem" | "No caminho" | "Atenção";

export interface RankingInput {
  athlete: AthleteId;
  nome: string;
  plan: PlanWorkout[];
  schedule: ScheduleWeek[];
  plan_inicio: string;
  logs: WorkoutLog[];
  estimates: Estimate[];
  /** Adesão de cada semana já fechada, em ordem (1ª semana primeiro). */
  adesaoSemanas: number[];
  alertaQueda: boolean;
  easyFraction: number | null;
  /** Melhora do pace da zona principal desde o começo (% , fallback da evolução). */
  melhoraZonaPct: number | null;
}

export interface RankingCard {
  athlete: AthleteId;
  nome: string;
  status: StatusRanking;
  adesao14: number | null;
  feitos14: number;
  planejados14: number;
  kmSemana: number;
  evolucaoPct: number | null;
  sequencia: number;
  acwr: number | null;
  dicas: string[];
}

export function adherence(input: RankingInput, hoje: string, dias = 14) {
  const from = addDays(hoje, -(dias - 1));
  const planejados = plannedBetween(input.plan, input.schedule, from, hoje, input.plan_inicio, input.athlete);
  // treino de hoje ainda não registrado não conta como perdido
  const considerados = planejados.filter((p) => p.data < hoje || logFor(p, input.logs));
  const feitos = considerados.filter((p) => {
    const l = logFor(p, input.logs);
    return l && l.completou !== "nao";
  }).length;
  return {
    feitos,
    planejados: considerados.length,
    adesao: considerados.length ? feitos / considerados.length : null,
    perdidos: considerados.filter((p) => !logFor(p, input.logs)),
  };
}

export function evolution(estimates: Estimate[]): number | null {
  if (estimates.length < 2) return null;
  const ord = [...estimates].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  const first = ord[0].est_5k_s;
  const last = ord[ord.length - 1].est_5k_s;
  return Math.round(((first - last) / first) * 1000) / 10;
}

export function streak(adesaoSemanas: number[]): number {
  let n = 0;
  for (let i = adesaoSemanas.length - 1; i >= 0; i--) {
    if (adesaoSemanas[i] >= 0.8) n++;
    else break;
  }
  return n;
}

export function rankingCard(input: RankingInput, hoje: string): RankingCard {
  const ad = adherence(input, hoje);
  const segunda = mondayOf(hoje);
  const kmSemana =
    Math.round(
      input.logs
        .filter((l) => l.atividade === "corrida" && l.data >= segunda && l.data <= hoje)
        .reduce((s, l) => s + l.distancia_km, 0) * 10,
    ) / 10;
  const evo = evolution(input.estimates) ?? input.melhoraZonaPct;
  const a = acwr(input.logs, hoje).acwr;

  let status: StatusRanking;
  const atencao = (ad.adesao != null && ad.adesao < 0.6) || input.alertaQueda || (a != null && a > ACWR_FAIXA.alerta);
  if (atencao) status = "Atenção";
  else if ((ad.adesao ?? 1) >= 0.85 && (evo ?? 0) >= 0) status = "Mandando bem";
  else status = "No caminho";

  return {
    athlete: input.athlete,
    nome: input.nome,
    status,
    adesao14: ad.adesao,
    feitos14: ad.feitos,
    planejados14: ad.planejados,
    kmSemana,
    evolucaoPct: evo,
    sequencia: streak(input.adesaoSemanas),
    acwr: a,
    dicas: improvementTips(input, hoje, ad.perdidos.map((p) => p.workout.tipo), a),
  };
}

/** Escolhe as 1 ou 2 dicas mais relevantes. */
export function improvementTips(
  input: RankingInput,
  hoje: string,
  tiposPerdidos: string[],
  acwrAtual: number | null,
): string[] {
  const candidatas: { peso: number; texto: string }[] = [];
  const leves = tiposPerdidos.filter((t) => ["Leve", "Longão", "Regenerativo", "Corre/anda", "Corrida"].includes(t)).length;
  if (leves > 0) candidatas.push({ peso: 5 + leves, texto: leves > 1 ? `Faltaram ${leves} treinos leves` : "Faltou um treino leve" });
  const forca = tiposPerdidos.filter((t) => t === "Força").length;
  if (forca > 0) candidatas.push({ peso: 3 + forca, texto: "Faltou a força: ela protege das lesões" });

  if (input.easyFraction != null && input.easyFraction < 0.7) {
    candidatas.push({ peso: 8, texto: `Leves rápidos demais: 80/20 em ${Math.round(input.easyFraction * 100)}%` });
  }

  const recentes = input.logs.filter((l) => l.data > addDays(hoje, -14));
  const tiros = recentes.filter((l) => ["Tiros", "Ritmo", "Fartlek"].includes(l.tipo_treino));
  if (tiros.length && tiros.reduce((s, l) => s + l.rpe, 0) / tiros.length >= 8.5) {
    candidatas.push({ peso: 6, texto: "Esforço alto nos tiros: segura o pace" });
  }

  if (input.athlete === "danilo") {
    // quartas sem futebol registrado nas últimas 2 semanas
    let quartas = 0;
    let comFutebol = 0;
    for (let d = 0; d < 14; d++) {
      const dia = addDays(hoje, -d);
      if (dia < input.plan_inicio) continue;
      if (dayKey(dia) === "qua" && dia < hoje) {
        quartas++;
        if (input.logs.some((l) => l.data === dia && l.atividade === "futebol")) comFutebol++;
      }
    }
    if (quartas > 0 && comFutebol < quartas) candidatas.push({ peso: 4, texto: "Faltou registrar o futebol" });
  }

  if (acwrAtual != null && acwrAtual > ACWR_FAIXA.alerta) candidatas.push({ peso: 9, texto: "Carga subiu rápido: segura o volume" });
  if (input.alertaQueda) candidatas.push({ peso: 7, texto: "Sinais de cansaço: prioriza sono e descanso" });

  if (candidatas.length === 0) {
    const semRegistroFc = recentes.filter((l) => l.atividade === "corrida" && l.fc_media == null).length;
    if (semRegistroFc >= 2) candidatas.push({ peso: 1, texto: "Anota a FC média: ajuda a ajustar melhor" });
    else candidatas.push({ peso: 0, texto: "Continua assim: consistência é o que mais importa" });
  }
  return candidatas
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 2)
    .map((c) => c.texto);
}
