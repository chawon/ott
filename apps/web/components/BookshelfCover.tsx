import { BookOpen } from "lucide-react";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function BookshelfCover({
  title,
  className,
  decorative = false,
}: {
  title: Title;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-[#ECEBE9] shadow-sm",
        className,
      )}
    >
      {title.posterUrl ? (
        <img
          src={title.posterUrl}
          alt={decorative ? "" : title.name}
          className="h-full w-full object-cover motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
          loading="lazy"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-[#FEF9EE] text-[#4A4A4A] dark:bg-[#2B241F] dark:text-[#D8CFC4]"
          aria-hidden="true"
        >
          <BookOpen className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
