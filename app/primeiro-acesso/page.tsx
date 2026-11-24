import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEmailProvisorio, isSupabaseConfigured } from "@/lib/env";
import { PrimeiroAcessoForm } from "./form";

export const metadata: Metadata = { title: "Primeiro acesso" };

export default async function PrimeiroAcesso() {
  await connection();
  if (!isSupabaseConfigured()) redirect("/entrar");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: perfil } = await supabase.from("profiles").select("nome, trocar_senha, precisa_email").maybeSingle();
  if (!perfil) redirect("/hoje");
  const precisaEmail = Boolean(perfil.precisa_email) || isEmailProvisorio(user.email);
  if (!perfil.trocar_senha && !precisaEmail) redirect("/hoje");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <Image src="/icons/icon-192.png" alt="Evora" width={64} height={64} priority className="mb-6 rounded-[26%]" />
      <h1 className="text-3xl font-semibold tracking-tight">Bem-vindo, {perfil.nome.split(" ")[0]}!</h1>
      <p className="mt-2 text-muted">
        Antes de começar, {precisaEmail ? "cadastre seu e-mail e " : ""}troque a senha provisória por uma só sua.
      </p>
      <PrimeiroAcessoForm precisaEmail={precisaEmail} />
    </main>
  );
}
