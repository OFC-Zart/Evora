import { tipoCor } from "@/lib/ui/colors";
import { cn } from "@/lib/utils";

export function TypeTag({ tipo, className }: { tipo: string; className?: string }) {
  const cor = tipoCor(tipo);
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", className)}
      style={{ color: cor, backgroundColor: `color-mix(in srgb, ${cor} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
      {tipo}
    </span>
  );
}

export function TypeDot({ tipo }: { tipo: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tipoCor(tipo) }} aria-hidden />;
}
