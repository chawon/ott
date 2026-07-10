"use client";

import { Clock, MessageCircle, PencilLine, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ComponentType,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link as IntlLink, usePathname } from "@/i18n/routing";
import { getMatchedNavHref, isNavHref, type NavHref } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onActivate,
}: {
  href: NavHref;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onActivate: (href: NavHref) => void;
}) {
  return (
    <IntlLink
      href={href}
      onClick={() => onActivate(href)}
      onMouseDown={() => onActivate(href)}
      onPointerDown={() => onActivate(href)}
      onTouchStart={() => onActivate(href)}
      data-bottom-nav-href={href}
      className={cn(
        "group relative flex min-h-14 flex-1 touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-medium transition-colors [-webkit-tap-highlight-color:transparent] active:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/40",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:bg-ott-paper-strong/70 hover:text-foreground/80 active:text-[#4A4A4A]",
      )}
      aria-current={active ? "page" : undefined}
      data-active={active ? "true" : "false"}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1 h-0.5 w-5 rounded-full bg-[#FF9933] transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "flex h-8 w-12 items-center justify-center rounded-full transition-all",
          active
            ? "bg-ott-paper-strong text-[#1E4D8C] shadow-sm ring-1 ring-border dark:text-foreground"
            : "bg-transparent group-hover:bg-card/80",
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 transition-transform",
            active ? "scale-110" : "scale-100",
          )}
        />
      </div>
      <span
        className={cn(
          "bottom-nav-label max-w-full truncate rounded-full px-1.5 leading-5",
          active ? "font-semibold" : "text-[#4A4A4A] dark:text-[#D8CFC4]",
        )}
        data-active={active ? "true" : "false"}
      >
        {label}
      </span>
    </IntlLink>
  );
}

export default function BottomNav() {
  const t = useTranslations("AppHeader");
  const pathname = usePathname();
  const navRef = useRef<HTMLElement | null>(null);
  const [pendingHref, setPendingHref] = useState<NavHref | null>(null);
  const currentHref = getMatchedNavHref(pathname) ?? "/";
  const activeHref = pendingHref ?? currentHref;

  const activateFromTarget = useCallback((target: EventTarget | null) => {
    const href = getNavHrefFromTarget(target);
    if (href) {
      setPendingHref(href);
    }
  }, []);

  useEffect(() => {
    if (currentHref) {
      setPendingHref(null);
    }
  }, [currentHref]);

  useEffect(() => {
    if (!pendingHref) return;

    const timeout = window.setTimeout(() => {
      setPendingHref(null);
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [pendingHref]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const handlePressStart = (event: Event) => {
      activateFromTarget(event.target);
    };

    nav.addEventListener("pointerdown", handlePressStart);
    nav.addEventListener("touchstart", handlePressStart);
    nav.addEventListener("mousedown", handlePressStart);

    return () => {
      nav.removeEventListener("pointerdown", handlePressStart);
      nav.removeEventListener("touchstart", handlePressStart);
      nav.removeEventListener("mousedown", handlePressStart);
    };
  }, [activateFromTarget]);

  const handleActivate = (href: NavHref) => {
    setPendingHref(href);
  };

  const handleNavCapture = (event: SyntheticEvent<HTMLElement>) => {
    activateFromTarget(event.target);
  };

  return (
    <nav
      ref={navRef}
      className="app-bottom-nav fixed left-3 right-3 bottom-[calc(var(--mobile-safe-area-bottom)+0.75rem)] z-50 flex min-h-16 rounded-[28px] border border-border bg-card/95 p-1.5 shadow-[0_18px_50px_rgba(15,15,15,0.12)] backdrop-blur-xl transition-colors duration-200 dark:bg-card/90 sm:hidden"
      onPointerDownCapture={handleNavCapture}
      onTouchStartCapture={handleNavCapture}
    >
      <NavLink
        href="/"
        label={t("navLogModern")}
        icon={PencilLine}
        active={activeHref === "/"}
        onActivate={handleActivate}
      />
      <NavLink
        href="/timeline"
        label={t("navTimelineModern")}
        icon={Clock}
        active={activeHref === "/timeline"}
        onActivate={handleActivate}
      />
      <NavLink
        href="/public"
        label={t("navPublicModern")}
        icon={MessageCircle}
        active={activeHref === "/public"}
        onActivate={handleActivate}
      />
      <NavLink
        href="/account"
        label={t("navAccountModern")}
        icon={Settings}
        active={activeHref === "/account"}
        onActivate={handleActivate}
      />
    </nav>
  );
}

function getNavHrefFromTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return null;

  const link = target.closest<HTMLElement>("[data-bottom-nav-href]");
  const href = link?.dataset.bottomNavHref;
  return isNavHref(href) ? href : null;
}
