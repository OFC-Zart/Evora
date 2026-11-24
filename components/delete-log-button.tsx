"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteLog } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function DeleteLogButton({ id }: { id: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const [pending, start] = useTransition();
  if (!confirmar) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setConfirmar(true)}>
        <Trash2 className="h-4 w-4" /> Apagar registro
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await deleteLog(id);
            if (r.ok) toast.success("Registro apagado");
            else toast.error(r.erro);
          })
        }
      >
        Apagar de vez
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirmar(false)}>
        Cancelar
      </Button>
    </div>
  );
}
