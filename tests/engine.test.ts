import { describe, expect, it } from "vitest";
import {
  ACWR_FAIXA,
  acwr,
  analyzeGoal,
  applyMode,
  calibrate,
  calendarWeekOf,
  capDelta,
  closeWeek,
  currentEstimate,
  dayKey,
  defaultSchedule,
  detectDecline,
  easyRule,
  formatDistance,
  formatDuration,
  formatPace,
  formatWorkoutTotal,
  heatAdjustment,
  isMaxTest,
  maskDuration,
  paceForFraction,
  parseDuration,
  plannedAvgPace,
  projectVdot,
  qualityRule,
  rebuildSchedule,
  reduceToKm,
  riegel,
  segmentLines,
  segmentsKm,
  sessionLoad,
  sessionSpike,
  soltoPer100,
  tanakaHrMax,
  testRule,
  timeForVdot,
  trendPerMonth,
  vdotFromRace,
  volumeRule,
  workoutTime,
  workoutsOfCalendarWeek,
  addDays as addDaysTest,
  zonesFromVdot,
  type EngineContext,
  type WorkoutLog,
  type Zonas,
} from "@/lib/engine";
import { ATHLETES, planOf } from "@/lib/plan-data";

const DANILO = ATHLETES.danilo;
const LETICIA = ATHLETES.leticia;
const workout = (athlete: "danilo" | "leticia", semana: number, dia: string) =>
  planOf(athlete).find((w) => w.semana === semana && w.dia === dia)!;

let seq = 0;
function log(p: Partial<WorkoutLog>): WorkoutLog {
  const distancia_km = p.distancia_km ?? 5;
  const tempo_s = p.tempo_s ?? 5 * 405;
  return {
    id: `l${seq++}`,
    athlete_id: "danilo",
    plan_workout_id: null,
    semana_calendario: null,
    tipo_treino: "Leve",
    data: "2026-11-24",
    distancia_km,
    tempo_s,
    pace_s_por_km: tempo_s / distancia_km,
    pace_alvo_s: null,
    rpe: 4,
    completou: "sim",
    dor: "nenhuma",
    atividade: "corrida",
    ...p,
  };
}

function ctx(p: Partial<EngineContext> = {}): EngineContext {
  return {
    athlete: "danilo",
    nivel: "intermediario",
    zonas: { ...DANILO.zonasIniciais },
    zonasIniciais: { ...DANILO.zonasIniciais },
    history: [],
    logs: [],
    ...p,
  };
}

// ---------------------------------------------------------------------------
// Testes obrigatórios (seção 13)
// ---------------------------------------------------------------------------

