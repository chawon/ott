"use client";
import { useEffect, Suspense } from "react";
import { setUserId, setDeviceId, setPairingCode, getUserId } from "@/lib/localStore";
import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

function MigrationHelperContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // 1. URL parameters based migration (Redirect Flow)
    const u = searchParams.get("u");
    const d = searchParams.get("d");
    const p = searchParams.get("p");

    if (u && d && p) {
      console.log("[Migration] Data received via URL. Saving...");
      setUserId(u);
      setDeviceId(d);
      setPairingCode(p);
      localStorage.setItem("watchlog.migration-success", "true");
      void trackEvent("migration_complete", { from_domain: "ott.preview.pe.kr" });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
      return;
    }

    // 2. Legacy postMessage handler (if needed for other flows, but disabled for main migration)
    function handleMessage(event: MessageEvent) {
      const ALLOWED_ORIGINS = ["https://ottline.app", "http://localhost:3000"];
      if (!ALLOWED_ORIGINS.includes(event.origin)) return;
      if (event.data?.type !== "REQUEST_MIGRATION_DATA") return;

      const userId = localStorage.getItem("watchlog.userId");
      const deviceId = localStorage.getItem("watchlog.deviceId");
      const pairingCode = localStorage.getItem("watchlog.pairingCode");

      if (event.source) {
        (event.source as Window).postMessage(
          { type: "MIGRATION_DATA", payload: { userId, deviceId, pairingCode } },
          { targetOrigin: event.origin }
        );
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [searchParams]);

  const hasParams = searchParams.get("u");

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      {hasParams ? (
        <>
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-xl font-bold mb-2">기록 옮기는 중...</h2>
          <p className="opacity-70">잠시만 기다려주세요. 안전하게 이전하고 있습니다.</p>
        </>
      ) : (
        <div className="opacity-50 text-sm">Migration Helper Active</div>
      )}
    </div>
  );
}

export default function MigrationHelperPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MigrationHelperContent />
    </Suspense>
  );
}
