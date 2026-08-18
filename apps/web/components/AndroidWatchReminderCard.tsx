"use client";

import { BellRing, Settings, ShieldCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { shouldShowAndroidReminderCard } from "@/lib/android-acquisition.mjs";
import { getGooglePlayTwaSignal } from "@/lib/androidAppContext";

const DISMISSED_AT_KEY = "ottline.androidWatchReminderCard.dismissedAt";

function readDismissedAt() {
  try {
    return window.localStorage.getItem(DISMISSED_AT_KEY);
  } catch {
    return null;
  }
}

function startCooldown() {
  try {
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
  } catch {
    // The card remains dismissible for the current render without storage.
  }
}

export default function AndroidWatchReminderCard() {
  const t = useTranslations("AndroidWatchReminderCard");
  const [isVisible, setIsVisible] = useState(false);
  const impressionTracked = useRef(false);

  useEffect(() => {
    const twaSignal = getGooglePlayTwaSignal();
    if (
      !shouldShowAndroidReminderCard({
        twaSignal,
        dismissalValue: readDismissedAt(),
      })
    ) {
      return;
    }

    setIsVisible(true);
    if (!impressionTracked.current) {
      impressionTracked.current = true;
      void trackEvent("android_reminder_card_impression", {
        placement: "home_after_first_log",
      });
    }
  }, []);

  function handleOpen() {
    startCooldown();
    void trackEvent("android_reminder_card_open", {
      placement: "home_after_first_log",
    });
    window.setTimeout(() => setIsVisible(false), 0);
  }

  function handleDismiss() {
    startCooldown();
    setIsVisible(false);
    void trackEvent("android_reminder_card_dismiss", {
      placement: "home_after_first_log",
    });
  }

  if (!isVisible) return null;

  return (
    <section className="rounded-lg border border-[#1E4D8C]/20 bg-ott-paper-strong p-4 text-foreground shadow-sm dark:border-border sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-[#1E4D8C] shadow-sm dark:text-foreground">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-xs font-semibold text-[#1E4D8C] dark:text-foreground">
            {t("eyebrow")}
          </div>
          <h2 className="text-base font-semibold leading-6">{t("title")}</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D8C]/25"
          aria-label={t("closeLabel")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/70 bg-card/80 p-3 text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1E4D8C] dark:text-foreground" />
        <p>{t("privacy")}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href="ottline://watch-reminder"
          onClick={handleOpen}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#1E4D8C]/30 bg-card px-4 text-sm font-semibold text-[#1E4D8C] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D8C]/25 dark:border-border dark:text-foreground dark:hover:bg-muted"
        >
          <Settings className="h-4 w-4" />
          {t("action")}
        </a>
        <button
          type="button"
          onClick={handleDismiss}
          className="min-h-12 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          {t("later")}
        </button>
      </div>
    </section>
  );
}
