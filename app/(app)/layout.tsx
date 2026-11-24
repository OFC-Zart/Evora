import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="pb-nav mx-auto max-w-md px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {children}
        <p className="mt-10 px-2 text-center text-[11px] leading-relaxed text-muted">
          Este app não substitui orientação médica ou de um profissional de educação física.
        </p>
      </main>
      <BottomNav />
    </>
  );
}
