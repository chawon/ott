"use client";

import {
  Download,
  ExternalLink,
  MonitorDown,
  Smartphone,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "@/i18n/routing";
import {
  buildNativeStoreUrl,
  getInstallBannerMode,
  isAppleStore,
  isIosSafari,
} from "@/lib/store-acquisition.mjs";
import {
  browserStoreSurface,
  dismissStoreOffer,
  STORE_OFFER_CHANGED,
  storeOfferSuppressed,
  trackStoreCta,
} from "@/lib/storeAcquisition";

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type BannerMode = NonNullable<ReturnType<typeof getInstallBannerMode>>;
type Surface = "browser" | "pwa";

const PWA_BANNER_HIDDEN_KEY = "pwa-banner-hidden";
const RECORDING_SELECTOR =
  '[role="dialog"][data-record-stage][data-state="open"], ' +
  '[data-record-layout="inline"][data-stage="status"], ' +
  '[data-record-layout="inline"][data-stage="edit"], ' +
  '[data-record-layout="inline"][data-stage="saved"]';

const COPY_KEYS = {
  "android-play": {
    title: "playTitle",
    description: "playDesc",
    action: "playAction",
  },
  "windows-store": {
    title: "windowsTitle",
    description: "windowsDesc",
    action: "windowsAction",
  },
  "ios-appstore": {
    title: "iosTitle",
    description: "iosDesc",
    action: "iosAction",
  },
  "macos-appstore": {
    title: "macosTitle",
    description: "macosDesc",
    action: "macosAction",
  },
  "browser-pwa": {
    title: "title",
    description: "androidDesc",
    action: "installAction",
  },
} as const;

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
    // Storage is optional; dismissal still takes effect in this page.
  }
}

export default function PwaInstallBanner() {
  const locale = useLocale();
  const path = usePathname();
  const t = useTranslations("PwaInstall");
  const [isVisible, setIsVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<BannerMode | null>(null);
  const [surface, setSurface] = useState<Surface>("browser");
  const [webHandoff, setWebHandoff] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const trackedMode = useRef<BannerMode | null>(null);
  const [iosSafari, setIosSafari] = useState(false);
  const applePage =
    path === "/" ||
    path === "/about" ||
    path === "/guide" ||
    path.startsWith("/guide/");
  // Safari owns the About banner. Direct record-entry links stay clear while
  // the dialog hydrates. Both conditions also apply during client navigation.
  const allowedOnPage =
    !isAppleStore(mode) ||
    (applePage &&
      !(iosSafari && path === "/about") &&
      new URLSearchParams(window.location.search).get("quick") !== "1");

  useEffect(() => {
    const browser = browserStoreSurface();
    const nextMode = getInstallBannerMode(browser);
    const standalone = browser.displayMode !== "browser";
    setIosSafari(isIosSafari(browser));
    setMode(nextMode);
    setSurface(standalone ? "pwa" : "browser");
    setWebHandoff(Boolean(readLocalStorage("watchlog.userId")?.trim()));

    const isSuppressed = () =>
      !nextMode ||
      (nextMode === "browser-pwa"
        ? readLocalStorage(PWA_BANNER_HIDDEN_KEY) === "true"
        : storeOfferSuppressed(nextMode));
    if (nextMode && nextMode !== "browser-pwa" && !isSuppressed()) {
      setIsVisible(true);
    }

    const updateRecording = () => {
      setIsRecording(Boolean(document.querySelector(RECORDING_SELECTOR)));
      // A saved-stage store click may have dismissed this platform while the
      // recording dialog was open. Do not show another CTA when it closes.
      if (isSuppressed()) setIsVisible(false);
    };
    updateRecording();
    const observer = new MutationObserver(updateRecording);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "data-stage", "data-record-stage"],
    });

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      if (nextMode !== "browser-pwa" || isSuppressed()) return;
      promptRef.current = event as BeforeInstallPromptEvent;
      setDeferredPrompt(promptRef.current);
      setIsVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("storage", updateRecording);
    window.addEventListener(STORE_OFFER_CHANGED, updateRecording);
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("storage", updateRecording);
      window.removeEventListener(STORE_OFFER_CHANGED, updateRecording);
    };
  }, []);

  useEffect(() => {
    if (
      !allowedOnPage ||
      !isVisible ||
      isRecording ||
      !mode ||
      mode === "browser-pwa" ||
      trackedMode.current === mode ||
      document.querySelector(RECORDING_SELECTOR)
    )
      return;
    trackedMode.current = mode;
    void trackStoreCta(mode, "impression", {
      placement: "global_install_banner",
      surface,
      ...(mode === "android-play" ? { webHandoff } : {}),
    });
  }, [allowedOnPage, isVisible, isRecording, mode, surface, webHandoff]);

  const handlePwaInstall = async () => {
    const prompt = promptRef.current;
    if (!prompt) return;
    // beforeinstallprompt is single-use, including when installation is declined.
    promptRef.current = null;
    setDeferredPrompt(null);
    setIsVisible(false);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // Browser cancellation must not interrupt recording or show a dead button.
    }
  };

  const dismissStore = (action: "click" | "dismiss") => {
    if (!mode || mode === "browser-pwa") return;
    dismissStoreOffer(mode);
    void trackStoreCta(mode, action, {
      placement: "global_install_banner",
      surface,
      ...(mode === "android-play" ? { webHandoff } : {}),
    });
  };

  const handleClose = () => {
    setIsVisible(false);
    if (mode === "browser-pwa") {
      writeLocalStorage(PWA_BANNER_HIDDEN_KEY, "true");
    } else {
      dismissStore("dismiss");
    }
  };

  if (!allowedOnPage || !isVisible || isRecording || !mode) return null;
  const nativeStore = mode !== "browser-pwa";
  const storeUrl = nativeStore
    ? buildNativeStoreUrl({
        platform: mode,
        locale,
        campaign: "web_global_banner",
        content:
          surface === "pwa" ? "global_banner_pwa" : "global_banner_browser",
        webHandoff,
      })
    : null;
  const copy = COPY_KEYS[mode];
  const Icon =
    mode === "windows-store" || mode === "macos-appstore"
      ? MonitorDown
      : Smartphone;

  return (
    <div
      data-testid="store-install-banner"
      data-store-platform={mode}
      className="fixed bottom-[var(--mobile-bottom-overlay-offset)] left-1/2 z-50 w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 sm:max-w-none sm:translate-x-0"
    >
      <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ott-paper-strong text-brand-navy dark:text-foreground">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <div className="font-semibold text-foreground">{t(copy.title)}</div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t(copy.description)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {storeUrl ? (
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="store-install-link"
                  onClick={() => {
                    dismissStore("click");
                    window.setTimeout(() => setIsVisible(false), 0);
                  }}
                  className="flex min-h-12 items-center gap-2 rounded-lg border border-brand-navy/30 bg-card px-4 text-sm font-semibold text-brand-navy transition-colors hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-border dark:text-foreground"
                >
                  <ExternalLink
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  {t(copy.action)}
                </a>
              ) : deferredPrompt ? (
                <button
                  type="button"
                  onClick={handlePwaInstall}
                  className="flex min-h-12 items-center gap-2 rounded-lg border border-brand-navy/30 bg-card px-4 text-sm font-semibold text-brand-navy transition-colors hover:bg-ott-paper-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-border dark:text-foreground"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("installAction")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleClose}
                className="min-h-12 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t("closeAction")}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            data-testid="store-install-dismiss"
            className="absolute right-1 top-1 flex min-h-12 min-w-12 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("closeAction")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
