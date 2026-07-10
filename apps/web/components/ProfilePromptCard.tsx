"use client";

import { ArrowRight, Clock3, UserRound } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function ProfilePromptCard({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  const t = useTranslations("Profile");

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-ott-paper-strong p-2 text-[#1E4D8C] dark:text-foreground">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-base font-semibold">{t("promptTitle")}</div>
          <p className="text-sm text-muted-foreground">{t("promptDesc")}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/account"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white transition hover:bg-neutral-800"
        >
          {t("createAction")}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted"
        >
          <Clock3 className="h-4 w-4" />
          {t("laterAction")}
        </button>
      </div>
    </section>
  );
}
