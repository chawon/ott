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
import { type ComponentProps, startTransition } from "react";
import { useTheme } from "@/context/ThemeContext";
import { Link as IntlLink, usePathname, useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";

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
  href: ComponentProps<typeof IntlLink>["href"];
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const active =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <IntlLink
      href={href}
      className={cn(
        "w-full rounded-lg px-2 py-2 text-xs transition sm:w-auto sm:px-3 sm:text-sm",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      <span className="flex items-center justify-center gap-2 sm:justify-start">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {label}
      </span>
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
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 dark:bg-card/90 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
          <IntlLink
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
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
                style={{ color: "#38BDF8" }}
              >
                On the Timeline
              </span>
            </span>
          </IntlLink>

          <div className="flex items-center gap-2">
            <fieldset
              className="flex items-center rounded-full border border-border bg-background/80 p-1"
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
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
              className="rounded-md p-2 text-foreground/70 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={t("themeClickToChange", { theme: themeLabel })}
              aria-label={t("themeChangeCurrent", { theme: themeLabel })}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="grid w-full grid-cols-4 items-center gap-1 sm:w-auto sm:flex sm:flex-nowrap sm:gap-2">
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
    </header>
  );
}
