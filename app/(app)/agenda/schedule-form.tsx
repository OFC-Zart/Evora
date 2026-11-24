"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { deleteScheduledRun, scheduleRun } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Chips } from "@/components/ui/chips";

const field = "h-12 w-full rounded-2xl border border-border bg-card px-4 text-base outline-none focus:border-ring";

export function ScheduleForm({ hoje, treinos, horaPadrao }: { hoje: string; treinos: { id: string; data: string; rotulo: string }[]; horaPadrao: string }) {
  const [treino, setTreino] = useState(treinos[0]?.id ?? "");
  const [data, setData] = useState(treinos[0]?.data ?? hoje);
  const [hora, setHora] = useState(horaPadrao);
  const [local, setLocal] = useState("");
  const [lembrete, setLembrete] = useState<"na_hora" | "30" | "60" | "vespera">("30");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="ag-treino" className="mb-1.5 block text-sm font-medium">
          Treino do plano
        </label>
        <select
          id="ag-treino"
          value={treino}
          onChange={(e) => {
            setTreino(e.target.value);
            const t = treinos.find((x) => x.id === e.target.value);
            if (t) setData(t.data);
          }}
          className={field}
        >
          {treinos.map((t) => (
            <option key={t.id + t.data} value={t.id}>
              {t.rotulo}
            </option>
          ))}
          <option value="">Sem vínculo (corrida livre)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ag-data" className="mb-1.5 block text-sm font-medium">
            Data
          </label>
          <input id="ag-data" type="date" min={hoje} value={data} onChange={(e) => setData(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="ag-hora" className="mb-1.5 block text-sm font-medium">
            Hora
          </label>
          <input id="ag-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="ag-local" className="mb-1.5 block text-sm font-medium">
          Local
        </label>
        <input id="ag-local" value={local} maxLength={200} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Parque do Ibirapuera" className={field} />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Lembrete</p>
        <Chips
          label="Lembrete"
          value={lembrete}
          onChange={setLembrete}
          options={[
            { value: "na_hora", label: "Na hora" },
            { value: "30", label: "30 min antes" },
            { value: "60", label: "1 h antes" },
            { value: "vespera", label: "Véspera 20h" },
          ]}
        />
      </div>
      <Button
        block
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await scheduleRun({ data, hora, local, plan_workout_id: treino || null, lembrete });
            if (r.ok) {
              toast.success("Corrida marcada");
              setLocal("");
            } else toast.error(r.erro);
          })
        }
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Marcar corrida
      </Button>
    </div>
  );
}

export function DeleteRunButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Apagar corrida"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await deleteScheduledRun(id);
          if (!r.ok) toast.error(r.erro);
        })
      }
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
