"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/routing";
import { trackAppOpenOnce } from "@/lib/analytics";
import { syncOutbox } from "@/lib/sync";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export default function SyncWorker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key.startsWith("ott-pwa-")) {
              void caches.delete(key);
            }
          });
        });
      }
      return;
    }
  }, []);

  useEffect(() => {
    if (!pathname) return;
    void syncOutbox();
  }, [pathname]);

  useEffect(() => {
    function handleOnline() {
      void syncOutbox();
    }

    function handleVisible() {
      if (document.visibilityState === "visible") void syncOutbox();
    }

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, []);

  useEffect(() => {
    if (!pathname || isAdminPath(pathname)) return;

    function handleOnline() {
      void trackAppOpenOnce();
    }

    function handleVisible() {
      if (document.visibilityState === "visible") void trackAppOpenOnce();
    }

    void trackAppOpenOnce();
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [pathname]);

  return null;
}
