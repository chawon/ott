"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import CommentsPanel from "@/components/CommentsPanel";
import { DiscussionListItem } from "@/lib/types";
import { getUserId } from "@/lib/localStore";

export default function PublicDiscussionDetailPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const discussionId = Array.isArray(rawId) ? rawId[0] : rawId;

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
        const res = await api<DiscussionListItem>(`/discussions/${discussionId}`);
        setDetail(res);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load discussion");
      } finally {
        setLoading(false);
      }
    })();
  }, [discussionId]);

  if (!discussionId) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="text-base font-semibold">Invalid route</div>
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-neutral-600">불러오는 중…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="text-base font-semibold">Error</div>
        <div className="mt-2 text-sm text-neutral-700">{err}</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="text-base font-semibold">Not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="h-20 w-14 overflow-hidden rounded-md bg-neutral-100">
            {detail.posterUrl ? (
              <img
                src={detail.posterUrl}
                alt={detail.titleName}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="text-xl font-semibold">{detail.titleName}</div>
            <div className="mt-1 text-sm text-neutral-600">
              {detail.titleType === "movie" ? "Movie" : "Series"}
              {detail.titleYear ? ` · ${detail.titleYear}` : ""}
            </div>
            <div className="mt-2 text-sm">
              <Link href={`/title/${detail.titleId}`} className="text-neutral-700 hover:underline">
                나의 기록/상세 보기
              </Link>
            </div>
          </div>
        </div>
      </section>

      <CommentsPanel titleId={detail.titleId} userId={userId} />
    </div>
  );
}
