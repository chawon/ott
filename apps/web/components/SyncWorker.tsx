"use client";

import { useEffect } from "react";
import { ensureAuth } from "@/lib/auth";
import { syncOutbox } from "@/lib/sync";
import { trackEvent } from "@/lib/analytics";

export default function SyncWorker() {
  useEffect(() => {
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
  }, []);

  return null;
}
