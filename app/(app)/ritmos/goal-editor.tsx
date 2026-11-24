"use client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveGoal } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Chips } from "@/components/ui/chips";
import { analyzeGoal } from "@/lib/engine/projection";
import { addMonths, formatDateFar } from "@/lib/engine/dates";
import { formatDuration, maskDuration, parseDuration } from "@/lib/engine/format";
import type { Estimate, Nivel } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

const field = "h-12 w-full rounded-2xl border border-border bg-card px-4 text-base outline-none focus:border-ring";

export function GoalEditor({
  atual,
  hoje,
  vdotAtual,
  nivel,
  mesesTreinados,
  estimates,
}: {
  atual: { distancia_km: number; tempo_alvo_s: number | null; prazo: string | null } | null;
  hoje: string;
  vdotAtual: number | null;
  nivel: Nivel;
  mesesTreinados: number;
  estimates: Estimate[];
}) {
  const [dist, setDist] = useState<"5" | "10" | "21.0975">(atual && [5, 10, 21.0975].includes(atual.distancia_km) ? (String(atual.distancia_km) as "5") : "5");
  const [tempo, setTempo] = useState(atual?.tempo_alvo_s ? formatDuration(atual.tempo_alvo_s) : "");
  const [prazo, setPrazo] = useState<"3" | "4" | "6" | "data">("3");
  const [data, setData] = useState(atual?.prazo ?? addMonths(hoje, 3));
  const [pending, start] = useTransition();

  const prazoData = prazo === "data" ? data : addMonths(hoje, Number(prazo));
  const tempo_s = parseDuration(tempo);
  const previa = useMemo(() => {
    if (!vdotAtual || !tempo_s) return null;
    return analyzeGoal({ distancia_km: Number(dist), tempo_alvo_s: tempo_s, prazo: prazoData }, { vdotAtual, nivel, mesesTreinados, estimates }, hoje);
  }, [vdotAtual, tempo_s, dist, prazoData, nivel, mesesTreinados, estimates, hoje]);

  return (
    <div className="space-y-4">
      <p className="font-semibold">Editar meta</p>
      <Chips
        label="Distância"
        value={dist}
        onChange={setDist}
        options={[
          { value: "5", label: "5 km" },
          { value: "10", label: "10 km" },
          { value: "21.0975", label: "Meia" },
        ]}
      />
      <div>
        <label htmlFor="meta-tempo" className="mb-1.5 block text-sm font-medium">
          Tempo alvo (vazio = só completar)
        </label>
        <input id="meta-tempo" inputMode="numeric" placeholder="25:00" value={tempo} onChange={(e) => setTempo(maskDuration(e.target.value))} className={cn(field, "num text-xl font-semibold")} />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Prazo</p>
        <Chips
          label="Prazo"
          value={prazo}
          onChange={setPrazo}
          options={[
            { value: "3", label: "3 meses" },
            { value: "4", label: "4 meses" },
            { value: "6", label: "6 meses" },
            { value: "data", label: "Escolher data" },
          ]}
        />
        {prazo === "data" && <input type="date" min={hoje} value={data} onChange={(e) => setData(e.target.value)} className={cn(field, "mt-2")} aria-label="Data do prazo" />}
      </div>

      {previa && (
        <div className="rounded-2xl bg-card-2 p-4 text-sm">
          <p className={cn("text-base font-semibold", previa.classificacao === "Realista" ? "text-ok" : previa.classificacao === "Ambiciosa" ? "text-warn" : "text-danger")}>
            {previa.jaAtingida ? "Já está no seu alcance" : previa.classificacao}
          </p>
          <p className="mt-1">
            {previa.dataProvavel ? `Data provável: ${formatDateFar(previa.dataProvavel, hoje)}.` : "Mais de 3 anos pela projeção atual."}
          </p>
          {previa.intermediarias.length > 1 && <p className="num mt-1 text-muted">{previa.intermediarias.map((m) => formatDuration(m.tempo_s)).join(" → ")}</p>}
        </div>
      )}

      <Button
        block
        disabled={pending || (tempo !== "" && !tempo_s)}
        onClick={() =>
          start(async () => {
            const r = await saveGoal({ distancia_km: Number(dist), tempo_alvo_s: tempo_s ?? null, prazo: tempo_s ? prazoData : null });
            if (r.ok) toast.success("Meta salva");
            else toast.error(r.erro);
          })
        }
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Salvar meta
      </Button>
    </div>
  );
}
