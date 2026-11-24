// Tipos do motor de cálculo. Todas as funções em /lib/engine são puras
// (sem banco, sem rede, sem relógio implícito) para poderem ser testadas.

export type AthleteId = "danilo" | "leticia";
export type Nivel = "intermediario" | "iniciante_sedentaria";

export type ZonaComPace =
  | "regenerativo"
  | "leve"
  | "moderado"
  | "forte"
  | "corrida"
  | "caminhada";

export type ZonaSemPace = "confortavel" | "maximo" | "caminhada_livre" | "solto";

export type Zona = ZonaComPace | ZonaSemPace;

/** Pace alvo atual de cada zona, em segundos por km. */
export type Zonas = Partial<Record<ZonaComPace, number>>;

export interface Bloco {
  distancia_km: number;
  zona: Zona;
}

export type Segmento =
  | { tipo: "corrida"; distancia_km: number; zona: Zona }
  | {
      tipo: "repeticao";
      vezes: number;
      blocos: Bloco[];
      pausa: { minutos: number; como: string } | null;
    }
  | { tipo: "caminhada"; distancia_km: number }
  | { tipo: "forca"; voltas: number };

export type TipoTreino =
  | "Força"
  | "Teste"
  | "Leve"
  | "Longão"
  | "Fartlek"
  | "Tiros"
  | "Ritmo"
  | "Regenerativo"
  | "Corre/anda"
  | "Corrida"
  | "Futebol"
  | "Livre";

export type Dia = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";
export const DIAS: Dia[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

export interface PlanWorkout {
  id: string;
  athlete_id: AthleteId;
  semana: number;
  dia: Dia;
  tipo: TipoTreino;
  segmentos: Segmento[];
  observacao: string | null;
  km_total: number | null;
  meta_texto?: string | null;
  opcional?: boolean;
  ordem: number;
}

export type Completou = "sim" | "parcial" | "nao";
export type Dor = "nenhuma" | "muscular" | "articulacao";
export type Atividade = "corrida" | "futebol" | "forca" | "outro";

export interface WorkoutLog {
  id: string;
  athlete_id: AthleteId;
  plan_workout_id: string | null;
  /** Semana do calendário do plano (1 = primeira semana após o início). */
  semana_calendario: number | null;
  /** Tipo do treino planejado no momento do registro (ou "Livre"/"Futebol"). */
  tipo_treino: TipoTreino;
  data: string; // YYYY-MM-DD (America/Sao_Paulo)
  distancia_km: number;
  tempo_s: number;
  pace_s_por_km: number | null;
  /** Pace médio planejado no momento do registro (s/km), para comparar depois. */
  pace_alvo_s: number | null;
  /** Tempo alvo de cada repetição no momento do registro (s). */
  rep_alvo_s?: number | null;
  /** Distância de cada repetição (km), para converter rep em pace. */
  rep_dist_km?: number | null;
  fc_media?: number | null;
  fc_max?: number | null;
  rpe: number;
  completou: Completou;
  dor: Dor;
  /** Tempos de cada repetição, em segundos. */
  reps?: number[] | null;
  notas?: string | null;
  atividade: Atividade;
  /** Trecho do teste (ex.: 5 km do meio do treino da semana 8). */
  teste_dist_km?: number | null;
  teste_tempo_s?: number | null;
  temp_c?: number | null;
  orvalho_c?: number | null;
  created_at?: string;
}

export type OrigemAjuste = "regra" | "teste" | "ia" | "manual";

export interface ZoneHistory {
  id?: string;
  athlete_id: AthleteId;
  zona: ZonaComPace;
  antes_s: number;
  depois_s: number;
  motivo: string;
  origem: OrigemAjuste;
  created_at: string;
  revertido: boolean;
  semana_calendario?: number | null;
}

export interface ZoneChange {
  zona: ZonaComPace;
  antes_s: number;
  depois_s: number;
  motivo: string;
  origem: OrigemAjuste;
}

export type ModoSemana = "normal" | "repetida" | "leve30" | "leve20";

export interface ScheduleWeek {
  semana_calendario: number;
  semana_plano: number;
  modo: ModoSemana;
  motivo?: string | null;
}

export interface Estimate {
  data: string;
  vdot: number;
  est_5k_s: number;
  fonte: "teste" | "treino" | "projecao";
}

export interface Profile {
  athlete_id: AthleteId;
  nome: string;
  nivel: Nivel;
  altura_m: number;
  peso_kg: number;
  idade?: number | null;
  fc_max?: number | null;
  fc_repouso?: number | null;
  plan_inicio: string; // dia do primeiro treino (qualquer dia), YYYY-MM-DD
}
