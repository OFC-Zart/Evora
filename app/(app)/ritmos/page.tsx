import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  addMonths,
  analyzeGoal,
  currentEstimate,
  formatDateFar,
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatNumber,
  formatPace,
  hrZones,
  monthsBetween,
  projectedTimes,
  raceEquivalents,
  riegel,
  tanakaHrMax,
  zoneName,
  type ZonaComPace,
} from "@/lib/engine";
import { getPageContext } from "@/lib/server/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { UndoButton } from "@/components/action-buttons";
import { NoProfile } from "@/components/no-profile";
import { GoalEditor } from "./goal-editor";
import { ORDEM_ZONAS, ZONA_INFO } from "@/lib/content";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ritmos e metas" };

const ORIGEM: Record<string, string> = { regra: "Regra", teste: "Teste", ia: "Coach IA", manual: "Manual" };
const CLASSE_COR = { Realista: "text-ok", Ambiciosa: "text-warn", "Muito ambiciosa": "text-danger" } as const;

export default async function Ritmos() {
  const ctx = await getPageContext();
  if ("semPerfil" in ctx) return <NoProfile />;
  const { s } = ctx;
  const historico = [...s.history].reverse();
  const temAtivo = s.history.some((h) => !h.revertido);

  const est = currentEstimate(s.estimates, s.zonas, s.athlete, s.hoje);
  const mesesTreinados = Math.max(0, monthsBetween(s.profile.plan_inicio, s.hoje));
  const input = est ? { vdotAtual: est.vdot, nivel: s.profile.nivel, mesesTreinados, estimates: s.estimates.filter((e) => e.fonte !== "projecao") } : null;
  const meta = s.goals.find((g) => g.status === "ativa");
  const proj = input ? projectedTimes(input, meta?.distancia_km ?? 5) : [];
  const analise =
    input && meta?.tempo_alvo_s
      ? analyzeGoal({ distancia_km: meta.distancia_km, tempo_alvo_s: meta.tempo_alvo_s, prazo: meta.prazo ?? addMonths(s.hoje, 6) }, input, s.hoje)
      : null;

  const maiorCorrida = Math.max(
    0,
    ...s.logs.filter((l) => l.atividade === "corrida" && ["Corrida", "Teste", "Livre", "Leve", "Longão"].includes(l.tipo_treino) && l.completou === "sim").map((l) => l.distancia_km),
  );
  const fcMax = s.profile.fc_max ?? (s.profile.idade ? tanakaHrMax(s.profile.idade) : null);
  const fc = fcMax ? hrZones(fcMax, s.profile.fc_repouso) : null;

  return (
    <div>
      <Link href="/perfil" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-muted">
        <ArrowLeft className="h-4 w-4" /> Perfil
      </Link>
      <header className="mb-5 px-1">
        <h1 className="text-3xl font-semibold tracking-tight">Ritmos e metas</h1>
        <p className="mt-1 text-sm text-muted">{s.profile.calibrado ? "Calibrados com os seus treinos." : "A semana 1 calibra estes paces."}</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {ORDEM_ZONAS[s.athlete].map((z) => (
          <Card key={z} className="p-4">
            <p className="text-sm font-medium text-muted">{ZONA_INFO[z].nome}</p>
            <p className="num mt-1 text-3xl font-semibold">
              {formatPace(s.zonas[z])}
              <span className="text-base font-normal text-muted">/km</span>
            </p>
            <p className="mt-2 text-xs text-muted">{ZONA_INFO[z].sente}</p>
            <p className="text-xs text-muted">{ZONA_INFO[z].respiracao}</p>
          </Card>
        ))}
      </div>
      {s.athlete === "danilo" && s.zonas.forte && (
        <p className="mt-3 px-1 text-sm text-muted">
          Solto (100 m): ~{Math.round(s.zonas.forte / 10 - 3)} s, rápido mas sem sprint.
        </p>
      )}

      <SectionTitle>Histórico de ajustes</SectionTitle>
      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <p className="text-sm text-muted">{historico.length ? `${historico.length} mudança(s)` : "Nenhuma mudança ainda"}</p>
          <UndoButton disabled={!temAtivo} />
        </div>
        <ul className="divide-y divide-border">
          {historico.slice(0, 30).map((h) => (
            <li key={h.id} className={cn("px-5 py-3", h.revertido && "opacity-50")}>
              <p className="num flex items-center justify-between gap-2 font-semibold">
                <span>
                  {zoneName(h.zona as ZonaComPace)}: {formatPace(h.antes_s)} → {formatPace(h.depois_s)}
                </span>
                <span className="shrink-0 text-xs font-normal text-muted">
                  {ORIGEM[h.origem]} · {formatDateShort(h.created_at.slice(0, 10))}
                </span>
              </p>
              <p className={cn("mt-0.5 text-sm text-muted", h.revertido && "line-through")}>{h.motivo}</p>
              {h.revertido && <p className="text-xs">Desfeito</p>}
            </li>
          ))}
        </ul>
      </Card>

      <SectionTitle>Estimativa e projeção</SectionTitle>
      <Card>
        {est ? (
          <>
            <p className="text-sm text-muted">5 km hoje{est.aproximada ? " (estimativa pelo pace leve)" : est.fonte === "teste" ? " (teste)" : " (treino forte)"}</p>
            <p className="num mt-1 text-4xl font-semibold">~{formatDuration(est.est_5k_s)}</p>
            <p className="mt-1 text-sm text-muted">VDOT {formatNumber(est.vdot)}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {proj.map((p) => (
                <div key={p.meses} className="rounded-xl bg-card-2 p-3 text-center">
                  <p className="text-xs text-muted">Em {p.meses} meses</p>
                  <p className="num text-lg font-semibold">~{formatDuration(p.tempo_s)}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Projeção {input && input.estimates.length >= 3 ? "pela sua tendência real" : "por ganho médio (corrigida quando houver 3 estimativas em 4+ semanas)"}
              {meta && meta.distancia_km !== 5 ? ` para ${formatNumber(meta.distancia_km)} km` : " para 5 km"}.
            </p>
            {s.athlete === "leticia" && est.aproximada && (
              <p className="mt-2 text-xs text-muted">Enquanto você ainda não corre 5 km seguidos, este número é só uma referência.</p>
            )}
          </>
        ) : (
          <p className="text-muted">Sem dados suficientes ainda.</p>
        )}
      </Card>

      <SectionTitle>Meta</SectionTitle>
      <Card>
        {meta ? (
          <>
            <p className="text-sm text-muted">Meta atual</p>
            <p className="mt-1 text-2xl font-semibold">
              {meta.tempo_alvo_s ? `${formatNumber(meta.distancia_km)} km em ${formatDuration(meta.tempo_alvo_s)}` : `Correr ${formatNumber(meta.distancia_km)} km`}
            </p>
            {meta.prazo && <p className="text-sm text-muted">Prazo: {formatDateLong(meta.prazo)}</p>}

            {analise ? (
              <div className="mt-4 space-y-3">
                <p className={cn("text-lg font-semibold", CLASSE_COR[analise.classificacao])}>
                  {analise.jaAtingida ? "Já está no seu alcance!" : analise.classificacao}
                </p>
                <p className="text-sm">
                  Precisa de VDOT {formatNumber(analise.vdotNecessario)}; no {meta.prazo ? "prazo" : "horizonte de 6 meses"} a projeção é {formatNumber(analise.vdotNoPrazo)}.
                  {analise.dataProvavel ? ` Data provável: ${formatDateFar(analise.dataProvavel, s.hoje)} (~${formatNumber(analise.mesesProvaveis ?? 0)} meses).` : " Leva mais de 3 anos pela projeção atual."}
                </p>
                {analise.intermediarias.length > 1 && (
                  <div>
                    <p className="text-sm font-semibold">Metas intermediárias</p>
                    <p className="num mt-1 text-[15px]">
                      {analise.intermediarias.map((m) => `${formatDuration(m.tempo_s)} (${formatDateFar(m.data, s.hoje)})`).join(" → ")}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm">Maior corrida contínua registrada: <strong className="num">{formatNumber(maiorCorrida)} km</strong> de {formatNumber(meta.distancia_km)} km.</p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-card-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (maiorCorrida / meta.distancia_km) * 100)}%` }} />
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted">Nenhuma meta ativa.</p>
        )}
        <div className="mt-5 border-t border-border pt-5">
          <GoalEditor
            atual={meta ? { distancia_km: meta.distancia_km, tempo_alvo_s: meta.tempo_alvo_s, prazo: meta.prazo } : null}
            hoje={s.hoje}
            vdotAtual={est?.vdot ?? null}
            nivel={s.profile.nivel}
            mesesTreinados={mesesTreinados}
            estimates={input?.estimates ?? []}
          />
        </div>
      </Card>

      {est && (
        <>
          <SectionTitle>Equivalências pelo seu VDOT</SectionTitle>
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {raceEquivalents(est.vdot).map((r) => (
                <li key={r.km} className="flex items-center justify-between px-5 py-3">
                  <span>{r.nome}</span>
                  <span className="num text-right">
                    <strong>{formatDuration(r.tempo_s)}</strong>
                    <span className="ml-2 text-xs text-muted">Riegel {formatDuration(riegel(est.est_5k_s, 5, r.km))}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="mt-2 px-1 text-xs text-muted">Previsões: cerca de 80% das pessoas ficam perto disso. Distâncias longas pedem treino específico.</p>
        </>
      )}

      {fc && fcMax && (
        <>
          <SectionTitle>Frequência cardíaca</SectionTitle>
          <Card>
            <p className="text-sm text-muted">
              FC máxima {s.profile.fc_max ? "informada" : "estimada (Tanaka: 208 − 0,7 × idade, erro ~10 bpm)"}: <strong className="num">{fcMax} bpm</strong> · {fc.metodo}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {(["leve", "moderado", "forte"] as const).map((z) => (
                <div key={z} className="rounded-xl bg-card-2 p-3">
                  <p className="text-xs capitalize text-muted">{z}</p>
                  <p className="num font-semibold">
                    {fc[z][0]}–{fc[z][1]}
                  </p>
                </div>
              ))}
            </div>
            {!s.profile.fc_max && <p className="mt-3 text-xs text-muted">Coloque sua FC máxima real no perfil para o motor usar a regra de FC (8.2).</p>}
          </Card>
        </>
      )}
    </div>
  );
}
