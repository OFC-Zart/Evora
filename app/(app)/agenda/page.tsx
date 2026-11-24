import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { DIA_CURTO, addDays, formatDateShort, plannedBetween } from "@/lib/engine";
import { getPageContext } from "@/lib/server/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { TypeTag } from "@/components/type-tag";
import { NoProfile } from "@/components/no-profile";
import { PushManager } from "@/components/push-manager";
import { ScheduleForm, DeleteRunButton } from "./schedule-form";

export const metadata: Metadata = { title: "Agenda" };

const LEMBRETE: Record<string, string> = { na_hora: "na hora", "30": "30 min antes", "60": "1 h antes", vespera: "na véspera às 20h" };

export default async function Agenda() {
  const ctx = await getPageContext();
  if ("semPerfil" in ctx) return <NoProfile />;
  const { supabase, s } = ctx;
  const { data: corridas } = await supabase
    .from("scheduled_runs")
    .select("*")
    .gte("inicio", new Date(Date.now() - 3 * 3600_000).toISOString())
    .order("inicio");

  const proximos = plannedBetween(s.plan, s.schedule, s.hoje, addDays(s.hoje, 13), s.profile.plan_inicio, s.athlete, { incluirOpcionais: true })
    .filter((p) => p.workout.tipo !== "Força")
    .map((p) => ({ id: p.workout.id, data: p.data, rotulo: `${DIA_CURTO[p.workout.dia]} ${formatDateShort(p.data)} · ${p.workout.tipo}` }));
  const nomeTreino = new Map(s.plan.map((w) => [w.id, w.tipo]));

  return (
    <div>
      <Link href="/perfil" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-muted">
        <ArrowLeft className="h-4 w-4" /> Perfil
      </Link>
      <header className="mb-5 px-1">
        <h1 className="text-3xl font-semibold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-muted">Marca a corrida e recebe o lembrete no celular.</p>
      </header>

      <PushManager vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />

      <SectionTitle>Marcar corrida</SectionTitle>
      <Card>
        <ScheduleForm hoje={s.hoje} treinos={proximos} horaPadrao={s.profile.hora_treino?.slice(0, 5) ?? "07:00"} />
      </Card>

      <SectionTitle>Próximas</SectionTitle>
      <Card className="p-0">
        <ul className="divide-y divide-border">
          {(corridas ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="num font-semibold">
                  {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(c.inicio))}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                  {c.plan_workout_id && nomeTreino.get(c.plan_workout_id) && <TypeTag tipo={nomeTreino.get(c.plan_workout_id)!} />}
                  {c.local && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {c.local}
                    </span>
                  )}
                  <span>lembrete {LEMBRETE[c.lembrete]}</span>
                  {c.enviado && <span>· enviado</span>}
                </p>
              </div>
              <DeleteRunButton id={c.id} />
            </li>
          ))}
          {!corridas?.length && <li className="px-5 py-6 text-sm text-muted">Nenhuma corrida marcada.</li>}
        </ul>
      </Card>
      <p className="mt-3 px-1 text-xs text-muted">O lembrete diário do treino de hoje fica no Perfil.</p>
    </div>
  );
}
