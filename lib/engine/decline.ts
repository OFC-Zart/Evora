// Queda de rendimento (8.6).
//  - pace dos treinos leves ≥ 5% mais lento nas últimas 2 semanas, com esforço
//    igual ou maior que nas 2 semanas anteriores; ou
//  - esforço médio ≥ 2 pontos maior para o mesmo tipo de treino; ou
//  - ACWR acima de 1,5.
// Ação sugerida: semana leve (−20% de volume) e prioridade para sono e descanso.

import { normalizedPace } from "./adjust";
import { addDays } from "./dates";
import { acwr, ACWR_FAIXA } from "./load";
import { TIPOS_LEVES } from "./plan";
import type { TipoTreino, WorkoutLog } from "./types";

export interface DeclineAlert {
  ativo: boolean;
  motivos: string[];
  acao: string;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function detectDecline(logs: WorkoutLog[], hoje: string): DeclineAlert {
  const motivos: string[] = [];
  const corridas = logs.filter((l) => l.atividade === "corrida");
  const recentes = corridas.filter((l) => l.data > addDays(hoje, -14) && l.data <= hoje);
  const anteriores = corridas.filter((l) => l.data > addDays(hoje, -28) && l.data <= addDays(hoje, -14));

  const leve = (ls: WorkoutLog[]) => ls.filter((l) => TIPOS_LEVES.includes(l.tipo_treino) && l.pace_s_por_km);
  const lr = leve(recentes);
  const la = leve(anteriores);
  if (lr.length >= 2 && la.length >= 2) {
    const pr = mean(lr.map((l) => normalizedPace(l) as number));
    const pa = mean(la.map((l) => normalizedPace(l) as number));
    const rr = mean(lr.map((l) => l.rpe));
    const ra = mean(la.map((l) => l.rpe));
    if (pr >= pa * 1.05 && rr >= ra) {
      motivos.push(`Seus leves ficaram ${Math.round((pr / pa - 1) * 100)}% mais lentos com esforço igual ou maior.`);
    }
  }

  const tipos = new Set<TipoTreino>(recentes.map((l) => l.tipo_treino));
  for (const t of tipos) {
    const r = recentes.filter((l) => l.tipo_treino === t);
    const a = anteriores.filter((l) => l.tipo_treino === t);
    if (r.length && a.length) {
      const d = mean(r.map((l) => l.rpe)) - mean(a.map((l) => l.rpe));
      if (d >= 2) motivos.push(`O esforço no ${t.toLowerCase()} subiu ${d.toFixed(1).replace(".", ",")} pontos.`);
    }
  }

  const a = acwr(logs, hoje);
  if (a.acwr != null && a.acwr > ACWR_FAIXA.alerta) {
    motivos.push(`Sua carga dos últimos 7 dias está ${a.acwr.toFixed(2).replace(".", ",")}× a média das semanas anteriores.`);
  }

  return {
    ativo: motivos.length > 0,
    motivos,
    acao: "Sugestão: semana leve (−20% do volume) e prioridade para sono e descanso.",
  };
}
