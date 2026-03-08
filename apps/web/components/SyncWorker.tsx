"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { syncOutbox } from "@/lib/sync";
import { trackEvent } from "@/lib/analytics";
import { useRetro } from "@/context/RetroContext";

export default function SyncWorker() {
  const pathname = usePathname();
  const { isRetro, isRetroReady } = useRetro();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key.startsWith("ott-pwa-")) {
              void caches.delete(key);
            }
          });
        });
      }
      return;
    }
  }, []);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;
    if (!isRetroReady) return;

    (async () => {
      await trackEvent("app_open", { isRetro });
      await syncOutbox();
    })();

    function handleOnline() {
      syncOutbox();
    }

    function handleVisible() {
      if (document.visibilityState === "visible") syncOutbox();
    }

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [pathname, isRetroReady]);

  return null;
}
