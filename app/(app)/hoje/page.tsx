import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronRight, Minus, Moon, PartyPopper, X } from "lucide-react";
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
import { ComecarPlanoButton } from "@/components/comecar-plano";
import { MODO_LABEL } from "@/lib/content";
import { tipoCor } from "@/lib/ui/colors";

/** Nome do treino em linguagem simples, para o título do card. */
const TITULO: Record<string, string> = {
  Leve: "Corrida leve",
  Ritmo: "Treino de ritmo",
  Regenerativo: "Corrida regenerativa",
  Força: "Treino de força",
  Teste: "Dia de teste",
  "Corre/anda": "Corre e anda",
  Corrida: "Corrida contínua",
};

export const metadata: Metadata = { title: "Hoje" };

export default async function Hoje() {
  const ctx = await getPageContext();
  if ("semPerfil" in ctx) return <NoProfile />;
  const { supabase, s } = ctx;
  const { hoje, athlete, profile } = s;
  const primeiroNome = profile.nome.split(" ")[0];

  // plano ainda não começou: só a tela de boas-vindas com o botão "Começar"
  if (!s.planoIniciado) {
    let primeiro: ScheduledWorkout | undefined;
    for (let d = 0; d <= 7 && !primeiro; d++) primeiro = workoutsOnDate(s.plan, s.schedule, addDays(hoje, d), hoje, athlete, s.overrides)[0];
    const porSemana = s.seed.treinos.filter((w) => w.semana === 2 && !w.opcional).length;
    return (
      <div className="space-y-4">
        <header className="flex items-start justify-between gap-3 px-1">
          <div>
            <p className="text-sm text-muted">{formatDateLong(hoje)}</p>
            <h1 className="mt-0.5 text-[32px] font-bold leading-tight tracking-tight">Oi, {primeiroNome}</h1>
          </div>
          <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="mt-1 rounded-[24%]" priority />
        </header>

        <Card className="overflow-hidden p-0" style={{ background: "var(--hero)" }}>
          <div className="h-1.5 bg-accent" aria-hidden />
          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Seu plano está pronto</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Meta: {s.seed.meta.descricao}</h2>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-card-2 px-2 py-3">
                <p className="num text-[22px] font-bold leading-none">8</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">semanas</p>
              </div>
              <div className="rounded-2xl bg-card-2 px-2 py-3">
                <p className="num text-[22px] font-bold leading-none">{porSemana}</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">treinos/sem.</p>
              </div>
              <div className="rounded-2xl bg-card-2 px-2 py-3">
                <p className="num text-[22px] font-bold leading-none">{formatNumber(s.seed.meta.distancia_km)}</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">km no fim</p>
              </div>
            </div>

            <ul className="mt-5 space-y-2.5 text-[15px]">
              <li className="flex gap-3">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">1</span>
                Toque em começar: hoje vira o dia 1 e os dias passam a contar.
              </li>
              <li className="flex gap-3">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">2</span>
                Cada dia mostra o treino em passo a passo, com ritmo e sensação.
              </li>
              <li className="flex gap-3">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">3</span>
                Terminou? Registre. O app ajusta os ritmos com o que você fez.
              </li>
            </ul>

            {primeiro && (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <span>
                  <span className="block text-xs text-muted">
                    {primeiro.data === hoje ? "Seu primeiro treino, hoje" : `Seu primeiro treino: ${DIA_LABEL[primeiro.workout.dia].toLowerCase()}`}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <TypeTag tipo={primeiro.workout.tipo} />
                    {primeiro.km != null && <span className="num font-semibold">{formatNumber(primeiro.km)} km</span>}
                  </span>
                </span>
              </div>
            )}

            <div className="mt-5">
              <ComecarPlanoButton />
            </div>
            {athlete === "leticia" && <p className="mt-3 text-center text-xs text-muted">Antes de começar, faça um check-up médico.</p>}
          </div>
        </Card>
      </div>
    );
  }

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
  const [clima, { data: agendadas }] = await Promise.all([
    temCorrida && profile.lat != null && profile.lon != null ? fetchWeather(Number(profile.lat), Number(profile.lon), hoje, profile.hora_treino ?? "07:00") : Promise.resolve(null),
    supabase.from("scheduled_runs").select("id, inicio, local").gte("inicio", new Date().toISOString()).order("inicio").limit(1),
  ]);
  const calor = clima ? heatAdjustment(clima.temp_c, clima.orvalho_c) : null;
  const proximaAgendada = agendadas?.[0];

  const queda = detectDecline(s.logs, hoje);
  const quartaDanilo = athlete === "danilo" && dayKey(hoje) === "qua" && !antesDoInicio && !fimDoPlano;
  const futebolHoje = s.logs.some((l) => l.data === hoje && l.atividade === "futebol");

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3 px-1">
        <div>
          <p className="text-sm text-muted">{formatDateLong(hoje)}</p>
          <h1 className="mt-0.5 text-[32px] font-bold leading-tight tracking-tight">Oi, {primeiroNome}</h1>
          {semanaRow && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-muted">
                Semana {semanaRow.semana_plano} de 8{MODO_LABEL[semanaRow.modo] ? ` · ${MODO_LABEL[semanaRow.modo]}` : ""}
              </span>
              <span className="flex gap-0.5" aria-hidden>
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className={`h-1.5 w-3 rounded-full ${i < semanaRow.semana_plano ? "bg-accent" : "bg-border"}`} />
                ))}
              </span>
            </div>
          )}
        </div>
        <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="mt-1 rounded-[24%]" priority />
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
            <Card className="overflow-hidden p-0" style={{ background: "var(--hero)" }}>
              <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${tipoCor(t.workout.tipo)}, transparent)` }} aria-hidden />
              <div className="p-5">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Treino de hoje</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight">{TITULO[t.workout.tipo] ?? t.workout.tipo}</h2>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <TypeTag tipo={t.workout.tipo} />
                  {t.workout.opcional && <span className="text-xs font-medium text-muted">Opcional</span>}
                </div>
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
                  <p className="flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold text-accent-ink">
                    <CheckCircle2 className="h-5 w-5" />
                    {st === "feito" ? "Treino feito. Mandou bem!" : st === "parcial" ? "Feito em parte" : "Registrado como não feito"}
                  </p>
                ) : (
                  <Link href={`/registrar?treino=${t.workout.id}&semana=${t.semana_calendario}`} className={buttonVariants({ size: "lg", block: true, className: "shadow-lg shadow-accent/25" })}>
                    Terminei, registrar treino
                  </Link>
                )}
              </div>
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
            <div className="mt-5 flex justify-between gap-1" aria-label="Treinos da semana">
              {semana.map((w) => {
                const st = statusOf(w, s.logs, hoje);
                const Icone = st === "feito" ? Check : st === "parcial" ? Minus : st === "pulado" ? X : null;
                return (
                  <Link
                    key={w.workout.id}
                    href={`/plano/${w.workout.id}?semana=${w.semana_calendario}`}
                    className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                    title={`${DIA_LABEL[w.workout.dia]}: ${w.workout.tipo}`}
                  >
                    <span className="text-[11px] font-medium uppercase text-muted">{w.workout.dia}</span>
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                        st === "feito"
                          ? "border-accent bg-accent text-accent-fg"
                          : st === "parcial"
                            ? "border-accent text-accent-ink"
                            : st === "pulado"
                              ? "border-border text-muted"
                              : st === "hoje"
                                ? "border-fg"
                                : "border-border"
                      }`}
                    >
                      {Icone ? <Icone className="h-4 w-4" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tipoCor(w.workout.tipo) }} />}
                    </span>
                    <span className="max-w-full truncate text-[10px] text-muted">{w.workout.tipo}</span>
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
