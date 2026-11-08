"use client";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  MessageSquare,
  MonitorPlay,
  Pencil,
  Share2,
  Users,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import CommentsPanel from "@/components/CommentsPanel";
import GoogleBooksAttribution from "@/components/GoogleBooksAttribution";
import RecordFeelings from "@/components/RecordFeelings";
import styles from "@/components/recording.module.css";
import ShareBottomSheet from "@/components/ShareBottomSheet";
import { Link } from "@/i18n/routing";
import { api, apiWithAuth } from "@/lib/api";
import { googleBooksUrl } from "@/lib/googleBooks";
import {
  enqueueUpdateLog,
  getTitleLocal,
  getUserId,
  listHistoryLocal,
  listLogsByTitleLocal,
  updateLogLocal,
  updatePendingCreatePayload,
  upsertHistoryLocal,
  upsertLogsLocal,
  upsertTitleLocal,
} from "@/lib/localStore";
import { editedRecordDate, recordDateInput } from "@/lib/recordDate";
import { recordDisplayYear } from "@/lib/recordMetadata";
import { syncOutbox } from "@/lib/sync";
import type {
  Occasion,
  Place,
  Status,
  Title,
  WatchLog,
  WatchLogHistory,
} from "@/lib/types";
import {
  formatNoteInline,
  OCCASION_LABELS,
  occasionLabel,
  placeLabel,
  placeOptionsForType,
  ratingDisplay,
  safeUUID,
  statusOptionsForType,
} from "@/lib/utils";
import { EN_BOOK_PLATFORM_GROUPS } from "../../../../../../shared/bookPlatforms";

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

function fmt(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function chip(label: string, _tone: "place" | "occasion") {
  return (
    <span className="rounded-lg border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
      {label}
    </span>
  );
}

function renderBody(text: string) {
  const parts = text.split(/(@\{[^}]+\})/g);
  const occurrences = new Map<string, number>();
  return parts.map((p) => {
    const occurrence = occurrences.get(p) ?? 0;
    occurrences.set(p, occurrence + 1);
    const key = `${p}:${occurrence}`;
    if (p.startsWith("@{") && p.endsWith("}")) {
      const name = p.slice(2, -1);
      return (
        <span
          key={key}
          className="rounded-md bg-indigo-50 px-1 text-indigo-700"
        >
          @{name}
        </span>
      );
    }
    if (p.startsWith("@")) {
      return (
        <span
          key={key}
          className="rounded-md bg-indigo-50 px-1 text-indigo-700"
        >
          {p}
        </span>
      );
    }
    return <span key={key}>{p}</span>;
  });
}

function seasonEpisodeLabel(
  seasonNumber?: number | null,
  episodeNumber?: number | null,
) {
  if (typeof seasonNumber !== "number") return null;
  if (typeof episodeNumber === "number")
    return `S${seasonNumber} · E${episodeNumber}`;
  return `S${seasonNumber}`;
}

function titleTypeLabel(type: Title["type"], t: any) {
  return type === "movie"
    ? t("typeMovie")
    : type === "series"
      ? t("typeSeriesModern")
      : t("typeBook");
}

function bookMeta(item: Pick<Title, "author" | "publisher" | "year">) {
  return [item.author, item.publisher, item.year ? String(item.year) : null]
    .filter(Boolean)
    .join(" · ");
}

