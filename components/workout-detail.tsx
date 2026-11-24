import { Clock, Gauge, Info, Repeat, Route, Thermometer } from "lucide-react";
import {
  formatDistance,
  formatNumber,
  formatPace,
  heatAdjustedPace,
  warmupWalkKm,
  workoutTime,
  zonePace,
  MIN_POR_VOLTA_FORCA,
  type AthleteId,
  type Bloco,
  type ScheduledWorkout,
  type Segmento,
  type Zona,
  type ZonaComPace,
  type Zonas,
} from "@/lib/engine";
import type { AthleteSeed } from "@/lib/plan-data";
import { DESCANSO_FORCA, MODO_LABEL, ZONA_INFO } from "@/lib/content";
import { tipoCor } from "@/lib/ui/colors";
import { cn } from "@/lib/utils";

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

// ---------- texto em linguagem simples ----------

/** "≈ 28 s", "≈ 2 min 08 s", "≈ 12 min" */
function tempoSimples(s: number | null): string | undefined {
  if (s == null || !Number.isFinite(s) || s <= 0) return undefined;
  const t = Math.round(s);
  if (t < 60) return `≈ ${t} s`;
  const m = Math.floor(t / 60);
  const r = t % 60;
  if (m >= 10 || r === 0) return `≈ ${Math.round(t / 60)} min`;
  return `≈ ${m} min ${String(r).padStart(2, "0")} s`;
}

const SEM_PACE = new Set<Zona>(["confortavel", "maximo", "caminhada_livre"]);

interface Item {
  acao: string;
  zona: Zona;
  ritmo?: string; // "6:45"
  sente?: string;
  tempo?: string;
}

function item(b: Bloco, zonas: Zonas): Item {
  const d = formatDistance(b.distancia_km);
  const zp = zonePace(b.zona, zonas);
  const info = ZONA_INFO[b.zona as ZonaComPace];
  const comPace = !SEM_PACE.has(b.zona) && zp.pace_s != null;
  const tempo = comPace ? tempoSimples(b.distancia_km * (zp.pace_s as number)) : undefined;
  const base = { zona: b.zona, sente: info?.sente, tempo, ritmo: comPace ? formatPace(zp.pace_s) : undefined };
  switch (b.zona) {
    case "caminhada":
      return { ...base, acao: `Ande ${d}`, sente: "Passo firme, braços balançando", ritmo: undefined };
    case "caminhada_livre":
      return { ...base, acao: `Caminhe ${d} rápido`, sente: "No seu ritmo, sem meta" };
    case "confortavel":
      return { ...base, acao: `Corra ${d} confortável`, sente: "Dá pra conversar · sem meta de ritmo" };
    case "maximo":
      return { ...base, acao: `Corra ${d} no máximo que der`, sente: "Forte do começo ao fim · sem meta de ritmo" };
    case "solto":
      return { ...base, acao: `Acelere ${d} soltinho`, sente: "Rápido mas relaxado, não é tiro", ritmo: undefined, tempo: zonas.forte ? `≈ ${Math.round(b.distancia_km * zp.pace_s!)} s` : undefined };
    case "corrida":
      return { ...base, acao: `${b.distancia_km <= 0.15 ? "Trote" : "Corra"} ${d}` };
    case "regenerativo":
      return { ...base, acao: `Corra ${d} bem leve` };
    default:
      return { ...base, acao: `Corra ${d} ${ZONA_INFO[b.zona as ZonaComPace]?.nome.toLowerCase() ?? ""}`.trim() };
  }
}

interface Passo {
  fase: string;
  itens: Item[];
  vezes?: number;
  pausa?: string;
  forca?: number;
  nota?: string;
}

function passos(segmentos: Segmento[], zonas: Zonas, athlete: AthleteId): Passo[] {
  const out: Passo[] = [];
  const aq = warmupWalkKm(athlete, segmentos);
  if (aq > 0) out.push({ fase: "Aquecimento", itens: [item({ distancia_km: aq, zona: "caminhada" }, zonas)], nota: "Não conta no km do treino" });

  const n = segmentos.length;
  const facil = (s: Segmento) => (s.tipo === "corrida" && (s.zona === "leve" || s.zona === "regenerativo")) || s.tipo === "caminhada";
  const temMiolo = n >= 3 && segmentos.slice(1, -1).some((s) => !facil(s));

  segmentos.forEach((s, i) => {
    let fase = aq > 0 ? "Parte principal" : n === 1 ? "O treino" : "Depois";
    if (i === 0 && !(aq > 0)) fase = temMiolo && facil(s) ? "Aquecimento" : "Comece";
    else if (i === n - 1 && temMiolo && facil(s)) fase = "Volta à calma";
    else if (temMiolo) fase = "Parte principal";
    // bloco final só de acelerações curtas (100 m soltos + andando)
    if (i > 0 && s.tipo === "repeticao" && s.blocos[0]?.zona === "solto" && s.blocos.every((b) => b.zona === "solto" || b.zona === "caminhada")) fase = "Acelerações";

    if (s.tipo === "forca") {
      out.push({ fase: "Circuito de força", itens: [], forca: s.voltas });
    } else if (s.tipo === "caminhada") {
      out.push({ fase, itens: [item({ distancia_km: s.distancia_km, zona: "caminhada" }, zonas)] });
    } else if (s.tipo === "corrida") {
      out.push({ fase, itens: [item(s, zonas)] });
    } else {
      out.push({
        fase,
        vezes: s.vezes,
        itens: s.blocos.map((b) => item(b, zonas)),
        pausa: s.pausa ? `Entre cada uma: ${Number.isInteger(s.pausa.minutos) ? `${s.pausa.minutos} min` : `${Math.round(s.pausa.minutos * 60)} s`} ${s.pausa.como}` : undefined,
      });
    }
  });

  if (aq > 0) out.push({ fase: "Volta à calma", itens: [item({ distancia_km: aq, zona: "caminhada" }, zonas)], nota: "Não conta no km do treino" });
  return out;
}

