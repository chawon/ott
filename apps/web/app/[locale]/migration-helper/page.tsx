"use client";
import { useEffect } from "react";

const NEW_DOMAIN = "https://ottline.app";

export default function MigrationHelperPage() {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== NEW_DOMAIN) return;
      if (event.data?.type !== "REQUEST_MIGRATION_DATA") return;

      const userId = localStorage.getItem("watchlog.userId");
      const deviceId = localStorage.getItem("watchlog.deviceId");
      const pairingCode = localStorage.getItem("watchlog.pairingCode");

      (event.source as Window).postMessage(
        { type: "MIGRATION_DATA", payload: { userId, deviceId, pairingCode } },
        { targetOrigin: NEW_DOMAIN }
      );
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}
