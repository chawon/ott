"use client";

import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  MessageSquare,
  MonitorPlay,
  Share2,
  Star,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import TitleSearchBox from "@/components/TitleSearchBox";
import { trackEvent } from "@/lib/analytics";
import { api, apiWithAuth } from "@/lib/api";
import {
  countLogsLocal,
  enqueueCreateLog,
  findTitleByProvider,
  upsertLogLocal,
} from "@/lib/localStore";
import { syncOutbox } from "@/lib/sync";
import type {
  Comment,
  CreateCommentRequest,
  Discussion,
  Occasion,
  Place,
  Status,
  Title,
  TitleSearchItem,
  WatchLog,
} from "@/lib/types";
import {
  cn,
  OCCASION_LABELS,
  placeOptionsForType,
  ratingOptionsForType,
  safeUUID,
  statusOptionsForType,
  tmdbResize,
} from "@/lib/utils";

type SeasonOption = {
  seasonNumber: number;
  name: string;
  episodeCount?: number | null;
  posterUrl?: string | null;
  year?: number | null;
};

type EpisodeOption = {
  episodeNumber: number;
  name: string;
};

const OTT_CUSTOM_VALUE = "__custom__";
const VIDEO_CUSTOM_KEY = "watchlog.ott.custom";
const BOOK_CUSTOM_KEY = "watchlog.book.platform.custom";
const fieldControlClass =
  "min-h-[40px] w-full select-base rounded-xl px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-neutral-900/5";
const selectControlClass =
  "flex h-10 w-full items-center select-base rounded-xl px-3 py-0 text-sm outline-none transition-all focus:ring-2 focus:ring-neutral-900/5";
const disabledControlClass = "cursor-not-allowed opacity-50";
type QuickLogTranslator = ReturnType<typeof useTranslations>;

function resolvePlatformSelect(
  value: string,
  options: string[],
  groups: readonly { label: string; options: readonly string[] }[],
) {
  if (!value) return "";
  if (value.includes(",")) {
    const picked = value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    for (const group of groups) {
      if (picked.length !== group.options.length) continue;
      const allMatch = picked.every((v) =>
        (group.options as readonly string[]).includes(v),
      );
      if (allMatch) return `__group:${group.label}`;
    }
    return OTT_CUSTOM_VALUE;
  }
  return options.includes(value) ? value : OTT_CUSTOM_VALUE;
}

