// Gera supabase/seed.sql a partir de data/planos.json (os dados das planilhas).
// Uso: npm run seed:gen  [-- --inicio 2026-11-23]
import { readFileSync, writeFileSync } from "node:fs";

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
const args = process.argv.slice(2);
const inicioArg = args[args.indexOf("--inicio") + 1];
const PLAN_INICIO = args.includes("--inicio") ? inicioArg : "2026-11-24";
if (!/^\d{4}-\d{2}-\d{2}$/.test(PLAN_INICIO)) throw new Error("--inicio precisa ser YYYY-MM-DD");

const { atletas } = JSON.parse(readFileSync(new URL("../data/planos.json", import.meta.url), "utf8"));

const q = (v) => (v == null ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const sec = (mmss) => {
  const [m, s] = mmss.split(":").map(Number);
  return m * 60 + s;
};

// VDOT (Daniels e Gilbert) — mesmo cálculo de lib/engine/vdot.ts
const vo2 = (v) => -4.6 + 0.182258 * v + 0.000104 * v * v;
const pct = (t) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
const timeForVdot = (vdot, km) => {
  let lo = 0.5, hi = 900;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (vo2((km * 1000) / mid) / pct(mid) - vdot > 0) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * 60;
};

const out = [];
out.push("-- Gerado por scripts/gen-seed.mjs a partir de data/planos.json. Não edite à mão.");
out.push(`-- Início do plano: ${PLAN_INICIO}`);
out.push("begin;");

for (const a of atletas) {
  out.push(`\n-- ${a.nome}`);
  out.push(
    `insert into public.profiles (athlete_id, nome, nivel, altura_m, peso_kg, plan_inicio) values (${q(a.id)}, ${q(a.nome)}, ${q(a.nivel)}, ${a.altura_m}, ${a.peso_kg}, ${q(PLAN_INICIO)})\n` +
      `  on conflict (athlete_id) do update set nome = excluded.nome, nivel = excluded.nivel, altura_m = excluded.altura_m, peso_kg = excluded.peso_kg;`,
  );
  for (const t of a.treinos) {
    const id = `${a.id}-s${t.semana}-${t.dia}`;
    out.push(
      `insert into public.plan_workouts (id, athlete_id, semana, dia, tipo, segmentos, observacao, km_total, meta_texto, opcional, ordem) values (` +
        [q(id), q(a.id), t.semana, q(t.dia), q(t.tipo), j(t.segmentos), q(t.observacao ?? null), q(t.km_total), q(t.meta_texto ?? null), q(!!t.opcional), DIAS.indexOf(t.dia)].join(", ") +
        `)\n  on conflict (id) do update set segmentos = excluded.segmentos, tipo = excluded.tipo, observacao = excluded.observacao, km_total = excluded.km_total, meta_texto = excluded.meta_texto, opcional = excluded.opcional, ordem = excluded.ordem;`,
    );
  }
  for (const [zona, v] of Object.entries(a.zonas_iniciais_min_km)) {
    out.push(`insert into public.zones (athlete_id, zona, pace_s_por_km) values (${q(a.id)}, ${q(zona)}, ${sec(v)}) on conflict do nothing;`);
  }
  const semanas = Math.max(...a.treinos.map((t) => t.semana));
  for (let s = 1; s <= semanas; s++) {
    out.push(`insert into public.plan_schedule (athlete_id, semana_calendario, semana_plano, modo) values (${q(a.id)}, ${s}, ${s}, 'normal') on conflict do nothing;`);
  }
  // meta inicial
  const alvo = a.meta.tempo_alvo ? sec(a.meta.tempo_alvo) : null;
  out.push(
    `insert into public.goals (athlete_id, distancia_km, tempo_alvo_s, prazo, status)\n  select ${q(a.id)}, ${a.meta.distancia_km}, ${q(alvo)}, null, 'ativa'\n  where not exists (select 1 from public.goals where athlete_id = ${q(a.id)});`,
  );
  // estimativa inicial pelo pace leve (fonte "projecao"): ponto de partida da evolução.
  // A Letícia ainda não corre 5 km seguidos, então não ganha estimativa inicial
  // (a evolução dela usa a melhora do pace de corrida até o primeiro teste).
  if (a.id !== "danilo") continue;
  const leve = a.zonas_iniciais_min_km.leve ?? a.zonas_iniciais_min_km.corrida;
  const frac = 0.7;
  const vdot = vo2(60000 / sec(leve)) / frac;
  out.push(
    `insert into public.estimates (athlete_id, data, vdot, est_5k_s, fonte)\n  select ${q(a.id)}, ${q(PLAN_INICIO)}, ${vdot.toFixed(2)}, ${Math.round(timeForVdot(vdot, 5))}, 'projecao'\n  where not exists (select 1 from public.estimates where athlete_id = ${q(a.id)});`,
  );
}
out.push("\ncommit;\n");
writeFileSync(new URL("../supabase/seed.sql", import.meta.url), out.join("\n"));
console.log(`supabase/seed.sql gerado (${PLAN_INICIO}).`);