describe("testes obrigatórios", () => {
  it("5 km em 25:00 → VDOT ≈ 38,3", () => {
    expect(vdotFromRace(5, 25 * 60)).toBeCloseTo(38.3, 1);
  });

  it("zonas do Danilo a partir de 5 km em 27:00 → moderado ≈ 5:47 e forte ≈ 5:12 (±3 s)", () => {
    const vdot = vdotFromRace(5, 27 * 60);
    expect(vdot).toBeCloseTo(35.0, 1);
    const z = zonesFromVdot(vdot, "danilo");
    expect(Math.abs(z.moderado! - (5 * 60 + 47))).toBeLessThanOrEqual(3);
    expect(Math.abs(z.forte! - (5 * 60 + 12))).toBeLessThanOrEqual(3);
  });

  it('"6× 400 m a 5:10" → "2:04 cada"', () => {
    const lines = segmentLines(workout("danilo", 3, "ter").segmentos, DANILO.zonasIniciais, "danilo");
    const tiro = lines.find((l) => l.texto.startsWith("6×"))!;
    expect(tiro.texto).toContain("6× 400 m a 5:10 (2:04 cada)");
    expect(tiro.texto).toContain("pausa 2 min trotando ou andando");
  });

  it("pico de sessão: maior treino = 6 km e próximo = 7 km → aviso e sugestão de 6,6 km", () => {
    const logs = [log({ data: "2026-11-10", distancia_km: 6 }), log({ data: "2026-11-15", distancia_km: 5 })];
    const spike = sessionSpike(logs, "2026-11-21", 7)!;
    expect(spike.passa).toBe(true);
    expect(spike.limite_km).toBe(6.6);
    const reduzido = reduceToKm([{ tipo: "corrida", distancia_km: 7, zona: "leve" }], spike.limite_km);
    expect(segmentsKm(reduzido)).toBe(6.6);
  });

  it("três leves com esforço 3 e 15 s mais rápidos que o alvo → leve −5 s, com o motivo gravado", () => {
    const alvo = 405;
    const logs = [0, 1, 2].map((i) =>
      log({ data: `2026-11-2${4 + i}`, rpe: 3, distancia_km: 5, tempo_s: 5 * (alvo - 15), pace_alvo_s: alvo }),
    );
    const changes = easyRule(ctx({ logs }), logs, 2);
    expect(changes).toHaveLength(1);
    expect(changes[0].zona).toBe("leve");
    expect(changes[0].depois_s - changes[0].antes_s).toBe(-5);
    expect(changes[0].motivo).toMatch(/6:45 para 6:40/);
    expect(changes[0].origem).toBe("regra");
  });

  it("dor na articulação → próxima semana leve e sem progressão", () => {
    const c = ctx();
    const schedule = defaultSchedule();
    const planejados = workoutsOfCalendarWeek(DANILO.treinos, schedule, 3, "2026-11-23", "danilo");
    const logs = planejados.map((p) =>
      log({
        plan_workout_id: p.workout.id,
        semana_calendario: 3,
        data: p.data,
        tipo_treino: p.workout.tipo,
        dor: p.workout.dia === "qui" ? "articulacao" : "nenhuma",
      }),
    );
    const res = closeWeek({
      ctx: { ...c, logs },
      semana: 3,
      semana_plano: 3,
      modo: "normal",
      inicio: "2026-12-07",
      fim: "2026-12-13",
      planejados,
      calibrado: true,
      bloqueioDor: false,
    });
    expect(res.decisao.acao).toBe("leve_dor");
    expect(res.proxima).toMatchObject({ semana_plano: 3, modo: "leve30" });
    expect(res.decisao.bloqueioDor).toBe(true);
    expect(res.proxima.motivo).toMatch(/procure um profissional de saúde/);

    // semana leve: −30% de volume e sem tiros
    const leve = applyMode(workout("danilo", 3, "ter").segmentos, "leve30", "danilo");
    expect(JSON.stringify(leve)).not.toMatch(/forte|moderado|solto/);
    expect(segmentsKm(leve)).toBeLessThan(segmentsKm(workout("danilo", 3, "ter").segmentos) * 0.75);
  });
});

// ---------------------------------------------------------------------------
// Conferências extras contra as planilhas e a literatura
// ---------------------------------------------------------------------------

describe("formatação", () => {
  it("pace e tempo", () => {
    expect(formatPace(405)).toBe("6:45");
    expect(formatDuration(1620)).toBe("27:00");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDistance(1.5)).toBe("1,5 km");
    expect(formatDistance(0.4)).toBe("400 m");
    expect(parseDuration("27:00")).toBe(1620);
    expect(parseDuration("1:02:30")).toBe(3750);
    expect(parseDuration("7:61")).toBeNull();
    expect(maskDuration("2700")).toBe("27:00");
    expect(maskDuration("10230")).toBe("1:02:30");
    expect(formatWorkoutTotal(39 * 60 + 17)).toBe("39:00");
    expect(formatWorkoutTotal(19 * 60 + 27)).toBe("19:27");
  });
});

