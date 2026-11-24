"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellOff, BellRing, Loader2, Share, SquarePlus, Smartphone } from "lucide-react";
import { deletePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Estado = "carregando" | "sem-suporte" | "ios-instalar" | "pronto" | "ativo" | "negado";

export function PushManager({ vapidKey }: { vapidKey: string }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (ios && !standalone) return setEstado("ios-instalar");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setEstado("sem-suporte");
      if (Notification.permission === "denied") return setEstado("negado");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const s = await reg.pushManager.getSubscription();
      setSub(s);
      setEstado(s ? "ativo" : "pronto");
    })().catch(() => setEstado("sem-suporte"));
  }, []);

  async function ativar() {
    if (!vapidKey) return toast.error("Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
    setBusy(true);
    try {
      // a permissão só é pedida depois do toque da pessoa
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setEstado(perm === "denied" ? "negado" : "pronto");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      const r = await savePushSubscription(JSON.parse(JSON.stringify(s)), navigator.userAgent);
      if (!r.ok) throw new Error(r.erro);
      setSub(s);
      setEstado("ativo");
      toast.success("Lembretes ativados");
    } catch (e) {
      toast.error((e as Error).message || "Não deu pra ativar");
    } finally {
      setBusy(false);
    }
  }

  async function desativar() {
    setBusy(true);
    try {
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSub(null);
      setEstado("pronto");
    } finally {
      setBusy(false);
    }
  }

  if (estado === "carregando") return <Card className="h-24 animate-pulse" />;

  if (estado === "ios-instalar") {
    return (
      <Card>
        <p className="flex items-center gap-2 font-semibold">
          <Smartphone className="h-5 w-5" /> Para receber lembretes no iPhone
        </p>
        <p className="mt-1 text-sm text-muted">O iPhone só manda notificação de app instalado na Tela de Início (iOS 16.4 ou mais recente).</p>
        <ol className="mt-4 space-y-3 text-[15px]">
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card-2 font-semibold">1</span>
            Toque em <Share className="inline h-4 w-4" /> <strong>Compartilhar</strong> no Safari
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card-2 font-semibold">2</span>
            Escolha <SquarePlus className="inline h-4 w-4" /> <strong>Adicionar à Tela de Início</strong>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card-2 font-semibold">3</span>
            Abra o Evora <strong>pelo ícone</strong> e volte aqui
          </li>
        </ol>
      </Card>
    );
  }

  return (
    <Card>
      {estado === "ativo" ? (
        <>
          <p className="flex items-center gap-2 font-semibold text-ok">
            <BellRing className="h-5 w-5" /> Lembretes ativos neste aparelho
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                const r = await sendTestPush();
                if (r.ok) toast.success("Notificação de teste enviada");
                else toast.error(r.erro);
              }}
            >
              Enviar teste
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={desativar}>
              <BellOff className="h-4 w-4" /> Desativar
            </Button>
          </div>
        </>
      ) : estado === "negado" ? (
        <p className="text-sm">As notificações estão bloqueadas. Libera nas configurações do navegador para este site e recarrega.</p>
      ) : estado === "sem-suporte" ? (
        <p className="text-sm text-muted">Este navegador não aceita notificações. No celular, use o Chrome (Android) ou instale na Tela de Início (iPhone).</p>
      ) : (
        <>
          <p className="font-semibold">Lembretes no celular</p>
          <p className="mt-1 text-sm text-muted">Corrida agendada, treino do dia, ajuste de pace e semana fechada.</p>
          <Button className="mt-4" disabled={busy} onClick={ativar}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
            Ativar lembretes
          </Button>
        </>
      )}
    </Card>
  );
}
