"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type MainTab = "/" | "/timeline" | "/public" | "/account";

const ORDER: MainTab[] = ["/", "/timeline", "/public", "/account"];
const EDGE_GUARD_PX = 24;
const MIN_SWIPE_X = 72;
const MAX_SWIPE_Y = 48;
const MAX_DURATION_MS = 700;

function currentTab(pathname: string): MainTab | null {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/timeline")) return "/timeline";
  if (pathname.startsWith("/public")) return "/public";
  if (pathname.startsWith("/account")) return "/account";
  return null;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, button, [contenteditable="true"], [data-no-swipe-nav]',
    ),
  );
}

export default function SwipeNav() {
  const router = useRouter();
  const pathname = usePathname();

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const ignoreRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        ignoreRef.current = true;
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      if (
        touch.clientX <= EDGE_GUARD_PX ||
        touch.clientX >= window.innerWidth - EDGE_GUARD_PX
      ) {
        ignoreRef.current = true;
        return;
      }
      if (isInteractiveTarget(e.target)) {
        ignoreRef.current = true;
        return;
      }
      ignoreRef.current = false;
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      startTimeRef.current = Date.now();
    };

    const onTouchEnd = (e: TouchEvent) => {
      const startX = startXRef.current;
      const startY = startYRef.current;
      const startTime = startTimeRef.current;
      startXRef.current = null;
      startYRef.current = null;
      startTimeRef.current = null;

      if (ignoreRef.current || startX == null || startY == null || startTime == null)
        return;

      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dt = Date.now() - startTime;

      if (dt > MAX_DURATION_MS) return;
      if (Math.abs(dx) < MIN_SWIPE_X) return;
      if (Math.abs(dy) > MAX_SWIPE_Y) return;

      const tab = currentTab(pathname);
      if (!tab) return;
      const idx = ORDER.indexOf(tab);
      if (idx < 0) return;

      // Swipe left -> next tab, swipe right -> previous tab.
      const nextIdx = dx < 0 ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= ORDER.length) return;

      const target = ORDER[nextIdx];
      if (target === tab) return;
      router.push(target);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pathname, router]);

  return null;
}
