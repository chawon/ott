"use client";

import { MonitorDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { buildNativeStoreUrl } from "@/lib/store-acquisition.mjs";

const PREFERENCE_KEY = "ottline.extension.prefersWindowsApp";

function readAppPreference() {
  try {
    return window.localStorage.getItem(PREFERENCE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function WindowsQuickRecordBridge({ href }: { href: string }) {
  const locale = useLocale();
  const t = useTranslations("WindowsQuickRecordBridge");
  const preferenceId = useId();
  const [prefersApp, setPrefersApp] = useState(readAppPreference);
  const storeUrl = buildNativeStoreUrl({
    platform: "windows-store",
    locale,
    campaign: "extension_handoff",
  });

  function updatePreference(checked: boolean) {
    setPrefersApp(checked);
    try {
      if (checked) window.localStorage.setItem(PREFERENCE_KEY, "1");
      else window.localStorage.removeItem(PREFERENCE_KEY);
    } catch {
      // The app link stays available when the browser blocks storage.
    }
  }

  return (
    <div
      data-testid="windows-quick-record-bridge"
      className="mb-4 flex shrink-0 flex-wrap items-center gap-x-4 rounded-lg border border-border bg-ott-paper-strong px-3 py-1 text-sm sm:px-4"
    >
      <a
        href={href}
        referrerPolicy="no-referrer"
        data-record-initial-focus={prefersApp ? "" : undefined}
        className={`inline-flex min-h-10 items-center gap-2 rounded-lg font-semibold text-brand-navy dark:text-foreground ${
          prefersApp ? "border border-current bg-card px-2" : "hover:underline"
        }`}
      >
        <MonitorDown className="size-4 shrink-0" aria-hidden="true" />
        {t("openApp")}
      </a>
      <a
        href={storeUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-9 items-center rounded-lg text-foreground underline underline-offset-2"
      >
        {t("installApp")}
      </a>
      <label
        htmlFor={preferenceId}
        className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-muted-foreground"
      >
        <input
          id={preferenceId}
          type="checkbox"
          checked={prefersApp}
          onChange={(event) => updatePreference(event.currentTarget.checked)}
          className="size-4 shrink-0 accent-primary"
        />
        {t("preferApp")}
      </label>
    </div>
  );
}
