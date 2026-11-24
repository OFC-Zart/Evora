import { Card } from "@/components/ui/card";
import { signOut } from "@/app/actions";

export function NoProfile() {
  return (
    <Card className="mt-16">
      <p className="text-lg font-semibold">Conta ainda não ligada a um atleta</p>
      <p className="mt-2 text-sm text-muted">
        No SQL Editor do Supabase, rode <code className="rounded bg-card-2 px-1">select public.link_athlete(&apos;seu-email&apos;, &apos;danilo&apos;);</code> (ou
        &apos;leticia&apos;) e recarregue a página.
      </p>
      <form action={signOut} className="mt-5">
        <button className="min-h-11 text-sm font-medium text-accent-ink">Sair</button>
      </form>
    </Card>
  );
}
