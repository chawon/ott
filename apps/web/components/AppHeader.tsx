"use client";

import {
  Clock,
  MessageCircle,
  Monitor,
  Moon,
  PencilLine,
  Settings,
  Sun,
} from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { startTransition } from "react";
import { useTheme } from "@/context/ThemeContext";
import { Link as IntlLink, usePathname, useRouter } from "@/i18n/routing";
import { getMatchedNavHref, type NavHref } from "@/lib/navigation";
import { isProfileComplete } from "@/lib/profile";
import { useUserProfile } from "@/lib/useUserProfile";
import { cn } from "@/lib/utils";
import ProfileAvatar from "./ProfileAvatar";
import SeasonalRecapNotice from "./SeasonalRecapNotice";

const localeOptions = [
  { value: "ko", shortLabel: "KO", labelKey: "languageKorean" },
  { value: "en", shortLabel: "EN", labelKey: "languageEnglish" },
] as const;

function buildQuery(searchParams: ReturnType<typeof useSearchParams>) {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of searchParams.entries()) {
    const existingValue = query[key];

    if (existingValue === undefined) {
      query[key] = value;
      continue;
    }

    query[key] = Array.isArray(existingValue)
      ? [...existingValue, value]
      : [existingValue, value];
  }

  return query;
}

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: NavHref;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const active = getMatchedNavHref(pathname) === href;

  return (
    <IntlLink
      href={href}
      className={cn(
        "relative w-full rounded-xl px-1.5 py-2 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/40 sm:w-auto sm:px-3 sm:text-sm",
        active
          ? "bg-ott-paper-strong text-foreground shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:bg-ott-paper-strong hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
      data-active={active ? "true" : "false"}
    >
      <span className="flex items-center justify-center gap-1.5 whitespace-nowrap sm:justify-start sm:gap-2">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {label}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-[#FF9933] transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
    </IntlLink>
  );
}

export default function AppHeader() {
  const { mode, toggleTheme } = useTheme();
  const t = useTranslations("AppHeader");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useUserProfile();
  const hasProfile = isProfileComplete(profile);

  const ThemeIcon = mode === "system" ? Monitor : mode === "dark" ? Moon : Sun;
  const themeLabel =
    mode === "system"
      ? t("themeSystem")
      : mode === "dark"
        ? t("themeDark")
        : t("themeLight");
  const query = buildQuery(searchParams);

  const handleLocaleChange = (
    nextLocale: (typeof localeOptions)[number]["value"],
  ) => {
    if (nextLocale === locale) {
      return;
    }

    startTransition(() => {
      if (Object.keys(query).length === 0) {
        router.replace(pathname, { locale: nextLocale });
        return;
      }

      router.replace({ pathname, query }, { locale: nextLocale });
    });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/85 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
          <IntlLink
            href="/"
            className="flex items-center gap-2 rounded-2xl transition-opacity hover:opacity-85"
          >
            <Image
              src="/ottline_logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10"
            />
            <span className="leading-none">
              <span
                className="block text-3xl font-bold tracking-tight"
                style={{ color: "#1E4D8C" }}
              >
                ottline
              </span>
              <span
                className="block text-[9px] font-semibold tracking-widest uppercase"
                style={{ color: "#FF9933" }}
              >
                On the Timeline
              </span>
            </span>
          </IntlLink>

          <div className="flex items-center gap-2">
            <fieldset
              className="flex items-center rounded-full border border-border bg-ott-paper/90 p-0.5"
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
                    className={cn(
                      "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[9px] font-semibold uppercase tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-6 sm:min-w-6",
                      active
                        ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:bg-ott-paper-strong hover:text-foreground",
                    )}
                    aria-pressed={active}
                    aria-label={
                      active
                        ? t("languageActive", { language: languageLabel })
                        : t("languageSwitchTo", { language: languageLabel })
                    }
                    title={
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
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-foreground/70 transition hover:bg-ott-paper-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9 sm:min-w-9"
              title={t("themeClickToChange", { theme: themeLabel })}
              aria-label={t("themeChangeCurrent", { theme: themeLabel })}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
            {hasProfile ? (
              <IntlLink
                href="/account"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl p-1 text-foreground/70 transition hover:bg-ott-paper-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
                title={t("profileLink")}
                aria-label={t("profileLink")}
              >
                <ProfileAvatar
                  personaKey={profile?.personaKey}
                  size={28}
                  alt=""
                />
              </IntlLink>
            ) : null}
          </div>
        </div>

        <nav className="app-top-nav hidden w-full items-center gap-1 sm:flex sm:w-auto sm:flex-nowrap sm:gap-2">
          <NavLink href="/" label={t("navLogModern")} icon={PencilLine} />
          <NavLink
            href="/timeline"
            label={t("navTimelineModern")}
            icon={Clock}
          />
          <NavLink
            href="/public"
            label={t("navPublicModern")}
            icon={MessageCircle}
          />
          <NavLink
            href="/account"
            label={t("navAccountModern")}
            icon={Settings}
          />
        </nav>
      </div>
      <SeasonalRecapNotice />
    </header>
  );
}
