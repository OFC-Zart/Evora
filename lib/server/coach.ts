import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  acwr,
  addDays,
  detectDecline,
  easyFraction,
  formatPace,
  workoutsOfCalendarWeek,
  type WeekCloseResult,
  type ZoneChange,
} from "@/lib/engine";
import { adherence } from "@/lib/engine/ranking";
import type { AthleteState } from "./state";

// ---------------------------------------------------------------------------
// Mensagens por regras (o app funciona 100% sem chave de IA)
// ---------------------------------------------------------------------------

export function templateWeekMessage(s: AthleteState, r: WeekCloseResult, changes: ZoneChange[]): { texto: string; dicas: string[] } {
  const nome = s.profile.nome.split(" ")[0];
  const pct = Math.round(r.resumo.adesao * 100);
  const partes: string[] = [];
  if (r.decisao.acao === "leve_dor") {
    partes.push(`${nome}, você marcou dor na articulação. Semana que vem fica leve e o plano espera você.`);
  } else if (r.decisao.acao === "repetir") {
    partes.push(`${nome}, semana com ${r.resumo.feitos} de ${r.resumo.planejados} treinos (${pct}%). Vamos repetir a semana pra consolidar.`);
  } else if (pct >= 80) {
    partes.push(`Boa, ${nome}! ${r.resumo.feitos} de ${r.resumo.planejados} treinos e ${r.resumo.km_feitos.toString().replace(".", ",")} km. Segue o plano.`);
  } else {
    partes.push(`${nome}, ${r.resumo.feitos} de ${r.resumo.planejados} treinos nesta semana. Segue o plano, mas tenta não pular os próximos.`);
  }
  if (changes.length) {
    partes.push(
      changes
        .map((c) => `${c.zona} ${formatPace(c.antes_s)} → ${formatPace(c.depois_s)}`)
        .join(", ")
        .replace(/^./, (x) => x.toUpperCase()) + ".",
    );
  } else if (r.calibrou === false) {
    partes.push("Paces mantidos: os dados da semana não pediram mudança.");
  }
  const dicas = weeklyTips(s);
  return { texto: partes.join(" ").slice(0, 600), dicas };
}

function weeklyTips(s: AthleteState): string[] {
  const dicas: string[] = [];
  const f = easyFraction(s.logs, s.hoje, segmentsLookup(s), s.zonas);
  if (f != null && f < 0.7) dicas.push(`Só ${Math.round(f * 100)}% do seu tempo foi leve. A meta é perto de 80%: segura o pace nos leves.`);
  const d = detectDecline(s.logs, s.hoje);
  if (d.ativo) dicas.push(d.acao);
  const a = acwr(s.logs, s.hoje).acwr;
  if (a != null && a > 1.3) dicas.push("Sua carga subiu rápido: capricha no sono e não dobre treino perdido.");
  if (s.athlete === "leticia") dicas.push("Andar faz parte do treino. Correr devagar é o certo nesta fase.");
  if (dicas.length === 0) dicas.push("Consistência ganha de intensidade. Continua assim!");
  return dicas.slice(0, 3);
}

export function segmentsLookup(s: AthleteState) {
  const map = new Map(s.plan.map((w) => [w.id, w.segmentos]));
  return (id: string) => map.get(id) ?? null;
}

// ---------------------------------------------------------------------------
// Coach de IA (opcional, só no servidor)
// ---------------------------------------------------------------------------

export const CoachSchema = z.object({
  mensagem: z.string().max(600),
  dicas: z.array(z.string().max(200)).max(3),
  sugestoes: z
    .array(
      z.object({
        zona: z.enum(["regenerativo", "leve", "moderado", "forte", "corrida", "caminhada"]),
        delta_s: z.number().int().min(-10).max(10),
        motivo: z.string().max(200),
      }),
    )
    .max(4),
  repetir_semana: z.boolean(),
});

export type CoachOutput = z.infer<typeof CoachSchema>;

export function isAiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `Você é o coach de corrida do app Evora, para dois atletas amadores (Danilo, intermediário, e Letícia, iniciante que estava sedentária).
Escreva em português do Brasil, com tom de treinador amigo, frases curtas e diretas. Paces sempre como "6:45/km", tempos como "27:00".
Você recebe as zonas atuais, metas, os registros das últimas 4 semanas, o plano da próxima semana, métricas (adesão, ACWR, 80/20, alertas) e as regras do motor.
Regras que você deve respeitar nas sugestões:
- cada zona muda no máximo 10 s/km por semana; nunca sugira mudança baseada num treino só;
- dor na articulação tem prioridade: recomende descanso e procurar um profissional de saúde; não dê diagnóstico médico;
- treinos leves devem ser leves (meta de ~80% do tempo em baixa intensidade);
- só sugira repetir a semana se faltaram 2+ treinos, o esforço médio foi ≥ 8, ou houve dor.
As sugestões são só sugestões: o atleta decide se aplica. Se nada precisa mudar, devolva "sugestoes" vazio.
"mensagem" tem no máximo 600 caracteres; "dicas" no máximo 3 itens.`;

