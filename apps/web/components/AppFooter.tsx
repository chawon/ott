import { getTranslations } from "next-intl/server";
import { Link as IntlLink } from "@/i18n/routing";
import styles from "./AppShell.module.css";

export default async function AppFooter() {
  const t = await getTranslations("AppFooter");
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div>
          <div className={styles.footerBrand}>ottline · ON THE TIMELINE</div>
          <p className={styles.footerDescription}>{t("descriptionModern")}</p>
        </div>
        <nav
          className={styles.footerLinks}
          aria-label={t("sectionGuideModern")}
        >
          <IntlLink href="/guide">{t("linkGuidesModern")}</IntlLink>
          <IntlLink href="/about">{t("linkAboutModern")}</IntlLink>
          <IntlLink href="/faq">{t("linkFaqModern")}</IntlLink>
          <IntlLink href="/privacy">{t("linkPrivacyModern")}</IntlLink>
          <IntlLink href="/feedback">{t("linkFeedbackModern")}</IntlLink>
        </nav>
        <div>
          <p>
            © {new Date().getFullYear()} {t("titleModern")}.{" "}
            {t("allRightsReserved")}
          </p>
          <a className={styles.footerContact} href="mailto:contact@ottline.app">
            contact@ottline.app
          </a>
        </div>
      </div>
    </footer>
  );
}
