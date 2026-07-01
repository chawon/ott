"use client";

import { Bell, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link as IntlLink, usePathname } from "@/i18n/routing";
import { api } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { listAllLogsLocal } from "@/lib/localStore";
import { buildPersonalReport, type PersonalReport } from "@/lib/report";

const RECAP_KEY = "2026-H1";
const NOTICE_STORAGE_KEY = `ottline.recapNotice.dismissed.${RECAP_KEY}`;
const NOTICE_START_AT = new Date("2026-07-01T00:00:00+09:00").getTime();
const NOTICE_END_AT = new Date("2026-08-01T00:00:00+09:00").getTime();

function isNoticePeriod(now = new Date()) {
  const time = now.getTime();
  return time >= NOTICE_START_AT && time < NOTICE_END_AT;
}

function readDismissed() {
  try {
    return window.localStorage.getItem(NOTICE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    window.localStorage.setItem(NOTICE_STORAGE_KEY, "1");
  } catch {
    // Ignore storage errors. The notice should never block navigation.
  }
}

async function loadReportWithLocalFallback(): Promise<PersonalReport> {
  try {
    return await api<PersonalReport>("/nalytic/me/report");
  } catch {
    const logs = await listAllLogsLocal();
    return buildPersonalReport(logs);
  }
}

export default function SeasonalRecapNotice() {
  const t = useTranslations("AppHeader");
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [recapMeta, setRecapMeta] = useState<{
    totalLogs: number;
    posterCount: number;
  } | null>(null);
  const impressionTracked = useRef(false);
  const isReportPage = pathname === "/me/report";
  const isAdminPage = pathname.startsWith("/admin");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isNoticePeriod() || isReportPage || isAdminPage || readDismissed()) {
        setVisible(false);
        return;
      }

      const report = await loadReportWithLocalFallback().catch(() => null);
      const recap = report?.seasonalRecap;
      if (cancelled || !recap || recap.key !== RECAP_KEY) {
        setVisible(false);
        return;
      }

      const meta = {
        totalLogs: recap.totalLogs,
        posterCount: recap.posters.length,
      };
      setRecapMeta(meta);
      setVisible(true);

      if (!impressionTracked.current) {
        impressionTracked.current = true;
        void trackEvent("h1_recap_notice_impression", {
          recapKey: recap.key,
          ...meta,
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isAdminPage, isReportPage]);

  if (!visible || !recapMeta) return null;

  function handleOpen() {
    markDismissed();
    setVisible(false);
    void trackEvent("h1_recap_notice_click", {
      recapKey: RECAP_KEY,
      ...recapMeta,
    });
  }

  function handleDismiss() {
    markDismissed();
    setVisible(false);
    void trackEvent("h1_recap_notice_dismiss", {
      recapKey: RECAP_KEY,
      ...recapMeta,
    });
  }

  return (
    <div className="border-t border-[#ECEBE9] bg-[#FEF9EE]">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center gap-3 px-4 py-3.5 text-[15px] leading-5 text-[#0F0F0F] sm:min-h-[60px] sm:py-3">
        <Bell className="h-5 w-5 shrink-0 text-[#FF9933]" />
        <div className="min-w-0 flex-1 font-semibold">
          {t("h1RecapNoticeTitle")}
        </div>
        <IntlLink
          href={"/me/report#seasonal-recap" as "/me/report"}
          onClick={handleOpen}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg bg-[#FF9933] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#e88724] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/40"
        >
          {t("h1RecapNoticeAction")}
          <ChevronRight className="h-4 w-4" />
        </IntlLink>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-[#4A4A4A] transition-colors hover:bg-[#ECEBE9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/40"
          aria-label={t("h1RecapNoticeDismiss")}
          title={t("h1RecapNoticeDismiss")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
