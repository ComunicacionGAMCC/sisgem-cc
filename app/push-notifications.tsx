"use client";

import { useEffect, useState } from "react";
import { useAccess } from "./access";
import { UiIcon } from "./ui-icons";

type PushState = "checking" | "unsupported" | "inactive" | "activating" | "active" | "denied" | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

const DEFAULT_VAPID_PUBLIC_KEY = "BCx8x_9ASuFXr1TqxbATJIHV7JJ72HAcHipYVb7JbSzoENDZvE7bcjG68Kv8fMSYQdbsMXZ0BureJAxQu23lAjs";

export function PushNotificationControl({ compact = false }: { compact?: boolean }) {
  const access = useAccess();
  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const checkDevice = async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      try {
        const subscription = await currentSubscription();
        if (!cancelled) setState(subscription ? "active" : "inactive");
      } catch {
        if (!cancelled) setState("error");
      }
    };
    void checkDevice();
    return () => { cancelled = true; };
  }, []);

  async function activate() {
    const token = access.session?.access_token;
    const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? DEFAULT_VAPID_PUBLIC_KEY;
    if (!token || !publicKey) {
      setState("error");
      setMessage("Las notificaciones aún no están configuradas en el servidor.");
      return;
    }
    setState("activating");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "inactive");
        setMessage("Debes permitir las notificaciones en este dispositivo.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      const response = await fetch("/api/notifications/subscriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo registrar el dispositivo.");
      setState("active");
      setMessage("Este dispositivo recibirá avisos de la agenda.");
    } catch (reason) {
      setState("error");
      setMessage(reason instanceof Error ? reason.message : "No se pudieron activar las notificaciones.");
    }
  }

  async function deactivate() {
    const token = access.session?.access_token;
    if (!token) return;
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await fetch("/api/notifications/subscriptions", {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("inactive");
      setMessage("Notificaciones desactivadas en este dispositivo.");
    } catch {
      setState("error");
      setMessage("No se pudieron desactivar las notificaciones.");
    }
  }

  if (state === "unsupported") {
    if (compact) return null;
    return <span className="pushNoticeHint">Instala el portal en la pantalla de inicio para recibir avisos.</span>;
  }
  if (state === "denied") {
    if (compact) return <span className="pushNoticeHint denied" title="Habilita las notificaciones desde la configuración del dispositivo.">Avisos bloqueados</span>;
    return <span className="pushNoticeHint denied">Notificaciones bloqueadas en este dispositivo.</span>;
  }

  return (
    <div className={`pushNotificationControl${compact ? " compact" : ""}`}>
      <button
        type="button"
        className={state === "active" ? "pushButton active" : "pushButton"}
        onClick={state === "active" ? deactivate : activate}
        disabled={state === "checking" || state === "activating"}
        aria-pressed={state === "active"}
        title={state === "active" ? "Desactivar notificaciones en este dispositivo" : "Activar notificaciones en este dispositivo"}
      >
        <UiIcon name="bell" size={16} />
        {state === "active" ? "Avisos activos" : state === "activating" ? "Activando…" : "Activar avisos"}
      </button>
      {!compact && message ? <span className={state === "error" ? "pushMessage error" : "pushMessage"}>{message}</span> : null}
    </div>
  );
}
