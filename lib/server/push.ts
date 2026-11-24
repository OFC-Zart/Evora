import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as webpush from "web-push";
import { getVapidKeys, vapidSubject } from "./secrets";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured = false;
async function configure(): Promise<boolean> {
  if (configured) return true;
  const keys = await getVapidKeys();
  if (!keys) return false;
  webpush.setVapidDetails(vapidSubject(), keys.publicKey, keys.privateKey);
  configured = true;
  return true;
}

/**
 * Envia um push para todos os aparelhos do atleta. Endpoints que respondem
 * 404 ou 410 (inscrição expirada) são apagados.
 */
export async function sendPushToAthlete(supabase: SupabaseClient, athlete: string, payload: PushPayload): Promise<number> {
  if (!(await configure())) return 0;
  const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("athlete_id", athlete);
  let enviados = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 6, urgency: "normal" },
      );
      enviados++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }
  return enviados;
}
