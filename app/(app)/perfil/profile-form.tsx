"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { updateProfile } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Dados = {
  peso_kg: number | null;
  altura_m: number | null;
  idade: number | null;
  fc_max: number | null;
  fc_repouso: number | null;
  hora_treino: string | null;
  lembrete_diario: boolean;
  lembrete_diario_hora: string;
  notif_ajustes: boolean;
  notif_semana: boolean;
  lat: number | null;
  lon: number | null;
};

const field = "h-12 w-full rounded-2xl border border-border bg-card px-4 text-base outline-none focus:border-ring";

function num(v: string): number | null {
  const n = Number(v.replace(",", "."));
  return v.trim() && Number.isFinite(n) ? n : null;
}

export function ProfileForm({ inicial, fcSugerida }: { inicial: Dados; fcSugerida: number | null }) {
  const [d, setD] = useState(inicial);
  const [txt, setTxt] = useState({
    peso: inicial.peso_kg?.toString().replace(".", ",") ?? "",
    altura: inicial.altura_m?.toString().replace(".", ",") ?? "",
    idade: inicial.idade?.toString() ?? "",
    fcMax: inicial.fc_max?.toString() ?? "",
    fcRep: inicial.fc_repouso?.toString() ?? "",
  });
  const [pending, start] = useTransition();

  const toggle = (k: "lembrete_diario" | "notif_ajustes" | "notif_semana", rotulo: string) => (
    <label className="flex min-h-12 items-center justify-between gap-3">
      <span className="text-[15px]">{rotulo}</span>
      <input type="checkbox" checked={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.checked })} className="h-6 w-11 accent-[var(--accent-ink)]" />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["peso", "Peso (kg)", "decimal"],
            ["altura", "Altura (m)", "decimal"],
            ["idade", "Idade", "numeric"],
            ["fcMax", "FC máxima", "numeric"],
            ["fcRep", "FC de repouso", "numeric"],
          ] as const
        ).map(([k, rotulo, mode]) => (
          <div key={k}>
            <label htmlFor={`pf-${k}`} className="mb-1.5 block text-sm font-medium">
              {rotulo}
            </label>
            <input id={`pf-${k}`} inputMode={mode} value={txt[k]} onChange={(e) => setTxt({ ...txt, [k]: e.target.value })} className={cn(field, "num")} placeholder={k === "fcMax" && fcSugerida ? `~${fcSugerida}` : ""} />
          </div>
        ))}
        <div>
          <label htmlFor="pf-hora" className="mb-1.5 block text-sm font-medium">
            Hora do treino
          </label>
          <input id="pf-hora" type="time" value={d.hora_treino ?? ""} onChange={(e) => setD({ ...d, hora_treino: e.target.value || null })} className={field} />
        </div>
      </div>
      {fcSugerida && !txt.fcMax && <p className="text-xs text-muted">Sem FC máxima medida, a estimativa pela idade é ~{fcSugerida} bpm (erro de ~10 bpm). O motor só usa a regra de FC com a sua FC real.</p>}

      <div className="divide-y divide-border rounded-2xl border border-border px-4">
        {toggle("lembrete_diario", "Lembrete diário do treino de hoje")}
        {d.lembrete_diario && (
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span className="text-[15px] text-muted">Horário do lembrete</span>
            <input type="time" value={d.lembrete_diario_hora} onChange={(e) => setD({ ...d, lembrete_diario_hora: e.target.value })} className="h-10 rounded-xl border border-border bg-card px-2" />
          </label>
        )}
        {toggle("notif_ajustes", "Avisar quando meu pace mudar")}
        {toggle("notif_semana", "Avisar quando a semana fechar")}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
        <div className="text-sm">
          <p className="font-medium">Local para o clima</p>
          <p className="text-muted">{d.lat != null && d.lon != null ? `${d.lat.toFixed(2)}, ${d.lon.toFixed(2)}` : "Não definido"}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          type="button"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition(
              (pos) => {
                setD({ ...d, lat: Math.round(pos.coords.latitude * 1000) / 1000, lon: Math.round(pos.coords.longitude * 1000) / 1000 });
                toast.success("Local atualizado (aproximado)");
              },
              () => toast.error("Não deu pra pegar a localização"),
            )
          }
        >
          <MapPin className="h-4 w-4" /> Usar aqui
        </Button>
      </div>

      <Button
        block
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await updateProfile({
              ...d,
              peso_kg: num(txt.peso),
              altura_m: num(txt.altura),
              idade: num(txt.idade),
              fc_max: num(txt.fcMax),
              fc_repouso: num(txt.fcRep),
            });
            if (r.ok) toast.success("Perfil salvo");
            else toast.error(r.erro);
          })
        }
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Salvar
      </Button>
    </div>
  );
}
