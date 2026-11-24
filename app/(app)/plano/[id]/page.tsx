import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DIA_LABEL, formatDayMonth, formatDuration, formatNumber, formatPace, logFor, resolveWorkout, type ScheduleWeek } from "@/lib/engine";
import { getPageContext } from "@/lib/server/page";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { TypeTag } from "@/components/type-tag";
import { WorkoutDetail } from "@/components/workout-detail";
import { NoProfile } from "@/components/no-profile";
import { DeleteLogButton } from "@/components/delete-log-button";
import { RPE_LABEL } from "@/lib/content";

export const metadata: Metadata = { title: "Treino" };

export default async function Treino({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semana?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getPageContext();
  if ("semPerfil" in ctx) return <NoProfile />;
  const { s } = ctx;
  const pw = s.plan.find((w) => w.id === id);
  if (!pw) notFound();
  const semanaNum = Number(sp.semana) || s.schedule.find((w) => w.semana_plano === pw.semana)?.semana_calendario;
  const week: ScheduleWeek = s.schedule.find((w) => w.semana_calendario === semanaNum) ?? {
    semana_calendario: pw.semana,
    semana_plano: pw.semana,
    modo: "normal",
  };
  const sw = resolveWorkout(pw, week, s.profile.plan_inicio, s.athlete, s.overrides);
  const log = logFor(sw, s.logs);
  const semanaFechada = s.closures.some((c) => c.semana_calendario === sw.semana_calendario);

  return (
    <div className="space-y-4">
      <Link href="/plano" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-muted">
        <ArrowLeft className="h-4 w-4" /> Plano
      </Link>
      <header className="px-1">
        <TypeTag tipo={pw.tipo} />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {DIA_LABEL[pw.dia]}, {formatDayMonth(sw.data)}
        </h1>
        <p className="text-sm text-muted">
          Semana {week.semana_plano} do plano{pw.opcional ? " · opcional" : ""}
        </p>
      </header>
      <Card>
        <WorkoutDetail sw={sw} zonas={s.zonas} athlete={s.athlete} seed={s.seed} />
      </Card>

      {log ? (
        <Card>
          <p className="text-sm font-medium text-muted">Seu registro</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <p className="num text-xl font-semibold">{log.distancia_km ? `${formatNumber(log.distancia_km, 2)} km` : "—"}</p>
              <p className="text-xs text-muted">distância</p>
            </div>
            <div>
              <p className="num text-xl font-semibold">{formatDuration(log.tempo_s)}</p>
              <p className="text-xs text-muted">tempo</p>
            </div>
            <div>
              <p className="num text-xl font-semibold">{log.pace_s_por_km ? formatPace(log.pace_s_por_km) : "—"}</p>
              <p className="text-xs text-muted">pace{log.pace_alvo_s ? ` (alvo ${formatPace(log.pace_alvo_s)})` : ""}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">
            Esforço {log.rpe} ({RPE_LABEL[log.rpe]}) · {log.completou === "sim" ? "completou" : log.completou === "parcial" ? "parcial" : "não completou"}
            {log.dor !== "nenhuma" ? ` · dor ${log.dor === "articulacao" ? "na articulação" : "muscular leve"}` : ""}
          </p>
          {log.notas && <p className="mt-2 text-sm">{log.notas}</p>}
          {!semanaFechada && (
            <div className="mt-4">
              <DeleteLogButton id={log.id} />
            </div>
          )}
        </Card>
      ) : sw.data <= s.hoje ? (
        <Link href={`/registrar?treino=${pw.id}&semana=${sw.semana_calendario}`} className={buttonVariants({ size: "lg", block: true })}>
          Registrar este treino
        </Link>
      ) : null}
    </div>
  );
}
