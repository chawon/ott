"use client";

import { useSearchParams } from "next/navigation";
import FeedbackInbox, { type FeedbackPreset } from "@/components/FeedbackInbox";
import type { FeedbackCategory } from "@/lib/types";

const feedbackCategories: FeedbackCategory[] = [
  "QUESTION",
  "BUG",
  "IDEA",
  "OTHER",
];

function toCategory(value: string | null): FeedbackCategory | undefined {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  return feedbackCategories.includes(normalized as FeedbackCategory)
    ? (normalized as FeedbackCategory)
    : undefined;
}

export default function FeedbackPageClient() {
  const searchParams = useSearchParams();
  const preset: FeedbackPreset = {
    source: searchParams.get("source") ?? undefined,
    category: toCategory(searchParams.get("category")),
    subject: searchParams.get("subject") ?? undefined,
    body: searchParams.get("body") ?? undefined,
  };

  return <FeedbackInbox preset={preset} />;
}
