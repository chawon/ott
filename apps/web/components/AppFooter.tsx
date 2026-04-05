import { getTranslations } from "next-intl/server";
import { Link as IntlLink } from "@/i18n/routing";
import { cn } from "@/lib/utils";

async function getApiVersion(): Promise<string> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/actuator/info`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return "unknown";
    const data = await res.json();
    return data?.app?.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export default async function AppFooter() {
  const t = await getTranslations("AppFooter");
  const currentYear = new Date().getFullYear();
  const webVersion = process.env.APP_VERSION ?? "dev";
  const apiVersion = await getApiVersion();

  return (
    <footer
      className={cn(
        "mt-20 border-t py-12",
        "border-border bg-muted/60 dark:bg-card/80",
      )}
    >
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <div
              className={cn(
                "text-sm font-bold tracking-tighter",
                "text-foreground",
              )}
            >
              {t("titleModern")}
            </div>
            <p
              className={cn(
                "text-xs leading-relaxed",
                "text-muted-foreground",
              )}
            >
              {t("descriptionModern")}
            </p>
          </div>

          <div className="space-y-4">
            <h3
              className={cn(
                "text-xs font-bold uppercase tracking-widest",
                "text-foreground",
              )}
            >
              {t("sectionServiceModern")}
            </h3>
            <ul
              className={cn(
                "space-y-2 text-xs",
                "text-muted-foreground",
              )}
            >
              <li>
                <IntlLink href="/" className="hover:underline">
                  {t("linkLogModern")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/timeline" className="hover:underline">
                  {t("linkTimelineModern")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/public" className="hover:underline">
                  {t("linkPublicModern")}
                </IntlLink>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3
              className={cn(
                "text-xs font-bold uppercase tracking-widest",
                "text-foreground",
              )}
            >
              {t("sectionGuideModern")}
            </h3>
            <ul
              className={cn(
                "space-y-2 text-xs",
                "text-muted-foreground",
              )}
            >
              <li>
                <IntlLink href="/about" className="hover:underline">
                  {t("linkAboutModern")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/faq" className="hover:underline">
                  {t("linkFaqModern")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/privacy" className="hover:underline">
                  {t("linkPrivacyModern")}
                </IntlLink>
              </li>
              <li>
                <IntlLink href="/feedback" className="hover:underline">
                  {t("linkFeedbackModern")}
                </IntlLink>
              </li>
            </ul>
          </div>

          <div
            className={cn(
              "space-y-4 text-xs",
              "text-muted-foreground",
            )}
          >
            <p>
              © {currentYear} {t("titleModern")}.{" "}
              {t("allRightsReserved")}
            </p>
            <a
              href="mailto:contact@ottline.app"
              className="block hover:underline"
            >
              contact@ottline.app
            </a>
            <p className="font-mono text-[10px] opacity-50">
              web {webVersion} · api {apiVersion}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
