"use client";
import * as S from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({ className, label, ...props }: React.ComponentProps<typeof S.Root> & { label: string }) {
  return (
    <S.Root className={cn("relative flex h-11 w-full touch-none select-none items-center", className)} {...props}>
      <S.Track className="relative h-2 grow overflow-hidden rounded-full bg-card-2">
        <S.Range className="absolute h-full bg-accent" />
      </S.Track>
      <S.Thumb
        aria-label={label}
        className="block h-7 w-7 rounded-full border-2 border-fg bg-card shadow focus-visible:outline-2 focus-visible:outline-ring"
      />
    </S.Root>
  );
}
