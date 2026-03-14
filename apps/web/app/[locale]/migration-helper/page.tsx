"use client";
import { useEffect } from "react";

// Domains allowed to request and receive migration data
const ALLOWED_ORIGINS = [
  "https://ottline.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://172.24.75.199:3000"
];

export default function MigrationHelperPage() {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Security: Check if the requester is in our allowed list
      if (!ALLOWED_ORIGINS.includes(event.origin)) {
        console.warn("[MigrationHelper] Unauthorized origin:", event.origin);
        return;
      }
      
      if (event.data?.type !== "REQUEST_MIGRATION_DATA") return;

      console.log("[MigrationHelper] Request received from:", event.origin);

      const userId = localStorage.getItem("watchlog.userId");
      const deviceId = localStorage.getItem("watchlog.deviceId");
      const pairingCode = localStorage.getItem("watchlog.pairingCode");

      if (event.source) {
        (event.source as Window).postMessage(
          { 
            type: "MIGRATION_DATA", 
            payload: { userId, deviceId, pairingCode } 
          },
          { targetOrigin: event.origin } // Respond exactly back to the requester
        );
        console.log("[MigrationHelper] Data sent back to parent.");
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div style={{ padding: "20px", fontSize: "12px", color: "#666" }}>
      Migration Helper Active
    </div>
  );
}
