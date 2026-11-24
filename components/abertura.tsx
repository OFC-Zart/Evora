"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// Abertura do app: a montanha monta, a trilha vermelha se desenha e, em
// seguida, a montanha se abre ao meio enquanto a câmera "entra" pela trilha.
// Roda uma vez por sessão (sessionStorage) e é pulada com movimento reduzido.
// O script em app/layout.tsx marca <html data-abertura="off"> antes da pintura
// quando ela não deve rodar, para o app não piscar por baixo.

const CHAVE = "evora:abertura";
const DURACAO_PADRAO = 2.35; // s (com ?abertura=lenta fica 6x mais lenta, para conferir)

// ponto da montanha por onde a trilha entra (origem do zoom)
const ORIGEM = "60% 55%";
const ease = [0.7, 0, 0.84, 0] as const; // acelera para dentro
const suave = [0.22, 1, 0.36, 1] as const;

export function Abertura() {
  const [ativa, setAtiva] = useState(true);
  const [DURACAO, setDuracao] = useState<number | null>(null);

  useEffect(() => {
    const lenta = new URLSearchParams(location.search).get("abertura") === "lenta";
    if (document.documentElement.dataset.abertura === "off" && !lenta) {
      setAtiva(false);
      return;
    }
    try {
      sessionStorage.setItem(CHAVE, "1");
    } catch {}
    const d = DURACAO_PADRAO * (lenta ? 6 : 1);
    setDuracao(d);
    const t = setTimeout(() => setAtiva(false), d * 1000);
    return () => clearTimeout(t);
  }, []);

  if (!ativa) return null;
  // antes de decidir, só a tela preta (cobre o app sem piscar)
  if (DURACAO === null) return <div id="abertura" aria-hidden className="fixed inset-0 z-[100] bg-black" />;

  return (
    <motion.div
      id="abertura"
      aria-hidden
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black"
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: DURACAO, times: [0, 0.78, 1], ease: "easeOut" }}
      style={{ pointerEvents: "none" }}
    >
      {/* brilho vermelho que cresce quando a câmera entra */}
      <motion.div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 48%, rgba(225,10,30,0.35), transparent 55%)" }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.5, 1, 0], scale: [0.6, 1, 2.6, 4] }}
        transition={{ duration: DURACAO, times: [0, 0.35, 0.72, 1], ease: "easeIn" }}
      />

      <div className="relative w-[78vw] max-w-[420px]">
        {/* montanha: duas metades que se separam */}
        <div className="relative" style={{ aspectRatio: "920 / 345" }}>
          {(["esq", "dir"] as const).map((lado) => (
            <motion.img
              key={lado}
              src="/brand/montanha.png"
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full select-none"
              style={{
                transformOrigin: ORIGEM,
                clipPath: lado === "esq" ? "polygon(0 0, 61% 0, 54% 100%, 0 100%)" : "polygon(61% 0, 100% 0, 100% 100%, 54% 100%)",
              }}
              initial={{ opacity: 0, scale: 0.82, y: 14, x: 0, rotate: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.82, 1, 1, 3.2],
                y: [14, 0, 0, 0],
                x: lado === "esq" ? ["0vw", "0vw", "0vw", "-70vw"] : ["0vw", "0vw", "0vw", "70vw"],
                rotate: lado === "esq" ? [0, 0, 0, -14] : [0, 0, 0, 14],
              }}
              transition={{ duration: DURACAO * 0.82, times: [0, 0.3, 0.55, 1], ease: [suave, "linear", ease] }}
            />
          ))}

          {/* trilha vermelha: desenha da esquerda e depois vira a "porta" do zoom */}
          <motion.img
            src="/brand/trilha.png"
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full select-none"
            style={{ transformOrigin: ORIGEM }}
            initial={{ clipPath: "inset(0 100% 0 0)", scale: 1, opacity: 1 }}
            animate={{
              clipPath: ["inset(0 100% 0 0)", "inset(0 100% 0 0)", "inset(0 0% 0 0)", "inset(0 0% 0 0)", "inset(0 0% 0 0)"],
              scale: [1, 1, 1, 1, 16],
              opacity: [1, 1, 1, 1, 0],
            }}
            transition={{ duration: DURACAO * 0.9, times: [0, 0.12, 0.34, 0.5, 1], ease: ["linear", "easeOut", "linear", ease] }}
          />
        </div>

        {/* marca EVORA: sobe no começo e cai quando a montanha abre */}
        <motion.img
          src="/brand/marca.png"
          alt=""
          draggable={false}
          className="relative mx-auto mt-[6%] w-[96%] select-none"
          initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
          animate={{
            opacity: [0, 0, 1, 1, 0],
            y: [18, 18, 0, 0, 46],
            filter: ["blur(6px)", "blur(6px)", "blur(0px)", "blur(0px)", "blur(4px)"],
          }}
          transition={{ duration: DURACAO * 0.72, times: [0, 0.2, 0.45, 0.62, 1], ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}

/** Roda antes da pintura: decide se a abertura aparece. */
export const ABERTURA_SCRIPT = `try{if(sessionStorage.getItem("${CHAVE}")||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.abertura="off"}catch(e){}`;
