"use client";
import * as A from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Accordion = A.Root;

export function AccordionItem({ className, ...props }: React.ComponentProps<typeof A.Item>) {
  return <A.Item className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof A.Trigger>) {
  return (
    <A.Header className="flex">
      <A.Trigger
        className={cn("group flex min-h-14 flex-1 items-center justify-between gap-3 px-5 py-4 text-left font-semibold", className)}
        {...props}
      >
        {children}
        <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </A.Trigger>
    </A.Header>
  );
}

export function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof A.Content>) {
  return (
    <A.Content className="overflow-hidden data-[state=closed]:animate-none" {...props}>
      <div className={cn("px-3 pb-3", className)}>{children}</div>
    </A.Content>
  );
}
