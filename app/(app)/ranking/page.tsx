import type { Metadata } from "next";
import { Activity, Flame, TrendingUp } from "lucide-react";
import {
  addDays,
  FRACAO_LEVE,
  defaultSchedule,
  detectDecline,
  easyFraction,
  formatDateShort,
  formatDuration,
  formatNumber,
  formatPace,
  rankingCard,
  zoneName,
  type AthleteId,
  type Estimate,
  type PlanWorkout,
  type ScheduleWeek,
  type WorkoutLog,
  type ZonaComPace,
  type Zonas,
} from "@/lib/engine";
import { ATHLETES } from "@/lib/plan-data";
import { getPageContext } from "@/lib/server/page";
import { demoState, isDemo } from "@/lib/server/demo";
import { Card, SectionTitle } from "@/components/ui/card";
import { TypeTag } from "@/components/type-tag";
import { NoProfile } from "@/components/no-profile";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ranking" };

const STATUS_COR = { "Mandando bem": "bg-accent text-accent-fg", "No caminho": "bg-card-2 text-fg", Atenção: "bg-warn text-white" } as const;

interface StatsRow {
  athlete_id: AthleteId;
  nome: string;
  nivel: string;
  plan_inicio: string | null;
  logs: WorkoutLog[];
  estimates: Estimate[];
  fechamentos: { semana: number; adesao: number }[];
  zonas: Zonas;
}

