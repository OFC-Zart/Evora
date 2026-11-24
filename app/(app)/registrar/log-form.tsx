"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronDown, Loader2, Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { logWorkout, type AdjustFeedback } from "@/app/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chips } from "@/components/ui/chips";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SpikeBanner } from "@/components/action-buttons";
import { TypeDot } from "@/components/type-tag";
import { formatDuration, formatNumber, formatPace, maskDuration, parseDuration } from "@/lib/engine/format";
import { RPE_LABEL } from "@/lib/content";
import type { AthleteId } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

export interface WorkoutOption {
  id: string;
  semana: number;
  data: string;
  rotulo: string;
  tipo: string;
  km: number | null;
  tempo_s: number;
  atividade: "corrida" | "forca";
  corrida: boolean;
  reps: { vezes: number; dist_km: number; alvo_s: number } | null;
  teste: { dist_km: number; maximo: boolean } | null;
}

const field = "h-12 w-full rounded-2xl border border-border bg-card px-4 text-base outline-none placeholder:text-muted focus:border-ring";
const label = "mb-1.5 block text-sm font-medium";

export function LogForm({ opcoes, inicial, hoje, athlete }: { opcoes: WorkoutOption[]; inicial: string; hoje: string; athlete: AthleteId }) {
  const [sel, setSel] = useState(inicial);
  const opt = opcoes.find((o) => `${o.id}|${o.semana}` === sel);
  const atividade: "corrida" | "futebol" | "forca" = sel === "futebol" ? "futebol" : opt?.atividade === "forca" ? "forca" : "corrida";
  const corrida = atividade === "corrida";

  const [data, setData] = useState(opt?.data ?? hoje);
  const [dist, setDist] = useState<number>(opt?.km ?? 0);
  const [distTxt, setDistTxt] = useState(opt?.km ? String(opt.km).replace(".", ",") : "");
  const [tempo, setTempo] = useState("");
  const [paceTxt, setPaceTxt] = useState<string | null>(null);
  const [rpe, setRpe] = useState(4);
  const [completou, setCompletou] = useState<"sim" | "parcial" | "nao">("sim");
  const [dor, setDor] = useState<"nenhuma" | "muscular" | "articulacao">("nenhuma");
  const [mais, setMais] = useState(false);
  const [fcMedia, setFcMedia] = useState("");
  const [fcMax, setFcMax] = useState("");
  const [hora, setHora] = useState("");
  const [reps, setReps] = useState<string[]>([]);
  const [testeDist, setTesteDist] = useState(opt?.teste ? String(opt.teste.dist_km).replace(".", ",") : "");
  const [testeTempo, setTesteTempo] = useState("");
  const [notas, setNotas] = useState("");
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<AdjustFeedback | null>(null);

  function escolher(v: string) {
    setSel(v);
    const o = opcoes.find((x) => `${x.id}|${x.semana}` === v);
    setData(o?.data ?? hoje);
    setDist(o?.km ?? 0);
    setDistTxt(o?.km ? String(o.km).replace(".", ",") : "");
    setReps([]);
    setPaceTxt(null);
    setTesteDist(o?.teste ? String(o.teste.dist_km).replace(".", ",") : "");
    setTesteTempo("");
  }

  function setDistance(n: number) {
    const v = Math.max(0, Math.round(n * 100) / 100);
    setDist(v);
    setDistTxt(String(v).replace(".", ","));
  }

  const tempo_s = parseDuration(tempo);
  const paceCalc = corrida && tempo_s && dist > 0 ? tempo_s / dist : null;
  const paceManual = paceTxt != null ? parseDuration(paceTxt) : null;
  const pace = paceManual ?? paceCalc;

  const repsTargetTxt = useMemo(() => (opt?.reps ? formatDuration(opt.reps.alvo_s) : null), [opt]);

  function salvar() {
    if (!tempo_s) {
      toast.error(corrida ? "Coloca o tempo total (ex.: 27:30)" : "Coloca a duração (ex.: 45:00)");
      return;
    }
    if (corrida && !(dist > 0)) {
      toast.error("Coloca a distância");
      return;
    }
    const repsNum = reps.map(parseDuration).filter((x): x is number => x != null && x > 0);
    start(async () => {
      const r = await logWorkout({
        plan_workout_id: opt?.id ?? null,
        semana_calendario: opt?.semana ?? null,
        atividade,
        data,
        hora: hora || null,
        distancia_km: corrida ? dist : 0,
        tempo_s,
        pace_s_por_km: corrida && paceManual ? paceManual : null,
        fc_media: fcMedia ? Number(fcMedia) : null,
        fc_max: fcMax ? Number(fcMax) : null,
        rpe,
        completou,
        dor,
        reps: repsNum.length ? repsNum : null,
        notas: notas || null,
        teste_dist_km: opt?.teste && testeDist ? Number(testeDist.replace(",", ".")) : null,
        teste_tempo_s: opt?.teste && testeTempo ? parseDuration(testeTempo) : null,
      });
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success("Treino salvo");
      setFeedback(r.feedback);
    });
  }

  return (
    <div className="space-y-5">
      {/* qual treino */}
      <div>
        <p className={label}>Treino</p>
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Treino">
          {opcoes.map((o) => {
            const v = `${o.id}|${o.semana}`;
            const on = v === sel;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => escolher(v)}
                className={cn("min-h-14 shrink-0 snap-start rounded-2xl border px-4 py-2 text-left", on ? "border-fg bg-fg text-bg" : "border-border bg-card")}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <TypeDot tipo={o.tipo} /> {o.tipo}
                </span>
                <span className={cn("block text-xs", on ? "opacity-80" : "text-muted")}>
                  {o.rotulo}
                  {o.km ? ` · ${formatNumber(o.km)} km` : ""}
                </span>
              </button>
            );
          })}
          {athlete === "danilo" && (
            <button type="button" role="radio" aria-checked={sel === "futebol"} onClick={() => escolher("futebol")} className={cn("min-h-14 shrink-0 rounded-2xl border px-4 text-sm font-semibold", sel === "futebol" ? "border-fg bg-fg text-bg" : "border-border bg-card")}>
              ⚽ Futebol
            </button>
          )}
          <button type="button" role="radio" aria-checked={sel === "livre"} onClick={() => escolher("livre")} className={cn("min-h-14 shrink-0 rounded-2xl border px-4 text-sm font-semibold", sel === "livre" ? "border-fg bg-fg text-bg" : "border-border bg-card")}>
            Treino livre
          </button>
        </div>
      </div>

      <Card className="space-y-5">
        {corrida && (
          <div>
            <label htmlFor="dist" className={label}>
              Distância (km)
            </label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="icon" aria-label="Menos 100 m" onClick={() => setDistance(dist - 0.1)}>
                <Minus className="h-5 w-5" />
              </Button>
              <input
                id="dist"
                inputMode="decimal"
                value={distTxt}
                placeholder="0,0"
                onChange={(e) => {
                  const t = e.target.value.replace(/[^\d,.]/g, "");
                  setDistTxt(t);
                  const n = Number(t.replace(",", "."));
                  if (Number.isFinite(n)) setDist(n);
                }}
                className={cn(field, "num text-center text-2xl font-semibold")}
              />
              <Button type="button" variant="secondary" size="icon" aria-label="Mais 100 m" onClick={() => setDistance(dist + 0.1)}>
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="tempo" className={label}>
              {corrida ? "Tempo total" : "Duração"}
            </label>
            <input
              id="tempo"
              inputMode="numeric"
              placeholder={opt?.tempo_s ? formatDuration(Math.round(opt.tempo_s / 60) * 60) : "00:00"}
              value={tempo}
              onChange={(e) => setTempo(maskDuration(e.target.value))}
              className={cn(field, "num text-xl font-semibold")}
              aria-describedby="tempo-dica"
            />
            <p id="tempo-dica" className="mt-1 text-xs text-muted">
              mm:ss ou h:mm:ss
            </p>
          </div>
          {corrida && (
            <div>
              <label htmlFor="pace" className={label}>
                Pace médio
              </label>
              <input
                id="pace"
                inputMode="numeric"
                value={paceTxt ?? (paceCalc ? formatPace(paceCalc) : "")}
                placeholder="—"
                onChange={(e) => setPaceTxt(maskDuration(e.target.value))}
                className={cn(field, "num text-xl font-semibold")}
              />
              <p className="mt-1 text-xs text-muted">{paceTxt != null ? "editado" : "calculado"}</p>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className={label} id="rpe-label">
              Esforço
            </span>
            <span className="num text-sm font-semibold">
              {rpe} · {RPE_LABEL[rpe]}
            </span>
          </div>
          <Slider label="Esforço de 0 a 10" min={0} max={10} step={1} value={[rpe]} onValueChange={([v]) => setRpe(v)} aria-labelledby="rpe-label" />
          <div className="flex justify-between text-[11px] text-muted">
            <span>Muito fácil</span>
            <span>Máximo</span>
          </div>
        </div>

        <div>
          <p className={label}>Completei?</p>
          <Chips
            label="Completei?"
            value={completou}
            onChange={setCompletou}
            options={[
              { value: "sim", label: "Sim" },
              { value: "parcial", label: "Parcial" },
              { value: "nao", label: "Não" },
            ]}
          />
        </div>
        <div>
          <p className={label}>Dor?</p>
          <Chips
            label="Dor?"
            value={dor}
            onChange={setDor}
            options={[
              { value: "nenhuma", label: "Nenhuma" },
              { value: "muscular", label: "Muscular leve", tone: "warn" },
              { value: "articulacao", label: "Articulação", tone: "danger" },
            ]}
          />
          {dor === "articulacao" && <p className="mt-2 text-sm text-danger">Para e descansa. Se continuar por mais de alguns dias, procure um profissional de saúde.</p>}
        </div>

        {opt?.teste && corrida && (
          <div className="rounded-2xl bg-card-2 p-4">
            <p className="text-sm font-semibold">Trecho do teste</p>
            <p className="text-xs text-muted">Se o teste foi parte do treino (com aquecimento), anota só o trecho do teste.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tdist" className="mb-1 block text-xs font-medium">
                  Distância (km)
                </label>
                <input id="tdist" inputMode="decimal" value={testeDist} onChange={(e) => setTesteDist(e.target.value.replace(/[^\d,.]/g, ""))} className={cn(field, "num")} />
              </div>
              <div>
                <label htmlFor="ttempo" className="mb-1 block text-xs font-medium">
                  Tempo do teste
                </label>
                <input id="ttempo" inputMode="numeric" placeholder="25:00" value={testeTempo} onChange={(e) => setTesteTempo(maskDuration(e.target.value))} className={cn(field, "num")} />
              </div>
            </div>
          </div>
        )}
      </Card>

      <button type="button" onClick={() => setMais(!mais)} className="flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-muted" aria-expanded={mais}>
        <ChevronDown className={cn("h-4 w-4 transition", mais && "rotate-180")} /> Mais detalhes (FC, hora, tempos de cada tiro, notas)
      </button>

      {mais && (
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="data" className={label}>
                Data
              </label>
              <input id="data" type="date" max={hoje} value={data} onChange={(e) => setData(e.target.value)} className={field} />
            </div>
            <div>
              <label htmlFor="hora" className={label}>
                Hora
              </label>
              <input id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={field} />
            </div>
            {corrida && (
              <>
                <div>
                  <label htmlFor="fcm" className={label}>
                    FC média
                  </label>
                  <input id="fcm" inputMode="numeric" placeholder="bpm" value={fcMedia} onChange={(e) => setFcMedia(e.target.value.replace(/\D/g, "").slice(0, 3))} className={cn(field, "num")} />
                </div>
                <div>
                  <label htmlFor="fcx" className={label}>
                    FC máxima
                  </label>
                  <input id="fcx" inputMode="numeric" placeholder="bpm" value={fcMax} onChange={(e) => setFcMax(e.target.value.replace(/\D/g, "").slice(0, 3))} className={cn(field, "num")} />
                </div>
              </>
            )}
          </div>

          {opt?.reps && corrida && (
            <div>
              <p className={label}>
                Tempo de cada repetição ({formatNumber(opt.reps.dist_km * 1000, 0)} m · alvo {repsTargetTxt})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: opt.reps.vezes }, (_, i) => (
                  <input
                    key={i}
                    inputMode="numeric"
                    aria-label={`Repetição ${i + 1}`}
                    placeholder={`#${i + 1}`}
                    value={reps[i] ?? ""}
                    onChange={(e) => {
                      const n = [...reps];
                      n[i] = maskDuration(e.target.value);
                      setReps(n);
                    }}
                    className={cn(field, "num h-11 px-3 text-center")}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="notas" className={label}>
              Notas
            </label>
            <textarea id="notas" rows={3} maxLength={1000} value={notas} onChange={(e) => setNotas(e.target.value)} className={cn(field, "h-auto py-3")} placeholder="Como foi?" />
          </div>
        </Card>
      )}

      <div className="sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-10">
        <Button size="lg" block onClick={salvar} disabled={pending} className="shadow-lg">
          {pending && <Loader2 className="h-5 w-5 animate-spin" />}
          Salvar treino{pace && corrida ? ` · ${formatPace(pace)}/km` : ""}
        </Button>
      </div>

      <Sheet open={!!feedback} onOpenChange={(o) => !o && setFeedback(null)}>
        {feedback && (
          <SheetContent title="Treino salvo ✓">
            <FeedbackView f={feedback} />
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

function FeedbackView({ f }: { f: AdjustFeedback }) {
  const item = (i: number) => ({ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.06 * i } });
  return (
    <div className="space-y-4">
      {f.pace_s != null && (
        <motion.div {...item(0)} className="rounded-2xl bg-card-2 p-4">
          <p className="num text-4xl font-semibold">{formatPace(f.pace_s)}/km</p>
          {f.alvo_s != null && f.diff_s != null ? (
            <p className={cn("mt-1 flex items-center gap-1.5 text-sm font-medium", Math.abs(f.diff_s) <= 5 ? "text-ok" : f.diff_s < 0 ? "text-accent-ink" : "text-warn")}>
              {f.diff_s < 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              Alvo {formatPace(f.alvo_s)}: {Math.abs(f.diff_s) <= 5 ? "no alvo" : `${Math.abs(f.diff_s)} s/km ${f.diff_s < 0 ? "mais rápido" : "mais lento"}`}
              {f.calor && f.calor.pct >= 1 ? " (já corrigido pelo calor)" : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">Treino sem meta de pace: serve para calibrar.</p>
          )}
        </motion.div>
      )}

      <motion.div {...item(1)} className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border p-3">
          <p className="text-xs text-muted">Carga (esforço × min)</p>
          <p className="num text-2xl font-semibold">{f.carga}</p>
        </div>
        <div className="rounded-2xl border border-border p-3">
          <p className="text-xs text-muted">Gasto estimado</p>
          <p className="num text-2xl font-semibold">{f.kcal != null ? `${f.kcal} kcal` : "—"}</p>
        </div>
      </motion.div>

      {f.teste && (
        <motion.div {...item(2)} className="rounded-2xl bg-accent-soft p-4 text-accent-ink">
          <p className="font-semibold">Teste registrado</p>
          <p className="text-sm">
            VDOT {formatNumber(f.teste.vdot)} · 5 km estimado em {formatDuration(f.teste.est_5k_s)}. Todas as zonas foram recalculadas.
          </p>
        </motion.div>
      )}

      {f.changes.length > 0 ? (
        <motion.div {...item(3)} className="space-y-2">
          <p className="text-sm font-semibold">Autoajuste</p>
          {f.changes.map((c, i) => (
            <div key={i} className="rounded-2xl border border-border p-3">
              <p className="num font-semibold">
                {c.zona}: {formatPace(c.antes_s)} → {formatPace(c.depois_s)}
              </p>
              <p className="mt-0.5 text-sm text-muted">{c.motivo}</p>
            </div>
          ))}
        </motion.div>
      ) : (
        <motion.p {...item(3)} className="text-sm text-muted">
          Paces mantidos.
        </motion.p>
      )}

      {f.semanaFechada && (
        <motion.div {...item(4)} className="rounded-2xl bg-card-2 p-4">
          <p className="font-semibold">
            Semana fechada: {f.semanaFechada.feitos} de {f.semanaFechada.planejados}
          </p>
          <p className="mt-1 text-sm">{f.semanaFechada.motivo}</p>
          <p className="mt-1 text-sm text-muted">{f.semanaFechada.proxima}</p>
        </motion.div>
      )}

      {f.pico && <SpikeBanner workoutId={f.pico.workoutId} semana={f.pico.semana} tipo={f.pico.tipo} planejado_km={f.pico.planejado_km} limite_km={f.pico.limite_km} maior_km={f.pico.maior_km} />}

      {f.notas.map((n) => (
        <p key={n} className="text-sm text-muted">
          {n}
        </p>
      ))}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Link href="/ritmos" className={buttonVariants({ variant: "secondary" })}>
          Ver ritmos
        </Link>
        <Link href="/hoje" className={buttonVariants()}>
          Voltar pro Hoje
        </Link>
      </div>
    </div>
  );
}
