"use client";

import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { trackEvent } from "@/lib/analytics";
import type { GuideContentType, GuideSlug } from "@/lib/guides";

type GuideCtaLinkProps = {
  guideSlug: GuideSlug;
  contentType: GuideContentType;
  label: string;
};

export default function GuideCtaLink({
  guideSlug,
  contentType,
  label,
}: GuideCtaLinkProps) {
  const href = `/?quick=1&quick_type=${contentType}&quick_focus=1`;

  return (
    <Link
      href={href}
      onClick={() => {
        void trackEvent("guide_cta_click", { guideSlug, contentType });
      }}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span>{label}</span>
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </Link>
  );
}
