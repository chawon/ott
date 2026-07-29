import { redirect } from "next/navigation";
import { isKdcBookshelfLocale, type KdcMajor } from "@/lib/bookshelf";
import BookshelfPageClient from "./BookshelfPageClient";

export default async function BookshelfPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kdc?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isKdcBookshelfLocale(locale)) {
    redirect(`/${locale}/timeline`);
  }

  const query = await searchParams;
  const raw = Array.isArray(query.kdc) ? query.kdc[0] : query.kdc;
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  const initialKdc =
    Number.isInteger(parsed) && parsed >= 0 && parsed <= 9
      ? (parsed as KdcMajor)
      : null;

  return <BookshelfPageClient initialKdc={initialKdc} />;
}
