"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  MessageCircle,
  Monitor,
  Moon,
  PencilLine,
  Settings,
  Sun,
} from "lucide-react";
import { useRetro } from "@/context/RetroContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Link as IntlLink } from "@/i18n/routing";

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  // Simple check to see if current path starts with the href, adjusting for locale prefix if needed
  // Note: For more robust matching with next-intl, you might use 'usePathname' from next-intl/navigation
  const active =
    pathname.endsWith(href) ||
    (href === "/" && pathname.split("/").length <= 2);
  const { isRetro } = useRetro();

  if (isRetro) {
    return (
      <IntlLink
        href={href as any}
        className={cn(
          "w-full px-2 py-2 text-sm font-bold border-2 border-transparent hover:border-black transition-none sm:w-auto sm:px-4",
          active
            ? "bg-black text-white border-black"
            : "text-black hover:bg-neutral-200",
        )}
      >
        <span className="flex items-center justify-center gap-2 sm:justify-start">
          {Icon ? <Icon className="h-4 w-4" /> : null}
          {label}
        </span>
      </IntlLink>
    );
  }

  return (
    <IntlLink
      href={href as any}
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
  const { isRetro, toggleRetro } = useRetro();
  const { mode, toggleTheme } = useTheme();
  const t = useTranslations("AppHeader");

  const ThemeIcon = mode === "system" ? Monitor : mode === "dark" ? Moon : Sun;
  const themeLabel =
    mode === "system"
      ? t("themeSystem")
      : mode === "dark"
        ? t("themeDark")
        : t("themeLight");

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-200",
        isRetro
          ? "border-b-4 border-black bg-white"
          : "border-b border-border bg-card/80 dark:bg-card/90 backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleRetro}
            className={cn(
              "focus:outline-none transition-transform active:scale-95",
              isRetro
                ? "border-2 border-black p-1 bg-neutral-100 hover:bg-red-500"
                : "hover:opacity-80",
            )}
            title={isRetro ? t("backToModern") : t("viewInRetro")}
          >
            <img
              src="/icon.png"
              alt="OTT"
              className={cn("h-8 w-8", isRetro && "pixelated")}
              style={isRetro ? { imageRendering: "pixelated" } : {}}
            />
          </button>

          <IntlLink
            href="/"
            className={cn(
              "font-bold tracking-tight transition-colors",
              isRetro
                ? "text-black text-xl uppercase"
                : "text-foreground text-lg",
            )}
          >
            {isRetro ? t("titleRetro") : "On the Timeline"}
          </IntlLink>

          {!isRetro ? (
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-md p-2 text-foreground/70 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={t("themeClickToChange", { theme: themeLabel })}
              aria-label={t("themeChangeCurrent", { theme: themeLabel })}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <nav className="grid w-full grid-cols-4 items-center gap-1 sm:w-auto sm:flex sm:flex-nowrap sm:gap-2">
          <NavLink
            href="/"
            label={isRetro ? t("navLogRetro") : t("navLogModern")}
            icon={PencilLine}
          />
          <NavLink
            href="/timeline"
            label={isRetro ? t("navTimelineRetro") : t("navTimelineModern")}
            icon={Clock}
          />
          <NavLink
            href="/public"
            label={isRetro ? t("navPublicRetro") : t("navPublicModern")}
            icon={MessageCircle}
          />
          <NavLink
            href="/account"
            label={isRetro ? t("navAccountRetro") : t("navAccountModern")}
            icon={Settings}
          />
        </nav>
      </div>
    </header>
  );
}
