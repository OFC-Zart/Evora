"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailProvisorio } from "@/lib/env";

type R = { ok: true } | { ok: false; erro: string };

/** "danilo" → e-mail da conta. Feito no servidor para não expor e-mails. */
async function resolverLogin(login: string): Promise<string | null> {
  const l = login.trim().toLowerCase();
  if (l.includes("@")) return l;
  const usuario = l.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!/^[a-z]{2,30}$/.test(usuario)) return null;
  try {
    const admin = createAdminClient();
    const { data: perfil } = await admin.from("profiles").select("user_id").eq("athlete_id", usuario).maybeSingle();
    if (!perfil?.user_id) return null;
    const { data } = await admin.auth.admin.getUserById(perfil.user_id);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

const Entrada = z.object({ login: z.string().min(2).max(200), senha: z.string().min(1).max(200) });

export async function entrar(input: z.infer<typeof Entrada>): Promise<R> {
  const v = Entrada.safeParse(input);
  if (!v.success) return { ok: false, erro: "Preencha usuário e senha." };
  const email = await resolverLogin(v.data.login);
  if (!email) return { ok: false, erro: "Usuário ou senha incorretos." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: v.data.senha });
  if (error) return { ok: false, erro: "Usuário ou senha incorretos." };
  return { ok: true };
}

export async function enviarLink(login: string, next: string): Promise<R> {
  const email = await resolverLogin(z.string().min(2).max(200).parse(login));
  if (!email || isEmailProvisorio(email)) {
    return { ok: false, erro: "Essa conta ainda não tem um e-mail de verdade. Entre com a senha." };
  }
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const destino = next.startsWith("/") && !next.startsWith("//") ? next : "/hoje";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(destino)}` },
  });
  if (error) return { ok: false, erro: "Não deu pra mandar o link agora. Tente de novo em alguns minutos." };
  return { ok: true };
}
