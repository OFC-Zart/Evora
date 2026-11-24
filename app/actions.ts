"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  addDays,
  calendarWeekOf,
  clampAiSuggestions,
  estimateFromHardRun,
  formatPace,
  heatAdjustment,
  heatNormalizedPace,
  isMaxTest,
  isRunType,
  paceFromTime,
  plannedAvgPace,
  plannedBetween,
  reduceToKm,
  repTarget,
  resolveWorkout,
  segmentsKm,
  sessionLoad,
  sessionSpike,
  testRule,
  type Segmento,
  type TipoTreino,
  type WorkoutLog,
  type ZoneChange,
} from "@/lib/engine";
import { createClient } from "@/lib/supabase/server";
import { engineContext, loadState, type AthleteState } from "@/lib/server/state";
import { applyZoneChanges, ensureWeeksClosed } from "@/lib/server/weeks";
import { fetchWeather } from "@/lib/server/weather";
import { sendPushToAthlete } from "@/lib/server/push";

type Result<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

async function requireState(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; s: AthleteState }> {
  const supabase = await createClient();
  const s = await loadState(supabase);
  if (!s) throw new Error("Perfil não encontrado. Peça para ligar sua conta ao atleta (link_athlete).");
  return { supabase, s };
}

function revalidateAll() {
  for (const p of ["/hoje", "/plano", "/ritmos", "/perfil", "/ranking", "/agenda"]) revalidatePath(p);
}

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ---------------------------------------------------------------------------
// Começar o plano: só a partir do toque em "Começar" os dias passam a contar
// ---------------------------------------------------------------------------

