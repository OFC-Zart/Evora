"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { concluirPrimeiroAcesso } from "./actions";

const input = "h-12 w-full rounded-2xl border border-border bg-card px-4 text-base outline-none placeholder:text-muted focus:border-ring";

export function PrimeiroAcessoForm({ precisaEmail }: { precisaEmail: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (precisaEmail && email.trim().toLowerCase() !== email2.trim().toLowerCase()) {
      toast.error("Os dois e-mails não são iguais.");
      return;
    }
    if (senha !== senha2) {
      toast.error("As duas senhas não são iguais.");
      return;
    }
    setLoading(true);
    try {
      const r = await concluirPrimeiroAcesso({ senha, email: precisaEmail ? email.trim() : null });
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success("Tudo pronto!");
      router.replace("/hoje");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      {precisaEmail && (
        <>
          <div>
            <label htmlFor="pa-email" className="mb-1.5 block text-sm font-medium">
              Seu e-mail
            </label>
            <input id="pa-email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="pa-email2" className="mb-1.5 block text-sm font-medium">
              Repita o e-mail
            </label>
            <input id="pa-email2" type="email" required autoComplete="email" inputMode="email" value={email2} onChange={(e) => setEmail2(e.target.value)} className={input} />
          </div>
        </>
      )}
      <div>
        <label htmlFor="pa-senha" className="mb-1.5 block text-sm font-medium">
          Senha nova
        </label>
        <input id="pa-senha" type="password" required minLength={8} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={input} aria-describedby="pa-dica" />
        <p id="pa-dica" className="mt-1 text-xs text-muted">
          Pelo menos 8 caracteres.
        </p>
      </div>
      <div>
        <label htmlFor="pa-senha2" className="mb-1.5 block text-sm font-medium">
          Repita a senha nova
        </label>
        <input id="pa-senha2" type="password" required minLength={8} autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} className={input} />
      </div>
      <Button type="submit" size="lg" block disabled={loading}>
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        Salvar e começar
      </Button>
    </form>
  );
}