describe("tempos batem com a planilha do Excel", () => {
  const z = DANILO.zonasIniciais;
  it("fartlek semana 2 ≈ 37 min", () => {
    const t = workoutTime(workout("danilo", 2, "ter").segmentos, z, "danilo");
    expect(Math.round(t.total_s / 60)).toBe(37);
  });
  it("tiros semana 3 ≈ 39 min (5 pausas de 2 min)", () => {
    const t = workoutTime(workout("danilo", 3, "ter").segmentos, z, "danilo");
    expect(Math.round(t.total_s / 60)).toBe(39);
  });
  it("tiros semana 7 ≈ 47 min", () => {
    const t = workoutTime(workout("danilo", 7, "ter").segmentos, z, "danilo");
    expect(Math.round(t.total_s / 60)).toBe(47);
  });
  it("100 m soltos ≈ 28 s (pace forte ÷ 10 − 3)", () => {
    expect(Math.round(soltoPer100(z.forte!))).toBe(28);
    const lines = segmentLines(workout("danilo", 3, "qui").segmentos, z, "danilo");
    expect(lines[1].texto).toBe("4× 100 m soltos (~28 s cada) · pausa 1 min andando");
  });
  it("Letícia sábado semana 1 ≈ 29 min, com 500 m andando antes e depois", () => {
    const w = workout("leticia", 1, "sab");
    const t = workoutTime(w.segmentos, LETICIA.zonasIniciais, "leticia");
    expect(Math.round(t.total_s / 60)).toBe(29);
    const lines = segmentLines(w.segmentos, LETICIA.zonasIniciais, "leticia");
    expect(lines[0].texto).toMatch(/500 m andando/);
    expect(lines[1].texto).toBe("10× (100 m trotando a 8:00 + 200 m andando)");
    expect(lines.at(-1)!.texto).toMatch(/500 m andando/);
  });
  it("Letícia: teste de caminhada não ganha aquecimento extra", () => {
    const lines = segmentLines(workout("leticia", 1, "ter").segmentos, LETICIA.zonasIniciais, "leticia");
    expect(lines).toHaveLength(1);
    expect(lines[0].texto).toMatch(/Sem meta/);
  });
  it("km totais do plano: Danilo 132,8 km e Letícia 81,5 km (77,3 da planilha + acelerações da meta de 28:00)", () => {
    const soma = (a: "danilo" | "leticia") => Math.round(planOf(a).reduce((s, w) => s + (w.km_total ?? 0), 0) * 10) / 10;
    expect(soma("danilo")).toBe(132.8);
    expect(soma("leticia")).toBe(81.5);
    expect(planOf("danilo")).toHaveLength(41);
    expect(planOf("leticia")).toHaveLength(39);
  });
  it("pace médio planejado do fartlek fica entre o moderado e o leve", () => {
    const p = plannedAvgPace(workout("danilo", 2, "ter").segmentos, z, "danilo")!;
    expect(p).toBeGreaterThan(z.moderado!);
    expect(p).toBeLessThan(z.leve!);
  });
});

describe("VDOT e previsões", () => {
  it("tempo de prova inverte o VDOT", () => {
    const v = vdotFromRace(5, 1500);
    expect(timeForVdot(v, 5)).toBeCloseTo(1500, 0);
  });
  it("tabela de Daniels: VDOT 50 → 5 km ≈ 19:57 e 10 km ≈ 41:21", () => {
    expect(Math.abs(timeForVdot(50, 5) - (19 * 60 + 57))).toBeLessThan(5);
    expect(Math.abs(timeForVdot(50, 10) - (41 * 60 + 21))).toBeLessThan(8);
  });
  it("meta do Danilo (5 km em 19:00) pede VDOT ≈ 53", () => {
    expect(vdotFromRace(5, 19 * 60)).toBeCloseTo(53.0, 0);
  });
  it("leve inicial (6:45) é coerente com 0,70 do VDOT de 27:00", () => {
    const leve = paceForFraction(vdotFromRace(5, 27 * 60), 0.7);
    expect(Math.abs(leve - 405)).toBeLessThan(10);
  });
  it("Riegel: 5 km em 25:00 → 10 km ≈ 52:07", () => {
    expect(Math.round(riegel(1500, 5, 10))).toBe(3127);
  });
});

describe("calor, FC e carga", () => {
  it("calor: 32 °C com orvalho 21 °C (soma 159 °F) ≈ 5,9% mais lento", () => {
    const h = heatAdjustment(32, 21);
    expect(h.soma_f).toBeCloseTo(159.4, 1);
    expect(h.pct).toBeCloseTo(5.8, 0);
    expect(heatAdjustment(15, 5).pct).toBe(0);
  });
  it("Tanaka: 30 anos → 187 bpm", () => {
    expect(tanakaHrMax(30)).toBe(187);
  });
  it("sRPE e ACWR", () => {
    expect(sessionLoad(4, 87 * 60)).toBe(348); // exemplo clássico de Foster
    // carga constante de 300 por semana durante 5 semanas → ACWR = 1
    const logs: WorkoutLog[] = [];
    for (let d = 0; d < 35; d += 7) logs.push(log({ data: addDaysTest("2026-10-27", d), rpe: 5, tempo_s: 3600 }));
    expect(acwr(logs, "2026-11-30").acwr).toBeCloseTo(1, 2);
    // com só 1 semana de histórico antes da semana aguda: sem ACWR (evita alarme falso)
    const pouco = [log({ data: "2026-11-18", rpe: 5, tempo_s: 3600 }), log({ data: "2026-11-25", rpe: 5, tempo_s: 3600 })];
    expect(acwr(pouco, "2026-11-30").acwr).toBeNull();
    // 3 semanas de histórico: média só dos dias que existem
    const tres = [0, 7, 14, 21].map((d) => log({ data: addDaysTest("2026-11-09", d), rpe: 5, tempo_s: 3600 }));
    expect(acwr(tres, "2026-11-30").acwr).toBeCloseTo(1, 1);
    expect(ACWR_FAIXA.max).toBe(1.3);
  });
  it("sem histórico não há pico de sessão", () => {
    expect(sessionSpike([], "2026-11-24", 7)).toBeNull();
  });
});

