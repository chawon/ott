"use client";

import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  buildNativeStoreUrl,
  getNativeStorePlatform,
  isAppleStore,
  type StorePlatform,
} from "@/lib/store-acquisition.mjs";
import {
  browserStoreSurface,
  dismissStoreOffer,
  STORE_OFFER_CHANGED,
  storeOfferSuppressed,
  trackStoreCta,
} from "@/lib/storeAcquisition";
import styles from "./recording.module.css";

const COPY_KEYS = {
  "android-play": {
    title: "savedPlayCtaTitle",
    action: "savedPlayCtaAction",
    hint: "savedPlayCtaHint",
  },
  "ios-appstore": {
    title: "savedIosCtaTitle",
    action: "savedIosCtaAction",
    hint: "savedIosCtaHint",
  },
  "macos-appstore": {
    title: "savedMacosCtaTitle",
    action: "savedMacosCtaAction",
    hint: "savedMacosCtaHint",
  },
  "windows-store": {
    title: "savedWindowsCtaTitle",
    action: "savedWindowsCtaAction",
    hint: "savedWindowsCtaHint",
  },
} as const;

type StoreContext = {
  platform: StorePlatform;
  surface: "browser" | "pwa";
  recordId: string;
};

function properties({ platform, surface }: StoreContext) {
  return {
    placement: "quicklog_saved",
    surface,
    ...(platform === "android-play" ? { webHandoff: true } : {}),
  };
}

function recordImpression(
  context: StoreContext,
  previous: RefObject<string | null>,
) {
  if (previous.current === context.recordId) return;
  previous.current = context.recordId;
  void trackStoreCta(context.platform, "impression", properties(context));
}

export default function SavedNativeStoreCta({
  recordId,
  firstRecord,
  impressionRecord,
}: {
  recordId: string;
  firstRecord: boolean;
  impressionRecord: RefObject<string | null>;
}) {
  const locale = useLocale();
  const t = useTranslations("QuickLogCard");
  const tInstall = useTranslations("PwaInstall");
  const [context, setContext] = useState<StoreContext | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const browser = browserStoreSurface();
    const platform = getNativeStorePlatform(browser);
    if (!platform || (isAppleStore(platform) && !firstRecord)) {
      setContext(null);
      return;
    }
    const updateVisibility = () => {
      if (platform !== "android-play" && storeOfferSuppressed(platform)) {
        setContext(null);
        return;
      }
      setContext({
        platform,
        surface: browser.displayMode === "browser" ? "browser" : "pwa",
        recordId,
      });
    };
    updateVisibility();
    window.addEventListener("storage", updateVisibility);
    window.addEventListener(STORE_OFFER_CHANGED, updateVisibility);
    return () => {
      window.removeEventListener("storage", updateVisibility);
      window.removeEventListener(STORE_OFFER_CHANGED, updateVisibility);
    };
  }, [recordId, firstRecord]);

  useEffect(() => {
    const link = linkRef.current;
    if (
      !context ||
      !link ||
      context.recordId !== recordId ||
      impressionRecord.current === recordId
    )
      return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      recordImpression(context, impressionRecord);
      observer.disconnect();
    });
    observer.observe(link);
    return () => observer.disconnect();
  }, [context, recordId, impressionRecord]);

  if (!context || context.recordId !== recordId) return null;
  const { platform } = context;
  const copy = COPY_KEYS[platform];
  const onAction = (action: "click" | "dismiss") => {
    recordImpression(context, impressionRecord);
    void trackStoreCta(platform, action, properties(context));
    if (platform !== "android-play") dismissStoreOffer(platform);
  };
  const storeUrl = buildNativeStoreUrl({
    platform,
    locale,
    campaign: "web_quicklog_saved",
    content: "saved_stage_cta",
    webHandoff: true,
  });

  return (
    <div
      className={styles.discussionConnection}
      data-testid={`saved-${platform}-cta`}
    >
      <p>{t(copy.title)}</p>
      <a
        ref={linkRef}
        href={storeUrl}
        target="_blank"
        rel="noreferrer"
        className={styles.quiet}
        data-testid={`saved-${platform}-link`}
        onClick={() => onAction("click")}
      >
        {t(copy.action)}
        <ExternalLink size={16} aria-hidden="true" />
      </a>
      {isAppleStore(platform) && (
        <button
          type="button"
          className={styles.quiet}
          data-testid={`saved-${platform}-dismiss`}
          onClick={() => onAction("dismiss")}
        >
          {tInstall("closeAction")}
        </button>
      )}
      <p className={styles.hint}>{t(copy.hint)}</p>
    </div>
  );
}
