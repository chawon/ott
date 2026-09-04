"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { CuratedContentAdmin, CuratedTitleOption } from "@/lib/types";

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/admin/api/curated-contents${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function statusClass(status: CuratedContentAdmin["status"]) {
  if (status === "PUBLISHED") return "bg-emerald-50 text-emerald-700";
  if (status === "DISABLED") return "bg-muted text-muted-foreground";
  return "bg-amber-50 text-amber-800";
}

export default function AdminCuratedContentConsole() {
  const t = useTranslations("AdminCuratedContent");
  const [items, setItems] = useState<CuratedContentAdmin[]>([]);
  const [titleQuery, setTitleQuery] = useState("");
  const [titleOptions, setTitleOptions] = useState<CuratedTitleOption[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<CuratedTitleOption | null>(
    null,
  );
  const [locale, setLocale] = useState("ko");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await adminFetch<CuratedContentAdmin[]>("?limit=100"));
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    const query = titleQuery.trim();
    if (query.length < 2 || selectedTitle?.name === query) {
      setTitleOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void adminFetch<CuratedTitleOption[]>(
        `/titles?q=${encodeURIComponent(query)}`,
      )
        .then(setTitleOptions)
        .catch((error: unknown) =>
          setStatus(error instanceof Error ? error.message : t("searchError")),
        );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [titleQuery, selectedTitle, t]);

  async function createDraft() {
    if (!selectedTitle || submitting) return;
    setSubmitting(true);
    try {
      await adminFetch<CuratedContentAdmin>("/drafts", {
        method: "POST",
        body: JSON.stringify({
          titleId: selectedTitle.id,
          locale,
          body: body.trim() || null,
        }),
      });
      setBody("");
      setSelectedTitle(null);
      setTitleQuery("");
      await loadItems();
      setStatus(t("createSuccess"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("createError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function transition(id: string, action: "publish" | "disable") {
    if (submitting) return;
    setSubmitting(true);
    try {
      await adminFetch<CuratedContentAdmin>(`/${id}/${action}`, {
        method: "POST",
        body: "{}",
      });
      await loadItems();
      setStatus(t(action === "publish" ? "publishSuccess" : "disableSuccess"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("actionError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand-navy" />
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        {status ? (
          <p className="text-xs font-medium text-brand-navy">{status}</p>
        ) : null}
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-[#FEF9EE] p-5">
        <div>
          <h2 className="text-base font-semibold">{t("newDraft")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("newDraftDescription")}
          </p>
        </div>
        <div className="relative">
          <label className="text-sm font-medium" htmlFor="curated-title-search">
            {t("titleSearch")}
          </label>
          <input
            id="curated-title-search"
            value={titleQuery}
            onChange={(event) => {
              setTitleQuery(event.target.value);
              setSelectedTitle(null);
            }}
            placeholder={t("titleSearchPlaceholder")}
            className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-4 text-sm outline-none focus:border-[#FF9933] focus:ring-2 focus:ring-[#FF9933]/30"
          />
          {titleOptions.length > 0 ? (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-white p-1 shadow-lg">
              {titleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="block min-h-12 w-full rounded-md px-3 text-left text-sm hover:bg-[#FEF9EE]"
                  onClick={() => {
                    setSelectedTitle(option);
                    setTitleQuery(option.name);
                    setTitleOptions([]);
                  }}
                >
                  <span className="font-semibold">{option.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {option.type}
                    {option.year ? ` · ${option.year}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <label className="text-sm font-medium">
            {t("locale")}
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-sm"
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            {t("bodyOverride")}
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("bodyOverridePlaceholder")}
              maxLength={2000}
              className="mt-2 min-h-24 w-full rounded-lg border border-border bg-white px-4 py-3 text-sm outline-none focus:border-[#FF9933] focus:ring-2 focus:ring-[#FF9933]/30"
            />
          </label>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {selectedTitle
              ? t("selectedTitle", { title: selectedTitle.name })
              : t("selectTitle")}
          </p>
          <button
            type="button"
            onClick={createDraft}
            disabled={!selectedTitle || submitting}
            className="min-h-12 rounded-lg bg-[#FF9933] px-5 text-sm font-semibold text-[#0F0F0F] disabled:bg-[#ECEBE9] disabled:text-[#4A4A4A]"
          >
            {submitting ? t("saving") : t("createDraft")}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("contentList")}</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-border bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{item.titleName}</h3>
                      <span className="rounded-md bg-[#FAF5D7] px-2 py-1 text-xs text-[#4A4A4A]">
                        {item.locale}
                      </span>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}
                      >
                        {t(`status.${item.status}`)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {item.body}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.actorDisplayName} · {item.disclosure} ·{" "}
                      {item.promptVersion ?? item.kind}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {item.status === "DRAFT" ? (
                      <button
                        type="button"
                        onClick={() => void transition(item.id, "publish")}
                        disabled={submitting}
                        className="min-h-10 rounded-lg border border-brand-navy px-3 text-xs font-semibold text-brand-navy"
                      >
                        {t("publish")}
                      </button>
                    ) : null}
                    {item.status !== "DISABLED" ? (
                      <button
                        type="button"
                        onClick={() => void transition(item.id, "disable")}
                        disabled={submitting}
                        className="min-h-10 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground"
                      >
                        {t("disable")}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
