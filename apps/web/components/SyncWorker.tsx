"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ensureAuth } from "@/lib/auth";
import { syncOutbox } from "@/lib/sync";
import { trackEvent } from "@/lib/analytics";

export default function SyncWorker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;

    (async () => {
      await ensureAuth();
      await trackEvent("app_open");
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
  }, [pathname]);

  return null;
}
