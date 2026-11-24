import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Bell, ChevronRight, Gauge, LogOut } from "lucide-react";
import { acwr, bmi, detectDecline, easyFraction, formatNumber, tanakaHrMax } from "@/lib/engine";
import { getPageContext } from "@/lib/server/page";
import { estimateSeries, rpeByType, weeklySeries } from "@/lib/server/metrics";
import { segmentsLookup } from "@/lib/server/coach";
import { Card, SectionTitle } from "@/components/ui/card";
import { EasyPaceChart, EstimateChart, KmChart, LoadChart, RpeChart } from "@/components/charts";
import { LightWeekButton } from "@/components/action-buttons";
import { CoachCard } from "@/components/coach-card";
import { NoProfile } from "@/components/no-profile";
import { signOut } from "@/app/actions";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Perfil" };

export default async function Perfil() {
  const ctx = await getPageContext();
  if ("semPerfil" in ctx) return <NoProfile />;
  const { s } = ctx;
  const p = s.profile;
  const semanas = weeklySeries(s);
  const queda = detectDecline(s.logs, s.hoje);
  const f8020 = easyFraction(s.logs, s.hoje, segmentsLookup(s), s.zonas);
  const a = acwr(s.logs, s.hoje);
  const totalKm = s.logs.filter((l) => l.atividade === "corrida").reduce((x, l) => x + l.distancia_km, 0);

  return (
    <div>
      <header className="mb-5 px-1">
        <h1 className="text-3xl font-semibold tracking-tight">{p.nome}</h1>
        <p className="mt-1 text-sm text-muted">
          {p.nivel === "intermediario" ? "Intermediário" : "Iniciante"} · {p.altura_m ? `${formatNumber(Number(p.altura_m), 2)} m` : ""} · {p.peso_kg ? `${formatNumber(Number(p.peso_kg))} kg` : ""}
          {p.altura_m && p.peso_kg ? ` · IMC ${formatNumber(bmi(Number(p.peso_kg), Number(p.altura_m)))}` : ""}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted">Total</p>
          <p className="num text-2xl font-semibold">{formatNumber(totalKm)}</p>
          <p className="text-xs text-muted">km</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">80/20</p>
          <p className={`num text-2xl font-semibold ${f8020 != null && f8020 < 0.7 ? "text-warn" : ""}`}>{f8020 != null ? `${Math.round(f8020 * 100)}%` : "—"}</p>
          <p className="text-xs text-muted">tempo leve</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">ACWR</p>
          <p className={`num text-2xl font-semibold ${a.acwr != null && a.acwr > 1.5 ? "text-danger" : a.acwr != null && (a.acwr > 1.3 || a.acwr < 0.8) ? "text-warn" : ""}`}>
            {a.acwr != null ? formatNumber(a.acwr, 2) : "—"}
          </p>
          <p className="text-xs text-muted">7 d ÷ 28 d</p>
        </Card>
      </div>

      {queda.ativo && (
        <Card className="mt-4 border-warn/40 bg-warn/10">
          <p className="flex items-center gap-2 font-semibold text-warn">
            <AlertTriangle className="h-5 w-5" /> Queda de rendimento
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

      <div className="mt-4 space-y-2">
        <Link href="/ritmos" className="flex min-h-14 items-center justify-between rounded-2xl border border-border bg-card px-5">
          <span className="flex items-center gap-3 font-medium">
            <Gauge className="h-5 w-5 text-accent-ink" /> Ritmos e metas
          </span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </Link>
        <Link href="/agenda" className="flex min-h-14 items-center justify-between rounded-2xl border border-border bg-card px-5">
          <span className="flex items-center gap-3 font-medium">
            <Bell className="h-5 w-5 text-accent-ink" /> Agenda e lembretes
          </span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </Link>
      </div>

      <SectionTitle>km por semana</SectionTitle>
      <Card className="px-3">
        <KmChart data={semanas} />
      </Card>

      <SectionTitle>Pace dos leves</SectionTitle>
      <Card className="px-3">
        <EasyPaceChart data={semanas} />
        <p className="mt-2 px-2 text-xs text-muted">Pace médio ponderado pelos km, já corrigido pelo calor. Mais alto no gráfico = mais rápido.</p>
      </Card>

      <SectionTitle>Estimativa de 5 km e VDOT</SectionTitle>
      <Card className="px-3">
        <EstimateChart data={estimateSeries(s)} />
      </Card>

      <SectionTitle>Carga semanal e ACWR</SectionTitle>
      <Card className="px-3">
        <LoadChart data={semanas} />
        <p className="mt-2 px-2 text-xs text-muted">Carga = esforço × minutos (Foster). A faixa 0,8–1,3 é só referência: a evidência em corredores é mista.</p>
      </Card>

      <SectionTitle>Esforço médio por tipo</SectionTitle>
      <Card className="px-3">
        <RpeChart data={rpeByType(s)} />
      </Card>

      <SectionTitle>Coach</SectionTitle>
      <CoachCard msg={s.coach[0]} />

      <SectionTitle>Seus dados</SectionTitle>
      <Card>
        <ProfileForm
          inicial={{
            peso_kg: p.peso_kg != null ? Number(p.peso_kg) : null,
            altura_m: p.altura_m != null ? Number(p.altura_m) : null,
            idade: p.idade,
            fc_max: p.fc_max,
            fc_repouso: p.fc_repouso,
            hora_treino: p.hora_treino?.slice(0, 5) ?? null,
            lembrete_diario: p.lembrete_diario,
            lembrete_diario_hora: p.lembrete_diario_hora.slice(0, 5),
            notif_ajustes: p.notif_ajustes,
            notif_semana: p.notif_semana,
            lat: p.lat != null ? Number(p.lat) : null,
            lon: p.lon != null ? Number(p.lon) : null,
          }}
          fcSugerida={p.idade ? tanakaHrMax(p.idade) : null}
        />
      </Card>

      <form action={signOut} className="mt-6">
        <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-medium text-muted hover:bg-card-2">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </form>
    </div>
  );
}
