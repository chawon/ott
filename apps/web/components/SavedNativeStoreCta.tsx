"use client";

import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { isDismissalCooldownActive } from "@/lib/android-acquisition.mjs";
import { getGooglePlayTwaSignal } from "@/lib/androidAppContext";
import {
  buildNativeStoreUrl,
  getNativeStorePlatform,
  STORE_CTA_DISMISSED_AT_KEYS,
  type StorePlatform,
} from "@/lib/store-acquisition.mjs";
import { trackStoreCta } from "@/lib/storeAcquisition";
import styles from "./recording.module.css";

const COPY_KEYS = {
  "android-play": {
    title: "savedPlayCtaTitle",
    action: "savedPlayCtaAction",
    hint: "savedPlayCtaHint",
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

export default function SavedNativeStoreCta({
  recordId,
}: {
  recordId: string;
}) {
  const locale = useLocale();
  const t = useTranslations("QuickLogCard");
  const [context, setContext] = useState<StoreContext | null>(null);
  const trackedRecordId = useRef<string | null>(null);

  useEffect(() => {
    const navigatorWithStandalone = window.navigator as Navigator & {
      standalone?: boolean;
    };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;
    const platform = getNativeStorePlatform({
      userAgent: window.navigator.userAgent,
      maxTouchPoints: window.navigator.maxTouchPoints,
      displayMode: standalone ? "standalone" : "browser",
      twaSignal: getGooglePlayTwaSignal(),
      embedded: window.self !== window.top,
    });
    let suppressed = false;
    if (platform && platform !== "android-play") {
      try {
        suppressed = isDismissalCooldownActive(
          window.localStorage.getItem(STORE_CTA_DISMISSED_AT_KEYS[platform]),
        );
      } catch {
        // Keep the optional CTA usable when browser storage is unavailable.
      }
    }
    setContext(
      platform && !suppressed
        ? {
            platform,
            surface: standalone ? "pwa" : "browser",
            recordId,
          }
        : null,
    );
  }, [recordId]);

  useEffect(() => {
    if (
      !context ||
      context.recordId !== recordId ||
      trackedRecordId.current === recordId
    )
      return;
    trackedRecordId.current = recordId;
    void trackStoreCta(context.platform, "impression", {
      placement: "quicklog_saved",
      surface: context.surface,
      ...(context.platform === "android-play" ? { webHandoff: true } : {}),
    });
  }, [context, recordId]);

  if (!context || context.recordId !== recordId) return null;
  const { platform, surface } = context;
  const copy = COPY_KEYS[platform];
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
        href={storeUrl}
        target="_blank"
        rel="noreferrer"
        className={styles.quiet}
        data-testid={`saved-${platform}-link`}
        onClick={() => {
          void trackStoreCta(platform, "click", {
            placement: "quicklog_saved",
            surface,
            ...(platform === "android-play" ? { webHandoff: true } : {}),
          });
          // Keep the established Android saved-stage behavior. The Windows
          // prompt shares the global banner's 14-day dismissal window.
          if (platform !== "android-play") {
            try {
              window.localStorage.setItem(
                STORE_CTA_DISMISSED_AT_KEYS[platform],
                String(Date.now()),
              );
            } catch {
              // The link still opens and this CTA still closes without storage.
            }
            window.setTimeout(() => setContext(null), 0);
          }
        }}
      >
        {t(copy.action)}
        <ExternalLink size={16} aria-hidden="true" />
      </a>
      <p className={styles.hint}>{t(copy.hint)}</p>
    </div>
  );
}