describe("motor de autoajuste", () => {
  it("leve: um treino só não muda nada", () => {
    const logs = [log({ rpe: 3, tempo_s: 5 * 380, pace_alvo_s: 405 })];
    expect(easyRule(ctx({ logs }), logs, 2)).toHaveLength(0);
  });
  it("leve: esforço alto → +10 s", () => {
    const logs = [log({ rpe: 7, pace_alvo_s: 405 }), log({ rpe: 8, pace_alvo_s: 405 })];
    const c = easyRule(ctx({ logs }), logs, 2);
    expect(c[0].depois_s - c[0].antes_s).toBe(10);
  });
  it("leve: FC média > 85% da máxima → +10 s", () => {
    const logs = [log({ rpe: 5, pace_alvo_s: 405, fc_media: 175 }), log({ rpe: 5, pace_alvo_s: 405, fc_media: 160 })];
    const c = easyRule(ctx({ logs, fc_max: 195 }), logs, 2);
    expect(c[0].depois_s - c[0].antes_s).toBe(10);
  });
  it("leve: calor normaliza o pace (dia quente não conta como lento)", () => {
    // 6:45 num dia de 32°C/21°C equivale a ~6:23 em clima ameno
    const logs = [0, 1].map(() => log({ rpe: 3, tempo_s: 5 * 405, pace_alvo_s: 405, temp_c: 32, orvalho_c: 21 }));
    const c = easyRule(ctx({ logs }), logs, 2);
    expect(c[0]?.depois_s).toBe(400);
  });
  it("limite de 10 s/km por semana", () => {
    const history = [
      { athlete_id: "danilo" as const, zona: "leve" as const, antes_s: 405, depois_s: 413, motivo: "", origem: "regra" as const, created_at: "", revertido: false, semana_calendario: 4 },
    ];
    expect(capDelta(history, "leve", 10, 4)).toBe(2);
    expect(capDelta(history, "leve", 10, 5)).toBe(10);
  });
  it("qualidade: dois treinos no alvo com esforço ≤ 7 → moderado e forte −3 s", () => {
    const logs = [
      log({ data: "2026-12-01", tipo_treino: "Tiros", rpe: 7, reps: [122, 123, 124], rep_alvo_s: 124, rep_dist_km: 0.4 }),
      log({ data: "2026-12-08", tipo_treino: "Ritmo", rpe: 6, reps: [205, 206, 207], rep_alvo_s: 207, rep_dist_km: 0.6 }),
    ];
    const c = qualityRule(ctx({ logs }), 3, "2026-12-07", "2026-12-13");
    expect(c.map((x) => [x.zona, x.depois_s - x.antes_s])).toEqual([["moderado", -3], ["forte", -3]]);
  });
  it("qualidade: não completou e esforço 9 → +5 s", () => {
    const logs = [
      log({ data: "2026-12-01", tipo_treino: "Tiros", rpe: 9 }),
      log({ data: "2026-12-08", tipo_treino: "Ritmo", rpe: 6, completou: "nao" }),
    ];
    const c = qualityRule(ctx({ logs }), 3, "2026-12-07", "2026-12-13");
    expect(c.every((x) => x.depois_s - x.antes_s === 5)).toBe(true);
  });
  it("calibração do Danilo: média ponderada pelos km dos treinos com esforço ≤ 6", () => {
    const logs = [
      log({ tipo_treino: "Teste", distancia_km: 5, tempo_s: 5 * 400, rpe: 5 }),
      log({ tipo_treino: "Leve", distancia_km: 3, tempo_s: 3 * 420, rpe: 4 }),
      log({ tipo_treino: "Longão", distancia_km: 5, tempo_s: 5 * 410, rpe: 7 }),
    ];
    const c = calibrate(ctx({ logs }), logs);
    const leve = c.find((x) => x.zona === "leve")!;
    expect(leve.depois_s).toBe(Math.round((5 * 400 + 3 * 420) / 8)); // 408
    expect(c.find((x) => x.zona === "forte")).toBeDefined();
  });
  it("calibração da Letícia sem trotes anotados: corrida = caminhada × 0,76", () => {
    const logs = [log({ athlete_id: "leticia", tipo_treino: "Teste", distancia_km: 3, tempo_s: 3 * 630, rpe: 4 })];
    const c = calibrate(
      ctx({ athlete: "leticia", nivel: "iniciante_sedentaria", zonas: { ...LETICIA.zonasIniciais }, zonasIniciais: { ...LETICIA.zonasIniciais }, logs }),
      logs,
    );
    expect(c.find((x) => x.zona === "corrida")?.depois_s ?? LETICIA.zonasIniciais.corrida).toBe(Math.round(630 * 0.76));
  });
  it("teste de 5 km no máximo recalcula todas as zonas sem o limite de 10 s", () => {
    const l = log({ tipo_treino: "Teste", distancia_km: 6.5, tempo_s: 2400, teste_dist_km: 5, teste_tempo_s: 1500, rpe: 10 });
    expect(isMaxTest(l, true)).toBe(true);
    const r = testRule(ctx(), l);
    expect(r.estimate.vdot).toBeCloseTo(38.3, 1);
    const forte = r.changes.find((c) => c.zona === "forte")!;
    expect(Math.abs(forte.depois_s - forte.antes_s)).toBeGreaterThan(10);
  });
  it("repetir semana com 2 treinos perdidos e deslocar o plano", () => {
    const schedule = defaultSchedule();
    const planejados = workoutsOfCalendarWeek(DANILO.treinos, schedule, 2, "2026-11-23", "danilo");
    const logs = planejados.slice(0, 3).map((p) => log({ plan_workout_id: p.workout.id, semana_calendario: 2, data: p.data }));
    const d = volumeRule("danilo", planejados, logs, false);
    expect(d.acao).toBe("repetir");
    const novo = rebuildSchedule(schedule, 2, { semana_plano: 2, modo: "repetida", motivo: d.motivo });
    expect(novo.map((w) => w.semana_plano)).toEqual([1, 2, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("semana cumprida segue o plano", () => {
    const schedule = defaultSchedule();
    const planejados = workoutsOfCalendarWeek(DANILO.treinos, schedule, 2, "2026-11-23", "danilo");
    const logs = planejados.map((p) => log({ plan_workout_id: p.workout.id, semana_calendario: 2, data: p.data, rpe: 5 }));
    expect(volumeRule("danilo", planejados, logs, false).acao).toBe("seguir");
  });
  it("Letícia: um 'não completou' repete a semana", () => {
    const schedule = defaultSchedule();
    const planejados = workoutsOfCalendarWeek(LETICIA.treinos, schedule, 2, "2026-11-23", "leticia");
    const logs = planejados.map((p, i) =>
      log({ athlete_id: "leticia", plan_workout_id: p.workout.id, semana_calendario: 2, data: p.data, completou: i === 1 ? "nao" : "sim" }),
    );
    expect(volumeRule("leticia", planejados, logs, false).acao).toBe("repetir");
  });
});

describe("queda de rendimento", () => {
  it("leves 5% mais lentos com o mesmo esforço disparam o alerta", () => {
    const logs = [
      log({ data: "2026-11-02", tempo_s: 5 * 400, rpe: 4 }),
      log({ data: "2026-11-05", tempo_s: 5 * 400, rpe: 4 }),
      log({ data: "2026-11-18", tempo_s: 5 * 425, rpe: 4 }),
      log({ data: "2026-11-21", tempo_s: 5 * 425, rpe: 5 }),
    ];
    const d = detectDecline(logs, "2026-11-24");
    expect(d.ativo).toBe(true);
  });
});

describe("projeção e metas", () => {
  it("intermediário ganha +1 VDOT/mês nos 3 primeiros meses e +0,5 depois", () => {
    const input = { vdotAtual: 35, nivel: "intermediario" as const, mesesTreinados: 0, estimates: [] };
    expect(projectVdot(input, 3)).toBeCloseTo(38, 5);
    expect(projectVdot(input, 6)).toBeCloseTo(39.5, 5);
  });
  it("tendência real substitui a heurística (limitada a 2/mês)", () => {
    const est = [
      { data: "2026-01-01", vdot: 30, est_5k_s: 0, fonte: "teste" as const },
      { data: "2026-02-01", vdot: 35, est_5k_s: 0, fonte: "treino" as const },
      { data: "2026-03-01", vdot: 40, est_5k_s: 0, fonte: "teste" as const },
    ];
    expect(trendPerMonth(est)).toBe(2);
  });
  it("19:00 em 3 meses a partir de 27:00 é muito ambiciosa", () => {
    const vdotAtual = vdotFromRace(5, 27 * 60);
    const g = analyzeGoal(
      { distancia_km: 5, tempo_alvo_s: 19 * 60, prazo: "2027-02-23" },
      { vdotAtual, nivel: "intermediario", mesesTreinados: 0, estimates: [] },
      "2026-11-23",
    );
    expect(g.classificacao).toBe("Muito ambiciosa");
    expect(g.intermediarias.length).toBeGreaterThan(1);
    expect(g.intermediarias.at(-1)!.tempo_s).toBe(19 * 60);
  });
  it("25:00 a partir de 27:00: ambiciosa em 3 meses, realista em 4", () => {
    const tres = analyzeGoal(
      { distancia_km: 5, tempo_alvo_s: 25 * 60, prazo: "2027-02-23" },
      { vdotAtual: vdotFromRace(5, 27 * 60), nivel: "intermediario", mesesTreinados: 0, estimates: [] },
      "2026-11-23",
    );
    // precisa de VDOT 38,3; a projeção em 3 meses chega a ~38,0
    expect(tres.classificacao).toBe("Ambiciosa");
    const g = analyzeGoal(
      { distancia_km: 5, tempo_alvo_s: 25 * 60, prazo: "2027-03-23" },
      { vdotAtual: vdotFromRace(5, 27 * 60), nivel: "intermediario", mesesTreinados: 0, estimates: [] },
      "2026-11-23",
    );
    expect(g.classificacao).toBe("Realista");
  });
  it("estimativa atual cai para o pace leve quando não há teste", () => {
    const e = currentEstimate([], DANILO.zonasIniciais as Zonas, "danilo", "2026-11-23")!;
    expect(e.aproximada).toBe(true);
    expect(e.est_5k_s).toBeGreaterThan(25 * 60);
    expect(e.est_5k_s).toBeLessThan(29 * 60);
  });
});

describe("datas", () => {
  it("semana do calendário e dia da semana", () => {
    expect(dayKey("2026-11-23")).toBe("seg");
    expect(dayKey("2026-11-25")).toBe("qua");
    expect(calendarWeekOf("2026-11-23", "2026-11-29")).toBe(1);
    expect(calendarWeekOf("2026-11-23", "2026-11-30")).toBe(2);
  });
});

describe("plano começando no meio da semana", () => {
  it("começa numa terça: a segunda some, a semana 1 vai até domingo", async () => {
    const { workoutsOfCalendarWeek, workoutsOnDate, calendarWeekOf, weekRange } = await import("@/lib/engine");
    const inicio = "2026-11-24"; // terça
    const schedule = defaultSchedule();
    expect(calendarWeekOf(inicio, "2026-11-24")).toBe(1);
    expect(calendarWeekOf(inicio, "2026-11-29")).toBe(1);
    expect(calendarWeekOf(inicio, "2026-11-30")).toBe(2);
    expect(weekRange(inicio, 1)).toEqual({ inicio: "2026-11-23", fim: "2026-11-29" });
    const s1 = workoutsOfCalendarWeek(DANILO.treinos, schedule, 1, inicio, "danilo");
    expect(s1.map((w) => w.workout.dia)).toEqual(["ter", "qui", "sex", "sab"]);
    expect(workoutsOnDate(DANILO.treinos, schedule, "2026-11-24", inicio, "danilo")[0].workout.tipo).toBe("Teste");
    expect(workoutsOnDate(DANILO.treinos, schedule, "2026-11-23", inicio, "danilo")).toEqual([]);
    const s2 = workoutsOfCalendarWeek(DANILO.treinos, schedule, 2, inicio, "danilo");
    expect(s2[0].workout.dia).toBe("seg");
    expect(s2[0].data).toBe("2026-11-30");
  });
});
