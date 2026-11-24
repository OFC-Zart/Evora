import "server-only";
// Modo demonstração (só em desenvolvimento, sem Supabase): EVORA_DEMO=1.
// Monta um estado de exemplo a partir das planilhas para ver as telas.
import {
  addDays,
  calendarWeekOf,
  defaultSchedule,
  isoDateInTz,
  mondayOf,
  plannedAvgPace,
  plannedBetween,
  timeForVdot,
  vdotFromRace,
  type AthleteId,
  type WorkoutLog,
} from "@/lib/engine";
import { ATHLETES } from "@/lib/plan-data";
import type { AthleteState } from "./state";

export function isDemo() {
  return process.env.EVORA_DEMO === "1" && process.env.NODE_ENV !== "production";
}

export function demoAthlete(): AthleteId {
  return process.env.EVORA_DEMO_ATHLETE === "leticia" ? "leticia" : "danilo";
}

export function demoState(athlete: AthleteId = demoAthlete()): AthleteState {
  const seed = ATHLETES[athlete];
  const hoje = isoDateInTz();
  const plan_inicio = addDays(mondayOf(hoje), -14);
  const schedule = defaultSchedule();
  const zonas = { ...seed.zonasIniciais };
  const passados = plannedBetween(seed.treinos, schedule, plan_inicio, addDays(hoje, -1), plan_inicio, athlete);
  const logs: WorkoutLog[] = passados.map((p, i) => {
    const km = p.km ?? 0;
    const alvo = plannedAvgPace(p.segmentos, zonas, athlete);
    const pace = (alvo ?? zonas.leve ?? zonas.corrida ?? 420) - 6 + (i % 3) * 4;
    const forca = p.workout.tipo === "Força";
    return {
      id: `demo-${i}`,
      athlete_id: athlete,
      plan_workout_id: p.workout.id,
      semana_calendario: p.semana_calendario,
      tipo_treino: p.workout.tipo,
      data: p.data,
      distancia_km: forca ? 0 : km,
      tempo_s: forca ? 1500 : Math.round(km * pace),
      pace_s_por_km: forca ? null : pace,
      pace_alvo_s: alvo,
      rpe: forca ? 5 : ["Tiros", "Fartlek", "Ritmo"].includes(p.workout.tipo) ? 7 : 3 + (i % 2),
      completou: "sim",
      dor: "nenhuma",
      atividade: forca ? "forca" : "corrida",
      fc_media: forca ? null : 148 + (i % 4) * 3,
      temp_c: 24,
      orvalho_c: 17,
    };
  });
  if (athlete === "danilo") {
    for (const d of [-1, 6].map((n) => addDays(plan_inicio, 2 + n + 1))) {
      if (d < hoje) logs.push({ id: `fut-${d}`, athlete_id: "danilo", plan_workout_id: null, semana_calendario: null, tipo_treino: "Futebol", data: d, distancia_km: 0, tempo_s: 4800, pace_s_por_km: null, pace_alvo_s: null, rpe: 8, completou: "sim", dor: "nenhuma", atividade: "futebol" });
    }
  }
  logs.sort((a, b) => (a.data < b.data ? -1 : 1));
  const v0 = athlete === "danilo" ? vdotFromRace(5, 27 * 60) : 22;
  return {
    athlete,
    profile: {
      athlete_id: athlete,
      user_id: "demo",
      nome: seed.nome,
      nivel: seed.nivel,
      altura_m: seed.altura_m,
      peso_kg: seed.peso_kg,
      idade: athlete === "danilo" ? 30 : 28,
      fc_max: null,
      fc_repouso: null,
      plan_inicio,
      calibrado: true,
      bloqueio_dor: false,
      lat: -23.55,
      lon: -46.63,
      hora_treino: "07:00",
      lembrete_diario: false,
      lembrete_diario_hora: "07:00",
      lembrete_diario_ultimo: null,
      notif_ajustes: true,
      notif_semana: true,
    },
    seed,
    plan: seed.treinos,
    schedule,
    overrides: [],
    zonas,
    history: [
      { id: "h1", athlete_id: athlete, zona: athlete === "danilo" ? "leve" : "corrida", antes_s: (athlete === "danilo" ? 405 : 480) + 7, depois_s: athlete === "danilo" ? 405 : 480, motivo: "Calibração da semana 1: média dos seus treinos confortáveis.", origem: "regra", created_at: `${addDays(plan_inicio, 6)}T20:00:00Z`, revertido: false, semana_calendario: 1 },
    ],
    logs,
    estimates: [
      { data: addDays(plan_inicio, 1), vdot: v0, est_5k_s: Math.round(timeForVdot(v0, 5)), fonte: "teste" },
      { data: addDays(plan_inicio, 12), vdot: v0 + 0.6, est_5k_s: Math.round(timeForVdot(v0 + 0.6, 5)), fonte: "treino" },
    ],
    goals: [{ id: "g1", distancia_km: 5, tempo_alvo_s: seed.meta.tempo_alvo_s, prazo: null, status: "ativa", created_at: plan_inicio }],
    closures: [1, 2].map((w) => ({ semana_calendario: w, resumo: { feitos: 5, planejados: 5, adesao: 1, km_feitos: 13, km_planejados: 13, rpe_medio: 4, carga: 900, dor: false }, closed_at: "" })),
    coach: [
      {
        id: "c1",
        semana: 2,
        texto: `Boa, ${seed.nome}! Semana completa e leves no alvo. Segue o plano: semana 3 traz o primeiro treino de tiros.`,
        dicas: ["Consistência ganha de intensidade. Continua assim!"],
        sugestoes: [],
        repetir_semana: false,
        fonte: "regras",
        aplicado: false,
        created_at: `${addDays(plan_inicio, 13)}T20:00:00Z`,
      },
    ],
    hoje,
    semanaAtual: calendarWeekOf(plan_inicio, hoje),
  };
}

/** Cliente falso: qualquer consulta devolve vazio. */
export function demoSupabase() {
  const result = { data: [], error: null };
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler) as never;
}
