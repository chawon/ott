"use client";

import { useEffect, useState } from "react";
import { X, Smartphone, Download, Share } from "lucide-react";
import { useTranslations } from "next-intl";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PwaInstallBanner() {
  const t = useTranslations("PwaInstall");
  const [isVisible, setIsVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">(
    "other",
  );

  useEffect(() => {
    // 앱인토스 미니앱 환경에서는 PWA 설치 배너를 표시하지 않음
    if ((window as any).__appsInToss) return;

    // Detect platform
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    if (isIos) setPlatform("ios");
    else if (isAndroid) setPlatform("android");

    // Check if already installed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone;
    const isPwaHidden = localStorage.getItem("pwa-banner-hidden") === "true";

    if (!isStandalone && !isPwaHidden) {
      // Show for iOS immediately (since there's no event)
      if (isIos) {
        setIsVisible(true);
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!isStandalone && !isPwaHidden) {
        setIsVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem("pwa-banner-hidden", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[100] animate-in fade-in slide-in-from-bottom-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
            <Smartphone className="h-6 w-6" />
          </div>
          <div className="flex-1 pr-6">
            <div className="font-semibold text-neutral-900">{t("title")}</div>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              {platform === "ios" ? t("iosDesc") : t("androidDesc")}
            </p>
            <div className="mt-4 flex items-center gap-3">
              {platform === "android" || deferredPrompt ? (
                <button
                  onClick={handleInstall}
                  className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-neutral-800 active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("installAction")}
                </button>
              ) : platform === "ios" ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-[10px] font-bold text-indigo-600">
                  <Share className="h-3.5 w-3.5" />
                  <span>Safari &gt; Add to Home Screen</span>
                </div>
              ) : null}
              <button
                onClick={handleClose}
                className="text-xs font-medium text-neutral-400 hover:text-neutral-600"
              >
                {t("closeAction")}
              </button>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="absolute right-3 top-3 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
