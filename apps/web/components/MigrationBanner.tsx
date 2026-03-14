"use client";
import { useEffect, useState } from "react";
import { getUserId, getDeviceId, getPairingCode } from "@/lib/localStore";

export default function MigrationBanner() {
  const [isOldDomain, setIsOldDomain] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsOldDomain(window.location.hostname === "ott.preview.pe.kr");
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  if (!isOldDomain) return null;

  const handleMigrate = () => {
    const u = getUserId() || "";
    const d = getDeviceId() || "";
    const p = getPairingCode() || "";
    
    const targetUrl = `https://ottline.app/ko/migration-helper?u=${encodeURIComponent(u)}&d=${encodeURIComponent(d)}&p=${encodeURIComponent(p)}`;
    
    if (isStandalone) {
      window.open(targetUrl, "_blank");
    } else {
      window.location.href = targetUrl;
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-blue-600 p-4 shadow-lg animate-in slide-in-from-top duration-500">
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
        <div className="text-center sm:text-left">
          <p className="font-bold text-lg">이사 기념! 새로운 도메인으로 안내합니다</p>
          <p className="text-sm opacity-90">
            {isStandalone 
              ? "기록 이사 후에는 새로운 앱을 다시 설치해 주세요 (기존 앱 삭제 권장)" 
              : "클릭 한 번으로 기존 기록을 안전하게 새 도메인으로 옮길 수 있습니다."}
          </p>
        </div>
        <button 
          onClick={handleMigrate}
          className="whitespace-nowrap bg-white text-blue-600 px-6 py-2 rounded-full font-bold hover:bg-gray-100 transition-colors shadow-sm"
        >
          {isStandalone ? "새 브라우저에서 열기" : "기록 옮기기"}
        </button>
      </div>
    </div>
  );
}
