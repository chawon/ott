"use client";

import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  buildGooglePlayStoreUrl,
  shouldShowAndroidSavedStagePlayCta,
} from "@/lib/android-acquisition.mjs";
import { getGooglePlayTwaSignal } from "@/lib/androidAppContext";
import { localizedStoreUrls } from "@/lib/seo";
import styles from "./recording.module.css";

type AndroidSurface = "browser" | "pwa";

export default function SavedAndroidPlayCta({
  recordId,
}: {
  recordId: string;
}) {
  const locale = useLocale();
  const t = useTranslations("QuickLogCard");
  const [surface, setSurface] = useState<AndroidSurface | null>(null);
  const trackedRecordIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent;
    const navigatorWithStandalone = window.navigator as Navigator & {
      standalone?: boolean;
    };
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;
    const twaSignal = getGooglePlayTwaSignal();

    if (
      !shouldShowAndroidSavedStagePlayCta({
        userAgent: ua,
        displayMode: isStandalone ? "standalone" : "browser",
        twaSignal,
      })
    ) {
      setSurface(null);
      return;
    }

    const nextSurface: AndroidSurface = isStandalone ? "pwa" : "browser";
    setSurface(nextSurface);

    if (trackedRecordIdRef.current !== recordId) {
      trackedRecordIdRef.current = recordId;
      void trackEvent("android_play_cta_impression", {
        placement: "quicklog_saved",
        surface: nextSurface,
        webHandoff: true,
      });
    }
  }, [recordId]);

  if (!surface) return null;

  const playStoreUrl = buildGooglePlayStoreUrl({
    baseUrl: localizedStoreUrls(locale).googlePlay,
    campaign: "quicklog_saved",
    content: "saved_stage_cta",
    webHandoff: true,
  });

  return (
    <div
      className={styles.discussionConnection}
      data-testid="saved-android-play-cta"
    >
      <p>{t("savedPlayCtaTitle")}</p>
      <a
        href={playStoreUrl}
        target="_blank"
        rel="noreferrer"
        className={styles.quiet}
        data-testid="saved-android-play-link"
        onClick={() => {
          void trackEvent("android_play_cta_click", {
            placement: "quicklog_saved",
            surface,
            webHandoff: true,
          });
        }}
      >
        {t("savedPlayCtaAction")}
        <ExternalLink size={16} aria-hidden="true" />
      </a>
      <p className={styles.hint}>{t("savedPlayCtaHint")}</p>
    </div>
  );
}