/** Zona com mais distância corrida: o "ritmo principal" do dia. */
function ritmoPrincipal(segmentos: Segmento[], zonas: Zonas): { pace: string; zona: Zona } | null {
  const dist = new Map<Zona, number>();
  const soma = (z: Zona, km: number) => dist.set(z, (dist.get(z) ?? 0) + km);
  for (const s of segmentos) {
    if (s.tipo === "corrida") soma(s.zona, s.distancia_km);
    else if (s.tipo === "repeticao") for (const b of s.blocos) soma(b.zona, b.distancia_km * s.vezes);
  }
  const corridas = [...dist.entries()].filter(([z]) => !["caminhada", "caminhada_livre", "solto"].includes(z));
  if (!corridas.length) return null;
  // treino de qualidade: mostra o ritmo da parte forte mesmo sendo menos km
  const qualidade = corridas.find(([z]) => z === "forte") ?? corridas.find(([z]) => z === "moderado");
  const [zona] = qualidade ?? corridas.sort((a, b) => b[1] - a[1])[0];
  if (SEM_PACE.has(zona)) return { pace: "Livre", zona };
  const zp = zonePace(zona, zonas);
  return zp.pace_s ? { pace: formatPace(zp.pace_s), zona } : null;
}

// ---------- componente ----------

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
  const lista = passos(sw.segmentos, z, athlete);
  const t = workoutTime(sw.segmentos, z, athlete);
  const forca = sw.workout.tipo === "Força";
  const modo = MODO_LABEL[sw.modo];
  const principal = forca ? null : ritmoPrincipal(sw.segmentos, z);
  const corTipo = tipoCor(sw.workout.tipo);

  return (
    <div>
      {(modo || sw.override) && (
        <p className="mb-4 rounded-2xl bg-accent-soft px-4 py-2.5 text-sm font-medium text-accent-ink">{sw.override?.motivo ?? modo}</p>
      )}

      {/* resumo em 3 números */}
      <div className="grid grid-cols-3 gap-2">
        <Stat icon={Route} rotulo="Distância" valor={sw.km != null ? formatNumber(sw.km) : forca ? "Casa" : "—"} unidade={sw.km != null ? "km" : undefined} />
        <Stat icon={Clock} rotulo="Duração" valor={`${t.estimado ? "≈" : ""}${duracao(t.total_s)}`} unidade={t.total_s < 3600 ? "min" : undefined} />
        {forca ? (
          <Stat icon={Repeat} rotulo="Voltas" valor={String(sw.segmentos.find((s) => s.tipo === "forca")?.voltas ?? "—")} />
        ) : (
          <Stat icon={Gauge} rotulo="Ritmo" valor={principal?.pace ?? "—"} unidade={principal && principal.pace !== "Livre" ? "/km" : undefined} cor={principal ? ZONA_COR[principal.zona] : undefined} />
        )}
      </div>
      {t.aquecimento_s > 0 && <p className="mt-2 text-center text-xs text-muted">+ ~{Math.round(t.aquecimento_s / 60)} min andando no aquecimento e na volta à calma</p>}

      {calorPct >= 1 && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-warn/10 px-4 py-2.5 text-sm text-warn">
          <Thermometer className="mt-0.5 h-4 w-4 shrink-0" />
          Ritmos já {formatNumber(calorPct)}% mais lentos por causa do calor. Vá pelo esforço.
        </p>
      )}

      {/* passo a passo */}
      <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-muted">Passo a passo</p>
      <ol className="relative">
        {lista.map((p, i) => (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {/* linha do tempo */}
            {i < lista.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" aria-hidden />}
            <span
              className="num relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ color: corDoPasso(p, corTipo), backgroundColor: `color-mix(in srgb, ${corDoPasso(p, corTipo)} 16%, var(--card))` }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{p.fase}</p>

              {p.forca != null ? (
                <p className="mt-0.5 text-[17px] font-semibold leading-snug">
                  {p.forca} {p.forca === 1 ? "volta" : "voltas"} do circuito <span className="font-normal text-muted">· ≈ {p.forca * MIN_POR_VOLTA_FORCA} min</span>
                </p>
              ) : p.vezes ? (
                <div className="mt-1.5 rounded-2xl border border-border bg-card-2/60 p-3">
                  <p className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[17px] font-semibold">
                      <Repeat className="h-4 w-4" /> Repita {p.vezes} vezes
                    </span>
                    <span className="flex flex-wrap justify-end gap-1" aria-hidden>
                      {Array.from({ length: Math.min(p.vezes, 12) }, (_, k) => (
                        <span key={k} className="h-2 w-2 rounded-full" style={{ backgroundColor: ZONA_COR[p.itens[0]?.zona] ?? corTipo }} />
                      ))}
                    </span>
                  </p>
                  <div className="mt-2 space-y-2">
                    {p.itens.map((it, k) => (
                      <ItemLinha key={k} it={it} />
                    ))}
                  </div>
                  {p.pausa && <p className="mt-2 border-t border-border pt-2 text-sm text-muted">{p.pausa}</p>}
                </div>
              ) : (
                p.itens.map((it, k) => <ItemLinha key={k} it={it} grande />)
              )}
              {p.nota && <p className="mt-1 text-xs text-muted">{p.nota}</p>}
            </div>
          </li>
        ))}
      </ol>

      {(sw.workout.observacao || sw.workout.meta_texto) && !compact && (
        <div className="mt-5 space-y-1 rounded-2xl bg-card-2 px-4 py-3 text-[15px]">
          {sw.workout.observacao && <p>💡 {sw.workout.observacao}</p>}
          {sw.workout.meta_texto && <p className="text-muted">{sw.workout.meta_texto}</p>}
        </div>
      )}

      {forca && !compact && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">1 volta = estes exercícios em sequência</p>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {seed.forca.map((e, k) => (
              <li key={e.nome} className="flex items-start gap-3 px-4 py-3">
                <span className="num mt-0.5 text-sm font-semibold text-muted">{k + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.nome}</p>
                  <p className="text-sm text-muted">{e.como}</p>
                </div>
                <span className="num shrink-0 rounded-full bg-card-2 px-2.5 py-1 text-sm font-semibold">{e.quantidade}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">Descanso: {DESCANSO_FORCA[athlete]}.</p>
        </div>
      )}

      {!forca && !compact && (
        <details className="group mt-4 rounded-2xl border border-border px-4 py-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
            <Info className="h-4 w-4 text-muted" /> O que é o ritmo (pace)?
          </summary>
          <p className="mt-2 text-muted">
            É o tempo para correr <strong className="text-fg">1 km</strong>. Ritmo <span className="num font-semibold text-fg">6:45</span> = 6 minutos e 45
            segundos a cada km. Número maior = mais devagar. O relógio ou o app de corrida mostra o ritmo enquanto você corre; se não tiver, vá pela
            sensação escrita em cada passo.
          </p>
        </details>
      )}
    </div>
  );
}