function loadCustomOptions(key: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

function saveCustomOptions(key: string, options: string[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(options));
}

function titleTypeLabel(type: Title["type"], t: QuickLogTranslator) {
  return type === "movie"
    ? t("typeMovie")
    : type === "series"
      ? t("typeSeriesModern")
      : t("typeBook");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateToIso(date: string) {
  return new Date(`${date}T00:00:00`).toISOString();
}

function bookMeta(
  item: Pick<TitleSearchItem, "author" | "publisher" | "year">,
) {
  return [item.author, item.publisher, item.year ? String(item.year) : null]
    .filter(Boolean)
    .join(" · ");
}

export default function QuickLogCard({
  onCreated,
  onContentTypeChange,
  initialContentType = "video",
  initialSearchQuery,
  initialPlatform,
  autoFocusSearch = false,
}: {
  onCreated: (log: WatchLog, options?: { shareCard: boolean }) => void;
  onContentTypeChange?: (type: "video" | "book") => void;
  initialContentType?: "video" | "book";
  initialSearchQuery?: string;
  initialPlatform?: string;
  autoFocusSearch?: boolean;
}) {
  const tQuick = useTranslations("QuickLogCard");
  const tCommon = useTranslations("Common");
  const tDetail = useTranslations("TitleDetail");
  const tStatus = useTranslations("Status");
  const [contentType, setContentType] = useState<"video" | "book">(
    initialContentType,
  );
  const [selected, setSelected] = useState<TitleSearchItem | null>(null);
  const [status, setStatus] = useState<Status>("IN_PROGRESS");
  const [rating, setRating] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [ott, setOtt] = useState("");
  const [ottSelect, setOttSelect] = useState<string>("");
  const [customOttOptions, setCustomOttOptions] = useState<string[]>([]);
  const [place, setPlace] = useState<Place | "">("");
  const [occasion, setOccasion] = useState<Occasion | "">("");
  const [useWatchedAt, setUseWatchedAt] = useState(false);
  const [watchedDate, setWatchedDate] = useState("");
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | "">("");
  const [selectedEpisode, setSelectedEpisode] = useState<number | "">("");
  const [seasonPosterUrl, setSeasonPosterUrl] = useState<string | null>(null);
  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const [shareToDiscussion, setShareToDiscussion] = useState(false);
  const [shareCard, setShareCard] = useState(false);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localLogId, setLocalLogId] = useState<string | null>(null);
  const [localTitleId, setLocalTitleId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{
    visible: boolean;
    count: number;
  } | null>(null);

  const isBookMode = contentType === "book";

  const videoPlatformGroups = useMemo(
    () =>
      [
        {
          label: "OTT",
          options: [
            tQuick("platformNetflix"),
            tQuick("platformDisney"),
            tQuick("platformTving"),
            tQuick("platformWavve"),
            tQuick("platformCoupang"),
            tQuick("platformApple"),
            tQuick("platformPrime"),
            tQuick("platformWatcha"),
          ],
        },
        {
          label: tQuick("groupPaidTv"),
          options: [tQuick("platformChannel"), tQuick("platformVod")],
        },
        {
          label: tQuick("groupPhysical"),
          options: [tQuick("platformDvd"), tQuick("platformBluray")],
        },
        {
          label: tQuick("groupTheater"),
          options: [
            tQuick("platformCgv"),
            tQuick("platformLotte"),
            tQuick("platformMegabox"),
            tQuick("platformCineQ"),
          ],
        },
      ] as const,
    [tQuick],
  );

  const bookPlatformGroups = useMemo(
    () =>
      [
        {
          label: tQuick("groupBookstore"),
          options: [
            tQuick("platformKyobo"),
            tQuick("platformYeongpung"),
            tQuick("platformYes24"),
            tQuick("platformAladin"),
          ],
        },
        {
          label: tQuick("groupEbook"),
          options: [
            tQuick("platformRidi"),
            tQuick("platformMillie"),
            tQuick("platformWilla"),
            tQuick("platformPlaybook"),
          ],
        },
        {
          label: tQuick("groupLibrary"),
          options: [
            tQuick("platformPublicLib"),
            tQuick("platformUnivLib"),
            tQuick("platformSchoolLib"),
          ],
        },
      ] as const,
    [tQuick],
  );

  const platformOptions = useMemo(
    () =>
      isBookMode
        ? bookPlatformGroups.flatMap((group) => group.options)
        : videoPlatformGroups.flatMap((group) => group.options),
    [isBookMode, bookPlatformGroups, videoPlatformGroups],
  );

  const occasionOptions = useMemo(
    () =>
      (Object.keys(OCCASION_LABELS) as Occasion[]).map((value) => ({
        value,
        label: tCommon(`occasionLabels.${value}`),
      })),
    [tCommon],
  );

  const canSave = useMemo(() => !!selected && !saving, [selected, saving]);
  const isWishlist = status === "WISHLIST";
  const statusOptions = useMemo(
    () => statusOptionsForType(isBookMode ? "book" : "movie", tStatus),
    [isBookMode, tStatus],
  );
  const placeOptions = useMemo(
    () => placeOptionsForType(isBookMode ? "book" : "movie", tCommon),
    [isBookMode, tCommon],
  );
  const ratingOptions = useMemo(() => {
    return ratingOptionsForType(isBookMode ? "book" : "movie", tQuick);
  }, [isBookMode, tQuick]);

  const platformGroups = isBookMode ? bookPlatformGroups : videoPlatformGroups;
  const platformCustomKey = isBookMode ? BOOK_CUSTOM_KEY : VIDEO_CUSTOM_KEY;
  const selectedLocalTitleId =
    selected?.provider === "LOCAL" ? selected.titleId : null;

  function clearSelectedTitleState() {
    setSelected(null);
    setLocalLogId(null);
    setLocalTitleId(null);
    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason("");
    setSelectedEpisode("");
    setSeasonPosterUrl(null);
    setSeasonYear(null);
  }

  useEffect(() => {
    if (useWatchedAt && !watchedDate) {
      setWatchedDate(toDateInput(new Date()));
    }
  }, [useWatchedAt, watchedDate]);

  useEffect(() => {
    if (!selectedLocalTitleId) return;
    let cancelled = false;
    (async () => {
      try {
        const title = await api<Title>(`/titles/${selectedLocalTitleId}`);
        if (cancelled) return;
        setSelected((prev) => {
          if (!prev || prev.titleId !== selectedLocalTitleId) return prev;
          return {
            ...prev,
            provider: title.provider ?? prev.provider,
            providerId: title.providerId ?? prev.providerId,
            posterUrl: title.posterUrl ?? prev.posterUrl,
            year: title.year ?? prev.year,
            type: title.type ?? prev.type,
            name: title.name ?? prev.name,
          };
        });
      } catch {
        // ignore resolution errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedLocalTitleId]);
  useEffect(() => {
    if (!selected || selected.genres || selected.provider !== "TMDB") return;
    let cancelled = false;
    (async () => {
      try {
        const details = await api<Pick<Title, "genres" | "directors" | "cast">>(
          `/tmdb/${selected.type}/${selected.providerId}`,
        );
        if (cancelled) return;
        setSelected((prev) => {
          if (!prev || prev.providerId !== selected.providerId) return prev;
          return {
            ...prev,
            genres: details.genres,
            directors: details.directors,
            cast: details.cast,
          };
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    setCustomOttOptions(loadCustomOptions(platformCustomKey));
  }, [platformCustomKey]);

  useEffect(() => {
    setContentType(initialContentType);
    setSelected(null);
    setLocalLogId(null);
    setLocalTitleId(null);
    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason("");
    setSelectedEpisode("");
    setSeasonPosterUrl(null);
    setSeasonYear(null);
  }, [initialContentType]);

  useEffect(() => {
    if (onContentTypeChange) onContentTypeChange(contentType);
  }, [contentType, onContentTypeChange]);

  const allOttOptions = useMemo(() => {
    const base = Array.from(platformOptions) as string[];
    const extras = customOttOptions.filter((v) => !base.includes(v));
    return [...base, ...extras];
  }, [customOttOptions, platformOptions]);

  useEffect(() => {
    if (ottSelect === OTT_CUSTOM_VALUE) return;
    setOttSelect(resolvePlatformSelect(ott, allOttOptions, platformGroups));
  }, [ott, ottSelect, allOttOptions, platformGroups]);

  useEffect(() => {
    if (isBookMode) return;
    const next = initialPlatform?.trim();
    if (!next) return;
    setOtt(next);
  }, [initialPlatform, isBookMode]);

  useEffect(() => {
    let cancelled = false;

    async function loadSeasons() {
      if (!selected || selected.type !== "series") return;
      if (!selected.providerId || selected.provider === "LOCAL") return;
      setSeasonLoading(true);
      setSeasonError(null);
      try {
        const res = await api<SeasonOption[]>(
          `/tmdb/tv/${selected.providerId}/seasons`,
        );
        if (!cancelled) {
          setSeasons(res);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setSeasons([]);
          setSeasonError(errorMessage(e, "Failed to load seasons"));
        }
      } finally {
        if (!cancelled) setSeasonLoading(false);
      }
    }

    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason("");
    setSelectedEpisode("");
    setSeasonPosterUrl(null);
    setSeasonYear(null);
    setSeasonError(null);

    if (selected?.type === "series") {
      loadSeasons();
    }

    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    async function loadEpisodes() {
      if (!selected || selected.type !== "series") return;
      if (selectedSeason === "") return;
      if (!selected.providerId || selected.provider === "LOCAL") return;
      setEpisodeLoading(true);
      try {
        const res = await api<EpisodeOption[]>(
          `/tmdb/tv/${selected.providerId}/seasons/${selectedSeason}`,
        );
        if (!cancelled) {
          setEpisodes(res);
        }
      } catch {
        if (!cancelled) {
          setEpisodes([]);
        }
      } finally {
        if (!cancelled) setEpisodeLoading(false);
      }
    }

    setEpisodes([]);
    setSelectedEpisode("");
    if (selectedSeason !== "") {
      const season = seasons.find((s) => s.seasonNumber === selectedSeason);
      setSeasonPosterUrl(season?.posterUrl ?? null);
      setSeasonYear(typeof season?.year === "number" ? season.year : null);
      loadEpisodes();
    } else {
      setSeasonPosterUrl(null);
      setSeasonYear(null);
    }

    return () => {
      cancelled = true;
    };
  }, [selected, selectedSeason, seasons]);

  async function handleInitialSave(clickedStatus: Status) {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const existingTitle = selected.titleId
        ? null
        : await findTitleByProvider(selected.provider, selected.providerId);
      const newLocalTitleId =
        selected.titleId ?? existingTitle?.id ?? safeUUID();
      const newLocalLogId = safeUUID();

      setLocalTitleId(newLocalTitleId);
      setLocalLogId(newLocalLogId);
      setStatus(clickedStatus);

      const localLog: WatchLog = {
        id: newLocalLogId,
        title: {
          id: newLocalTitleId,
          type: selected.type,
          name: selected.name,
          year: selected.year ?? undefined,
          posterUrl: selected.posterUrl ?? undefined,
          overview: selected.overview ?? undefined,
          author: selected.author ?? undefined,
          publisher: selected.publisher ?? undefined,
          isbn10: selected.isbn10 ?? undefined,
          isbn13: selected.isbn13 ?? undefined,
          pubdate: selected.pubdate ?? undefined,
          provider: selected.provider,
          providerId: selected.providerId,
          updatedAt: now,
        },
        status: clickedStatus,
        rating: null,
        note: null,
        ott: null,
        seasonNumber: null,
        episodeNumber: null,
        seasonPosterUrl: null,
        seasonYear: null,
        origin: "LOG",
        spoiler: false,
        watchedAt: now,
        createdAt: now,
        place: null,
        occasion: null,
        syncStatus: "pending",
        updatedAt: now,
      };

      await upsertLogLocal(localLog);
      await enqueueCreateLog({
        logId: newLocalLogId,
        titleId: newLocalTitleId,
        updatedAt: now,
        log: {
          id: newLocalLogId,
          op: "upsert",
          updatedAt: now,
          payload: {
            titleId: newLocalTitleId,
            status: clickedStatus,
            rating: null,
            note: null,
            ott: null,
            seasonNumber: null,
            episodeNumber: null,
            seasonPosterUrl: null,
            seasonYear: null,
            origin: "LOG",
            spoiler: false,
            watchedAt: now,
            place: null,
            occasion: null,
          },
        },
        title: {
          id: newLocalTitleId,
          op: "upsert",
          updatedAt: now,
          payload: {
            type: selected.type,
            name: selected.name,
            year: selected.year ?? null,
            genres: null,
            overview: selected.overview ?? null,
            posterUrl: selected.posterUrl ?? null,
            author: selected.author ?? null,
            publisher: selected.publisher ?? null,
            isbn10: selected.isbn10 ?? null,
            isbn13: selected.isbn13 ?? null,
            pubdate: selected.pubdate ?? null,
            provider: selected.provider,
            providerId: selected.providerId,
          },
        },
      });
      await trackEvent("log_create", {
        titleType: selected.type,
        hasRating: false,
        hasNote: false,
        hasOtt: false,
      });
      onCreated(localLog);
      await syncOutbox();

      const totalCount = await countLogsLocal();
      setBanner({ visible: true, count: totalCount });
      window.setTimeout(() => setBanner(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSave() {
    if (!selected || !localLogId || !localTitleId || saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();

      if (ott.trim()) {
        const trimmed = ott.trim();
        const baseOptions = Array.from(platformOptions) as string[];
        if (
          !baseOptions.includes(trimmed) &&
          !customOttOptions.includes(trimmed)
        ) {
          const next = [...customOttOptions, trimmed];
          setCustomOttOptions(next);
          saveCustomOptions(platformCustomKey, next);
        }
      }

      const pickedWatchedAt =
        useWatchedAt && watchedDate ? dateToIso(watchedDate) : now;

      const updatedLog: WatchLog = {
        id: localLogId,
        title: {
          id: localTitleId,
          type: selected.type,
          name: selected.name,
          year: selected.year ?? undefined,
          posterUrl: selected.posterUrl ?? undefined,
          overview: selected.overview ?? undefined,
          author: selected.author ?? undefined,
          publisher: selected.publisher ?? undefined,
          isbn10: selected.isbn10 ?? undefined,
          isbn13: selected.isbn13 ?? undefined,
          pubdate: selected.pubdate ?? undefined,
          provider: selected.provider,
          providerId: selected.providerId,
          updatedAt: now,
        },
        status,
        rating: rating === "" ? null : rating,
        note: note.trim() ? note.trim() : null,
        ott: ott.trim() ? ott.trim() : null,
        seasonNumber: selectedSeason === "" ? null : selectedSeason,
        episodeNumber: selectedEpisode === "" ? null : selectedEpisode,
        seasonPosterUrl: seasonPosterUrl ?? null,
        seasonYear: seasonYear ?? null,
        origin: "LOG",
        spoiler: false,
        watchedAt: pickedWatchedAt,
        createdAt: now, // Will be overwritten by DB layer properly
        place: place === "" ? null : place,
        occasion: occasion === "" ? null : occasion,
        syncStatus: "pending",
        updatedAt: now,
      };

      await upsertLogLocal(updatedLog);
      await enqueueCreateLog({
        logId: localLogId,
        titleId: localTitleId,
        updatedAt: now,
        log: {
          id: localLogId,
          op: "upsert",
          updatedAt: now,
          payload: {
            titleId: localTitleId,
            status,
            rating: rating === "" ? null : rating,
            note: note.trim() ? note.trim() : null,
            ott: ott.trim() ? ott.trim() : null,
            seasonNumber: selectedSeason === "" ? null : selectedSeason,
            episodeNumber: selectedEpisode === "" ? null : selectedEpisode,
            seasonPosterUrl: seasonPosterUrl ?? null,
            seasonYear: seasonYear ?? null,
            origin: "LOG",
            spoiler: false,
            watchedAt: pickedWatchedAt,
            place: place === "" ? null : place,
            occasion: occasion === "" ? null : occasion,
          },
        },
        title: {
          id: localTitleId,
          op: "upsert",
          updatedAt: now,
          payload: {
            type: selected.type,
            name: selected.name,
            year: selected.year ?? null,
            genres: null,
            overview: selected.overview ?? null,
            posterUrl: selected.posterUrl ?? null,
            author: selected.author ?? null,
            publisher: selected.publisher ?? null,
            isbn10: selected.isbn10 ?? null,
            isbn13: selected.isbn13 ?? null,
            pubdate: selected.pubdate ?? null,
            provider: selected.provider,
            providerId: selected.providerId,
          },
        },
      });
      onCreated(updatedLog, { shareCard });
      await syncOutbox();

      if (shareToDiscussion) {
        try {
          const discussion = await api<Discussion>("/discussions", {
            method: "POST",
            body: JSON.stringify({ titleId: localTitleId }),
          });
          if (note.trim()) {
            const req: CreateCommentRequest = {
              body: note.trim(),
              mentions: [],
              syncLog: false,
            };
            await apiWithAuth<Comment>(
              `/discussions/${discussion.id}/comments`,
              {
                method: "POST",
                body: JSON.stringify(req),
              },
            );
          }
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("sync:updated"));
          }
        } catch {}
      }

      clearSelectedTitleState();
      setStatus("IN_PROGRESS");
      setRating("");
      setNote("");
      setOtt("");
      setOttSelect("");
      setCustomOttOptions(loadCustomOptions(platformCustomKey));
      setPlace("");
      setOccasion("");
      setUseWatchedAt(false);
      setWatchedDate("");
      setShareCard(false);
      setShareToDiscussion(false);
    } finally {
      setSaving(false);
    }
  }
  function handleCancel() {
    clearSelectedTitleState();
    setStatus("IN_PROGRESS");
    setRating("");
    setNote("");
    setOtt("");
    setOttSelect("");
    setPlace("");
    setOccasion("");
    setUseWatchedAt(false);
    setWatchedDate("");
    setShareCard(false);
    setShareToDiscussion(false);
  }

  function contentTypeButtonClass(type: "video" | "book") {
    const active = contentType === type;
    return cn(
      "inline-flex h-10 items-center justify-center rounded-xl px-4 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active && type === "video" && "bg-foreground text-background shadow-sm",
      !active &&
        type === "video" &&
        "bg-muted text-muted-foreground hover:bg-muted/80",
      active &&
        type === "book" &&
        "border border-emerald-700 bg-emerald-700 text-white shadow-sm dark:bg-emerald-600 dark:border-emerald-600",
      !active &&
        type === "book" &&
        "border border-emerald-200/70 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60",
    );
  }

  return (
    <>
      <section
        className={cn(
          "rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm space-y-4 transition-all hover:border-border/80",
          isBookMode &&
            "bg-emerald-50/30 ring-1 ring-emerald-100/80 border-emerald-200/70 dark:bg-emerald-950/25 dark:ring-emerald-900/60 dark:border-emerald-900/50",
        )}
      >
        {!selected ? (
          <>
            <div
              className="flex items-center gap-2"
              data-onboarding-target="content-type"
            >
              <button
                type="button"
                onClick={() => {
                  if (contentType !== "video") clearSelectedTitleState();
                  setContentType("video");
                }}
                className={contentTypeButtonClass("video")}
              >
                {tQuick("tabVideo")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (contentType !== "book") clearSelectedTitleState();
                  setContentType("book");
                }}
                className={contentTypeButtonClass("book")}
              >
                {tQuick("tabBook")}
              </button>
            </div>

            <div
              data-onboarding-target="title-search"
              className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 ring-2 ring-blue-100 shadow-sm"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
                <ArrowRight className="h-4 w-4" />
                {tQuick("searchStartModern")}
              </div>
              <TitleSearchBox
                key={contentType}
                onSelect={(item) => setSelected(item)}
                placeholder={
                  isBookMode
                    ? tQuick("searchPlaceholderBook")
                    : tQuick("searchPlaceholderVideo")
                }
                showRecentDiscussions
                contentType={isBookMode ? "book" : "video"}
                initialQuery={initialSearchQuery}
                autoFocus={autoFocusSearch}
              />
            </div>
          </>
        ) : null}

        {selected ? (
          <div className="animate-in slide-in-from-top-2 duration-300 fade-in space-y-4">
            <div
              className="rounded-xl border border-border bg-muted p-4 transition-colors"
              data-onboarding-target="selected-title"
            >
              <div className="flex items-center gap-5">
                <div className="h-32 w-20 shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm border border-border">
                  {(seasonPosterUrl ?? selected.posterUrl) ? (
                    <img
                      src={
                        tmdbResize(
                          (seasonPosterUrl ?? selected.posterUrl) || "",
                          "w185",
                        ) ??
                        seasonPosterUrl ??
                        selected.posterUrl ??
                        ""
                      }
                      alt={selected.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold text-foreground">
                    {selected.name}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground font-medium">
                    {titleTypeLabel(selected.type, tQuick)}
                    {selected.type === "book" ? (
                      bookMeta(selected) ? (
                        ` · ${bookMeta(selected)}`
                      ) : (
                        ""
                      )
                    ) : (
                      <>
                        {(seasonYear ?? selected.year)
                          ? ` · ${seasonYear ?? selected.year}`
                          : ""}
                        {selectedSeason !== ""
                          ? " · " +
                            tQuick("seasonValue", { number: selectedSeason })
                          : ""}
                        {selectedEpisode !== ""
                          ? ` · EP ${selectedEpisode}`
                          : ""}
                      </>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {selected.genres && selected.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selected.genres.map((g) => (
                          <span
                            key={g}
                            className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {selected.directors && selected.directors.length > 0 && (
                        <div className="text-[11px] text-muted-foreground line-clamp-1">
                          {tDetail("director")} ·{" "}
                          {selected.directors.join(", ")}
                        </div>
                      )}
                      {selected.cast && selected.cast.length > 0 && (
                        <div className="text-[11px] text-muted-foreground line-clamp-1">
                          {tDetail("cast")} · {selected.cast.join(", ")}
                        </div>
                      )}
                    </div>
                    {selected.type === "book" && selected.overview && (
                      <div className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                        {selected.overview}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={tQuick("cancelAction")}
                  onClick={handleCancel}
                  className="flex min-h-12 min-w-12 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {!localLogId ? (
              <div className="space-y-4 pt-4 pb-2 animate-in fade-in duration-300">
                <div className="text-sm font-semibold text-center text-foreground">
                  {tQuick("statusPrompt")}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleInitialSave("DONE")}
                    disabled={saving}
                    className="min-h-[52px] rounded-xl bg-foreground text-background font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isBookMode
                      ? tQuick("statusDoneBook")
                      : tQuick("statusDoneVideo")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInitialSave("IN_PROGRESS")}
                    disabled={saving}
                    className="min-h-[52px] rounded-xl bg-muted text-foreground font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isBookMode
                      ? tQuick("statusInProgressBook")
                      : tQuick("statusInProgressVideo")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInitialSave("WISHLIST")}
                    disabled={saving}
                    className="min-h-[52px] rounded-xl border border-border bg-card text-foreground font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isBookMode
                      ? tQuick("statusWishlistBook")
                      : tQuick("statusWishlistVideo")}
                  </button>
                </div>
                <div className="text-center text-xs text-muted-foreground mt-2">
                  {tQuick("savedLocally")}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pt-2 animate-in slide-in-from-top-4 fade-in duration-300">
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl text-center border border-emerald-200 dark:border-emerald-900/50">
                  {tQuick("saveSuccessPrompt")}
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 ml-1">
                    {tQuick("optionalDetailsTitle")}
                  </div>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {tQuick("detailStatus")}
                      </div>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as Status)}
                        className={fieldControlClass}
                      >
                        {statusOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selected?.type === "series" ? (
                      <>
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-neutral-500 ml-1">
                            {tQuick("seasonLabel")}
                          </div>
                          <select
                            value={selectedSeason}
                            onChange={(e) =>
                              setSelectedSeason(
                                e.target.value ? Number(e.target.value) : "",
                              )
                            }
                            className={fieldControlClass}
                          >
                            <option value="">{tCommon("none")}</option>
                            {seasons.map((s) => (
                              <option
                                key={s.seasonNumber}
                                value={s.seasonNumber}
                              >
                                {tQuick("seasonValue", {
                                  number: s.seasonNumber,
                                })}
                                {s.name ? ` · ${s.name}` : ""}
                              </option>
                            ))}
                          </select>
                          {seasonLoading ? (
                            <div className="text-[11px] text-neutral-400">
                              {tQuick("loadingSeasons")}
                            </div>
                          ) : null}
                          {seasonError ? (
                            <div className="text-[11px] text-red-500">
                              {seasonError}
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-medium text-neutral-500 ml-1">
                            {tQuick("episodeLabel")}
                          </div>
                          <select
                            value={selectedEpisode}
                            onChange={(e) =>
                              setSelectedEpisode(
                                e.target.value ? Number(e.target.value) : "",
                              )
                            }
                            className={cn(
                              fieldControlClass,
                              (selectedSeason === "" || episodeLoading) &&
                                disabledControlClass,
                            )}
                            disabled={selectedSeason === "" || episodeLoading}
                          >
                            <option value="">{tCommon("none")}</option>
                            {episodes.map((e) => (
                              <option
                                key={e.episodeNumber}
                                value={e.episodeNumber}
                              >
                                EP {e.episodeNumber}
                                {e.name ? ` · ${e.name}` : ""}
                              </option>
                            ))}
                          </select>
                          {episodeLoading ? (
                            <div className="text-[11px] text-neutral-400">
                              {tQuick("loadingEpisodes")}
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : null}

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                        <Star className="h-3 w-3" />
                        {tQuick("detailRating")}
                      </div>
                      <select
                        value={rating === "" ? "" : String(rating)}
                        onChange={(e) =>
                          setRating(
                            e.target.value === "" ? "" : Number(e.target.value),
                          )
                        }
                        className={cn(
                          fieldControlClass,
                          isWishlist && disabledControlClass,
                        )}
                        disabled={isWishlist}
                      >
                        <option value="">{tCommon("none")}</option>
                        {ratingOptions.map((o) => (
                          <option key={o.value} value={String(o.value)}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                        <MonitorPlay className="h-3 w-3" />
                        {tQuick("detailPlatform")}
                      </div>
                      <select
                        value={ottSelect}
                        onChange={(e) => {
                          const next = e.target.value;
                          setOttSelect(next);
                          if (next === OTT_CUSTOM_VALUE) {
                            setOtt("");
                          } else {
                            setOtt(next);
                          }
                        }}
                        className={fieldControlClass}
                      >
                        <option value="">{tCommon("none")}</option>
                        {platformGroups.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.options.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        {customOttOptions.length > 0 ? (
                          <optgroup label={tQuick("myInput")}>
                            {customOttOptions.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        <option value={OTT_CUSTOM_VALUE}>
                          {tQuick("customInput")}
                        </option>
                      </select>
                      {ottSelect === OTT_CUSTOM_VALUE ? (
                        <input
                          value={ott}
                          onChange={(e) => setOtt(e.target.value)}
                          className={cn(fieldControlClass, "mt-2")}
                          placeholder={
                            isBookMode
                              ? tQuick("customInputPlaceholder")
                              : tQuick("customInput")
                          }
                        />
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" />
                        {tQuick("detailPlace")}
                      </div>
                      <select
                        value={place}
                        onChange={(e) => setPlace(e.target.value as Place | "")}
                        className={cn(
                          fieldControlClass,
                          isWishlist && disabledControlClass,
                        )}
                        disabled={isWishlist}
                      >
                        <option value="">{tCommon("none")}</option>
                        {placeOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                        <Users className="h-3 w-3" />
                        {tQuick("detailOccasion")}
                      </div>
                      <select
                        value={occasion}
                        onChange={(e) =>
                          setOccasion(e.target.value as Occasion)
                        }
                        className={cn(
                          fieldControlClass,
                          isWishlist && disabledControlClass,
                        )}
                        disabled={isWishlist}
                      >
                        {occasionOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => setUseWatchedAt(!useWatchedAt)}
                        className={cn(
                          "flex min-h-[52px] items-center gap-2 rounded-xl px-2 text-xs font-medium transition-colors",
                          useWatchedAt
                            ? "text-neutral-900"
                            : "text-neutral-400 hover:text-neutral-600",
                        )}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        {useWatchedAt
                          ? tQuick("dateSelecting")
                          : tQuick("dateOther")}
                      </button>
                      {useWatchedAt ? (
                        <input
                          type="date"
                          value={watchedDate}
                          onChange={(e) => setWatchedDate(e.target.value)}
                          className={selectControlClass}
                        />
                      ) : null}
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3" />
                        {tQuick("detailNote")}
                      </div>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className={cn(
                          fieldControlClass,
                          "min-h-28 resize-none",
                        )}
                        placeholder={tQuick("notePlaceholder")}
                        rows={3}
                      />
                    </div>
                  </div>

                  <div
                    className="mt-3 grid grid-cols-1 gap-2"
                    data-onboarding-target="status-save"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-neutral-500 ml-1 flex items-center gap-1.5">
                        <Share2 className="h-3 w-3" />
                        {tQuick("saveAndShare")}
                      </div>
                      <div className="flex flex-row flex-nowrap items-center rounded-xl border border-border bg-muted/30 px-4 sm:px-6 py-2 overflow-x-auto no-scrollbar">
                        <label className="flex min-h-[40px] cursor-pointer items-center whitespace-nowrap text-xs font-medium text-neutral-700">
                          <input
                            type="checkbox"
                            checked={shareToDiscussion}
                            onChange={(e) =>
                              setShareToDiscussion(e.target.checked)
                            }
                            style={{
                              width: "20px",
                              height: "20px",
                              marginRight: "12px",
                            }}
                            className="shrink-0"
                          />
                          <span>{tQuick("shareToPublic")}</span>
                        </label>
                        <div className="w-10 sm:w-24 shrink-0" />
                        <label className="flex min-h-[40px] cursor-pointer items-center whitespace-nowrap text-xs font-medium text-neutral-700">
                          <input
                            type="checkbox"
                            checked={shareCard}
                            onChange={(e) => setShareCard(e.target.checked)}
                            style={{
                              width: "20px",
                              height: "20px",
                              marginRight: "12px",
                            }}
                            className="shrink-0"
                          />
                          <span>{tQuick("createShareCard")}</span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canSave}
                      onClick={handleUpdateSave}
                      className="flex h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] w-full items-center justify-center whitespace-nowrap rounded-2xl bg-neutral-900 px-8 text-sm font-semibold text-white transition-all hover:bg-neutral-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                    >
                      {saving ? tQuick("saving") : tQuick("saveActionModern")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {banner?.visible ? (
        <div className="fixed bottom-[var(--mobile-bottom-overlay-offset)] left-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300 sm:bottom-6">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card/90 p-4 shadow-xl backdrop-blur-md">
            <div className="text-sm font-medium text-foreground">
              {tQuick("successLike")}{" "}
              <span className="font-bold text-blue-600">
                {tQuick("successCount", { count: banner.count })}
              </span>
            </div>
            <Link
              href="/timeline"
              data-onboarding-target="timeline-confirm"
              className="flex min-h-12 items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
            >
              {tQuick("viewTimeline")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
