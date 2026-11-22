"use client";

import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import CommentsPanel from "@/components/CommentsPanel";
import DiscussionReactionChips from "@/components/DiscussionReactionChips";
import { Link } from "@/i18n/routing";
import { ApiError, api } from "@/lib/api";
import { getUserId } from "@/lib/localStore";
import type {
  DiscussionListItem,
  DiscussionReactionSummary,
} from "@/lib/types";

type DetailState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; detail: DiscussionListItem };

export default function PublicDiscussionDetail({
  discussionId,
}: {
  discussionId?: string;
}) {
  const locale = useLocale();
  const tQuick = useTranslations("QuickLogCard");
  const t = useTranslations("DiscussionDetail");
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestFocusRef = useRef<Element | null>(null);

  useEffect(() => setUserId(getUserId()), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt deliberately retries the same discussion request.
  useEffect(() => {
    if (!discussionId) return;
    let active = true;
    const controller = new AbortController();
    requestFocusRef.current = document.activeElement;
    setState({ status: "loading" });

    void api<DiscussionListItem | null>(
      `/discussions/${encodeURIComponent(discussionId)}`,
      { signal: controller.signal, headers: { "Accept-Language": locale } },
    )
      .then((detail) => {
        if (active) {
          setState(
            detail ? { status: "ready", detail } : { status: "missing" },
          );
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status:
            error instanceof ApiError && error.status === 404
              ? "missing"
              : "error",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [discussionId, locale, attempt]);

  useEffect(() => {
    if (
      state.status !== "loading" &&
      (document.activeElement === document.body ||
        document.activeElement === requestFocusRef.current)
    ) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [state.status]);

  const updateReactionSummary = useCallback(
    (summary: DiscussionReactionSummary) => {
      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              detail: { ...current.detail, reactionSummary: summary },
            }
          : current,
      );
    },
    [],
  );

  const backLink = (
    <Link
      href="/public"
      scroll={false}
      className="inline-flex min-h-12 items-center gap-2 text-sm font-medium text-brand-navy dark:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      {t("backToList")}
    </Link>
  );

  if (!discussionId) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        {t("invalidPath")}
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div
        className="rounded-lg border border-border bg-card p-6"
        aria-busy="true"
        data-testid="discussion-loading"
      >
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
        <progress aria-label={t("loading")} className="mt-4 max-w-full" />
      </div>
    );
  }

  if (state.status === "missing" || state.status === "error") {
    return (
      <div
        className="rounded-lg border border-border bg-card p-6"
        data-testid={`discussion-${state.status}`}
      >
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold">
          {t(state.status === "missing" ? "notFound" : "errorTitle")}
        </h2>
        {state.status === "error" ? (
          <>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("loadError")}
            </p>
            <button
              type="button"
              onClick={() => setAttempt((previous) => previous + 1)}
              className="mt-4 min-h-12 rounded-lg border border-border bg-background px-4 text-sm font-medium"
            >
              {t("retry")}
            </button>
          </>
        ) : null}
        <div className="mt-3">{backLink}</div>
      </div>
    );
  }

  const detail = state.detail;
  const typeLabel =
    detail.titleType === "movie"
      ? tQuick("typeMovie")
      : detail.titleType === "series"
        ? tQuick("typeSeriesModern")
        : tQuick("typeBook");

  return (
    <div
      className="space-y-4"
      data-testid="discussion-detail"
      data-discussion-id={detail.id}
    >
      {backLink}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-5">
          <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
            {detail.posterUrl ? (
              <img
                src={detail.posterUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-semibold break-words"
            >
              {detail.titleName}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {typeLabel}
              {detail.titleYear ? ` · ${detail.titleYear}` : ""}
            </p>
            <Link
              href={`/title/${detail.titleId}`}
              className="mt-3 inline-flex min-h-12 items-center text-sm text-brand-navy underline-offset-4 hover:underline dark:text-foreground"
            >
              {t("viewTitleDetail")}
            </Link>
            <div className="mt-4">
              <DiscussionReactionChips
                discussionId={detail.id}
                title={{
                  id: detail.titleId,
                  name: detail.titleName,
                  type: detail.titleType,
                  year: detail.titleYear,
                  posterUrl: detail.posterUrl,
                }}
                summary={detail.reactionSummary}
                onSummaryChange={updateReactionSummary}
              />
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
