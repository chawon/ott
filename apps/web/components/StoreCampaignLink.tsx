"use client";

import { type ReactNode, useEffect, useRef } from "react";
import {
  getNativeStorePlatform,
  isAppleStore,
  type StorePlatform,
} from "@/lib/store-acquisition.mjs";
import {
  browserStoreSurface,
  dismissStoreOffer,
  trackStoreCta,
} from "@/lib/storeAcquisition";

/** Server-rendered href, with attribution only when the card is actually seen. */
export default function StoreCampaignLink({
  platform,
  href,
  className,
  children,
}: {
  platform: StorePlatform;
  href: string;
  className: string;
  children: ReactNode;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const impressed = useRef(false);

  useEffect(() => {
    const link = linkRef.current;
    if (!link) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || impressed.current) {
        return;
      }
      impressed.current = true;
      void trackStoreCta(platform, "impression", {
        placement: "about_platform_card",
        surface: "platform_card",
        campaign: "about_platform_card",
      });
      observer.disconnect();
    });
    observer.observe(link);
    return () => observer.disconnect();
  }, [platform]);

  return (
    <a
      ref={linkRef}
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      data-store-platform={platform}
      data-testid={`about-${platform}-link`}
      onClick={() => {
        const properties = {
          placement: "about_platform_card",
          surface: "platform_card",
          campaign: "about_platform_card",
        };
        if (!impressed.current) {
          impressed.current = true;
          void trackStoreCta(platform, "impression", properties);
        }
        void trackStoreCta(platform, "click", properties);
        if (
          isAppleStore(platform) &&
          getNativeStorePlatform(browserStoreSurface()) === platform
        ) {
          dismissStoreOffer(platform);
        }
      }}
    >
      {children}
    </a>
  );
}
