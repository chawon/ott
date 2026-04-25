"use client";

import { Clock, MessageCircle, PencilLine, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Link as IntlLink, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useMobileBottomNav } from "./useMobileBottomNav";

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: ComponentProps<typeof IntlLink>["href"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
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
        "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground/80",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
          active ? "bg-foreground/10" : "bg-transparent",
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 transition-transform",
            active ? "scale-110" : "scale-100",
          )}
        />
      </div>
      <span className="truncate">{label}</span>
    </IntlLink>
  );
}

export default function BottomNav() {
  const t = useTranslations("AppHeader");
  const enabled = useMobileBottomNav();

  if (!enabled) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex min-h-[var(--mobile-bottom-nav-height)] border-t border-border bg-card/90 pb-[var(--mobile-safe-area-bottom)] backdrop-blur-md transition-colors duration-200 sm:hidden">
      <NavLink href="/" label={t("navLogModern")} icon={PencilLine} />
      <NavLink href="/timeline" label={t("navTimelineModern")} icon={Clock} />
      <NavLink
        href="/public"
        label={t("navPublicModern")}
        icon={MessageCircle}
      />
      <NavLink href="/account" label={t("navAccountModern")} icon={Settings} />
    </nav>
  );
}
