// Datas no fuso America/Sao_Paulo. Datas de calendário são strings YYYY-MM-DD
// e a aritmética é feita em UTC para não sofrer com fuso/horário de verão.

import { DIAS, type Dia } from "./types";

export const TZ = "America/Sao_Paulo";

/** Data local (YYYY-MM-DD) em São Paulo para um instante. */
export function isoDateInTz(d: Date = new Date(), tz = TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Hora local "HH:MM" em São Paulo. */
export function timeInTz(d: Date = new Date(), tz = TZ): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86400000);
}

/** seg..dom de uma data. */
export function dayKey(iso: string): Dia {
  const js = toUtc(iso).getUTCDay(); // 0 = domingo
  return DIAS[(js + 6) % 7];
}

/** Segunda-feira da semana de uma data. */
export function mondayOf(iso: string): string {
  const idx = DIAS.indexOf(dayKey(iso));
  return addDays(iso, -idx);
}

/** Semana do calendário do plano (1-based). Antes do início retorna ≤ 0. */
export function calendarWeekOf(plan_inicio: string, iso: string): number {
  return Math.floor(daysBetween(plan_inicio, iso) / 7) + 1;
}

/** Intervalo [segunda, domingo] de uma semana do calendário do plano. */
export function weekRange(plan_inicio: string, semana: number): { inicio: string; fim: string } {
  const inicio = addDays(plan_inicio, (semana - 1) * 7);
  return { inicio, fim: addDays(inicio, 6) };
}

/** Data de um dia (seg..dom) numa semana do calendário. */
export function dateOfDay(plan_inicio: string, semana: number, dia: Dia): string {
  return addDays(weekRange(plan_inicio, semana).inicio, DIAS.indexOf(dia));
}

export function monthsBetween(a: string, b: string): number {
  return daysBetween(a, b) / 30.4375;
}

export function addMonths(iso: string, months: number): string {
  return addDays(iso, Math.round(months * 30.4375));
}

export const DIA_LABEL: Record<Dia, string> = {
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
  dom: "Domingo",
};

export const DIA_CURTO: Record<Dia, string> = {
  seg: "Seg",
  ter: "Ter",
  qua: "Qua",
  qui: "Qui",
  sex: "Sex",
  sab: "Sáb",
  dom: "Dom",
};

/** "23/11" */
export function formatDateShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** "seg, 23 de nov." */
export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(toUtc(iso));
}

/** "24 de nov." (sem o dia da semana) */
export function formatDayMonth(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(toUtc(iso));
}

/** Data distante: "set. de 2029"; perto (até ~10 meses): "8 de set." */
export function formatDateFar(iso: string, hoje: string): string {
  if (daysBetween(hoje, iso) > 300) {
    return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).format(toUtc(iso));
  }
  return formatDayMonth(iso);
}
