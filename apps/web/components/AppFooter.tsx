"use client";

import Link from "next/link";
import { useRetro } from "@/context/RetroContext";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Link as IntlLink } from "@/i18n/routing";

export default function AppFooter() {
  const currentYear = new Date().getFullYear();
  const { isRetro } = useRetro();
  const t = useTranslations("AppFooter");

  return (
    <footer
      className={cn(
        "mt-20 border-t py-12",
        isRetro
          ? "border-black bg-white"
          : "border-border bg-muted/60 dark:bg-card/80",
      )}
    >
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <div
              className={cn(
                "text-sm font-bold tracking-tighter",
                isRetro ? "text-black uppercase" : "text-foreground",
              )}
            >
              {isRetro ? t("titleRetro") : t("titleModern")}
            </div>
            <p
              className={cn(
                "text-xs leading-relaxed",
                isRetro
                  ? "font-bold text-neutral-600"
                  : "text-muted-foreground",
              )}
            >
              {isRetro ? t("descriptionRetro") : t("descriptionModern")}
            </p>
          </div>

          <div className="space-y-4">
            <h3
              className={cn(
                "text-xs font-bold uppercase tracking-widest",
                isRetro ? "text-black" : "text-foreground",
              )}
            >
              {isRetro ? t("sectionServiceRetro") : t("sectionServiceModern")}
            </h3>
            <ul
              className={cn(
                "space-y-2 text-xs",
                isRetro
                  ? "font-bold text-neutral-800"
                  : "text-muted-foreground",
              )}
            >
              <li>
                <IntlLink href="/" className="hover:underline">
                  {isRetro ? t("linkLogRetro") : t("linkLogModern")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/timeline" className="hover:underline">
                  {isRetro ? t("linkTimelineRetro") : t("linkTimelineModern")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/public" className="hover:underline">
                  {isRetro ? t("linkPublicRetro") : t("linkPublicModern")}
                </IntlLink>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3
              className={cn(
                "text-xs font-bold uppercase tracking-widest",
                isRetro ? "text-black" : "text-foreground",
              )}
            >
              {isRetro ? t("sectionGuideRetro") : t("sectionGuideModern")}
            </h3>
            <ul
              className={cn(
                "space-y-2 text-xs",
                isRetro
                  ? "font-bold text-neutral-800"
                  : "text-muted-foreground",
              )}
            >
              <li>
                <IntlLink href="/about" className="hover:underline">
                  {isRetro ? t("linkAboutRetro") : t("linkAboutModern")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/faq" className="hover:underline">
                  {isRetro ? t("linkFaqRetro") : t("linkFaqModern")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/privacy" className="hover:underline">
                  {isRetro ? t("linkPrivacyRetro") : t("linkPrivacyModern")}
                </IntlLink>
              </li>
            </ul>
          </div>

          <div
            className={cn(
              "space-y-4 text-xs",
              isRetro ? "font-bold text-neutral-400" : "text-muted-foreground",
            )}
          >
            <p>
              © {currentYear} {isRetro ? t("titleRetro") : t("titleModern")}. {t("allRightsReserved")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
