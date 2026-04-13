"use client";

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
  const active =
    href === "/"
      ? pathname === "/" || /^\/[a-z]{2}$/.test(pathname)
      : pathname === href || pathname.endsWith(href);

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
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 dark:bg-card/90 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <IntlLink href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/ottline_logo.png" alt="" className="h-10 w-auto" />
            <span className="leading-none">
              <span className="block text-3xl font-bold tracking-tight" style={{ color: "#1E4D8C" }}>ottline</span>
              <span className="block text-[9px] font-semibold tracking-widest uppercase" style={{ color: "#38BDF8" }}>On the Timeline</span>
            </span>
          </IntlLink>

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

        <nav className="grid w-full grid-cols-4 items-center gap-1 sm:w-auto sm:flex sm:flex-nowrap sm:gap-2">
          <NavLink href="/" label={t("navLogModern")} icon={PencilLine} />
          <NavLink href="/timeline" label={t("navTimelineModern")} icon={Clock} />
          <NavLink href="/public" label={t("navPublicModern")} icon={MessageCircle} />
          <NavLink href="/account" label={t("navAccountModern")} icon={Settings} />
        </nav>
      </div>
    </header>
  );
}
