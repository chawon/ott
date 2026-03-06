"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { api } from "@/lib/api";
import CommentsPanel from "@/components/CommentsPanel";
import { DiscussionListItem } from "@/lib/types";
import { getUserId } from "@/lib/localStore";
import { useRetro } from "@/context/RetroContext";
import { cn } from "@/lib/utils";

export default function PublicDiscussionDetailPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const discussionId = Array.isArray(rawId) ? rawId[0] : rawId;
  const { isRetro } = useRetro();
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
      <div
        className={cn(
          isRetro
            ? "nes-container border-4 border-black p-6 font-bold"
            : "rounded-2xl border border-border bg-card p-6 shadow-sm",
        )}
      >
        <div className="text-base font-semibold">
          {tDetail("invalidPath")}
        </div>
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <div
        className={cn(
          isRetro
            ? "nes-container border-4 border-black p-6 font-bold"
            : "rounded-2xl border border-border bg-card p-6 shadow-sm",
        )}
      >
        <div className="text-sm text-neutral-600">{tDetail("loading")}</div>
      </div>
    );
  }

  if (err) {
    return (
      <div
        className={cn(
          isRetro
            ? "nes-container border-4 border-black p-6 font-bold"
            : "rounded-2xl border border-border bg-card p-6 shadow-sm",
        )}
      >
        <div className="text-base font-semibold text-red-600">
          {tDetail("errorTitle")}
        </div>
        <div className="mt-2 text-sm text-neutral-700">{err}</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div
        className={cn(
          isRetro
            ? "nes-container border-4 border-black p-6 font-bold"
            : "rounded-2xl border border-border bg-card p-6 shadow-sm",
        )}
      >
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
      <section
        className={cn(
          isRetro
            ? "nes-container border-4 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            : "rounded-2xl border border-border bg-card p-6 shadow-sm",
        )}
      >
        <div className="flex items-start gap-6">
          <div
            className={cn(
              "shrink-0 overflow-hidden bg-neutral-100",
              isRetro
                ? "h-32 w-24 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                : "h-24 w-16 rounded-xl",
            )}
          >
            {detail.posterUrl ? (
              <img
                src={detail.posterUrl}
                alt={detail.titleName}
                className={cn(
                  "h-full w-full object-cover",
                  isRetro && "pixelated",
                )}
                style={isRetro ? { imageRendering: "pixelated" } : {}}
                loading="lazy"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={cn("text-xl font-semibold", isRetro && "uppercase")}
            >
              {detail.titleName}
            </div>
            <div
              className={cn(
                "mt-1 text-sm font-medium",
                isRetro ? "text-black uppercase" : "text-muted-foreground",
              )}
            >
              {typeLabel}
              {detail.titleYear ? ` · ${detail.titleYear}` : ""}
            </div>
            <div className="mt-4 text-sm">
              <Link
                href={`/title/${detail.titleId}`}
                className={cn(
                  "inline-block transition-colors",
                  isRetro
                    ? "bg-blue-600 text-white px-2 py-1 font-bold uppercase hover:bg-blue-700"
                    : "text-neutral-700 hover:text-black hover:underline",
                )}
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