export default async function Ranking() {
  const ctx = await getPageContext();
  if ("semPerfil" in ctx) return <NoProfile />;
  const { supabase, s } = ctx;

  const [{ data: stats }, { data: plan }, { data: sched }, { data: feed }] = await Promise.all([
    supabase.from("ranking_stats").select("*"),
    supabase.from("plan_workouts").select("*"),
    supabase.from("plan_schedule").select("*"),
    supabase.from("ranking_feed").select("*").limit(25),
  ]);

  let linhas = (stats ?? []) as StatsRow[];
  if (!linhas.length && isDemo()) {
    linhas = (["danilo", "leticia"] as const).map((a) => {
      const d = demoState(a);
      return { athlete_id: a, nome: d.profile.nome, nivel: d.profile.nivel, plan_inicio: d.profile.plan_inicio, logs: d.logs, estimates: d.estimates, fechamentos: d.closures.map((c) => ({ semana: c.semana_calendario, adesao: c.resumo.adesao })), zonas: d.zonas };
    });
  }

  const cards = linhas.map((r) => {
    const seed = ATHLETES[r.athlete_id];
    const logs = r.logs.map((l) => ({ ...l, distancia_km: Number(l.distancia_km), pace_s_por_km: l.pace_s_por_km == null ? null : Number(l.pace_s_por_km), pace_alvo_s: l.pace_alvo_s == null ? null : Number(l.pace_alvo_s), dor: "nenhuma" as const }));
    const planA = ((plan ?? []) as PlanWorkout[]).filter((p) => p.athlete_id === r.athlete_id);
    const schedA = ((sched ?? []) as (ScheduleWeek & { athlete_id: string })[]).filter((w) => w.athlete_id === r.athlete_id);
    const zonas: Zonas = { ...seed.zonasIniciais, ...r.zonas };
    const z = FRACAO_LEVE[r.athlete_id].zona as ZonaComPace;
    const ini = seed.zonasIniciais[z];
    const atual = zonas[z];
    const segs = new Map(planA.map((p) => [p.id, p.segmentos]));
    return rankingCard(
      {
        athlete: r.athlete_id,
        nome: r.nome,
        plan: planA.length ? planA : seed.treinos,
        schedule: schedA.length ? schedA : defaultSchedule(),
        // plano não iniciado (nulo): começa amanhã, então nada conta ainda
        plan_inicio: r.plan_inicio ?? addDays(s.hoje, 1),
        logs,
        estimates: r.estimates.filter((e) => e.fonte !== "projecao" || r.estimates.length > 1).map((e) => ({ ...e, vdot: Number(e.vdot) })),
        adesaoSemanas: r.fechamentos.map((f) => Number(f.adesao)),
        alertaQueda: detectDecline(logs, s.hoje).ativo,
        easyFraction: easyFraction(logs, s.hoje, (id) => segs.get(id) ?? null, zonas),
        melhoraZonaPct: ini && atual ? Math.round(((ini - atual) / ini) * 1000) / 10 : null,
      },
      s.hoje,
    );
  });

  return (
    <div>
      <header className="mb-5 px-1">
        <h1 className="text-3xl font-semibold tracking-tight">Ranking</h1>
        <p className="mt-1 text-sm text-muted">Compara adesão e evolução de cada um, não pace contra pace.</p>
      </header>

      <div className="space-y-4">
        {cards.map((c) => (
          <Card key={c.athlete} className={cn(c.athlete === s.athlete && "border-fg/25")}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-semibold">
                {c.nome}
                {c.athlete === s.athlete && <span className="ml-2 text-sm font-normal text-muted">você</span>}
              </p>
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", STATUS_COR[c.status])}>{c.status}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric icon={<Activity className="h-4 w-4" />} label="Adesão 14 dias" value={c.adesao14 != null ? `${Math.round(c.adesao14 * 100)}%` : "—"} sub={`${c.feitos14} de ${c.planejados14}`} />
              <Metric label="Km da semana" value={`${formatNumber(c.kmSemana)} km`} />
              <Metric icon={<TrendingUp className="h-4 w-4" />} label="Evolução" value={c.evolucaoPct != null ? `${c.evolucaoPct > 0 ? "+" : ""}${formatNumber(c.evolucaoPct)}%` : "—"} sub="desde o começo" />
              <Metric icon={<Flame className="h-4 w-4" />} label="Sequência" value={`${c.sequencia} ${c.sequencia === 1 ? "semana" : "semanas"}`} sub="com adesão ≥ 80%" />
            </div>
            <div className="mt-4 rounded-xl bg-card-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">O que melhorar</p>
              <ul className="mt-1 space-y-0.5 text-[15px]">
                {c.dicas.map((d) => (
                  <li key={d}>• {d}</li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle>Atividade recente</SectionTitle>
      <Card className="p-0">
        <ul className="divide-y divide-border">
          {(feed ?? []).map((f, i) => (
            <li key={i} className="flex items-start gap-3 px-5 py-3">
              <span className="w-12 shrink-0 pt-0.5 text-xs text-muted">{formatDateShort(String(f.data))}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{f.nome}</p>
                {f.tipo === "treino" ? (
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <TypeTag tipo={f.titulo} />
                    {f.detalhe.atividade === "corrida" ? (
                      <span className="num">
                        {formatNumber(Number(f.detalhe.distancia_km), 2)} km · {formatDuration(f.detalhe.tempo_s)}
                        {f.detalhe.pace_s_por_km ? ` · ${formatPace(Number(f.detalhe.pace_s_por_km))}/km` : ""}
                      </span>
                    ) : (
                      <span className="num">{formatDuration(f.detalhe.tempo_s)}</span>
                    )}
                    <span>esforço {f.detalhe.rpe}</span>
                  </p>
                ) : (
                  <p className={cn("num mt-0.5 text-sm text-muted", f.detalhe.revertido && "line-through")}>
                    Pace {zoneName(f.titulo as ZonaComPace)}: {formatPace(f.detalhe.antes_s)} → {formatPace(f.detalhe.depois_s)}
                  </p>
                )}
              </div>
            </li>
          ))}
          {!feed?.length && <li className="px-5 py-6 text-sm text-muted">Nada ainda. O primeiro treino registrado aparece aqui.</li>}
        </ul>
      </Card>
    </div>
  );
}

function Metric({ icon, label, value, sub }: { icon?: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </p>
      <p className="num mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
