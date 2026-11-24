"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDuration, formatPace } from "@/lib/engine/format";
import { tipoCor } from "@/lib/ui/colors";

const AX = { fontSize: 11, fill: "var(--muted)" };
const GRID = { stroke: "var(--border)", strokeDasharray: "3 3", vertical: false };
const TIP = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 13, color: "var(--fg)" },
  labelStyle: { color: "var(--muted)" },
  cursor: { fill: "var(--card-2)" },
};

function Empty({ text = "Ainda sem dados" }: { text?: string }) {
  return <div className="flex h-44 items-center justify-center rounded-xl bg-card-2 text-sm text-muted">{text}</div>;
}

export function KmChart({ data }: { data: { semana: string; km_plan: number; km_feito: number }[] }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="semana" tick={AX} tickFormatter={(v: string) => v.split(" ")[0]} />
        <YAxis tick={AX} />
        <Tooltip {...TIP} formatter={(v) => `${String(v).replace(".", ",")} km`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="km_plan" name="Planejado" fill="var(--border)" radius={[6, 6, 0, 0]} />
        <Bar dataKey="km_feito" name="Feito" fill="var(--accent)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EasyPaceChart({ data }: { data: { semana: string; pace_leve: number | null; fc_leve: number | null }[] }) {
  const pts = data.filter((d) => d.pace_leve);
  if (!pts.length) return <Empty text="Registre treinos leves para ver a evolução" />;
  const temFc = pts.some((d) => d.fc_leve);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={pts} margin={{ top: 8, right: temFc ? -10 : 4, left: -10, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="semana" tick={AX} tickFormatter={(v: string) => v.split(" ")[0]} />
        <YAxis yAxisId="p" tick={AX} reversed domain={["dataMin - 10", "dataMax + 10"]} tickFormatter={(v: number) => formatPace(v)} />
        {temFc && <YAxis yAxisId="fc" orientation="right" tick={AX} domain={["dataMin - 5", "dataMax + 5"]} />}
        <Tooltip {...TIP} formatter={(v, n) => (n === "Pace leve" ? `${formatPace(Number(v))}/km` : `${v} bpm`)} />
        <Line yAxisId="p" type="monotone" dataKey="pace_leve" name="Pace leve" stroke="var(--t-leve)" strokeWidth={3} dot={{ r: 3 }} />
        {temFc && <Line yAxisId="fc" type="monotone" dataKey="fc_leve" name="FC média" stroke="var(--t-tiros)" strokeWidth={2} strokeDasharray="4 3" dot={false} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function EstimateChart({ data }: { data: { data: string; est_5k_s: number; vdot: number }[] }) {
  if (!data.length) return <Empty text="Aparece depois do primeiro teste ou treino forte" />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: -10, left: -6, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="data" tick={AX} />
        <YAxis yAxisId="t" tick={AX} reversed domain={["dataMin - 30", "dataMax + 30"]} tickFormatter={(v: number) => formatDuration(v)} />
        <YAxis yAxisId="v" orientation="right" tick={AX} domain={["dataMin - 1", "dataMax + 1"]} />
        <Tooltip {...TIP} formatter={(v, n) => (n === "5 km" ? formatDuration(Number(v)) : String(v).replace(".", ","))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line yAxisId="t" type="monotone" dataKey="est_5k_s" name="5 km" stroke="var(--t-teste)" strokeWidth={3} dot={{ r: 3 }} />
        <Line yAxisId="v" type="monotone" dataKey="vdot" name="VDOT" stroke="var(--t-longao)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LoadChart({ data }: { data: { semana: string; carga: number; acwr: number | null }[] }) {
  if (!data.some((d) => d.carga > 0)) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: -10, left: -12, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="semana" tick={AX} tickFormatter={(v: string) => v.split(" ")[0]} />
        <YAxis yAxisId="c" tick={AX} />
        <YAxis yAxisId="a" orientation="right" tick={AX} domain={[0, 2]} />
        <ReferenceArea yAxisId="a" y1={0.8} y2={1.3} fill="var(--ok)" fillOpacity={0.1} label={{ value: "0,8–1,3", position: "insideTopRight", fontSize: 10, fill: "var(--muted)" }} />
        <Tooltip {...TIP} formatter={(v, n) => (n === "ACWR" ? String(v).replace(".", ",") : `${v}`)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="c" dataKey="carga" name="Carga (sRPE)" fill="var(--t-ritmo)" radius={[6, 6, 0, 0]} />
        <Line yAxisId="a" type="monotone" dataKey="acwr" name="ACWR" stroke="var(--fg)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function RpeChart({ data }: { data: { tipo: string; rpe: number; n: number }[] }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 10, bottom: 0 }}>
        <XAxis type="number" domain={[0, 10]} tick={AX} />
        <YAxis type="category" dataKey="tipo" tick={AX} width={86} />
        <Tooltip {...TIP} formatter={(v) => String(v).replace(".", ",")} />
        <Bar dataKey="rpe" name="Esforço médio" radius={[0, 6, 6, 0]}>
          {data.map((d) => (
            <Cell key={d.tipo} fill={tipoCor(d.tipo)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
