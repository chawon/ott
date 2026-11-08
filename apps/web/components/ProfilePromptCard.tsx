"use client";

import { ArrowRight, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import styles from "./ProfileEditor.module.css";

export default function ProfilePromptCard({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  const t = useTranslations("Profile");
  return (
    <section className={styles.prompt}>
      <UserRound
        aria-hidden="true"
        size={28}
        className="shrink-0 text-brand-navy dark:text-foreground"
      />
      <div className={styles.promptCopy}>
        <h2>{t("promptTitle")}</h2>
        <p>{t("promptDesc")}</p>
      </div>
      <div className={styles.promptActions}>
        <Link href="/account">
          {t("createAction")}
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
        <button type="button" onClick={onDismiss}>
          {t("laterAction")}
        </button>
      </div>
    </section>
  );
}
