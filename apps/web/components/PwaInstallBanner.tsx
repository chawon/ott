"use client";

import { Download, ExternalLink, Share, Smartphone, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  isAndroidUserAgent,
  shouldShowAndroidPlayPrompt,
} from "@/lib/android-acquisition.mjs";
import { getGooglePlayTwaSignal } from "@/lib/androidAppContext";
import { localizedStoreUrls } from "@/lib/seo";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type BannerMode = "android-play" | "ios-pwa" | "browser-pwa";
type AndroidSurface = "browser" | "pwa";

const PWA_BANNER_HIDDEN_KEY = "pwa-banner-hidden";
const PLAY_CTA_DISMISSED_AT_KEY = "ottline.androidPlayCta.dismissedAt";
const PLAY_REFERRER = encodeURIComponent(
  "utm_source=ottline_web&utm_medium=owned&utm_campaign=android_play_cta",
);

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Dismissal persistence is optional; the banner remains non-blocking.
  }
}

export default function PwaInstallBanner() {
  const locale = useLocale();
  const t = useTranslations("PwaInstall");
  const [isVisible, setIsVisible] = useState(false);
  const [mode, setMode] = useState<BannerMode | null>(null);
  const [androidSurface, setAndroidSurface] =
    useState<AndroidSurface>("browser");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = isAndroidUserAgent(ua);
    const navigatorWithStandalone = window.navigator as Navigator & {
      standalone?: boolean;
    };
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;

    if (isAndroid) {
      const suppressPwaPrompt = (event: Event) => {
        event.preventDefault();
      };
      window.addEventListener("beforeinstallprompt", suppressPwaPrompt);

      const twaSignal = getGooglePlayTwaSignal();
      const surface: AndroidSurface = isStandalone ? "pwa" : "browser";
      if (
        shouldShowAndroidPlayPrompt({
          userAgent: ua,
          displayMode: isStandalone ? "standalone" : "browser",
          twaSignal,
          dismissalValue: readLocalStorage(PLAY_CTA_DISMISSED_AT_KEY),
        })
      ) {
        setAndroidSurface(surface);
        setMode("android-play");
        setIsVisible(true);
        void trackEvent("android_play_cta_impression", {
          placement: "global_install_banner",
          surface,
        });
      }

      return () =>
        window.removeEventListener("beforeinstallprompt", suppressPwaPrompt);
    }

    const isPwaHidden = readLocalStorage(PWA_BANNER_HIDDEN_KEY) === "true";
    if (!isStandalone && !isPwaHidden && isIos) {
      setMode("ios-pwa");
      setIsVisible(true);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      if (!isStandalone && !isPwaHidden) {
        setMode("browser-pwa");
        setIsVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handlePwaInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsVisible(false);
    setDeferredPrompt(null);
  };

  const handlePlayClick = () => {
    writeLocalStorage(PLAY_CTA_DISMISSED_AT_KEY, String(Date.now()));
    void trackEvent("android_play_cta_click", {
      placement: "global_install_banner",
      surface: androidSurface,
    });
    window.setTimeout(() => setIsVisible(false), 0);
  };

  const handleClose = () => {
    setIsVisible(false);
    if (mode === "android-play") {
      writeLocalStorage(PLAY_CTA_DISMISSED_AT_KEY, String(Date.now()));
      void trackEvent("android_play_cta_dismiss", {
        placement: "global_install_banner",
        surface: androidSurface,
      });
      return;
    }
    writeLocalStorage(PWA_BANNER_HIDDEN_KEY, "true");
  };

  if (!isVisible || !mode) return null;

  const playStoreUrl = `${localizedStoreUrls(locale).googlePlay}&referrer=${PLAY_REFERRER}`;
  const isPlayMode = mode === "android-play";

  return (
    <div className="fixed bottom-[var(--mobile-bottom-overlay-offset)] left-1/2 z-[100] w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 sm:max-w-none sm:translate-x-0">
      <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ott-paper-strong text-[#1E4D8C] dark:text-foreground">
            <Smartphone className="h-6 w-6" />
          </div>
          <div className="flex-1 pr-6">
            <div className="font-semibold text-foreground">
              {isPlayMode ? t("playTitle") : t("title")}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {isPlayMode
                ? t("playDesc")
                : mode === "ios-pwa"
                  ? t("iosDesc")
                  : t("androidDesc")}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {isPlayMode ? (
                <a
                  href={playStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handlePlayClick}
                  className="flex min-h-12 items-center gap-2 rounded-lg border border-[#1E4D8C]/30 bg-card px-4 text-xs font-semibold text-[#1E4D8C] transition-colors hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D8C]/25 dark:border-border dark:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("playAction")}
                </a>
              ) : deferredPrompt ? (
                <button
                  type="button"
                  onClick={handlePwaInstall}
                  className="flex min-h-12 items-center gap-2 rounded-lg border border-[#1E4D8C]/30 bg-card px-4 text-xs font-semibold text-[#1E4D8C] transition-colors hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D8C]/25 dark:border-border dark:text-foreground"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("installAction")}
                </button>
              ) : mode === "ios-pwa" ? (
                <div className="flex min-h-12 items-center gap-1.5 rounded-lg bg-ott-paper-strong px-3 text-[10px] font-semibold text-[#1E4D8C] dark:text-foreground">
                  <Share className="h-3.5 w-3.5" />
                  <span>Safari &gt; Add to Home Screen</span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleClose}
                className="min-h-12 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t("closeAction")}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-1 top-1 flex min-h-12 min-w-12 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("closeAction")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
