"use client";

import {
  Clock,
  Home,
  MessageCircle,
  Monitor,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { startTransition } from "react";
import { useTheme } from "@/context/ThemeContext";
import { Link as IntlLink, usePathname, useRouter } from "@/i18n/routing";
import { getMatchedNavHref, type NavHref } from "@/lib/navigation";
import { useUserProfile } from "@/lib/useUserProfile";
import styles from "./AppShell.module.css";
import ProfileAvatar from "./ProfileAvatar";
import QuickLogAction from "./QuickLogAction";
import SeasonalRecapNotice from "./SeasonalRecapNotice";

const localeOptions = [
  { value: "ko", shortLabel: "KO", labelKey: "languageKorean" },
  { value: "en", shortLabel: "EN", labelKey: "languageEnglish" },
] as const;

function buildQuery(searchParams: URLSearchParams) {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of searchParams.entries()) {
    const existingValue = query[key];
    query[key] =
      existingValue === undefined
        ? value
        : Array.isArray(existingValue)
          ? [...existingValue, value]
          : [existingValue, value];
  }
  return query;
}

export default function AppHeader() {
  const { mode, toggleTheme } = useTheme();
  const t = useTranslations("AppHeader");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useUserProfile();
  const ko = locale === "ko";
  const matched = getMatchedNavHref(pathname);
  const nav = [
    { href: "/", label: ko ? "홈" : "Home", icon: Home },
    { href: "/timeline", label: ko ? "타임라인" : "Timeline", icon: Clock },
    { href: "/public", label: ko ? "함께" : "Together", icon: MessageCircle },
    { href: "/account", label: ko ? "내 공간" : "My space", icon: UserRound },
  ] as const satisfies readonly {
    href: NavHref;
    label: string;
    icon: typeof Home;
  }[];
  const ThemeIcon = mode === "system" ? Monitor : mode === "dark" ? Moon : Sun;
  const themeLabel =
    mode === "system"
      ? t("themeSystem")
      : mode === "dark"
        ? t("themeDark")
        : t("themeLight");

  function handleLocaleChange(nextLocale: "ko" | "en") {
    if (nextLocale === locale) return;
    startTransition(() => {
      const query = buildQuery(new URLSearchParams(window.location.search));
      router.replace(
        Object.keys(query).length ? { pathname, query } : pathname,
        { locale: nextLocale },
      );
    });
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <IntlLink
          href="/"
          className={styles.brand}
          aria-label={ko ? "ottline 홈" : "ottline home"}
        >
          <Image
            src="/brand/v2/mark.svg"
            alt=""
            width={40}
            height={40}
            className={`${styles.brandMark} ${styles.brandMarkLight}`}
            unoptimized
          />
          <Image
            src="/brand/v2/mark-inverse.svg"
            alt=""
            width={40}
            height={40}
            className={`${styles.brandMark} ${styles.brandMarkInverse}`}
            unoptimized
          />
          <span className={styles.brandLettering}>
            <span className={styles.brandName}>ottline</span>
            <span className={styles.brandTagline}>On the Timeline</span>
          </span>
        </IntlLink>
        <nav
          className={`app-top-nav ${styles.topNav}`}
          aria-label={ko ? "주 메뉴" : "Main navigation"}
        >
          {nav.map(({ href, label, icon: Icon }) => (
            <IntlLink
              key={href}
              href={href}
              data-active={matched === href}
              aria-current={matched === href ? "page" : undefined}
            >
              <Icon aria-hidden="true" size={18} />
              {label}
            </IntlLink>
          ))}
        </nav>
        <div className={styles.actions}>
          <fieldset
            className={styles.languages}
            aria-label={t("languageSwitcher")}
          >
            <legend className="sr-only">{t("languageSwitcher")}</legend>
            {localeOptions.map(({ value, shortLabel, labelKey }) => {
              const active = locale === value;
              const languageLabel = t(labelKey);
              return (
                <button
                  key={value}
                  type="button"
                  lang={value}
                  onClick={() => handleLocaleChange(value)}
                  aria-pressed={active}
                  aria-label={
                    active
                      ? t("languageActive", { language: languageLabel })
                      : t("languageSwitchTo", { language: languageLabel })
                  }
                >
                  {shortLabel}
                </button>
              );
            })}
          </fieldset>
          <button
            type="button"
            onClick={toggleTheme}
            className={styles.iconButton}
            title={t("themeClickToChange", { theme: themeLabel })}
            aria-label={t("themeChangeCurrent", { theme: themeLabel })}
          >
            <ThemeIcon aria-hidden="true" size={18} />
          </button>
          <QuickLogAction className={styles.recordButton} />
          <IntlLink
            href="/account"
            className={styles.profileLink}
            aria-label={ko ? "내 프로필" : "My profile"}
          >
            <ProfileAvatar personaKey={profile?.personaKey} size={40} />
          </IntlLink>
        </div>
      </div>
      <SeasonalRecapNotice />
    </header>
  );
}
