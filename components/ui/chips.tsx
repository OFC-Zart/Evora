"use client";
import { cn } from "@/lib/utils";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  tone?: "ok" | "warn" | "danger";
}

/** Grupo de chips de escolha única (acessível como radiogroup). */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-medium transition",
              active
                ? o.tone === "danger"
                  ? "border-danger bg-danger text-white"
                  : o.tone === "warn"
                    ? "border-warn bg-warn text-white"
                    : "border-fg bg-fg text-bg"
                : "border-border bg-card text-fg hover:bg-card-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
