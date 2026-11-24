import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AskCoachButton, ApplySuggestionsButton } from "@/components/action-buttons";
import { formatDateShort } from "@/lib/engine";
import type { CoachRow } from "@/lib/server/state";

export function CoachCard({ msg, showAsk = true }: { msg: CoachRow | undefined; showAsk?: boolean }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-muted">
          <MessageCircle className="h-4 w-4" /> Recado do coach
          {msg && <span className="text-xs">· {formatDateShort(msg.created_at.slice(0, 10))}{msg.fonte === "ia" ? " · IA" : ""}</span>}
        </p>
      </div>
      {msg ? (
        <>
          <p className="mt-3 text-[15px] leading-relaxed">{msg.texto}</p>
          {msg.dicas?.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              {msg.dicas.map((d, i) => (
                <li key={i}>• {d}</li>
              ))}
            </ul>
          )}
          {msg.sugestoes?.length > 0 && (
            <div className="mt-4 rounded-xl bg-card-2 p-3">
              <p className="text-sm font-semibold">Sugestões de ajuste</p>
              <ul className="mt-1 space-y-1 text-sm">
                {msg.sugestoes.map((s, i) => (
                  <li key={i}>
                    <span className="num font-medium">
                      {s.zona} {s.delta_s > 0 ? "+" : ""}
                      {s.delta_s} s/km
                    </span>{" "}
                    <span className="text-muted">— {s.motivo}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3">{msg.aplicado ? <p className="text-sm text-ok">Aplicado ✓</p> : <ApplySuggestionsButton id={msg.id} />}</div>
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-[15px] text-muted">O primeiro recado chega quando a semana fechar. Ou pede uma análise agora.</p>
      )}
      {showAsk && (
        <div className="mt-4">
          <AskCoachButton />
        </div>
      )}
    </Card>
  );
}
