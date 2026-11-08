import { BookOpen, Frown, Meh, Smile } from "lucide-react";
import type { Title } from "@/lib/types";

/** Use the same normalized feeling icon when choosing and revisiting a record. */
export default function FeelingIcon({
  value,
  type,
  size = 16,
}: {
  value: number;
  type?: Title["type"];
  size?: number;
}) {
  const Icon =
    value === 5
      ? type === "book"
        ? BookOpen
        : Smile
      : value === 3
        ? Meh
        : Frown;
  return <Icon aria-hidden="true" size={size} />;
}
