import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/env";
import { IconArt } from "@/lib/ui/icon-art";
import { buttonVariants } from "@/components/ui/button";

export default function Inicio() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 pb-10 pt-[18vh]">
      <div>
        <IconArt size={72} />
        <h1 className="mt-8 text-5xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="mt-3 text-xl text-muted">{APP_TAGLINE}</p>
        <ul className="mt-10 space-y-3 text-[15px] text-muted">
          <li>• O treino do dia com pace e tempo exatos</li>
          <li>• Registro em menos de 30 segundos</li>
          <li>• Paces que se ajustam com os seus dados</li>
        </ul>
      </div>
      <div className="space-y-4">
        <Link href="/entrar" className={buttonVariants({ size: "lg", block: true })}>
          Entrar
        </Link>
        <p className="text-center text-xs text-muted">
          Este app não substitui orientação médica ou de um profissional de educação física.
        </p>
      </div>
    </main>
  );
}
