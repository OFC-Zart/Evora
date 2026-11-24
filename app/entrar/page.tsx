import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/hoje";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <Image src="/icons/icon-192.png" alt="Evora" width={64} height={64} priority className="mb-6 rounded-[26%]" />
      <h1 className="text-3xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-2 text-muted">Use seu nome de usuário e a senha.</p>
      {!isSupabaseConfigured() && (
        <p className="mt-6 rounded-2xl bg-card-2 p-4 text-sm">
          O app ainda não está ligado ao banco de dados. Veja o SETUP.md.
        </p>
      )}
      {sp.erro === "link" && <p className="mt-6 rounded-2xl bg-card-2 p-4 text-sm text-danger">O link expirou ou já foi usado. Pede outro.</p>}
      <LoginForm next={next} />
    </main>
  );
}