export default function TitlePage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const titleId = Array.isArray(rawId) ? rawId[0] : rawId;
  const locale = useLocale();
  const tQuick = useTranslations("QuickLogCard");
  const tCommon = useTranslations("Common");
  const tStatus = useTranslations("Status");
  const tDetail = useTranslations("TitleDetail");

  const [title, setTitle] = useState<Title | null>(null);
  const [log, setLog] = useState<WatchLog | null>(null);
  const [history, setHistory] = useState<WatchLogHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [status, setStatus] = useState<Status>("IN_PROGRESS");
  const [rating, setRating] = useState<number | "">("");
  const [ott, setOtt] = useState("");
  const [ottSelect, setOttSelect] = useState<string>("");
  const [note, setNote] = useState("");
  const [place, setPlace] = useState<Place | "">("");
  const [occasion, setOccasion] = useState<Occasion | "">("");
  const [watchedDate, setWatchedDate] = useState("");
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | "">("");
  const [selectedEpisode, setSelectedEpisode] = useState<number | "">("");
  const [seasonPosterUrl, setSeasonPosterUrl] = useState<string | null>(null);
  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const [origin, setOrigin] = useState<WatchLog["origin"]>("LOG");
  const [customOttOptions, setCustomOttOptions] = useState<string[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const isBook = title?.type === "book";
  const titleType = title?.type;
  const titleProviderId = title?.providerId;
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const copy = (ko: string, en: string) => (locale === "ko" ? ko : en);

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
      locale === "en"
        ? EN_BOOK_PLATFORM_GROUPS
        : ([
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
          ] as const),
    [locale, tQuick],
  );

  const platformOptions = useMemo(
    () =>
      isBook
        ? bookPlatformGroups.flatMap((group) => group.options)
        : videoPlatformGroups.flatMap((group) => group.options),
    [isBook, bookPlatformGroups, videoPlatformGroups],
  );

  const platformGroups = isBook ? bookPlatformGroups : videoPlatformGroups;
  const platformCustomKey = isBook ? BOOK_CUSTOM_KEY : VIDEO_CUSTOM_KEY;
  const platformPlaceholder = isBook
    ? tQuick("customInputPlaceholder")
    : tQuick("customInput");

  const allOttOptions = useMemo(() => {
    const base = Array.from(platformOptions) as string[];
    const extras = customOttOptions.filter((v) => !base.includes(v));
    return [...base, ...extras];
  }, [customOttOptions, platformOptions]);

  const statusOptions = useMemo(
    () => statusOptionsForType(title?.type, tStatus),
    [title?.type, tStatus],
  );
  const placeOptions = useMemo(
    () => placeOptionsForType(title?.type, tCommon),
    [title?.type, tCommon],
  );

  const occasionOptions = useMemo(
    () =>
      (Object.keys(OCCASION_LABELS) as Occasion[]).map((value) => ({
        value,
        label: tCommon("occasionLabels." + value),
      })),
    [tCommon],
  );

  const loadLocalOnly = useCallback(async () => {
    if (!titleId) return false;
    let applied = false;
    const localTitle = await getTitleLocal(titleId);
    const localLogs = await listLogsByTitleLocal(titleId, 1);
    const localCurrent = localLogs[0] ?? null;

    if (localTitle) {
      applied = true;
      setTitle(localTitle);
    }
    if (localCurrent) {
      applied = true;
      setLog(localCurrent);
      setStatus(localCurrent.status);
      setRating(
        typeof localCurrent.rating === "number" ? localCurrent.rating : "",
      );
      setOtt(localCurrent.ott ?? "");
      setOttSelect("");
      setNote(localCurrent.note ?? "");
      setPlace(localCurrent.place ?? "");
      setOccasion(localCurrent.occasion ?? "");
      setSelectedSeason(
        typeof localCurrent.seasonNumber === "number"
          ? localCurrent.seasonNumber
          : "",
      );
      setSelectedEpisode(
        typeof localCurrent.episodeNumber === "number"
          ? localCurrent.episodeNumber
          : "",
      );
      setSeasonPosterUrl(localCurrent.seasonPosterUrl ?? null);
      setSeasonYear(
        typeof localCurrent.seasonYear === "number"
          ? localCurrent.seasonYear
          : null,
      );
      setOrigin(localCurrent.origin ?? "LOG");
      setWatchedDate(recordDateInput(localCurrent.watchedAt));

      const localHistory = await listHistoryLocal(localCurrent.id, 50);
      if (localHistory.length > 0) setHistory(localHistory);
    }
    return applied;
  }, [titleId]);

  const reloadAll = useCallback(async () => {
    if (!titleId) return;
    setLoading(true);
    setErr(null);

    let hadLocal = false;
    try {
      const localApplied = await loadLocalOnly();
      if (localApplied) hadLocal = true;

      const t = await api<Title>(`/titles/${titleId}`);
      const hasUser = !!getUserId();
      const logs = hasUser
        ? await apiWithAuth<WatchLog[]>(
            `/logs?titleId=${encodeURIComponent(titleId)}&limit=1`,
          )
        : [];
      const current = logs[0] ?? null;

      setTitle(t);
      await upsertTitleLocal(t);
      if (!hasUser) return;

      setLog(current);
      await upsertLogsLocal(logs);

      if (!current) {
        setHistory([]);
        return;
      }

      setStatus(current.status);
      setRating(typeof current.rating === "number" ? current.rating : "");
      setOtt(current.ott ?? "");
      setOttSelect("");
      setNote(current.note ?? "");
      setPlace(current.place ?? "");
      setOccasion(current.occasion ?? "");
      setSelectedSeason(
        typeof current.seasonNumber === "number" ? current.seasonNumber : "",
      );
      setSelectedEpisode(
        typeof current.episodeNumber === "number" ? current.episodeNumber : "",
      );
      setSeasonPosterUrl(current.seasonPosterUrl ?? null);
      setSeasonYear(
        typeof current.seasonYear === "number" ? current.seasonYear : null,
      );
      setOrigin(current.origin ?? "LOG");
      setWatchedDate(recordDateInput(current.watchedAt));

      const h = await apiWithAuth<WatchLogHistory[]>(
        `/logs/${current.id}/history?limit=50`,
      );
      setHistory(h);
      await upsertHistoryLocal(h);
    } catch (e: any) {
      if (!hadLocal) {
        setErr(e?.message ?? tDetail("errorTitle"));
      }
    } finally {
      setLoading(false);
    }
  }, [titleId, loadLocalOnly, tDetail]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  useEffect(() => {
    setCustomOttOptions(loadCustomOptions(platformCustomKey));
  }, [platformCustomKey]);

  useEffect(() => {
    if (ottSelect === OTT_CUSTOM_VALUE) return;
    setOttSelect(resolvePlatformSelect(ott, allOttOptions, platformGroups));
  }, [ott, ottSelect, allOttOptions, platformGroups]);

  useEffect(() => {
    let cancelled = false;
    async function loadSeasons() {
      if (titleType !== "series" || !titleProviderId) return;
      setSeasonLoading(true);
      setSeasonError(null);
      try {
        const res = await api<SeasonOption[]>(
          `/tmdb/tv/${titleProviderId}/seasons`,
        );
        if (!cancelled) setSeasons(res);
      } catch (e: any) {
        if (!cancelled) {
          setSeasons([]);
          setSeasonError(e?.message ?? tQuick("loadingSeasons"));
        }
      } finally {
        if (!cancelled) setSeasonLoading(false);
      }
    }

    setSeasons([]);
    setEpisodes([]);
    setSeasonError(null);

    if (titleType === "series" && titleProviderId) {
      loadSeasons();
    }

    return () => {
      cancelled = true;
    };
  }, [titleType, titleProviderId, tQuick]);

  useEffect(() => {
    let cancelled = false;
    async function loadEpisodes() {
      if (titleType !== "series" || !titleProviderId) return;
      if (selectedSeason === "") return;
      setEpisodeLoading(true);
      try {
        const res = await api<EpisodeOption[]>(
          `/tmdb/tv/${titleProviderId}/seasons/${selectedSeason}`,
        );
        if (!cancelled) setEpisodes(res);
      } catch {
        if (!cancelled) setEpisodes([]);
      } finally {
        if (!cancelled) setEpisodeLoading(false);
      }
    }

    setEpisodes([]);
    if (selectedSeason !== "") {
      const season = seasons.find((s) => s.seasonNumber === selectedSeason);
      if (season) {
        setSeasonPosterUrl(season.posterUrl ?? null);
        setSeasonYear(typeof season.year === "number" ? season.year : null);
      }
      loadEpisodes();
    } else {
      setSeasonPosterUrl(null);
      setSeasonYear(null);
      setSelectedEpisode("");
    }

    return () => {
      cancelled = true;
    };
  }, [titleType, titleProviderId, selectedSeason, seasons]);

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  useEffect(() => {
    function handleSync() {
      void loadLocalOnly();
    }
    window.addEventListener("sync:updated", handleSync);
    return () => window.removeEventListener("sync:updated", handleSync);
  }, [loadLocalOnly]);

  const isDirty = useMemo(() => {
    if (!log) return false;
    const baselineRating = typeof log.rating === "number" ? log.rating : null;
    const baselineOtt = log.ott ?? "";
    const baselineNote = log.note ?? "";
    const baselinePlace = log.place ?? "";
    const baselineOccasion = log.occasion ?? "";
    const baselineWatchedDate = recordDateInput(log.watchedAt);
    const baselineSeason =
      typeof log.seasonNumber === "number" ? log.seasonNumber : "";
    const baselineEpisode =
      typeof log.episodeNumber === "number" ? log.episodeNumber : "";
    const baselineSeasonYear =
      typeof log.seasonYear === "number" ? log.seasonYear : null;
    return (
      status !== log.status ||
      (rating === "" ? null : rating) !== baselineRating ||
      ott.trim() !== baselineOtt ||
      note.trim() !== baselineNote ||
      place !== baselinePlace ||
      occasion !== baselineOccasion ||
      selectedSeason !== baselineSeason ||
      selectedEpisode !== baselineEpisode ||
      seasonYear !== baselineSeasonYear ||
      Boolean(watchedDate && watchedDate !== baselineWatchedDate)
    );
  }, [
    log,
    status,
    rating,
    ott,
    note,
    place,
    occasion,
    watchedDate,
    selectedSeason,
    selectedEpisode,
    seasonYear,
  ]);

  const canUpdate = useMemo(
    () => !!log && !saving && isDirty,
    [log, saving, isDirty],
  );

  async function updateLog() {
    if (!log || saving) return;
    setUpdateError(null);
    setSaving(true);
    try {
      if (!isDirty) return;
      const now = new Date().toISOString();
      const pickedWatchedAt = editedRecordDate(log.watchedAt, watchedDate);
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
      const payload = {
        id: log.id,
        op: "upsert",
        updatedAt: now,
        payload: {
          status,
          rating: rating === "" ? null : rating,
          ott: ott.trim() ? ott.trim() : null,
          note: note.trim() ? note.trim() : null,
          seasonNumber: selectedSeason === "" ? null : selectedSeason,
          episodeNumber: selectedEpisode === "" ? null : selectedEpisode,
          seasonPosterUrl: seasonPosterUrl ?? null,
          seasonYear: seasonYear ?? null,
          origin,
          place: place || null,
          occasion: occasion || null,
          watchedAt: pickedWatchedAt,
        },
      };

      const updatedLocal: WatchLog = {
        ...log,
        status,
        rating: rating === "" ? null : rating,
        ott: ott.trim() ? ott.trim() : null,
        note: note.trim() ? note.trim() : null,
        seasonNumber: selectedSeason === "" ? null : selectedSeason,
        episodeNumber: selectedEpisode === "" ? null : selectedEpisode,
        seasonPosterUrl: seasonPosterUrl ?? null,
        seasonYear: seasonYear ?? null,
        origin,
        place: place || null,
        occasion: occasion || null,
        syncStatus: "pending",
        updatedAt: now,
        watchedAt: pickedWatchedAt ?? log.watchedAt,
      };

      setLog(updatedLocal);
      await updateLogLocal(log.id, updatedLocal);
      const historyEntry: WatchLogHistory = {
        id: safeUUID(),
        logId: log.id,
        recordedAt: now,
        status,
        rating: rating === "" ? null : rating,
        note: note.trim() ? note.trim() : null,
        spoiler: false,
        ott: ott.trim() ? ott.trim() : null,
        seasonNumber: selectedSeason === "" ? null : selectedSeason,
        episodeNumber: selectedEpisode === "" ? null : selectedEpisode,
        seasonPosterUrl: seasonPosterUrl ?? null,
        seasonYear: seasonYear ?? null,
        origin,
        watchedAt: pickedWatchedAt ?? log.watchedAt,
        place: place || null,
        occasion: occasion || null,
      };
      setHistory((prev) => [historyEntry, ...prev]);
      await upsertHistoryLocal([historyEntry]);

      const mergedIntoCreate = await updatePendingCreatePayload(
        log.id,
        payload,
      );
      if (!mergedIntoCreate) {
        await enqueueUpdateLog(log.id, payload);
      }
      await syncOutbox();
      setEditOpen(false);
    } catch (error) {
      setUpdateError(
        error instanceof Error
          ? error.message
          : copy(
              "수정 내용을 보관하지 못했어요. 다시 시도해 주세요.",
              "Your changes could not be kept. Please try again.",
            ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!titleId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-base font-semibold">Invalid route</div>
      </div>
    );
  }

  if (loading && !title) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-sm text-neutral-600">{tDetail("loading")}</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-base font-semibold">{tDetail("errorTitle")}</div>
        <div className="mt-2 text-sm text-neutral-700">{err}</div>
      </div>
    );
  }

  if (!title) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-base font-semibold">{tDetail("notFound")}</div>
      </div>
    );
  }

  const feeling = ratingDisplay(log?.rating, title.type, tQuick);
  const displayYear = recordDisplayYear(title, log);
  return (
    <div className={styles.detail}>
      <Link href="/timeline" className={styles.quiet}>
        <ArrowLeft size={16} />
        {copy("타임라인", "Timeline")}
      </Link>
      <section className={styles.detailHero}>
        {log?.seasonPosterUrl || title.posterUrl ? (
          <img
            className={styles.detailPoster}
            data-book={isBook}
            src={log?.seasonPosterUrl || title.posterUrl || ""}
            alt={title.name}
            width={280}
            height={420}
          />
        ) : (
          <div className={styles.detailPoster} aria-hidden="true" />
        )}
        <div className={styles.detailStory}>
          <p className={styles.eyebrow}>
            {titleTypeLabel(title.type, tQuick)}
            {displayYear ? ` · ${displayYear}` : ""}
          </p>
          <h1>{title.name}</h1>
          <div className={styles.detailMeta}>
            {isBook ? bookMeta(title) : title.directors?.join(", ")}
            {log ? (
              <span>
                {
                  statusOptions.find((option) => option.value === log.status)
                    ?.label
                }
              </span>
            ) : null}
            {feeling ? <span>{feeling.label}</span> : null}
            {log && seasonEpisodeLabel(log.seasonNumber, log.episodeNumber) ? (
              <span>
                {seasonEpisodeLabel(log.seasonNumber, log.episodeNumber)}
              </span>
            ) : null}
          </div>
          {log ? (
            <>
              <dl
                className={styles.detailTpo}
                aria-label={copy("그날의 온기", "The moment")}
              >
                <div>
                  <dt>{copy("언제", "When")}</dt>
                  <dd>
                    {log.watchedAt
                      ? fmt(log.watchedAt, locale)
                      : copy("기록하지 않았어요", "Not recorded")}
                  </dd>
                </div>
                <div>
                  <dt>
                    {isBook
                      ? copy("읽은 곳·플랫폼", "Where you got or read it")
                      : tQuick("detailPlatform")}
                  </dt>
                  <dd>
                    {log.ott || copy("기록하지 않았어요", "Not recorded")}
                  </dd>
                </div>
                <div>
                  <dt>{copy("어디서", "Where")}</dt>
                  <dd>
                    {log.place
                      ? placeLabel(log.place, (key: Place) =>
                          tCommon(`placeLabels.${key}`),
                        )
                      : copy("기록하지 않았어요", "Not recorded")}
                  </dd>
                </div>
                <div>
                  <dt>
                    {copy(
                      "누구와·어떤 상황",
                      "Who you were with or the occasion",
                    )}
                  </dt>
                  <dd>
                    {log.occasion
                      ? occasionLabel(log.occasion, (key: Occasion) =>
                          tCommon(`occasionLabels.${key}`),
                        )
                      : copy("기록하지 않았어요", "Not recorded")}
                  </dd>
                </div>
              </dl>
              {log.note ? (
                <p className={styles.detailNote}>{log.note}</p>
              ) : null}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primary}
                  data-testid="record-detail-edit"
                  onClick={() => setEditOpen((value) => !value)}
                >
                  <Pencil size={16} />
                  {copy("기록 수정하기", "Edit this record")}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 size={16} />
                  {copy("공유 카드 만들기", "Create a share card")}
                </button>
              </div>
              <p className={styles.hint}>
                {copy(
                  "내 기록은 직접 공개하기 전까지 나에게만 보여요.",
                  "Your record stays private until you choose to share it.",
                )}
              </p>
            </>
          ) : (
            <p className={styles.hint}>{tDetail("myRecordEmpty")}</p>
          )}
        </div>
      </section>
      {googleBooksUrl(title) ? (
        <GoogleBooksAttribution href={googleBooksUrl(title)!} />
      ) : null}
      <ShareBottomSheet
        open={shareOpen}
        log={log}
        onClose={() => setShareOpen(false)}
      />
      <div>
        <section
          className={styles.detailEditor}
          hidden={!editOpen}
          aria-label={copy("기록 수정", "Edit record")}
        >
          <div>
            <div className="text-base font-semibold">
              {copy("그날의 순간", "The moment")}
            </div>
            <div className="text-sm text-neutral-600">
              {log ? tDetail("myRecordDesc") : tDetail("myRecordEmpty")}
            </div>
          </div>

          {log ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-xs text-neutral-600 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {tQuick("detailStatus")}
                  </div>
                  <select
                    data-testid="record-edit-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Status)}
                    className="w-full select-base rounded-xl px-3 py-2 text-sm"
                  >
                    {statusOptions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                {title.type === "series" ? (
                  <label className="space-y-1">
                    <div className="text-xs text-neutral-600">
                      {tQuick("seasonLabel")}
                    </div>
                    <select
                      data-testid="record-season"
                      value={selectedSeason}
                      onChange={(e) => {
                        setSelectedSeason(
                          e.target.value ? Number(e.target.value) : "",
                        );
                        setSelectedEpisode("");
                      }}
                      className="w-full select-base rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="">{tCommon("none")}</option>
                      {selectedSeason !== "" &&
                      !seasons.some(
                        (season) => season.seasonNumber === selectedSeason,
                      ) ? (
                        <option value={selectedSeason}>
                          {tQuick("seasonValue", { number: selectedSeason })}
                        </option>
                      ) : null}
                      {seasons.map((s) => (
                        <option key={s.seasonNumber} value={s.seasonNumber}>
                          {tQuick("seasonValue", { number: s.seasonNumber })}
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
                  </label>
                ) : null}

                {title.type === "series" ? (
                  <label className="space-y-1">
                    <div className="text-xs text-neutral-600">
                      {tQuick("episodeLabel")}
                    </div>
                    <select
                      data-testid="record-episode"
                      value={selectedEpisode}
                      onChange={(e) =>
                        setSelectedEpisode(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className="w-full select-base rounded-xl px-3 py-2 text-sm"
                      disabled={selectedSeason === "" || episodeLoading}
                    >
                      <option value="">{tCommon("none")}</option>
                      {selectedEpisode !== "" &&
                      !episodes.some(
                        (episode) => episode.episodeNumber === selectedEpisode,
                      ) ? (
                        <option value={selectedEpisode}>
                          {copy(
                            `${selectedEpisode}화`,
                            `Episode ${selectedEpisode}`,
                          )}
                        </option>
                      ) : null}
                      {episodes.map((e) => (
                        <option key={e.episodeNumber} value={e.episodeNumber}>
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
                  </label>
                ) : null}

                <div className="md:col-span-2">
                  <RecordFeelings
                    value={rating}
                    type={title.type}
                    onChange={setRating}
                  />
                </div>

                <label className="space-y-1">
                  <div className="text-xs text-neutral-600 flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" />
                    {tQuick("detailPlace")}
                  </div>
                  <select
                    data-testid="record-place"
                    value={place}
                    onChange={(e) => setPlace(e.target.value as Place | "")}
                    className="w-full select-base rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">{tCommon("none")}</option>
                    {placeOptions.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-neutral-600 flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    {tQuick("detailOccasion")}
                  </div>
                  <select
                    data-testid="record-occasion"
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value as Occasion)}
                    className="w-full select-base rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">{tCommon("none")}</option>
                    {occasionOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label
                  htmlFor="record-detail-platform"
                  className="space-y-1 md:col-span-2"
                >
                  <div className="text-xs text-neutral-600 flex items-center gap-1.5">
                    <MonitorPlay className="h-3 w-3" />
                    {title.type === "book" && locale !== "ko"
                      ? "Where you got or read it"
                      : tQuick("detailPlatform")}
                  </div>
                  <>
                    <select
                      id="record-detail-platform"
                      data-testid="record-platform"
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
                      className="w-full select-base rounded-xl px-3 py-2 text-sm"
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
                        className="mt-2 w-full select-base rounded-xl px-3 py-2 text-sm"
                        placeholder={platformPlaceholder}
                      />
                    ) : null}
                  </>
                </label>

                <label className={styles.field}>
                  <span>
                    <Calendar size={16} />
                    {copy("날짜", "Date")}
                  </span>
                  <input
                    type="date"
                    data-testid="record-date"
                    required
                    value={watchedDate}
                    onChange={(event) => setWatchedDate(event.target.value)}
                  />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3" />
                    {tQuick("detailNote")}
                  </div>
                  <textarea
                    data-testid="record-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full select-base rounded-xl px-3 py-2 text-sm"
                    rows={3}
                  />
                </label>
              </div>

              {updateError ? (
                <p className={styles.error} role="alert">
                  {updateError}
                </p>
              ) : null}
              <button
                type="button"
                data-testid="record-detail-save"
                disabled={!canUpdate || !watchedDate}
                onClick={updateLog}
                className={styles.primary}
              >
                {saving ? tDetail("updating") : tDetail("updateAction")}
              </button>
            </>
          ) : null}
        </section>

        <section className={styles.detailHistory} data-testid="record-history">
          <div>
            <div className="text-base font-semibold">
              {tDetail("historyTitle")}
            </div>
            <div className="text-sm text-muted-foreground">
              {tDetail("historyDesc")}
            </div>
          </div>

          {!log ? (
            <div className="text-sm text-muted-foreground">
              {tDetail("historyEmpty")}
            </div>
          ) : history.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {tDetail("historyEmpty")}
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const ratingInfo = ratingDisplay(h.rating, title?.type, tQuick);
                const statusText =
                  statusOptions.find((s) => s.value === h.status)?.label ??
                  h.status;
                return (
                  <article key={h.id} data-testid="record-history-entry">
                    <div className="text-sm font-semibold text-foreground">
                      {fmt(h.recordedAt, locale)} · {statusText}
                      {seasonEpisodeLabel(h.seasonNumber, h.episodeNumber)
                        ? ` · ${seasonEpisodeLabel(h.seasonNumber, h.episodeNumber)}`
                        : ""}
                      {ratingInfo ? ` · ${ratingInfo.label}` : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {h.place
                        ? chip(
                            placeLabel(h.place, (k: any) =>
                              tCommon("placeLabels." + k),
                            ),
                            "place",
                          )
                        : null}
                      {h.occasion
                        ? chip(
                            occasionLabel(h.occasion, (k: any) =>
                              tCommon("occasionLabels." + k),
                            ),
                            "occasion",
                          )
                        : null}
                      {h.ott ? (
                        <span className="rounded-full border border-border bg-muted px-3 py-1 text-muted-foreground">
                          {h.ott}
                        </span>
                      ) : null}
                    </div>
                    {h.note ? (
                      <div className="mt-2 text-sm text-foreground">
                        {renderBody(formatNoteInline(h.note))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <CommentsPanel
        titleId={titleId}
        userId={userId}
        titleType={title?.type}
      />
    </div>
  );
}
