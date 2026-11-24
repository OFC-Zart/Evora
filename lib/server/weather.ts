import "server-only";

// Clima pela Open-Meteo (gratuita, sem chave). Usado para corrigir o pace pelo
// calor: temperatura + ponto de orvalho na hora do treino.

export interface Weather {
  temp_c: number;
  orvalho_c: number;
}

export async function fetchWeather(lat: number, lon: number, data: string, hora = "07:00"): Promise<Weather | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toFixed(4));
    url.searchParams.set("longitude", lon.toFixed(4));
    url.searchParams.set("hourly", "temperature_2m,dew_point_2m");
    url.searchParams.set("timezone", "America/Sao_Paulo");
    url.searchParams.set("start_date", data);
    url.searchParams.set("end_date", data);
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { hourly?: { time: string[]; temperature_2m: number[]; dew_point_2m: number[] } };
    const h = json.hourly;
    if (!h?.time?.length) return null;
    const alvo = `${data}T${hora.slice(0, 2)}:00`;
    let i = h.time.indexOf(alvo);
    if (i < 0) i = Math.min(h.time.length - 1, Math.max(0, Number(hora.slice(0, 2))));
    const temp = h.temperature_2m[i];
    const dew = h.dew_point_2m[i];
    if (temp == null || dew == null) return null;
    return { temp_c: Math.round(temp * 10) / 10, orvalho_c: Math.round(dew * 10) / 10 };
  } catch {
    return null;
  }
}
