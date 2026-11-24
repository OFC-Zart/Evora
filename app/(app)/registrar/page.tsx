import type { Metadata } from "next";
import {
  DIA_CURTO,
  addDays,
  formatDateShort,
  isRunType,
  logFor,
  plannedBetween,
  repTarget,
  workoutTime,
} from "@/lib/engine";
import { getPageContext } from "@/lib/server/page";
import { NoProfile } from "@/components/no-profile";
import { LogForm, type WorkoutOption } from "./log-form";

export const metadata: Metadata = { title: "Registrar" };

export default async function Registrar({ searchParams }: { searchParams: Promise<{ treino?: string; semana?: string; atividade?: string }> }) {
  const sp = await searchParams;
  const ctx = await getPageContext();
  if ("semPerfil" in ctx) return <NoProfile />;
  const { s } = ctx;

  // treinos dos últimos 10 dias e de hoje que ainda não foram registrados
  const candidatos = plannedBetween(s.plan, s.schedule, addDays(s.hoje, -10), s.hoje, s.profile.plan_inicio, s.athlete, { incluirOpcionais: true });
  const opcoes: WorkoutOption[] = candidatos
    .filter((c) => !logFor(c, s.logs) || (sp.treino === c.workout.id && Number(sp.semana) === c.semana_calendario))
    .reverse()
    .map((c) => {
      const t = workoutTime(c.segmentos, s.zonas, s.athlete);
      const rep = repTarget(c.segmentos, s.zonas);
      const temMaximo = c.segmentos.some((x) => x.tipo === "corrida" && x.zona === "maximo");
      const testeKm = temMaximo ? c.segmentos.find((x) => x.tipo === "corrida" && x.zona === "maximo")! : null;
      return {
        id: c.workout.id,
        semana: c.semana_calendario,
        data: c.data,
        rotulo: `${DIA_CURTO[c.workout.dia]} ${formatDateShort(c.data)}`,
        tipo: c.workout.tipo,
        km: c.km,
        tempo_s: Math.round(t.total_s),
        atividade: c.workout.tipo === "Força" ? "forca" : "corrida",
        corrida: isRunType(c.workout.tipo),
        reps: rep ? { vezes: rep.vezes, dist_km: rep.dist_km, alvo_s: Math.round(rep.alvo_s) } : null,
        teste: c.workout.tipo === "Teste" ? { dist_km: testeKm && testeKm.tipo === "corrida" ? testeKm.distancia_km : (c.km ?? 5), maximo: temMaximo } : null,
      };
    });

  const preferida =
    opcoes.find((o) => o.id === sp.treino && (!sp.semana || o.semana === Number(sp.semana))) ??
    (sp.atividade ? undefined : opcoes.find((o) => o.data === s.hoje));

  return (
    <div>
      <header className="mb-5 px-1">
        <h1 className="text-3xl font-semibold tracking-tight">Registrar</h1>
        <p className="mt-1 text-sm text-muted">Copia do relógio: distância, tempo e como foi.</p>
      </header>
      <LogForm
        opcoes={opcoes}
        inicial={preferida?.id ? `${preferida.id}|${preferida.semana}` : sp.atividade === "futebol" ? "futebol" : "livre"}
        hoje={s.hoje}
        athlete={s.athlete}
      />
    </div>
  );
}
