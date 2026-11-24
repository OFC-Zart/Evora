import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, ChevronRight, Moon, PartyPopper } from "lucide-react";
import {
  DIA_LABEL,
  addDays,
  dayKey,
  detectDecline,
  formatDateLong,
  formatDayMonth,
  formatNumber,
  heatAdjustment,
  isRunType,
  logFor,
  sessionSpike,
  statusOf,
  weekRange,
  workoutsOfCalendarWeek,
  workoutsOnDate,
  type ScheduledWorkout,
} from "@/lib/engine";
import { getPageContext } from "@/lib/server/page";
import { fetchWeather } from "@/lib/server/weather";
import { Card, SectionTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { TypeTag } from "@/components/type-tag";
import { WorkoutDetail } from "@/components/workout-detail";
import { CoachCard } from "@/components/coach-card";
import { LightWeekButton, SpikeBanner } from "@/components/action-buttons";
import { NoProfile } from "@/components/no-profile";
import { MODO_LABEL } from "@/lib/content";

export const metadata: Metadata = { title: "Hoje" };

export default async function Hoje() {
  const ctx = await getPageContext();
  if ("semPerfil" in ctx) return <NoProfile />;
  const { supabase, s } = ctx;
  const { hoje, athlete, profile } = s;
  const primeiroNome = profile.nome.split(" ")[0];

  const antesDoInicio = hoje < profile.plan_inicio;
  const semanaRow = s.schedule.find((w) => w.semana_calendario === s.semanaAtual);
  const fimDoPlano = !antesDoInicio && !semanaRow;

  const treinosHoje = antesDoInicio || fimDoPlano ? [] : workoutsOnDate(s.plan, s.schedule, hoje, profile.plan_inicio, athlete, s.overrides);
  const semana = semanaRow ? workoutsOfCalendarWeek(s.plan, s.schedule, s.semanaAtual, profile.plan_inicio, athlete, s.overrides) : [];
  const obrig = semana.filter((w) => !w.workout.opcional);
  const feitos = obrig.filter((w) => {
    const l = logFor(w, s.logs);
    return l && l.completou !== "nao";
  }).length;
  const faixa = weekRange(profile.plan_inicio, Math.max(1, s.semanaAtual));
  const kmFeitos = s.logs.filter((l) => l.atividade === "corrida" && l.data >= faixa.inicio && l.data <= faixa.fim).reduce((a, l) => a + l.distancia_km, 0);
  const kmPlan = obrig.reduce((a, w) => a + (w.km ?? 0), 0);

  // próximo treino quando hoje é descanso
  let proximo: ScheduledWorkout | undefined;
  if (!treinosHoje.length && !fimDoPlano) {
    for (let d = 1; d <= 14 && !proximo; d++) {
      const dia = addDays(antesDoInicio ? addDays(profile.plan_inicio, -1) : hoje, d);
      proximo = workoutsOnDate(s.plan, s.schedule, dia, profile.plan_inicio, athlete, s.overrides)[0];
    }
  }

  // clima de hoje no horário de treino
  const temCorrida = treinosHoje.some((t) => isRunType(t.workout.tipo));
  const clima = temCorrida && profile.lat != null && profile.lon != null ? await fetchWeather(Number(profile.lat), Number(profile.lon), hoje, profile.hora_treino ?? "07:00") : null;
  const calor = clima ? heatAdjustment(clima.temp_c, clima.orvalho_c) : null;

  const { data: agendadas } = await supabase
    .from("scheduled_runs")
    .select("id, inicio, local")
    .gte("inicio", new Date().toISOString())
    .order("inicio")
    .limit(1);
  const proximaAgendada = agendadas?.[0];

  const queda = detectDecline(s.logs, hoje);
  const quartaDanilo = athlete === "danilo" && dayKey(hoje) === "qua" && !antesDoInicio && !fimDoPlano;
  const futebolHoje = s.logs.some((l) => l.data === hoje && l.atividade === "futebol");

  return (
    <div className="space-y-4">
      <header className="px-1">
        <p className="text-sm text-muted">{formatDateLong(hoje)}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Oi, {primeiroNome}</h1>
        {semanaRow && (
          <p className="mt-1 text-sm text-muted">
            Semana {semanaRow.semana_plano} de 8{MODO_LABEL[semanaRow.modo] ? ` · ${MODO_LABEL[semanaRow.modo]}` : ""}
          </p>
        )}
      </header>

      {queda.ativo && (
        <Card className="border-warn/40 bg-warn/10">
          <p className="flex items-center gap-2 font-semibold text-warn">
            <AlertTriangle className="h-5 w-5" /> Sinal de queda de rendimento
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {queda.motivos.map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm">{queda.acao}</p>
          <div className="mt-3">
            <LightWeekButton />
          </div>
        </Card>
      )}

      {antesDoInicio && (
        <Card>
          <p className="text-lg font-semibold">O plano começa {formatDateLong(profile.plan_inicio)}</p>
          <p className="mt-1 text-sm text-muted">A semana 1 é leve, pra calibrar os seus paces.</p>
        </Card>
      )}

      {fimDoPlano && (
        <Card>
          <PartyPopper className="h-7 w-7 text-accent-ink" />
          <p className="mt-2 text-lg font-semibold">Plano de 8 semanas concluído!</p>
          <p className="mt-1 text-sm text-muted">Veja sua evolução e defina a próxima meta.</p>
          <Link href="/ritmos" className={buttonVariants({ className: "mt-4" })}>
            Ver ritmos e metas
          </Link>
        </Card>
      )}

      {quartaDanilo && (
        <Card>
          <p className="text-2xl font-semibold">Dia de futebol ⚽</p>
          <p className="mt-1 text-muted">Sem corrida hoje. Conta como treino forte na sua carga.</p>
          {futebolHoje ? (
            <p className="mt-4 text-sm font-medium text-ok">Futebol registrado ✓</p>
          ) : (
            <Link href="/registrar?atividade=futebol" className={buttonVariants({ variant: "secondary", className: "mt-4" })}>
              Registrar futebol
            </Link>
          )}
        </Card>
      )}

      {treinosHoje.map((t) => {
        const log = logFor(t, s.logs);
        const st = statusOf(t, s.logs, hoje);
        const spike = isRunType(t.workout.tipo) && t.km && !t.override ? sessionSpike(s.logs, hoje, t.km) : null;
        return (
          <div key={t.workout.id} className="space-y-3">
            {spike?.passa && (
              <SpikeBanner workoutId={t.workout.id} semana={t.semana_calendario} tipo={t.workout.tipo} planejado_km={spike.planejado_km} limite_km={spike.limite_km} maior_km={spike.maior_km} />
            )}
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <TypeTag tipo={t.workout.tipo} />
                {t.workout.opcional && <span className="text-xs font-medium text-muted">Opcional</span>}
              </div>
              <WorkoutDetail sw={t} zonas={s.zonas} athlete={athlete} seed={s.seed} calorPct={calor && calor.pct >= 1 ? calor.pct : 0} />
              {calor && clima && (
                <p className="mt-3 text-xs text-muted">
                  Previsão às {(profile.hora_treino ?? "07:00").slice(0, 5)}: {formatNumber(clima.temp_c)}°C, orvalho {formatNumber(clima.orvalho_c)}°C
                  {calor.extremo ? " · calor extremo: evite esforço forte" : ""}
                </p>
              )}
              <div className="mt-5">
                {log ? (
                  <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent-ink">
                    {st === "feito" ? "Treino feito ✓" : st === "parcial" ? "Feito em parte" : "Registrado como não feito"}
                  </p>
                ) : (
                  <Link href={`/registrar?treino=${t.workout.id}&semana=${t.semana_calendario}`} className={buttonVariants({ size: "lg", block: true })}>
                    Registrar este treino
                  </Link>
                )}
              </div>
            </Card>
          </div>
        );
      })}

      {!treinosHoje.length && !quartaDanilo && !fimDoPlano && (
        <Card>
          <p className="flex items-center gap-2 text-lg font-semibold">
            <Moon className="h-5 w-5" /> {antesDoInicio ? "Primeiro treino" : "Descanso hoje"}
          </p>
          {proximo ? (
            <Link href={`/plano/${proximo.workout.id}?semana=${proximo.semana_calendario}`} className="mt-3 flex items-center justify-between rounded-xl bg-card-2 px-4 py-3">
              <span>
                <span className="block text-sm text-muted">
                  Próximo: {DIA_LABEL[proximo.workout.dia]}, {formatDayMonth(proximo.data)}
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <TypeTag tipo={proximo.workout.tipo} />
                  {proximo.km != null && <span className="num font-semibold">{formatNumber(proximo.km)} km</span>}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </Link>
          ) : (
            <p className="mt-1 text-sm text-muted">Aproveita para dormir bem.</p>
          )}
          <Link href="/registrar" className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-4" })}>
            Registrar treino livre
          </Link>
        </Card>
      )}

      {semana.length > 0 && (
        <>
          <SectionTitle>Esta semana</SectionTitle>
          <Card>
            <div className="flex items-end justify-between">
              <div>
                <p className="num text-3xl font-semibold">
                  {feitos}
                  <span className="text-lg text-muted">/{obrig.length}</span>
                </p>
                <p className="text-sm text-muted">treinos feitos</p>
              </div>
              <div className="text-right">
                <p className="num text-3xl font-semibold">
                  {formatNumber(kmFeitos)}
                  <span className="text-lg text-muted">/{formatNumber(kmPlan)} km</span>
                </p>
                <p className="text-sm text-muted">corridos</p>
              </div>
            </div>
            <div className="mt-4 flex gap-1.5" aria-label="Treinos da semana">
              {semana.map((w) => {
                const st = statusOf(w, s.logs, hoje);
                return (
                  <Link
                    key={w.workout.id}
                    href={`/plano/${w.workout.id}?semana=${w.semana_calendario}`}
                    className="flex-1"
                    title={`${DIA_LABEL[w.workout.dia]}: ${w.workout.tipo}`}
                  >
                    <span
                      className={`block h-2.5 rounded-full ${st === "feito" ? "bg-accent" : st === "parcial" ? "bg-accent/50" : st === "pulado" ? "bg-danger/60" : st === "hoje" ? "bg-fg" : "bg-card-2"}`}
                    />
                    <span className="mt-1 block text-center text-[10px] text-muted">{w.workout.dia}</span>
                  </Link>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {proximaAgendada && (
        <Link href="/agenda">
          <Card className="mt-4 flex items-center justify-between">
            <span className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-accent-ink" />
              <span>
                <span className="block text-sm text-muted">Próxima corrida agendada</span>
                <span className="font-semibold">
                  {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(proximaAgendada.inicio))}
                  {proximaAgendada.local ? ` · ${proximaAgendada.local}` : ""}
                </span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted" />
          </Card>
        </Link>
      )}

      <SectionTitle>Coach</SectionTitle>
      <CoachCard msg={s.coach[0]} />
    </div>
  );
}
