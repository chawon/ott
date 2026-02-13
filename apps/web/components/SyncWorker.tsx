"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ensureAuth } from "@/lib/auth";
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

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration errors to avoid blocking runtime flows.
    });
  }, []);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;
    if (!isRetroReady) return;

    (async () => {
      await ensureAuth();
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
