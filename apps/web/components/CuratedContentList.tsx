import { Sparkles } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { CuratedContent } from "@/lib/types";
import { tmdbResize } from "@/lib/utils";

export default async function CuratedContentList({
  items,
}: {
  items: CuratedContent[];
}) {
  if (items.length === 0) return null;

  const t = await getTranslations("Public");

  return (
    <section
      aria-labelledby="curated-content-title"
      className="space-y-3 rounded-lg border border-[#1E4D8C]/20 bg-ott-paper-strong p-4 shadow-sm sm:p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Sparkles
            className="mt-0.5 h-5 w-5 shrink-0 text-[#1E4D8C]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2
              id="curated-content-title"
              className="text-base font-semibold text-foreground"
            >
              {t("curatedTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("curatedDescription")}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-[#1E4D8C]/25 bg-card px-2 py-1 text-[10px] font-semibold text-[#1E4D8C] dark:border-border dark:text-foreground">
          {t("curatedDisclosure")}
        </span>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-lg border border-border bg-card p-3 text-card-foreground"
          >
            <Link
              href={`/title/${item.titleId}`}
              className="flex items-start gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]"
            >
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {item.posterUrl ? (
                  <Image
                    src={tmdbResize(item.posterUrl, "w185") ?? item.posterUrl}
                    alt={item.titleName}
                    width={48}
                    height={64}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">
                  {item.titleName}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {item.titleYear ? `${item.titleYear} · ` : ""}
                  {item.actorDisplayName}
                </div>
              </div>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              {item.body}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {item.disclosure}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