export async function comecarPlano(): Promise<Result> {
  const { supabase, s } = await requireState();
  if (s.planoIniciado) return { ok: false, erro: "Seu plano já começou." };
  const { error } = await supabase.from("profiles").update({ plan_inicio: s.hoje, calibrado: false, bloqueio_dor: false }).eq("athlete_id", s.athlete);
  if (error) return { ok: false, erro: "Não deu pra começar agora. Tenta de novo." };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Registrar treino + autoajuste
// ---------------------------------------------------------------------------

const LogSchema = z.object({
  plan_workout_id: z.string().max(40).nullish(),
  semana_calendario: z.number().int().min(1).max(60).nullish(),
  atividade: z.enum(["corrida", "futebol", "forca", "outro"]),
  data: dataISO,
  hora: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  distancia_km: z.number().min(0).max(100),
  tempo_s: z.number().int().min(1).max(86399),
  pace_s_por_km: z.number().min(120).max(1800).nullish(),
  fc_media: z.number().int().min(40).max(230).nullish(),
  fc_max: z.number().int().min(40).max(240).nullish(),
  rpe: z.number().int().min(0).max(10),
  completou: z.enum(["sim", "parcial", "nao"]),
  dor: z.enum(["nenhuma", "muscular", "articulacao"]),
  reps: z.array(z.number().min(1).max(3600)).max(30).nullish(),
  notas: z.string().max(1000).nullish(),
  teste_dist_km: z.number().min(0.5).max(50).nullish(),
  teste_tempo_s: z.number().int().min(60).max(86399).nullish(),
  temp_c: z.number().min(-10).max(50).nullish(),
  orvalho_c: z.number().min(-20).max(40).nullish(),
});

export type LogInput = z.infer<typeof LogSchema>;

export interface AdjustFeedback {
  logId: string;
  tipo: TipoTreino;
  pace_s: number | null;
  alvo_s: number | null;
  /** + = mais lento que o alvo (já corrigido pelo calor) */
  diff_s: number | null;
  calor: { pct: number; temp_c: number; orvalho_c: number } | null;
  carga: number;
  kcal: number | null;
  changes: ZoneChange[];
  teste: { vdot: number; est_5k_s: number } | null;
  semanaFechada: { semana: number; feitos: number; planejados: number; motivo: string; proxima: string } | null;
  pico: { workoutId: string; semana: number; data: string; tipo: string; planejado_km: number; limite_km: number; maior_km: number } | null;
  notas: string[];
}

export async function logWorkout(input: LogInput): Promise<Result<{ feedback: AdjustFeedback }>> {
  const parsed = LogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Confere os campos: " + parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  const v = parsed.data;
  const { supabase, s } = await requireState();

  // treino planejado (com modo da semana e override aplicados)
  const pw = v.plan_workout_id ? s.plan.find((w) => w.id === v.plan_workout_id) : undefined;
  const semana = v.semana_calendario ?? calendarWeekOf(s.profile.plan_inicio, v.data);
  const week = s.schedule.find((w) => w.semana_calendario === semana);
  const sw = pw && week ? resolveWorkout(pw, week, s.profile.plan_inicio, s.athlete, s.overrides) : null;
  const segs: Segmento[] | null = sw?.segmentos ?? pw?.segmentos ?? null;

  const tipo: TipoTreino = pw ? pw.tipo : v.atividade === "futebol" ? "Futebol" : v.atividade === "forca" ? "Força" : "Livre";
  const corrida = v.atividade === "corrida" && isRunType(tipo);
  const pace = corrida ? (v.pace_s_por_km ?? paceFromTime(v.tempo_s, v.distancia_km)) : null;
  const alvo = corrida && segs ? plannedAvgPace(segs, s.zonas, s.athlete) : null;
  const rep = corrida && segs ? repTarget(segs, s.zonas) : null;

  // clima (Open-Meteo) para corrigir o pace pelo calor
  let temp = v.temp_c ?? null;
  let orvalho = v.orvalho_c ?? null;
  if (corrida && (temp == null || orvalho == null) && s.profile.lat != null && s.profile.lon != null) {
    const w = await fetchWeather(Number(s.profile.lat), Number(s.profile.lon), v.data, v.hora ?? s.profile.hora_treino ?? "07:00");
    if (w) {
      temp = w.temp_c;
      orvalho = w.orvalho_c;
    }
  }

  const row = {
    athlete_id: s.athlete,
    plan_workout_id: pw?.id ?? null,
    semana_calendario: pw ? semana : null,
    tipo_treino: tipo,
    data: v.data,
    hora: v.hora ?? null,
    distancia_km: v.atividade === "corrida" ? v.distancia_km : 0,
    tempo_s: v.tempo_s,
    pace_s_por_km: pace ? Math.round(pace * 100) / 100 : null,
    pace_alvo_s: alvo ? Math.round(alvo * 100) / 100 : null,
    rep_alvo_s: rep ? Math.round(rep.alvo_s * 100) / 100 : null,
    rep_dist_km: rep?.dist_km ?? null,
    fc_media: v.fc_media ?? null,
    fc_max: v.fc_max ?? null,
    rpe: v.rpe,
    completou: v.completou,
    dor: v.dor,
    reps: v.reps?.length ? v.reps : null,
    notas: v.notas?.trim() || null,
    atividade: v.atividade,
    teste_dist_km: v.teste_dist_km ?? null,
    teste_tempo_s: v.teste_tempo_s ?? null,
    temp_c: temp,
    orvalho_c: orvalho,
  };
  const { data: inserted, error } = await supabase.from("workout_logs").insert(row).select().single();
  if (error || !inserted) return { ok: false, erro: `Não deu pra salvar: ${error?.message ?? "erro desconhecido"}` };
  const log = { ...(inserted as WorkoutLog), distancia_km: Number(inserted.distancia_km) };
  s.logs.push(log);

  const notas: string[] = [];
  const calor = temp != null && orvalho != null ? { ...heatAdjustment(temp, orvalho), temp_c: temp, orvalho_c: orvalho } : null;
  const paceNorm = pace != null && calor ? heatNormalizedPace(pace, calor.pct) : pace;
  const diff = paceNorm != null && alvo != null ? Math.round(paceNorm - alvo) : null;
  if (calor && calor.pct >= 1) notas.push(`Calor de ${String(temp).replace(".", ",")}°C (orvalho ${String(orvalho).replace(".", ",")}°C): o motor considerou ${String(calor.pct).replace(".", ",")}% a mais no pace.`);
  if (v.dor === "articulacao") notas.push("Dor na articulação: para e descansa. Se continuar por mais de alguns dias, procure um profissional de saúde.");

  // 8.5 teste no máximo → recalcula todas as zonas
  let changes: ZoneChange[] = [];
  let teste: AdjustFeedback["teste"] = null;
  const temMaximo = !!segs?.some((x) => x.tipo === "corrida" && x.zona === "maximo");
  if (corrida && isMaxTest(log, temMaximo)) {
    const r = testRule(engineContext(s), log);
    changes = r.changes;
    await applyZoneChanges(supabase, s, changes, semana);
    await supabase.from("estimates").insert({ athlete_id: s.athlete, ...r.estimate });
    s.estimates.push(r.estimate);
    teste = { vdot: r.estimate.vdot, est_5k_s: r.estimate.est_5k_s };
  } else if (corrida) {
    const e = estimateFromHardRun(log);
    if (e) {
      await supabase.from("estimates").insert({ athlete_id: s.athlete, ...e });
      s.estimates.push(e);
    }
  }

  // fechamento da semana (se este foi o último treino planejado)
  const fechadas = await ensureWeeksClosed(supabase, s, { push: false });
  const ultima = fechadas.at(-1);
  if (ultima) changes = [...changes, ...ultima.result.changes];

  if (corrida && !teste && !ultima) {
    notas.push("Os paces mudam no fechamento da semana, com pelo menos 2 treinos (nunca com um treino só).");
  }

  // pico de sessão para o próximo treino de corrida (7 dias)
  let pico: AdjustFeedback["pico"] = null;
  const proximos = plannedBetween(s.plan, s.schedule, addDays(v.data, 1), addDays(v.data, 7), s.profile.plan_inicio, s.athlete).filter(
    (p) => isRunType(p.workout.tipo) && (p.km ?? 0) > 0 && !s.overrides.some((o) => o.plan_workout_id === p.workout.id && o.semana_calendario === p.semana_calendario),
  );
  for (const p of proximos) {
    const sp = sessionSpike(s.logs, p.data, p.km ?? segmentsKm(p.segmentos));
    if (sp?.passa) {
      pico = { workoutId: p.workout.id, semana: p.semana_calendario, data: p.data, tipo: p.workout.tipo, planejado_km: sp.planejado_km, limite_km: sp.limite_km, maior_km: sp.maior_km };
      break;
    }
  }

  if (changes.length && s.profile.notif_ajustes) {
    await sendPushToAthlete(supabase, s.athlete, {
      title: "Seu pace foi ajustado",
      body: changes.map((c) => `${c.zona}: ${formatPace(c.antes_s)} → ${formatPace(c.depois_s)}`).join(" · "),
      url: "/ritmos",
      tag: "ajuste",
    });
  }

  revalidateAll();
  const kcal = s.profile.peso_kg
    ? Math.round(
        v.atividade === "futebol"
          ? 7 * Number(s.profile.peso_kg) * (v.tempo_s / 3600)
          : v.atividade === "forca"
            ? 3.5 * Number(s.profile.peso_kg) * (v.tempo_s / 3600)
            : Number(s.profile.peso_kg) * v.distancia_km,
      )
    : null;

  return {
    ok: true,
    feedback: {
      logId: log.id,
      tipo,
      pace_s: pace,
      alvo_s: alvo,
      diff_s: diff,
      calor: calor ? { pct: calor.pct, temp_c: calor.temp_c, orvalho_c: calor.orvalho_c } : null,
      carga: sessionLoad(v.rpe, v.tempo_s),
      kcal,
      changes,
      teste,
      semanaFechada: ultima
        ? {
            semana: ultima.semana,
            feitos: ultima.result.resumo.feitos,
            planejados: ultima.result.resumo.planejados,
            motivo: ultima.result.decisao.motivo,
            proxima: ultima.result.proxima.semana_plano > 8 ? "Plano concluído!" : `Próxima: semana ${ultima.result.proxima.semana_plano} do plano${ultima.result.proxima.modo === "leve30" ? " (leve)" : ultima.result.proxima.modo === "repetida" ? " (repetição)" : ""}`,
          }
        : null,
      pico,
      notas,
    },
  };
}

export async function deleteLog(id: string): Promise<Result> {
  const { supabase, s } = await requireState();
  const log = s.logs.find((l) => l.id === id);
  if (!log) return { ok: false, erro: "Registro não encontrado." };
  if (log.semana_calendario && s.closures.some((c) => c.semana_calendario === log.semana_calendario)) {
    return { ok: false, erro: "Essa semana já foi fechada. Não dá pra apagar." };
  }
  await supabase.from("workout_logs").delete().eq("id", id);
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Desfazer o último ajuste (8.7)
// ---------------------------------------------------------------------------

export async function undoLastAdjustment(): Promise<Result<{ desfeitos: number }>> {
  const { supabase, s } = await requireState();
  const ativos = s.history.filter((h) => !h.revertido);
  const ultimo = ativos.at(-1);
  if (!ultimo) return { ok: false, erro: "Nenhum ajuste para desfazer." };
  // um ajuste pode ter várias zonas (calibração, teste): desfaz o lote inteiro
  const lote = ativos.filter((h) => h.created_at === ultimo.created_at);
  for (const h of [...lote].reverse()) {
    await supabase.from("zone_history").update({ revertido: true }).eq("id", h.id!);
    await supabase.from("zones").upsert({ athlete_id: s.athlete, zona: h.zona, pace_s_por_km: h.antes_s, updated_at: new Date().toISOString() });
  }
  revalidateAll();
  return { ok: true, desfeitos: lote.length };
}

// ---------------------------------------------------------------------------
// Pico de sessão e semana leve
// ---------------------------------------------------------------------------

export async function applySpikeReduction(workoutId: string, semana: number, alvoKm: number): Promise<Result> {
  const { supabase, s } = await requireState();
  const pw = s.plan.find((w) => w.id === workoutId);
  const week = s.schedule.find((w) => w.semana_calendario === semana);
  if (!pw || !week) return { ok: false, erro: "Treino não encontrado." };
  const sw = resolveWorkout(pw, week, s.profile.plan_inicio, s.athlete, s.overrides);
  const segmentos = reduceToKm(sw.segmentos, alvoKm);
  const { error } = await supabase.from("plan_overrides").upsert(
    {
      athlete_id: s.athlete,
      plan_workout_id: workoutId,
      semana_calendario: semana,
      segmentos,
      motivo: `Pico de sessão: reduzido para ${String(alvoKm).replace(".", ",")} km (até 10% acima do seu maior treino dos últimos 30 dias).`,
    },
    { onConflict: "athlete_id,plan_workout_id,semana_calendario" },
  );
  if (error) return { ok: false, erro: error.message };
  revalidateAll();
  return { ok: true };
}

export async function applyLightWeek(): Promise<Result> {
  const { supabase, s } = await requireState();
  const prox = s.semanaAtual + 1;
  const row = s.schedule.find((w) => w.semana_calendario === prox);
  if (!row) return { ok: false, erro: "Não há próxima semana no plano." };
  const { error } = await supabase
    .from("plan_schedule")
    .update({ modo: "leve20", motivo: "Queda de rendimento: semana leve (−20% do volume) e prioridade para sono e descanso." })
    .eq("athlete_id", s.athlete)
    .eq("semana_calendario", prox);
  if (error) return { ok: false, erro: error.message };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------

const GoalSchema = z.object({
  distancia_km: z.number().min(0.4).max(50),
  tempo_alvo_s: z.number().int().min(60).max(36000).nullable(),
  prazo: dataISO.nullable(),
});

export async function saveGoal(input: z.infer<typeof GoalSchema>): Promise<Result> {
  const v = GoalSchema.safeParse(input);
  if (!v.success) return { ok: false, erro: "Meta inválida." };
  const { supabase, s } = await requireState();
  await supabase.from("goals").update({ status: "arquivada" }).eq("athlete_id", s.athlete).eq("status", "ativa");
  const { error } = await supabase.from("goals").insert({ athlete_id: s.athlete, ...v.data, status: "ativa" });
  if (error) return { ok: false, erro: error.message };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

const RunSchema = z.object({
  data: dataISO,
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  local: z.string().max(200).nullish(),
  plan_workout_id: z.string().max(40).nullish(),
  lembrete: z.enum(["na_hora", "30", "60", "vespera"]),
});

export async function scheduleRun(input: z.infer<typeof RunSchema>): Promise<Result> {
  const v = RunSchema.safeParse(input);
  if (!v.success) return { ok: false, erro: "Confere data, hora e lembrete." };
  const { supabase, s } = await requireState();
  const inicio = new Date(`${v.data.data}T${v.data.hora}:00-03:00`);
  const lembrete_em =
    v.data.lembrete === "vespera"
      ? new Date(`${addDays(v.data.data, -1)}T20:00:00-03:00`)
      : new Date(inicio.getTime() - (v.data.lembrete === "na_hora" ? 0 : Number(v.data.lembrete)) * 60000);
  const { error } = await supabase.from("scheduled_runs").insert({
    athlete_id: s.athlete,
    inicio: inicio.toISOString(),
    local: v.data.local?.trim() || null,
    plan_workout_id: v.data.plan_workout_id || null,
    lembrete: v.data.lembrete,
    lembrete_min: v.data.lembrete === "vespera" ? null : v.data.lembrete === "na_hora" ? 0 : Number(v.data.lembrete),
    lembrete_em: lembrete_em.toISOString(),
    enviado: lembrete_em.getTime() < Date.now() - 60000,
  });
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/agenda");
  revalidatePath("/hoje");
  return { ok: true };
}

export async function deleteScheduledRun(id: string): Promise<Result> {
  const { supabase } = await requireState();
  await supabase.from("scheduled_runs").delete().eq("id", z.string().uuid().parse(id));
  revalidatePath("/agenda");
  revalidatePath("/hoje");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

const SubSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export async function savePushSubscription(sub: unknown, userAgent: string): Promise<Result> {
  const v = SubSchema.safeParse(sub);
  if (!v.success) return { ok: false, erro: "Inscrição de push inválida." };
  const { supabase, s } = await requireState();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { athlete_id: s.athlete, endpoint: v.data.endpoint, p256dh: v.data.keys.p256dh, auth: v.data.keys.auth, user_agent: userAgent.slice(0, 300) },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

export async function deletePushSubscription(endpoint: string): Promise<Result> {
  const { supabase } = await requireState();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}

export async function sendTestPush(): Promise<Result<{ enviados: number }>> {
  const { supabase, s } = await requireState();
  const enviados = await sendPushToAthlete(supabase, s.athlete, {
    title: "Lembretes ativados ✅",
    body: "É assim que vão chegar os avisos de corrida.",
    url: "/agenda",
  });
  return enviados > 0 ? { ok: true, enviados } : { ok: false, erro: "Nenhum aparelho recebeu. Confere as chaves VAPID e a permissão." };
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

const ProfileSchema = z.object({
  peso_kg: z.number().min(30).max(200).nullable(),
  altura_m: z.number().min(1).max(2.3).nullable(),
  idade: z.number().int().min(10).max(100).nullable(),
  fc_max: z.number().int().min(120).max(230).nullable(),
  fc_repouso: z.number().int().min(30).max(110).nullable(),
  hora_treino: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  lembrete_diario: z.boolean(),
  lembrete_diario_hora: z.string().regex(/^\d{2}:\d{2}$/),
  notif_ajustes: z.boolean(),
  notif_semana: z.boolean(),
  lat: z.number().min(-90).max(90).nullable(),
  lon: z.number().min(-180).max(180).nullable(),
});

export async function updateProfile(input: z.infer<typeof ProfileSchema>): Promise<Result> {
  const v = ProfileSchema.safeParse(input);
  if (!v.success) return { ok: false, erro: "Confere os dados do perfil." };
  const { supabase, s } = await requireState();
  const { error } = await supabase.from("profiles").update(v.data).eq("athlete_id", s.athlete);
  if (error) return { ok: false, erro: error.message };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Coach
// ---------------------------------------------------------------------------

export async function applyCoachSuggestions(messageId: string): Promise<Result<{ aplicadas: number }>> {
  const { supabase, s } = await requireState();
  const msg = s.coach.find((m) => m.id === messageId);
  if (!msg) return { ok: false, erro: "Recado não encontrado." };
  if (msg.aplicado) return { ok: false, erro: "Essas sugestões já foram aplicadas." };
  const changes = clampAiSuggestions(engineContext(s), msg.sugestoes ?? [], s.semanaAtual);
  await applyZoneChanges(supabase, s, changes, s.semanaAtual);
  await supabase.from("coach_messages").update({ aplicado: true }).eq("id", messageId);
  revalidateAll();
  return { ok: true, aplicadas: changes.length };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
