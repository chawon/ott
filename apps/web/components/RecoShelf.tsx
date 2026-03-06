import Link from "next/link";
import { Title } from "@/lib/types";
import { useTranslations } from "next-intl";

export default function RecoShelf({
  title,
  items,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  items: Title[];
}) {
  const tQuick = useTranslations("QuickLogCard");
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <div className="text-base font-semibold">{title}</div>
        {subtitle && <div className="text-sm text-neutral-600">{subtitle}</div>}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((t) => {
          const typeLabel =
            t.type === "movie"
              ? tQuick("typeMovie")
              : t.type === "series"
                ? tQuick("typeSeriesModern")
                : tQuick("typeBook");
          return (
            <Link
              key={t.id}
              href={`/title/${t.id}`}
              className="rounded-xl border border-border bg-card px-4 py-3 text-sm hover:bg-neutral-50"
            >
              <div className="font-medium">{t.name}</div>
              <div className="mt-1 text-neutral-600">
                {typeLabel}
                {t.year ? ` · ${t.year}` : ""}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