export function buildCoachContext(s: AthleteState) {
  const desde = addDays(s.hoje, -27);
  const registros = s.logs
    .filter((l) => l.data >= desde)
    .map((l) => ({
      data: l.data,
      tipo: l.tipo_treino,
      atividade: l.atividade,
      km: l.distancia_km,
      tempo_s: l.tempo_s,
      pace: l.pace_s_por_km ? formatPace(l.pace_s_por_km) : null,
      pace_alvo: l.pace_alvo_s ? formatPace(l.pace_alvo_s) : null,
      esforco: l.rpe,
      completou: l.completou,
      dor: l.dor,
      fc_media: l.fc_media ?? null,
      calor_c: l.temp_c ?? null,
      orvalho_c: l.orvalho_c ?? null,
    }));
  const proxima = workoutsOfCalendarWeek(s.plan, s.schedule, s.semanaAtual + 1, s.profile.plan_inicio, s.athlete, s.overrides).map((w) => ({
    dia: w.workout.dia,
    tipo: w.workout.tipo,
    km: w.km,
    modo: w.modo,
  }));
  const ad = adherence(
    {
      athlete: s.athlete,
      nome: s.profile.nome,
      plan: s.plan,
      schedule: s.schedule,
      plan_inicio: s.profile.plan_inicio,
      logs: s.logs,
      estimates: s.estimates,
      adesaoSemanas: [],
      alertaQueda: false,
      easyFraction: null,
      melhoraZonaPct: null,
    },
    s.hoje,
  );
  return {
    atleta: { nome: s.profile.nome, nivel: s.profile.nivel, peso_kg: s.profile.peso_kg, altura_m: s.profile.altura_m, fc_max: s.profile.fc_max },
    hoje: s.hoje,
    semana_do_calendario: s.semanaAtual,
    zonas_atuais: Object.fromEntries(Object.entries(s.zonas).map(([z, v]) => [z, formatPace(v)])),
    metas: s.goals.filter((g) => g.status === "ativa"),
    registros_4_semanas: registros,
    plano_proxima_semana: proxima,
    metricas: {
      adesao_14_dias: ad.adesao,
      acwr: acwr(s.logs, s.hoje).acwr,
      fracao_leve_80_20: easyFraction(s.logs, s.hoje, segmentsLookup(s), s.zonas),
      alertas: detectDecline(s.logs, s.hoje).motivos,
    },
  };
}

export async function generateAiCoach(s: AthleteState): Promise<CoachOutput | null> {
  if (!isAiEnabled()) return null;
  const client = new Anthropic();
  const contexto = buildCoachContext(s);
  try {
    const response = await client.beta.messages.parse(
      {
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 4000,
        // se a IA recusar, a API tenta outro modelo na mesma chamada
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        output_config: { effort: "low", format: betaZodOutputFormat(CoachSchema) },
        messages: [
          {
            role: "user",
            content: `Analise a semana e responda no formato pedido.\n\n${JSON.stringify(contexto)}`,
          },
        ],
      },
      { timeout: 45_000 },
    );
    if (response.stop_reason === "refusal" || !response.parsed_output) return null;
    return CoachSchema.parse(response.parsed_output);
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error("coach IA:", err.status, err.message);
    else console.error("coach IA:", err);
    return null;
  }
}

/** Análise por regras da semana em andamento (sem chave de IA). */
export function ruleAnalysis(s: AthleteState): { texto: string; dicas: string[] } {
  const nome = s.profile.nome.split(" ")[0];
  const semana = workoutsOfCalendarWeek(s.plan, s.schedule, s.semanaAtual, s.profile.plan_inicio, s.athlete, s.overrides).filter(
    (w) => !w.workout.opcional,
  );
  const ate = semana.filter((w) => w.data <= s.hoje);
  const feitos = ate.filter((w) => s.logs.some((l) => l.plan_workout_id === w.workout.id && l.semana_calendario === w.semana_calendario && l.completou !== "nao")).length;
  const faltam = semana.filter((w) => w.data > s.hoje).length;
  const recentes = s.logs.filter((l) => l.atividade === "corrida" && l.data > addDays(s.hoje, -7));
  const rpe = recentes.length ? recentes.reduce((a, l) => a + l.rpe, 0) / recentes.length : null;
  const partes = [
    ate.length
      ? `${nome}, até agora ${feitos} de ${ate.length} treinos desta semana${faltam ? ` e faltam ${faltam}` : ""}.`
      : `${nome}, a semana está começando: ${faltam} treinos pela frente.`,
  ];
  if (rpe != null) partes.push(`Esforço médio dos últimos 7 dias: ${rpe.toFixed(1).replace(".", ",")}.`);
  if (rpe != null && rpe >= 7) partes.push("Está puxado: os leves precisam ser leves de verdade.");
  else if (rpe != null && rpe <= 4) partes.push("Esforço confortável: ótimo sinal de adaptação.");
  return { texto: partes.join(" ").slice(0, 600), dicas: weeklyTips(s) };
}
