import type { Metadata } from "next";
import Link from "next/link";
import { Check, ChevronRight, Circle, CircleDot, Minus, X } from "lucide-react";
import { DIA_CURTO, formatDateShort, formatNumber, statusOf, weekRange, workoutsOfCalendarWeek, type StatusTreino } from "@/lib/engine";
import { getPageContext } from "@/lib/server/page";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, SectionTitle } from "@/components/ui/card";
import { TypeTag } from "@/components/type-tag";
import { NoProfile } from "@/components/no-profile";
import { DICAS, MODO_LABEL } from "@/lib/content";

export const metadata: Metadata = { title: "Plano" };

const STATUS: Record<StatusTreino, { icon: typeof Check; label: string; cls: string }> = {
  feito: { icon: Check, label: "Feito", cls: "bg-accent text-accent-fg" },
  parcial: { icon: Minus, label: "Parcial", cls: "bg-accent/40 text-fg" },
  pulado: { icon: X, label: "Pulado", cls: "bg-danger/15 text-danger" },
  hoje: { icon: CircleDot, label: "Hoje", cls: "bg-fg text-bg" },
  futuro: { icon: Circle, label: "Futuro", cls: "bg-card-2 text-muted" },
};

export default async function Plano() {
  const ctx = await getPageContext();
  if ("semPerfil" in ctx) return <NoProfile />;
  const { s } = ctx;
  const semanas = [...s.schedule].sort((a, b) => a.semana_calendario - b.semana_calendario);
  const aberta = `s${Math.min(Math.max(1, s.semanaAtual), semanas.at(-1)?.semana_calendario ?? 1)}`;

  return (
    <div>
      <header className="mb-5 px-1">
        <h1 className="text-3xl font-semibold tracking-tight">Plano</h1>
        <p className="mt-1 text-sm text-muted">
          {s.seed.meta.descricao} · {semanas.length} semanas no calendário
        </p>
      </header>

      <Accordion type="single" collapsible defaultValue={aberta} className="space-y-3">
        {semanas.map((w) => {
          const treinos = workoutsOfCalendarWeek(s.plan, s.schedule, w.semana_calendario, s.profile.plan_inicio, s.athlete, s.overrides);
          const { inicio, fim } = weekRange(s.profile.plan_inicio, w.semana_calendario);
          const obrig = treinos.filter((t) => !t.workout.opcional);
          const feitos = obrig.filter((t) => ["feito", "parcial"].includes(statusOf(t, s.logs, s.hoje))).length;
          const km = obrig.reduce((a, t) => a + (t.km ?? 0), 0);
          const atual = w.semana_calendario === s.semanaAtual;
          return (
            <AccordionItem key={w.semana_calendario} value={`s${w.semana_calendario}`} className={atual ? "border-fg/30" : undefined}>
              <AccordionTrigger>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    Semana {w.semana_plano}
                    {atual && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-fg">Agora</span>}
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-muted">
                    {formatDateShort(inicio)}–{formatDateShort(fim)} · {feitos}/{obrig.length} · {formatNumber(km)} km
                    {MODO_LABEL[w.modo] ? ` · ${MODO_LABEL[w.modo]}` : ""}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1.5">
                  {treinos.map((t) => {
                    const st = statusOf(t, s.logs, s.hoje);
                    const S = STATUS[st];
                    return (
                      <li key={t.workout.id}>
                        <Link href={`/plano/${t.workout.id}?semana=${t.semana_calendario}`} className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-card-2">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${S.cls}`} aria-label={S.label}>
                            <S.icon className="h-4 w-4" strokeWidth={2.6} />
                          </span>
                          <span className="w-9 shrink-0 text-sm font-medium text-muted">{DIA_CURTO[t.workout.dia]}</span>
                          <span className="min-w-0 flex-1">
                            <TypeTag tipo={t.workout.tipo} />
                            {t.workout.opcional && <span className="ml-2 text-xs text-muted">opcional</span>}
                          </span>
                          <span className="num shrink-0 text-sm font-semibold">{t.km != null ? `${formatNumber(t.km)} km` : ""}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {w.motivo && <p className="mt-2 px-2 text-xs text-muted">{w.motivo}</p>}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <SectionTitle>Respiração e regras</SectionTitle>
      <Card className="divide-y divide-border p-0">
        {DICAS[s.athlete].map((d) => (
          <div key={d.titulo} className="px-5 py-3.5">
            <p className="font-medium">
              {d.titulo} <span className="ml-1 text-xs font-normal text-muted">{d.tipo}</span>
            </p>
            <p className="mt-0.5 text-sm text-muted">{d.detalhe}</p>
          </div>
        ))}
      </Card>
      {s.seed.restricoes.length > 0 && <p className="mt-4 px-2 text-sm text-muted">{s.seed.restricoes.join(" · ")}</p>}
    </div>
  );
}
