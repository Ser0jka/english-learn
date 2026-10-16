import { useEffect, useRef, useState } from "react";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export function usePwa() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => window.matchMedia("(display-mode: standalone)").matches,
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null);
  const updateRequested = useRef(false);
  useEffect(() => {
    const before = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let active = true;
    const controller = () => {
      if (updateRequested.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", controller);
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(async (registration) => {
        if (registration.waiting && active) setUpdate(registration);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (
              active &&
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setUpdate(registration);
          });
        });
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(
                () => reject(new Error("Offline installation timed out")),
                30000,
              );
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
        if (active) setReady(true);
      })
      .catch(() => {
        if (active)
          setError(
            "Не удалось подготовить офлайн-версию. Приложение продолжает работать с сетью.",
          );
      });
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controller,
      );
    };
  }, []);
  async function install() {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    } catch {
      setError(
        "Браузер не смог открыть установку. Используйте его меню «На главный экран».",
      );
    }
  }
  function applyUpdate() {
    if (update?.waiting) {
      updateRequested.current = true;
      update.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }
  return {
    installed,
    canInstall: !!installEvent,
    install,
    ready,
    error,
    hasUpdate: !!update,
    applyUpdate,
  };
}
