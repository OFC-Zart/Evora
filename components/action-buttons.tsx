"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Sparkles, Undo2 } from "lucide-react";
import { applyCoachSuggestions, applyLightWeek, applySpikeReduction, undoLastAdjustment } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/engine/format";

export function SpikeBanner(props: { workoutId: string; semana: number; tipo: string; planejado_km: number; limite_km: number; maior_km: number }) {
  const [pending, start] = useTransition();
  const [feito, setFeito] = useState(false);
  if (feito) return null;
  return (
    <div className="rounded-2xl border border-warn/40 bg-warn/10 p-4">
      <p className="flex items-center gap-2 font-semibold text-warn">
        <AlertTriangle className="h-5 w-5" /> Pico de distância
      </p>
      <p className="mt-1 text-sm">
        {props.tipo} de {formatNumber(props.planejado_km)} km passa mais de 10% do seu maior treino dos últimos 30 dias ({formatNumber(props.maior_km)} km).
        Esse tipo de salto aumenta o risco de lesão.
      </p>
      <Button
        size="sm"
        className="mt-3"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await applySpikeReduction(props.workoutId, props.semana, props.limite_km);
            if (r.ok) {
              toast.success(`Treino reduzido para ${formatNumber(props.limite_km)} km`);
              setFeito(true);
            } else toast.error(r.erro);
          })
        }
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Reduzir para {formatNumber(props.limite_km)} km
      </Button>
    </div>
  );
}

export function LightWeekButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await applyLightWeek();
          if (r.ok) toast.success("Próxima semana leve (−20%)");
          else toast.error(r.erro);
        })
      }
    >
      Aplicar semana leve
    </Button>
  );
}

export function UndoButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          const r = await undoLastAdjustment();
          if (r.ok) toast.success(r.desfeitos > 1 ? `${r.desfeitos} paces voltaram ao valor anterior` : "Ajuste desfeito");
          else toast.error(r.erro);
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
      Desfazer último ajuste
    </Button>
  );
}

export function AskCoachButton({ label = "Pedir análise" }: { label?: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const res = await fetch("/api/coach", { method: "POST" });
          const j = await res.json();
          if (j.ok) {
            toast.success(j.ia ? "Análise do coach pronta" : "Análise pronta (por regras)");
            router.refresh();
          } else toast.error(j.erro ?? "Não deu pra analisar agora");
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {label}
    </Button>
  );
}

export function ApplySuggestionsButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await applyCoachSuggestions(id);
          if (r.ok) toast.success(r.aplicadas ? `${r.aplicadas} ajuste(s) aplicado(s), dentro dos limites do motor` : "Nada mudou: os limites semanais já foram usados");
          else toast.error(r.erro);
        })
      }
    >
      Aplicar
    </Button>
  );
}
