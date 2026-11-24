import "server-only";
import { generateVAPIDKeys } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Segredos que o app gera sozinho e guarda em public.app_secrets (tabela com
// RLS e sem políticas: só a service role lê). Assim ninguém precisa copiar
// chave de push nem segredo do agendador para a Vercel. Se as variáveis de
// ambiente existirem, elas têm prioridade.

const cache = new Map<string, string>();

async function lerSegredo(nome: string): Promise<string | null> {
  if (cache.has(nome)) return cache.get(nome)!;
  const admin = createAdminClient();
  const { data, error } = await admin.from("app_secrets").select("valor").eq("nome", nome).maybeSingle();
  if (error) throw new Error(`app_secrets: ${error.message}`);
  if (data?.valor) cache.set(nome, data.valor);
  return data?.valor ?? null;
}

async function gravarSeAusente(nome: string, valor: string): Promise<string> {
  const admin = createAdminClient();
  await admin.from("app_secrets").upsert({ nome, valor }, { onConflict: "nome", ignoreDuplicates: true });
  cache.delete(nome);
  return (await lerSegredo(nome)) ?? valor;
}

export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string } | null> {
  const envPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const envPriv = process.env.VAPID_PRIVATE_KEY;
  if (envPub && envPriv) return { publicKey: envPub, privateKey: envPriv };
  try {
    let pub = await lerSegredo("vapid_public");
    let priv = await lerSegredo("vapid_private");
    if (!pub || !priv) {
      // primeira vez: gera o par e guarda (se outra requisição gravou antes, vale a dela)
      const novo = generateVAPIDKeys();
      priv = await gravarSeAusente("vapid_private", novo.privateKey);
      pub = await gravarSeAusente("vapid_public", priv === novo.privateKey ? novo.publicKey : ((await lerSegredo("vapid_public")) ?? novo.publicKey));
    }
    return { publicKey: pub, privateKey: priv };
  } catch {
    return null;
  }
}

export async function getCronSecret(): Promise<string | null> {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
  try {
    return await lerSegredo("cron_secret");
  } catch (e) {
    console.error("[cron] não deu pra ler o cron_secret:", e instanceof Error ? e.message : e);
    return null;
  }
}

export function vapidSubject(): string {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : "https://evora.vercel.app";
}
