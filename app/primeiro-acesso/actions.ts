"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailProvisorio } from "@/lib/env";

const Schema = z.object({
  senha: z.string().min(8, "A senha nova precisa ter pelo menos 8 caracteres.").max(72),
  email: z.string().email("E-mail inválido.").max(200).nullable(),
});

export async function concluirPrimeiroAcesso(input: z.infer<typeof Schema>): Promise<{ ok: true } | { ok: false; erro: string }> {
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? "Confere os campos." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };
  const { data: perfil } = await supabase.from("profiles").select("athlete_id, trocar_senha, precisa_email").maybeSingle();
  if (!perfil) return { ok: false, erro: "Perfil não encontrado." };

  if (perfil.precisa_email || isEmailProvisorio(user.email)) {
    if (!v.data.email || isEmailProvisorio(v.data.email)) return { ok: false, erro: "Coloque um e-mail de verdade." };
    // o e-mail provisório não recebe nada, então a troca é feita direto pelo servidor
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(user.id, { email: v.data.email.trim().toLowerCase(), email_confirm: true });
    if (error) return { ok: false, erro: error.message.includes("already") ? "Esse e-mail já está em uso." : "Não deu pra salvar o e-mail." };
  }

  const { error } = await supabase.auth.updateUser({ password: v.data.senha });
  if (error) {
    const msg = error.message.toLowerCase();
    return { ok: false, erro: msg.includes("same") || msg.includes("different") ? "A senha nova precisa ser diferente da provisória." : "Não deu pra trocar a senha." };
  }

  await supabase.from("profiles").update({ trocar_senha: false, precisa_email: false }).eq("athlete_id", perfil.athlete_id);
  return { ok: true };
}
