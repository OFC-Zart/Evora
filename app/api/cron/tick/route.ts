import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dayKey, isoDateInTz, timeInTz, workoutsOnDate, type AthleteId } from "@/lib/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadState } from "@/lib/server/state";
import { ensureWeeksClosed } from "@/lib/server/weeks";
import { getCronSecret } from "@/lib/server/secrets";
import { sendPushToAthlete } from "@/lib/server/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorized(req: NextRequest): Promise<boolean> {
  const secret = await getCronSecret();
  if (!secret) return false;
  const got = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Chamado a cada minuto pelo pg_cron do Supabase (supabase/cron.sql).
//  1) lembretes de corridas agendadas que venceram;
//  2) lembrete diário do "treino de hoje" no horário escolhido;
//  3) fechamento da semana no domingo a partir das 20h.
export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const agora = new Date();
  const hoje = isoDateInTz(agora);
  const hora = timeInTz(agora);
  const relatorio = { corridas: 0, diarios: 0, semanas: 0 };

  // 1) corridas agendadas
  const { data: vencidos } = await admin
    .from("scheduled_runs")
    .select("*")
    .eq("enviado", false)
    .lte("lembrete_em", agora.toISOString())
    .limit(50);
  for (const r of vencidos ?? []) {
    // marca antes de enviar para não duplicar se o próximo tick chegar junto
    const { data: marcado } = await admin.from("scheduled_runs").update({ enviado: true }).eq("id", r.id).eq("enviado", false).select("id");
    if (!marcado?.length) continue;
    if (new Date(r.inicio).getTime() < agora.getTime() - 2 * 3600_000) continue; // muito antigo
    const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(r.inicio));
    await sendPushToAthlete(admin, r.athlete_id, {
      title: r.lembrete === "na_hora" ? "Hora de correr! 🏃" : "Corrida agendada",
      body: `${quando}${r.local ? ` · ${r.local}` : ""}`,
      url: "/hoje",
      tag: `corrida-${r.id}`,
    });
    relatorio.corridas++;
  }

  // 2) lembrete diário e 3) fechamento da semana
  const { data: perfis } = await admin.from("profiles").select("athlete_id, lembrete_diario, lembrete_diario_hora, lembrete_diario_ultimo").not("user_id", "is", null);
  for (const p of perfis ?? []) {
    const athlete = p.athlete_id as AthleteId;
    const precisaDiario = p.lembrete_diario && (p.lembrete_diario_hora as string).slice(0, 5) <= hora && p.lembrete_diario_ultimo !== hoje;
    const domingoNoite = dayKey(hoje) === "dom" && hora >= "20:00";
    if (!precisaDiario && !domingoNoite) continue;

    const s = await loadState(admin, athlete);
    if (!s) continue;

    if (precisaDiario) {
      await admin.from("profiles").update({ lembrete_diario_ultimo: hoje }).eq("athlete_id", athlete);
      const treinos = workoutsOnDate(s.plan, s.schedule, hoje, s.profile.plan_inicio, athlete, s.overrides);
      const jaFeito = treinos.every((t) => s.logs.some((l) => l.plan_workout_id === t.workout.id && l.semana_calendario === t.semana_calendario));
      if (treinos.length && !jaFeito) {
        const t = treinos[0];
        await sendPushToAthlete(admin, athlete, {
          title: `Treino de hoje: ${t.workout.tipo}`,
          body: t.km ? `${String(t.km).replace(".", ",")} km${t.workout.observacao ? ` · ${t.workout.observacao}` : ""}` : (t.workout.observacao ?? "Bora!"),
          url: "/hoje",
          tag: `hoje-${hoje}`,
        });
        relatorio.diarios++;
      }
    }
    if (domingoNoite) {
      const fechadas = await ensureWeeksClosed(admin, s, { now: agora, useAi: true, push: true });
      relatorio.semanas += fechadas.length;
    }
  }

  return NextResponse.json({ ok: true, ...relatorio, em: `${hoje} ${hora}` });
}

export const GET = POST;
