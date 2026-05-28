import FeedbackInbox, { type FeedbackPreset } from "@/components/FeedbackInbox";
import type { FeedbackCategory } from "@/lib/types";

type FeedbackPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const feedbackCategories: FeedbackCategory[] = [
  "QUESTION",
  "BUG",
  "IDEA",
  "OTHER",
];

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toCategory(value: string | undefined): FeedbackCategory | undefined {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  return feedbackCategories.includes(normalized as FeedbackCategory)
    ? (normalized as FeedbackCategory)
    : undefined;
}

export default async function FeedbackPage({
  searchParams,
}: FeedbackPageProps) {
  const params = (await searchParams) ?? {};
  const preset: FeedbackPreset = {
    source: single(params.source),
    from: single(params.from),
    category: toCategory(single(params.category)),
    subject: single(params.subject),
    body: single(params.body),
  };

  return <FeedbackInbox preset={preset} />;
}
