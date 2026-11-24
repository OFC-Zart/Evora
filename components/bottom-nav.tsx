"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, Plus, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/hoje", label: "Hoje", icon: House },
  { href: "/plano", label: "Plano", icon: CalendarDays },
  { href: "/registrar", label: "Registrar", icon: Plus, central: true },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/perfil", label: "Perfil", icon: User },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Navegação principal" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg">
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
        {ITEMS.map(({ href, label, icon: Icon, central }) => {
          const active = path === href || path.startsWith(href + "/") || (href === "/perfil" && ["/ritmos", "/agenda"].some((p) => path.startsWith(p)));
          if (central) {
            return (
              <li key={href} className="flex justify-center">
                <Link
                  href={href}
                  aria-label={label}
                  className="-mt-6 mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg shadow-accent/40 ring-4 ring-bg transition active:scale-95"
                >
                  <Icon className="h-8 w-8" strokeWidth={2.5} />
                </Link>
              </li>
            );
          }
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-fg" : "text-muted")}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 1.9} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