/** 1620 → "27"; 3900 → "1h05" */
function duracao(s: number): string {
  const m = Math.round(s / 60);
  return m < 60 ? String(m) : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

function corDoPasso(p: Passo, corTipo: string): string {
  if (p.forca != null) return corTipo;
  const z = p.itens.find((i) => i.zona !== "caminhada")?.zona ?? p.itens[0]?.zona;
  return (z && ZONA_COR[z]) || corTipo;
}

function ItemLinha({ it, grande = false }: { it: Item; grande?: boolean }) {
  const cor = ZONA_COR[it.zona];
  return (
    <div className={cn(grande && "mt-0.5")}>
      <p className={cn("font-semibold leading-snug", grande ? "text-[17px]" : "text-[15px]")}>
        {it.acao}
        {it.tempo && <span className="num font-normal text-muted"> · {it.tempo}</span>}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {it.ritmo && (
          <span className="num inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold" style={{ color: cor, backgroundColor: `color-mix(in srgb, ${cor} 14%, transparent)` }}>
            ritmo {it.ritmo}/km
          </span>
        )}
        {it.sente && <span className="text-muted">{it.sente}</span>}
      </p>
    </div>
  );
}

function Stat({ icon: Icon, rotulo, valor, unidade, cor }: { icon: typeof Clock; rotulo: string; valor: string; unidade?: string; cor?: string }) {
  return (
    <div className="rounded-2xl bg-card-2 px-3 py-3">
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" /> {rotulo}
      </p>
      <p className="num mt-1 text-[22px] font-bold leading-none" style={cor ? { color: cor } : undefined}>
        {valor}
        {unidade && <span className="ml-0.5 text-xs font-medium text-muted">{unidade}</span>}
      </p>
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
