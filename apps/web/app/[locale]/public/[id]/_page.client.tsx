"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { api } from "@/lib/api";
import CommentsPanel from "@/components/CommentsPanel";
import { DiscussionListItem } from "@/lib/types";
import { getUserId } from "@/lib/localStore";

export default function PublicDiscussionDetailPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const discussionId = Array.isArray(rawId) ? rawId[0] : rawId;
  const tQuick = useTranslations("QuickLogCard");
  const tDetail = useTranslations("DiscussionDetail");

  const [detail, setDetail] = useState<DiscussionListItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  useEffect(() => {
    if (!discussionId) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await api<DiscussionListItem>(
          `/discussions/${discussionId}`,
        );
        setDetail(res);
      } catch (e: any) {
        setErr(
          e?.message ??
            tDetail("loadError"),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [discussionId, tDetail]);

  if (!discussionId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-base font-semibold">
          {tDetail("invalidPath")}
        </div>
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-sm text-neutral-600">{tDetail("loading")}</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-base font-semibold text-red-600">
          {tDetail("errorTitle")}
        </div>
        <div className="mt-2 text-sm text-neutral-700">{err}</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-base font-semibold">{tDetail("notFound")}</div>
      </div>
    );
  }

  const typeLabel =
    detail.titleType === "movie"
      ? tQuick("typeMovie")
      : detail.titleType === "series"
        ? tQuick("typeSeriesModern")
        : tQuick("typeBook");

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-6">
          <div className="shrink-0 overflow-hidden bg-neutral-100 h-24 w-16 rounded-xl">
            {detail.posterUrl ? (
              <img
                src={detail.posterUrl}
                alt={detail.titleName}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-semibold">
              {detail.titleName}
            </div>
            <div className="mt-1 text-sm font-medium text-muted-foreground">
              {typeLabel}
              {detail.titleYear ? ` · ${detail.titleYear}` : ""}
            </div>
            <div className="mt-4 text-sm">
              <Link
                href={`/title/${detail.titleId}`}
                className="inline-block transition-colors text-neutral-700 hover:text-black hover:underline"
              >
                {tDetail("viewTitleDetail")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <CommentsPanel
        titleId={detail.titleId}
        userId={userId}
        titleType={detail.titleType}
      />
    </div>
  );
}
