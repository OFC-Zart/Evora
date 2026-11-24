"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { entrar, enviarLink } from "./actions";

const input =
  "h-12 w-full rounded-2xl border border-border bg-card px-4 text-base outline-none placeholder:text-muted focus:border-ring";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"senha" | "link">("senha");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = modo === "senha" ? await entrar({ login, senha }) : await enviarLink(login, next);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      if (modo === "senha") {
        router.replace(next);
        router.refresh();
      } else setEnviado(true);
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <Mail className="h-6 w-6 text-accent-ink" />
        <p className="mt-3 font-semibold">Confere seu e-mail</p>
        <p className="mt-1 text-sm text-muted">Mandamos um link de acesso. Abre ele neste aparelho.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="login" className="mb-1.5 block text-sm font-medium">
          Usuário ou e-mail
        </label>
        <input
          id="login"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ex.: danilo"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className={input}
        />
      </div>
      {modo === "senha" && (
        <div>
          <label htmlFor="senha" className="mb-1.5 block text-sm font-medium">
            Senha
          </label>
          <input id="senha" type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={input} />
        </div>
      )}
      <Button type="submit" size="lg" block disabled={loading}>
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        {modo === "senha" ? "Entrar" : "Mandar link por e-mail"}
      </Button>
      <button type="button" onClick={() => setModo(modo === "senha" ? "link" : "senha")} className="min-h-11 w-full text-sm font-medium text-accent-ink">
        {modo === "senha" ? "Prefiro receber um link por e-mail" : "Entrar com senha"}
      </button>
    </form>
  );
}
