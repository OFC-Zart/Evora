import { Clock, Route, Thermometer } from "lucide-react";
import {
  formatNumber,
  formatPace,
  formatWorkoutTotal,
  heatAdjustedPace,
  segmentLines,
  workoutTime,
  type AthleteId,
  type ScheduledWorkout,
  type Zonas,
} from "@/lib/engine";
import type { AthleteSeed } from "@/lib/plan-data";
import { DESCANSO_FORCA, MODO_LABEL } from "@/lib/content";
import { tipoCor } from "@/lib/ui/colors";

const ZONA_COR: Record<string, string> = {
  leve: "var(--t-leve)",
  regenerativo: "var(--t-regen)",
  moderado: "var(--t-ritmo)",
  forte: "var(--t-tiros)",
  solto: "var(--t-fartlek)",
  confortavel: "var(--t-leve)",
  maximo: "var(--t-teste)",
  corrida: "var(--t-corrida)",
  caminhada: "var(--t-livre)",
  caminhada_livre: "var(--t-livre)",
};

/** Zonas com o pace corrigido pelo calor (para mostrar no dia). */
function zonesForHeat(zonas: Zonas, pct: number): Zonas {
  if (!pct) return zonas;
  const out: Zonas = {};
  for (const [k, v] of Object.entries(zonas)) (out as Record<string, number>)[k] = Math.round(heatAdjustedPace(v as number, pct));
  return out;
}

export function WorkoutDetail({
  sw,
  zonas,
  athlete,
  seed,
  calorPct = 0,
  compact = false,
}: {
  sw: ScheduledWorkout;
  zonas: Zonas;
  athlete: AthleteId;
  seed: AthleteSeed;
  calorPct?: number;
  compact?: boolean;
}) {
  const z = zonesForHeat(zonas, calorPct);
  const lines = segmentLines(sw.segmentos, z, athlete);
  const t = workoutTime(sw.segmentos, z, athlete);
  const forca = sw.workout.tipo === "Força";
  const modo = MODO_LABEL[sw.modo];

  return (
    <div>
      {(modo || sw.override) && (
        <p className="mb-3 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent-ink">{sw.override?.motivo ?? modo}</p>
      )}

      <ol className="space-y-2">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-3 rounded-xl bg-card-2 px-3 py-3">
            <span className="mt-1 w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: l.zona ? ZONA_COR[l.zona] : tipoCor(sw.workout.tipo) }} aria-hidden />
            <div className="min-w-0">
              <p className="num text-[17px] font-semibold leading-snug">{l.texto}</p>
              {l.detalhe && <p className="num mt-0.5 text-sm text-muted">{l.detalhe}</p>}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border px-3 py-3">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Clock className="h-3.5 w-3.5" /> Tempo estimado
          </p>
          <p className="num mt-1 text-2xl font-semibold">
            {t.estimado ? "≈ " : ""}
            {formatWorkoutTotal(t.total_s)}
          </p>
          {t.aquecimento_s > 0 && <p className="mt-0.5 text-xs text-muted">+ ~{Math.round(t.aquecimento_s / 60)} min andando</p>}
        </div>
        <div className="rounded-xl border border-border px-3 py-3">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Route className="h-3.5 w-3.5" /> Distância
          </p>
          <p className="num mt-1 text-2xl font-semibold">{sw.km != null ? `${formatNumber(sw.km)} km` : forca ? "Em casa" : "—"}</p>
        </div>
      </div>

      {calorPct >= 1 && (
        <p className="mt-3 flex items-start gap-2 text-sm text-warn">
          <Thermometer className="mt-0.5 h-4 w-4 shrink-0" />
          Paces já {formatNumber(calorPct)}% mais lentos por causa do calor. Vai pelo esforço.
        </p>
      )}

      {(sw.workout.observacao || sw.workout.meta_texto) && !compact && (
        <div className="mt-4 space-y-1 text-[15px]">
          {sw.workout.observacao && <p>{sw.workout.observacao}</p>}
          {sw.workout.meta_texto && <p className="text-muted">{sw.workout.meta_texto}</p>}
        </div>
      )}

      {forca && !compact && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">1 volta = os exercícios em sequência</p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {seed.forca.map((e) => (
              <li key={e.nome} className="flex items-start justify-between gap-3 px-3 py-3">
                <div>
                  <p className="font-medium">{e.nome}</p>
                  <p className="text-sm text-muted">{e.como}</p>
                </div>
                <span className="num shrink-0 font-semibold">{e.quantidade}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">Descanso: {DESCANSO_FORCA[athlete]}.</p>
        </div>
      )}
    </div>
  );
}

export function ZonePill({ nome, pace }: { nome: string; pace: number }) {
  return (
    <span className="num rounded-full bg-card-2 px-3 py-1 text-sm">
      {nome} <strong>{formatPace(pace)}</strong>
    </span>
  );
}
