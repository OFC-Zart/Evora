// Formatação e conversões básicas (7.1).

/** Pace em s/km a partir do tempo total e da distância. */
export function paceFromTime(tempo_s: number, distancia_km: number): number | null {
  if (!(distancia_km > 0) || !(tempo_s > 0)) return null;
  return tempo_s / distancia_km;
}

/** Tempo (s) de um trecho a partir da distância e do pace. */
export function segmentTime(distancia_km: number, pace_s_por_km: number): number {
  return distancia_km * pace_s_por_km;
}

/** 405 → "6:45". Arredonda para o segundo mais próximo. */
export function formatPace(pace_s: number | null | undefined): string {
  if (pace_s == null || !Number.isFinite(pace_s)) return "—";
  const total = Math.round(pace_s);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "6:45/km" */
export function formatPaceKm(pace_s: number | null | undefined): string {
  const p = formatPace(pace_s);
  return p === "—" ? p : `${p}/km`;
}

/** 1620 → "27:00"; 3725 → "1:02:05"; 28 → "0:28". */
export function formatDuration(total_s: number | null | undefined): string {
  if (total_s == null || !Number.isFinite(total_s)) return "—";
  const t = Math.round(total_s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Tempo total de um treino para mostrar: acima de 20 min arredonda para o
 * minuto (regra 7.1).
 */
export function formatWorkoutTotal(total_s: number): string {
  if (total_s > 20 * 60) return formatDuration(Math.round(total_s / 60) * 60);
  return formatDuration(total_s);
}

/** 1.5 → "1,5 km"; 0.4 → "400 m"; 5 → "5 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${formatNumber(km, 2)} km`;
}

/** Número com vírgula decimal, sem zeros sobrando. */
export function formatNumber(n: number, maxDecimals = 1): string {
  return n.toLocaleString("pt-BR", {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: 0,
  });
}

/** "27:00" / "1:02:05" / "27" (minutos) → segundos. Retorna null se inválido. */
export function parseDuration(text: string): number | null {
  const clean = text.trim();
  if (!clean) return null;
  if (/^\d+$/.test(clean)) return Number(clean) * 60;
  const parts = clean.split(":").map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 2) {
    const [m, s] = nums;
    if (s >= 60) return null;
    return m * 60 + s;
  }
  if (nums.length === 3) {
    const [h, m, s] = nums;
    if (m >= 60 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

/** "6:45" → 405 */
export function parsePace(text: string): number | null {
  const v = parseDuration(text);
  return v;
}

/** Máscara de digitação para tempo: "2700" → "27:00", "10230" → "1:02:30". */
export function maskDuration(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
  return `${digits.slice(0, -4)}:${digits.slice(-4, -2)}:${digits.slice(-2)}`;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
