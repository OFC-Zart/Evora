import type { TipoTreino } from "@/lib/engine";

/** Cor fixa de cada tipo de treino (variáveis CSS em globals.css). */
export const TIPO_COR: Record<TipoTreino, string> = {
  Leve: "var(--t-leve)",
  Longão: "var(--t-longao)",
  Tiros: "var(--t-tiros)",
  Ritmo: "var(--t-ritmo)",
  Fartlek: "var(--t-fartlek)",
  Regenerativo: "var(--t-regen)",
  Força: "var(--t-forca)",
  Teste: "var(--t-teste)",
  "Corre/anda": "var(--t-correanda)",
  Corrida: "var(--t-corrida)",
  Futebol: "var(--t-futebol)",
  Livre: "var(--t-livre)",
};

export function tipoCor(t: string): string {
  return TIPO_COR[t as TipoTreino] ?? "var(--t-livre)";
}
