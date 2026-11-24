// Planos de 8 semanas (as duas planilhas do Excel), em formato tipado.
// É a mesma fonte usada para gerar o seed do Supabase (scripts/gen-seed.mjs).

import raw from "../data/planos.json";
import { DIAS, type AthleteId, type Dia, type Nivel, type PlanWorkout, type Segmento, type TipoTreino, type Zonas } from "./engine/types";
import { parseDuration } from "./engine/format";

interface RawWorkout {
  semana: number;
  dia: string;
  tipo: string;
  segmentos: unknown[];
  observacao?: string | null;
  km_total: number | null;
  meta_texto?: string | null;
  opcional?: boolean;
}

interface RawAthlete {
  id: string;
  nome: string;
  nivel: string;
  altura_m: number;
  peso_kg: number;
  meta: { descricao: string; distancia_km: number; tempo_alvo: string | null };
  restricoes: string[];
  zonas_iniciais_min_km: Record<string, string>;
  forca: string[][];
  aquecimento_extra: string | null;
  treinos: RawWorkout[];
}

export interface AthleteSeed {
  id: AthleteId;
  nome: string;
  nivel: Nivel;
  altura_m: number;
  peso_kg: number;
  meta: { descricao: string; distancia_km: number; tempo_alvo_s: number | null };
  restricoes: string[];
  zonasIniciais: Zonas;
  forca: { nome: string; quantidade: string; como: string }[];
  aquecimento_extra: string | null;
  treinos: PlanWorkout[];
}

const atletas = (raw as unknown as { atletas: RawAthlete[] }).atletas;

export const ATHLETES: Record<AthleteId, AthleteSeed> = Object.fromEntries(
  atletas.map((a) => {
    const id = a.id as AthleteId;
    const zonas: Zonas = {};
    for (const [z, v] of Object.entries(a.zonas_iniciais_min_km)) {
      (zonas as Record<string, number>)[z] = parseDuration(v) as number;
    }
    const treinos: PlanWorkout[] = a.treinos.map((t) => ({
      id: `${id}-s${t.semana}-${t.dia}`,
      athlete_id: id,
      semana: t.semana,
      dia: t.dia as Dia,
      tipo: t.tipo as TipoTreino,
      segmentos: t.segmentos as Segmento[],
      observacao: t.observacao ?? null,
      km_total: t.km_total,
      meta_texto: t.meta_texto ?? null,
      opcional: t.opcional ?? false,
      ordem: DIAS.indexOf(t.dia as Dia),
    }));
    const seed: AthleteSeed = {
      id,
      nome: a.nome,
      nivel: a.nivel as Nivel,
      altura_m: a.altura_m,
      peso_kg: a.peso_kg,
      meta: {
        descricao: a.meta.descricao,
        distancia_km: a.meta.distancia_km,
        tempo_alvo_s: a.meta.tempo_alvo ? parseDuration(a.meta.tempo_alvo) : null,
      },
      restricoes: a.restricoes,
      zonasIniciais: zonas,
      forca: a.forca.map(([nome, quantidade, como]) => ({ nome, quantidade, como })),
      aquecimento_extra: a.aquecimento_extra,
      treinos,
    };
    return [id, seed];
  }),
) as Record<AthleteId, AthleteSeed>;

export function planOf(athlete: AthleteId): PlanWorkout[] {
  return ATHLETES[athlete].treinos;
}
