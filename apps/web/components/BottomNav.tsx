"use client";

import { Clock, Home, MessageCircle, UserRound } from "lucide-react";
import { useLocale } from "next-intl";
import { Fragment, useEffect, useState } from "react";
import { Link as IntlLink, usePathname } from "@/i18n/routing";
import { getMatchedNavHref, type NavHref } from "@/lib/navigation";
import styles from "./AppShell.module.css";
import QuickLogAction from "./QuickLogAction";

export default function BottomNav() {
  const ko = useLocale() === "ko";
  const pathname = usePathname();
  const currentHref = getMatchedNavHref(pathname);
  const [pendingHref, setPendingHref] = useState<NavHref | null>(null);
  const nav = [
    { href: "/", label: ko ? "홈" : "Home", icon: Home },
    { href: "/timeline", label: ko ? "타임라인" : "Timeline", icon: Clock },
    { href: "/public", label: ko ? "함께" : "Together", icon: MessageCircle },
    { href: "/account", label: ko ? "내 공간" : "My space", icon: UserRound },
  ] as const;

  useEffect(() => {
    if (pathname) setPendingHref(null);
  }, [pathname]);
  useEffect(() => {
    if (!pendingHref) return;
    const timeout = window.setTimeout(() => setPendingHref(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [pendingHref]);

  return (
    <nav
      className={`app-bottom-nav ${styles.bottomNav}`}
      aria-label={ko ? "주 메뉴" : "Main navigation"}
    >
      {nav.map(({ href, label, icon: Icon }, index) => (
        <Fragment key={href}>
          {index === 2 && (
            <QuickLogAction className={styles.mobileRecord} iconOnly />
          )}
          <IntlLink
            href={href}
            className={styles.bottomLink}
            data-bottom-nav-href={href}
            data-active={(pendingHref ?? currentHref) === href}
            aria-current={currentHref === href ? "page" : undefined}
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey
              )
                return;
              if (currentHref === href) event.preventDefault();
              else setPendingHref(href);
            }}
          >
            <Icon aria-hidden="true" size={20} />
            <span className="bottom-nav-label">{label}</span>
          </IntlLink>
        </Fragment>
      ))}
    </nav>
  );
}
