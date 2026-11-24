"use client";
import { Button } from "@/components/ui/button";

export default function Erro({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mt-16 rounded-2xl border border-border bg-card p-6">
      <p className="text-lg font-semibold">Algo deu errado</p>
      <p className="mt-2 text-sm text-muted">{error.message}</p>
      <Button className="mt-5" onClick={reset}>
        Tentar de novo
      </Button>
    </div>
  );
}
