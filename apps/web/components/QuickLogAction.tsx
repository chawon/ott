"use client";

import { Plus } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";

/** Every shell entry reaches the same real record flow, even on the current home URL. */
export default function QuickLogAction({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const label = locale === "ko" ? "기록 남기기" : "Leave a record";
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onClick={() => {
        if (pathname === "/") {
          window.dispatchEvent(new CustomEvent("ottline:quick-log"));
        } else {
          router.push("/?quick=1");
        }
      }}
    >
      <Plus aria-hidden="true" size={20} />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
