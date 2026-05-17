"use client";

import { UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UserProfile } from "@/lib/types";
import ProfileEditor from "./ProfileEditor";

export default function ProfilePromptCard({
  profile,
  onSaved,
  onDismiss,
}: {
  profile: UserProfile | null;
  onSaved?: (profile: UserProfile) => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("Profile");

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-sky-50 p-2 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="text-base font-semibold">{t("promptTitle")}</div>
          <p className="text-sm text-muted-foreground">{t("promptDesc")}</p>
        </div>
      </div>
      <ProfileEditor
        profile={profile}
        onSaved={onSaved}
        onDismiss={onDismiss}
        submitLabel={t("createAction")}
      />
    </section>
  );
}
