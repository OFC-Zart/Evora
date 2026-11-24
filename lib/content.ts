// Textos das planilhas (aba "Ritmos e dicas") e rótulos fixos.
import type { AthleteId, ZonaComPace } from "@/lib/engine";

export const ZONA_INFO: Record<ZonaComPace, { nome: string; sente: string; respiracao: string }> = {
  regenerativo: { nome: "Regenerativo", sente: "Bem fácil, quase andando", respiracao: "Calma, sem esforço" },
  leve: { nome: "Leve", sente: "Dá pra conversar", respiracao: "3 passos puxa, 3 solta" },
  moderado: { nome: "Moderado", sente: "Só frases curtas", respiracao: "2 passos puxa, 2 solta" },
  forte: { nome: "Forte", sente: "Só sai uma palavra", respiracao: "2 puxa, 2 solta (ou 2/1)" },
  corrida: { nome: "Corrida leve", sente: "Bem devagar, dá pra conversar", respiracao: "3 passos puxa, 3 solta" },
  caminhada: { nome: "Caminhada rápida", sente: "Passo firme, braços balançando", respiracao: "Normal, sem esforço" },
};

export const ORDEM_ZONAS: Record<AthleteId, ZonaComPace[]> = {
  danilo: ["regenerativo", "leve", "moderado", "forte"],
  leticia: ["caminhada", "corrida"],
};

export const DICAS: Record<AthleteId, { titulo: string; tipo: string; detalhe: string }[]> = {
  danilo: [
    { titulo: "Faltou ar? Desacelera", tipo: "Respiração", detalhe: "Se não dá pra falar no leve, tá rápido demais." },
    { titulo: "Andar vale", tipo: "Respiração", detalhe: "No leve e no longão, anda 1 min e volta. Com o tempo isso some." },
    { titulo: "Solta bem o ar", tipo: "Respiração", detalhe: "Nariz e boca juntos. Foca em soltar todo o ar." },
    { titulo: "Respira com a barriga", tipo: "Respiração", detalhe: "A barriga enche quando puxa o ar. Treina deitado 5 min por dia." },
    { titulo: "Postura", tipo: "Técnica", detalhe: "Ombros soltos, corpo um pouco à frente, passo curto." },
    { titulo: "Sempre aquece", tipo: "Regra", detalhe: "O 1,5 km leve antes dos tiros não é opcional." },
    { titulo: "Depois do forte, leve", tipo: "Regra", detalhe: "No dia seguinte a um treino forte: descanso ou leve." },
    { titulo: "Perdeu um treino?", tipo: "Regra", detalhe: "Segue a semana normal. Não dobra." },
    { titulo: "Dor na articulação", tipo: "Regra", detalhe: "Para e descansa. Dor muscular leve é normal." },
  ],
  leticia: [
    { titulo: "Devagar mesmo", tipo: "Respiração", detalhe: "No começo, correr devagar é o certo. Se não dá pra falar, diminui." },
    { titulo: "Andar faz parte", tipo: "Respiração", detalhe: "As caminhadas são parte do treino. Não é falhar." },
    { titulo: "Solta bem o ar", tipo: "Respiração", detalhe: "Nariz e boca juntos. Foca em soltar todo o ar." },
    { titulo: "Respira com a barriga", tipo: "Respiração", detalhe: "A barriga enche quando puxa o ar. Treina 5 min por dia, de barriga pra cima." },
    { titulo: "Passo curto", tipo: "Técnica", detalhe: "Passos curtos e leves, ombros soltos, olhando pra frente." },
    { titulo: "Aquece e desaquece", tipo: "Regra", detalhe: "Começa e termina todo treino com 500 m andando." },
    { titulo: "Folga entre corridas", tipo: "Regra", detalhe: "Nunca corre dois dias seguidos nessas 8 semanas." },
    { titulo: "Repetir vale", tipo: "Regra", detalhe: "Semana pesada demais? Repete a semana antes de avançar." },
    { titulo: "Dor na articulação", tipo: "Regra", detalhe: "Para e descansa. Dor muscular leve é normal." },
    { titulo: "Check-up antes", tipo: "Regra", detalhe: "Quem estava parado deve passar no médico antes de começar." },
  ],
};

export const DESCANSO_FORCA: Record<AthleteId, string> = {
  danilo: "1 min entre uma volta e outra",
  leticia: "30 s entre exercícios, 1 min entre voltas",
};

/** Escala de esforço (Borg CR-10 adaptada). */
export const RPE_LABEL: Record<number, string> = {
  0: "Repouso",
  1: "Muito fácil",
  2: "Fácil",
  3: "Confortável",
  4: "Leve puxado",
  5: "Moderado",
  6: "Um pouco difícil",
  7: "Difícil",
  8: "Muito difícil",
  9: "Quase no limite",
  10: "Máximo",
};

export const MODO_LABEL = {
  normal: null,
  repetida: "Repetição da semana",
  leve30: "Semana leve (−30%, sem tiros)",
  leve20: "Semana leve (−20%)",
} as const;
