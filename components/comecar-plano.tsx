"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";
import { comecarPlano } from "@/app/actions";
import { Button } from "@/components/ui/button";

/** Botão que marca hoje como o dia 1 do plano. */
export function ComecarPlanoButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      block
      disabled={pending}
      className="shadow-lg shadow-accent/30"
      onClick={() =>
        start(async () => {
          const r = await comecarPlano();
          if (!r.ok) {
            toast.error(r.erro);
            return;
          }
          toast.success("Plano começou! Hoje é o dia 1.");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
      Começar meu plano hoje
    </Button>
  );
}
