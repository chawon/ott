"use client";

import { useEffect } from "react";
import { ensureAuth } from "@/lib/auth";
import { syncOutbox } from "@/lib/sync";

export default function SyncWorker() {
  useEffect(() => {
    (async () => {
      await ensureAuth();
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
