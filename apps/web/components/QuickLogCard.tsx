"use client";

import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  MapPin,
  MessageSquare,
  MonitorPlay,
  Share2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GoogleBooksAttribution from "@/components/GoogleBooksAttribution";
import SavedAndroidPlayCta from "@/components/SavedAndroidPlayCta";
import SavedDiscussionLink from "@/components/SavedDiscussionLink";
import TitleSearchBox from "@/components/TitleSearchBox";
import { Link as IntlLink } from "@/i18n/routing";
import {
  clearCuratedAttribution,
  readCuratedAttribution,
  trackEvent,
} from "@/lib/analytics";
import { api, apiWithAuth } from "@/lib/api";
import { isKdcBookshelfLocale, type KdcMajor } from "@/lib/bookshelf";
import { resolveTitleClassification } from "@/lib/bookshelfStore";
import { googleBooksUrl } from "@/lib/googleBooks";
import {
  countLogsLocal,
  enqueueCreateLog,
  enqueueUpdateLog,
  findTitleByProvider,
  listOutbox,
  resolveLogLocal,
  updatePendingCreatePayload,
  upsertHistoryLocal,
  upsertLogLocal,
} from "@/lib/localStore";
import { editedRecordDate, recordDateInput } from "@/lib/recordDate";
import { recordDisplayYear } from "@/lib/recordMetadata";
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
  TitleSelectSource,
  WatchLog,
} from "@/lib/types";
import {
  OCCASION_LABELS,
  placeOptionsForType,
  safeUUID,
  statusOptionsForType,
  tmdbResize,
} from "@/lib/utils";
import { EN_BOOK_PLATFORM_GROUPS } from "../../../shared/bookPlatforms";
import RecordFeelings from "./RecordFeelings";
import styles from "./recording.module.css";

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

type ActivationTitleSelection = {
  item: TitleSearchItem;
  source: Extract<
    TitleSelectSource,
    "activation_recent_discussion" | "activation_popular_title"
  >;
  nonce: number;
};

const OTT_CUSTOM_VALUE = "__custom__";
const VIDEO_CUSTOM_KEY = "watchlog.ott.custom";
const BOOK_CUSTOM_KEY = "watchlog.book.platform.custom";
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
  searchFocusSignal = 0,
  shareImportStatus,
  shareImportFeedbackHref,
  activationTitleSelection,
  initialCatalogTitle,
  highlightedStatus,
  dialogLayout = false,
  onStageChange,
  onDone,
}: {
  onCreated: (log: WatchLog, options?: { shareCard: boolean }) => void;
  onContentTypeChange?: (type: "video" | "book") => void;
  initialContentType?: "video" | "book";
  initialSearchQuery?: string;
  initialPlatform?: string;
  autoFocusSearch?: boolean;
  searchFocusSignal?: number;
  shareImportStatus?: "imported" | "unresolved" | null;
  shareImportFeedbackHref?: string;
  activationTitleSelection?: ActivationTitleSelection | null;
  initialCatalogTitle?: TitleSearchItem | null;
  highlightedStatus?: Status | null;
  dialogLayout?: boolean;
  onStageChange?: (stage: "search" | "status" | "saved" | "edit") => void;
  onDone?: () => void;
}) {
  const locale = useLocale();
  const tQuick = useTranslations("QuickLogCard");
  const tBookshelf = useTranslations("Bookshelf");
  const tCommon = useTranslations("Common");
  const tStatus = useTranslations("Status");
  const [contentType, setContentType] = useState<"video" | "book">(
    initialContentType,
  );
  const contentTypeRef = useRef(contentType);
  contentTypeRef.current = contentType;
  const [selected, setSelected] = useState<TitleSearchItem | null>(null);
  const [status, setStatus] = useState<Status>("IN_PROGRESS");
  const [pendingStatus, setPendingStatus] = useState<Status | null>(
    highlightedStatus ?? null,
  );
  const [rating, setRating] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [ott, setOtt] = useState("");
  const [ottSelect, setOttSelect] = useState<string>("");
  const [customOttOptions, setCustomOttOptions] = useState<string[]>([]);
  const [place, setPlace] = useState<Place | "">("");
  const [occasion, setOccasion] = useState<Occasion | "">("");
  const [watchedDate, setWatchedDate] = useState(() =>
    recordDateInput(new Date().toISOString()),
  );
  const [savedRecord, setSavedRecord] = useState<WatchLog | null>(null);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | "">("");
  const [selectedEpisode, setSelectedEpisode] = useState<number | "">("");
  const [seasonPosterUrl, setSeasonPosterUrl] = useState<string | null>(null);
  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const [shareToDiscussion, setShareToDiscussion] = useState(false);
  const [shareCard, setShareCard] = useState(false);
  const [pendingShare, setPendingShare] = useState<WatchLog | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localLogId, setLocalLogId] = useState<string | null>(null);
  const [localTitleId, setLocalTitleId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{
    visible: boolean;
    count: number;
    bookshelf: boolean;
    shelfMajor?: KdcMajor | null;
  } | null>(null);

  const isBookMode = selected
    ? selected.type === "book"
    : contentType === "book";
  const selectedDisplayYear = selected
    ? recordDisplayYear(selected, {
        seasonNumber: selectedSeason === "" ? null : selectedSeason,
        seasonYear,
      })
    : null;
  const copy = (ko: string, en: string) => (locale === "ko" ? ko : en);
  const stage = !selected
    ? "search"
    : !localLogId
      ? "status"
      : editing
        ? "edit"
        : "saved";
  useEffect(() => {
    onStageChange?.(stage);
  }, [stage, onStageChange]);

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
  const statusOptions = useMemo(
    () => statusOptionsForType(isBookMode ? "book" : "movie", tStatus),
    [isBookMode, tStatus],
  );
  const placeOptions = useMemo(
    () => placeOptionsForType(isBookMode ? "book" : "movie", tCommon),
    [isBookMode, tCommon],
  );

  const platformGroups = isBookMode ? bookPlatformGroups : videoPlatformGroups;
  const platformCustomKey = isBookMode ? BOOK_CUSTOM_KEY : VIDEO_CUSTOM_KEY;
  const selectedProvider = selected?.provider;
  const selectedProviderId = selected?.providerId;
  const selectedType = selected?.type;
  const selectedHasGenres = Boolean(selected?.genres);
  const selectedLocalTitleId =
    selected?.provider === "LOCAL" ? selected.titleId : null;
  const handleTitleSearchComplete = useCallback(
    (result: {
      contentType: "video" | "book";
      queryLength: number;
      resultCount: number;
      success: boolean;
    }) => {
      void trackEvent("title_search", {
        contentType: result.contentType,
        queryLength: result.queryLength,
        resultCount: result.resultCount,
        success: result.success,
      });
    },
    [],
  );
  const handleTitleSelectAnalytics = useCallback(
    (result: {
      item: TitleSearchItem;
      contentType: "video" | "book";
      source: TitleSelectSource;
      queryLength: number;
      resultRank?: number;
    }) => {
      void trackEvent("title_select", {
        contentType: result.contentType,
        titleType: result.item.type,
        provider: result.item.provider,
        source: result.source,
        queryLength: result.queryLength,
        resultRank: result.resultRank ?? null,
      });
    },
    [],
  );

  const clearSelectedTitleState = useCallback(() => {
    setSelected(null);
    setPendingStatus(null);
    setSavedRecord(null);
    setEditing(false);
    setSaveError(null);
    setPendingShare(null);
    setLocalLogId(null);
    setLocalTitleId(null);
    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason("");
    setSelectedEpisode("");
    setSeasonPosterUrl(null);
    setSeasonYear(null);
  }, []);

  useEffect(() => {
    const item = activationTitleSelection?.item ?? initialCatalogTitle;
    if (!item) return;
    const nextContentType = item.type === "book" ? "book" : "video";

    clearSelectedTitleState();
    setContentType(nextContentType);
    setSelected(item);
    setPendingStatus(highlightedStatus ?? null);
    if (activationTitleSelection) {
      handleTitleSelectAnalytics({
        item,
        contentType: nextContentType,
        source: activationTitleSelection.source,
        queryLength: 0,
      });
    } else {
      void trackEvent("title_select", {
        contentType: nextContentType,
        titleType: item.type,
        provider: item.provider,
        source: "future_recommendation",
        queryLength: 0,
      });
    }
  }, [
    activationTitleSelection,
    initialCatalogTitle,
    highlightedStatus,
    clearSelectedTitleState,
    handleTitleSelectAnalytics,
  ]);

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
            overview: title.overview ?? prev.overview,
            author: title.author ?? prev.author,
            publisher: title.publisher ?? prev.publisher,
            isbn10: title.isbn10 ?? prev.isbn10,
            isbn13: title.isbn13 ?? prev.isbn13,
            pubdate: title.pubdate ?? prev.pubdate,
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
    if (
      selectedHasGenres ||
      selectedProvider !== "TMDB" ||
      !selectedProviderId ||
      !selectedType
    )
      return;
    let cancelled = false;
    (async () => {
      try {
        const details = await api<Pick<Title, "genres" | "directors" | "cast">>(
          `/tmdb/${selectedType}/${selectedProviderId}`,
        );
        if (cancelled) return;
        setSelected((prev) => {
          if (!prev || prev.providerId !== selectedProviderId) return prev;
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
  }, [selectedProvider, selectedProviderId, selectedType, selectedHasGenres]);

  useEffect(() => {
    setCustomOttOptions(loadCustomOptions(platformCustomKey));
  }, [platformCustomKey]);

  useEffect(() => {
    // Parent echoes this type after selection; that must not clear the chosen title.
    if (contentTypeRef.current === initialContentType) return;
    setContentType(initialContentType);
    setSelected(null);
    setPendingStatus(null);
    setSavedRecord(null);
    setEditing(false);
    setSaveError(null);
    setPendingShare(null);
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
      if (selectedType !== "series") return;
      if (!selectedProviderId || selectedProvider === "LOCAL") return;
      setSeasonLoading(true);
      setSeasonError(null);
      try {
        const res = await api<SeasonOption[]>(
          `/tmdb/tv/${selectedProviderId}/seasons`,
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

    if (selectedType === "series") {
      loadSeasons();
    }

    return () => {
      cancelled = true;
    };
  }, [selectedProvider, selectedProviderId, selectedType]);

  useEffect(() => {
    let cancelled = false;
    async function loadEpisodes() {
      if (selectedType !== "series") return;
      if (selectedSeason === "") return;
      if (!selectedProviderId || selectedProvider === "LOCAL") return;
      setEpisodeLoading(true);
      try {
        const res = await api<EpisodeOption[]>(
          `/tmdb/tv/${selectedProviderId}/seasons/${selectedSeason}`,
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
  }, [
    selectedProvider,
    selectedProviderId,
    selectedType,
    selectedSeason,
    seasons,
  ]);

  async function refreshSavedRecord(record: WatchLog) {
    const current = (await resolveLogLocal(record.id, record.title)) ?? record;
    setLocalLogId(current.id);
    setLocalTitleId(current.title.id);
    setSavedRecord(current);
    return current;
  }

  async function synchronizeSavedRecord(record: WatchLog) {
    // A kept local record remains valid even when the network cannot sync it yet.
    await syncOutbox().catch(() => undefined);
    return refreshSavedRecord(record);
  }

  async function shareSavedRecord(record: WatchLog) {
    setPendingShare(record);
    setSaveError(null);
    try {
      // Publishing requires the pull that resolves server IDs to finish too.
      await syncOutbox();
      const current = await refreshSavedRecord(record);
      const outbox = await listOutbox();
      const hasPendingChanges = outbox.some((item) => {
        const id = item.type === "create_log" ? item.localLogId : item.logId;
        return id === record.id || id === current.id;
      });
      if (
        !navigator.onLine ||
        current.syncStatus !== "synced" ||
        hasPendingChanges
      ) {
        setSaveError(
          copy(
            "기록은 이 기기에 보관했어요. 연결된 뒤 함께 나누기를 다시 눌러주세요.",
            "Your record is kept on this device. Try sharing again when connected.",
          ),
        );
        return false;
      }

      const discussion = await api<Discussion>("/discussions", {
        method: "POST",
        body: JSON.stringify({ titleId: current.title.id }),
      });
      if (record.note?.trim()) {
        const request: CreateCommentRequest = {
          body: record.note.trim(),
          mentions: [],
          syncLog: false,
        };
        await apiWithAuth<Comment>(`/discussions/${discussion.id}/comments`, {
          method: "POST",
          body: JSON.stringify(request),
        });
      }
      setPendingShare(null);
      setShareToDiscussion(false);
      window.dispatchEvent(new CustomEvent("sync:updated"));
      if (shareCard) {
        onCreated(current, { shareCard: true });
        onDone?.();
      }
      setShareCard(false);
      return true;
    } catch {
      setSaveError(
        copy(
          "기록은 보관했지만 함께 나누지 못했어요. 잠시 뒤 다시 눌러주세요.",
          "Your record is kept, but sharing to Together failed. Please try again in a moment.",
        ),
      );
      return false;
    }
  }

  async function retrySharing() {
    if (!pendingShare || saving) return;
    setSaving(true);
    try {
      await shareSavedRecord(pendingShare);
    } finally {
      setSaving(false);
    }
  }

  async function handleInitialSave(clickedStatus: Status) {
    if (!selected || saving || !watchedDate) return;
    setSaveError(null);
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const existingTitle = selected.titleId
        ? null
        : await findTitleByProvider(
            selected.provider,
            selected.providerId,
            selected,
          );
      const logCountBeforeSave = await countLogsLocal();
      const newLocalTitleId =
        selected.titleId ?? existingTitle?.id ?? safeUUID();
      const newLocalLogId = safeUUID();

      const pickedWatchedAt = editedRecordDate(now, watchedDate);

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
        ott: ott.trim() || null,
        seasonNumber: selectedSeason === "" ? null : selectedSeason,
        episodeNumber: selectedEpisode === "" ? null : selectedEpisode,
        seasonPosterUrl,
        seasonYear,
        origin: "LOG",
        spoiler: false,
        watchedAt: pickedWatchedAt,
        createdAt: now,
        place: place || null,
        occasion: occasion || null,
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
            ott: ott.trim() || null,
            seasonNumber: selectedSeason === "" ? null : selectedSeason,
            episodeNumber: selectedEpisode === "" ? null : selectedEpisode,
            seasonPosterUrl,
            seasonYear,
            origin: "LOG",
            spoiler: false,
            watchedAt: pickedWatchedAt,
            place: place || null,
            occasion: occasion || null,
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
      setLocalTitleId(newLocalTitleId);
      setLocalLogId(newLocalLogId);
      setStatus(clickedStatus);
      setSavedRecord(localLog);
      setWatchedDate(recordDateInput(localLog.watchedAt));
      setEditing(false);
      const logCreateProperties = {
        entryPoint: "quick_log",
        titleType: selected.type,
        status: clickedStatus,
        hasRating: false,
        hasNote: false,
        hasOtt: false,
        isFirstLog: logCountBeforeSave === 0,
      };
      await trackEvent("log_create", logCreateProperties);
      if (logCountBeforeSave === 0) {
        await trackEvent("first_log_create", logCreateProperties);
      }
      const curatedAttribution = readCuratedAttribution();
      if (curatedAttribution?.titleId === newLocalTitleId) {
        await trackEvent("curated_human_action", {
          curatedContentId: curatedAttribution.curatedContentId,
          titleId: newLocalTitleId,
          actorType: "ai_curator",
          contentOrigin: "ai_curator",
          action: "log_create",
          entryPoint: "quick_log",
        });
        clearCuratedAttribution();
      }
      onCreated(localLog);
      const bookshelfEnabled = isKdcBookshelfLocale(locale);
      const classificationPromise =
        bookshelfEnabled && localLog.title.type === "book"
          ? resolveTitleClassification(localLog.title).catch(() => null)
          : null;
      await synchronizeSavedRecord(localLog);

      const totalCount = await countLogsLocal();
      setBanner({
        visible: true,
        count: totalCount,
        bookshelf: bookshelfEnabled && localLog.title.type === "book",
        shelfMajor: null,
      });
      if (classificationPromise) {
        void classificationPromise.then((classification) => {
          if (
            classification?.status !== "RESOLVED" ||
            typeof classification.kdcMajor !== "number"
          ) {
            return;
          }
          setBanner((current) =>
            current?.visible && current.bookshelf
              ? {
                  ...current,
                  shelfMajor: classification.kdcMajor as KdcMajor,
                }
              : current,
          );
        });
      }
      window.setTimeout(() => setBanner(null), 3000);
    } catch (error) {
      setSaveError(
        errorMessage(
          error,
          copy(
            "기록을 보관하지 못했어요. 다시 시도해 주세요.",
            "Your record could not be kept. Please try again.",
          ),
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSave() {
    if (!selected || !savedRecord || !localLogId || !localTitleId || saving)
      return;
    setSaveError(null);
    setSaving(true);
    try {
      const current = await synchronizeSavedRecord(savedRecord);
      const currentLogId = current.id;
      const currentTitleId = current.title.id;
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

      const pickedWatchedAt = editedRecordDate(
        current.watchedAt || now,
        watchedDate,
      );

      const updatedLog: WatchLog = {
        id: currentLogId,
        title: {
          ...current.title,
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
        createdAt: current.createdAt || now,
        place: place === "" ? null : place,
        occasion: occasion === "" ? null : occasion,
        syncStatus: "pending",
        updatedAt: now,
      };

      await upsertLogLocal(updatedLog);
      const payload = {
        id: currentLogId,
        op: "upsert",
        updatedAt: now,
        payload: {
          titleId: currentTitleId,
          status,
          rating: updatedLog.rating,
          note: updatedLog.note,
          ott: updatedLog.ott,
          seasonNumber: updatedLog.seasonNumber,
          episodeNumber: updatedLog.episodeNumber,
          seasonPosterUrl: updatedLog.seasonPosterUrl,
          seasonYear: updatedLog.seasonYear,
          origin: "LOG",
          spoiler: false,
          watchedAt: pickedWatchedAt,
          place: updatedLog.place,
          occasion: updatedLog.occasion,
        },
      };
      const merged = await updatePendingCreatePayload(currentLogId, payload);
      if (!merged) await enqueueUpdateLog(currentLogId, payload);
      await upsertHistoryLocal([
        {
          id: safeUUID(),
          logId: currentLogId,
          recordedAt: now,
          status: updatedLog.status,
          rating: updatedLog.rating,
          note: updatedLog.note,
          ott: updatedLog.ott,
          seasonNumber: updatedLog.seasonNumber,
          episodeNumber: updatedLog.episodeNumber,
          seasonPosterUrl: updatedLog.seasonPosterUrl,
          seasonYear: updatedLog.seasonYear,
          origin: updatedLog.origin,
          spoiler: updatedLog.spoiler,
          watchedAt: updatedLog.watchedAt,
          place: updatedLog.place,
          occasion: updatedLog.occasion,
        },
      ]);
      setSavedRecord(updatedLog);
      setEditing(false);
      onCreated(updatedLog);

      if (shareToDiscussion) {
        await shareSavedRecord(updatedLog);
      } else {
        const synced = await synchronizeSavedRecord(updatedLog);
        setPendingShare(null);
        if (shareCard) {
          onCreated(synced, { shareCard: true });
          onDone?.();
        }
        setShareCard(false);
      }
    } catch (error) {
      setSaveError(
        errorMessage(
          error,
          copy(
            "기록을 보관하지 못했어요. 다시 시도해 주세요.",
            "Your record could not be kept. Please try again.",
          ),
        ),
      );
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
    setWatchedDate(recordDateInput(new Date().toISOString()));
    setShareCard(false);
    setShareToDiscussion(false);
  }

  function cancelEdit() {
    if (savedRecord) {
      setStatus(savedRecord.status);
      setRating(savedRecord.rating ?? "");
      setNote(savedRecord.note ?? "");
      setOtt(savedRecord.ott ?? "");
      setOttSelect(
        resolvePlatformSelect(
          savedRecord.ott ?? "",
          allOttOptions,
          platformGroups,
        ),
      );
      setPlace(savedRecord.place ?? "");
      setOccasion(savedRecord.occasion ?? "");
      setWatchedDate(recordDateInput(savedRecord.watchedAt));
      setSelectedSeason(savedRecord.seasonNumber ?? "");
      setSelectedEpisode(savedRecord.episodeNumber ?? "");
      setSeasonPosterUrl(savedRecord.seasonPosterUrl ?? null);
      setSeasonYear(savedRecord.seasonYear ?? null);
    }
    setShareCard(false);
    setShareToDiscussion(false);
    setEditing(false);
  }

  const contextFields = (
    <div className={styles.contextGrid}>
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
          aria-describedby="record-date-hint"
        />
        <small id="record-date-hint">
          {copy(
            isBookMode ? "읽은 날을 골라주세요." : "본 날을 골라주세요.",
            isBookMode
              ? "Choose the day you read it."
              : "Choose the day you watched it.",
          )}
        </small>
      </label>
      <label className={styles.field}>
        <span>
          <MonitorPlay size={16} />
          {isBookMode
            ? copy("읽은 곳·플랫폼", "Where you got or read it")
            : tQuick("detailPlatform")}
        </span>
        <select
          data-testid="record-platform"
          value={ottSelect}
          onChange={(event) => {
            setOttSelect(event.target.value);
            setOtt(
              event.target.value === OTT_CUSTOM_VALUE ? "" : event.target.value,
            );
          }}
        >
          <option value="">{tCommon("none")}</option>
          {platformGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </optgroup>
          ))}
          {customOttOptions.length ? (
            <optgroup label={tQuick("myInput")}>
              {customOttOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </optgroup>
          ) : null}
          <option value={OTT_CUSTOM_VALUE}>{tQuick("customInput")}</option>
        </select>
        {ottSelect === OTT_CUSTOM_VALUE ? (
          <input
            data-testid="record-platform-custom"
            value={ott}
            onChange={(event) => setOtt(event.target.value)}
            placeholder={tQuick("customInputPlaceholder")}
            aria-label={tQuick("customInput")}
          />
        ) : null}
      </label>
      <label className={styles.field}>
        <span>
          <MapPin size={16} />
          {tQuick("detailPlace")}
        </span>
        <select
          data-testid="record-place"
          value={place}
          onChange={(event) => setPlace(event.target.value as Place | "")}
        >
          <option value="">{tCommon("none")}</option>
          {placeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>
          <Users size={16} />
          {copy("누구와·어떤 상황", "Who you were with or the occasion")}
        </span>
        <select
          data-testid="record-occasion"
          value={occasion}
          onChange={(event) => setOccasion(event.target.value as Occasion | "")}
        >
          <option value="">{tCommon("none")}</option>
          {occasionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {selected?.type === "series" ? (
        <>
          <label className={styles.field}>
            <span>{tQuick("seasonLabel")}</span>
            <select
              data-testid="record-season"
              value={selectedSeason}
              onChange={(event) => {
                setSelectedSeason(
                  event.target.value ? Number(event.target.value) : "",
                );
                setSelectedEpisode("");
              }}
              disabled={seasonLoading}
            >
              <option value="">{tCommon("none")}</option>
              {seasons.map((season) => (
                <option key={season.seasonNumber} value={season.seasonNumber}>
                  {tQuick("seasonValue", { number: season.seasonNumber })}
                  {season.name ? ` · ${season.name}` : ""}
                </option>
              ))}
            </select>
            {seasonLoading ? <small>{tQuick("loadingSeasons")}</small> : null}
            {seasonError ? <small>{seasonError}</small> : null}
          </label>
          <label className={styles.field}>
            <span>{tQuick("episodeLabel")}</span>
            <select
              data-testid="record-episode"
              value={selectedEpisode}
              onChange={(event) =>
                setSelectedEpisode(
                  event.target.value ? Number(event.target.value) : "",
                )
              }
              disabled={selectedSeason === "" || episodeLoading}
            >
              <option value="">{tCommon("none")}</option>
              {episodes.map((episode) => (
                <option
                  key={episode.episodeNumber}
                  value={episode.episodeNumber}
                >
                  {copy(
                    `${episode.episodeNumber}화`,
                    `Episode ${episode.episodeNumber}`,
                  )}
                  {episode.name ? ` · ${episode.name}` : ""}
                </option>
              ))}
            </select>
            {episodeLoading ? <small>{tQuick("loadingEpisodes")}</small> : null}
          </label>
        </>
      ) : null}
    </div>
  );

  return (
    <section
      className={styles.card}
      data-stage={stage}
      data-record-layout={dialogLayout ? "dialog" : "inline"}
    >
      <div
        className={styles.cardBody}
        data-testid={editing ? "record-edit-body" : undefined}
      >
        {!selected ? (
          <>
            {shareImportStatus ? (
              <div className={styles.notice}>
                <strong>
                  {shareImportStatus === "imported"
                    ? tQuick("shareImportTitle")
                    : tQuick("shareImportUnresolvedTitle")}
                </strong>
                <p>
                  {shareImportStatus === "imported"
                    ? tQuick("shareImportDesc")
                    : tQuick("shareImportUnresolvedDesc")}
                </p>
                {shareImportFeedbackHref ? (
                  <Link href={shareImportFeedbackHref}>
                    {tQuick("shareImportFeedbackAction")}
                  </Link>
                ) : null}
              </div>
            ) : null}
            <TitleSearchBox
              dialogLayout={dialogLayout}
              onSelect={(item) => {
                setSelected(item);
                setPendingStatus(highlightedStatus ?? null);
                setContentType(item.type === "book" ? "book" : "video");
              }}
              onSearchComplete={handleTitleSearchComplete}
              onSelectAnalytics={handleTitleSelectAnalytics}
              contentType={contentType}
              onContentTypeChange={setContentType}
              initialQuery={initialSearchQuery}
              autoFocus={autoFocusSearch}
              focusSignal={searchFocusSignal}
              showRecentDiscussions
            />
          </>
        ) : (
          <>
            <div className={styles.titleSummary} data-book={isBookMode}>
              {seasonPosterUrl || selected.posterUrl ? (
                <img
                  src={
                    tmdbResize(
                      seasonPosterUrl || selected.posterUrl || "",
                      "w342",
                    ) ||
                    seasonPosterUrl ||
                    selected.posterUrl ||
                    ""
                  }
                  alt={selected.name}
                  width={88}
                  height={132}
                />
              ) : null}
              <div>
                <h3>{selected.name}</h3>
                <p>
                  {titleTypeLabel(selected.type, tQuick)}
                  {isBookMode
                    ? bookMeta(selected)
                      ? ` · ${bookMeta(selected)}`
                      : ""
                    : selectedDisplayYear
                      ? ` · ${selectedDisplayYear}`
                      : ""}
                </p>
                {selectedSeason !== "" ? (
                  <p>
                    {tQuick("seasonValue", { number: selectedSeason })}
                    {selectedEpisode !== ""
                      ? copy(
                          ` · ${selectedEpisode}화`,
                          ` · Episode ${selectedEpisode}`,
                        )
                      : ""}
                  </p>
                ) : null}
              </div>
              {!localLogId ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className={styles.close}
                  aria-label={copy("다른 작품 찾기", "Choose another title")}
                >
                  <X size={20} />
                </button>
              ) : null}
            </div>
            {googleBooksUrl(selected) ? (
              <GoogleBooksAttribution href={googleBooksUrl(selected)!} />
            ) : null}
            {saveError ? (
              <p className={styles.error} role="alert">
                {saveError}
              </p>
            ) : null}
            {pendingShare && !editing ? (
              <div className={styles.actions}>
                <button
                  type="button"
                  data-testid="record-retry-sharing"
                  className={styles.secondary}
                  disabled={saving}
                  onClick={() => void retrySharing()}
                >
                  {saving
                    ? copy("함께 나누는 중…", "Sharing…")
                    : copy("함께 나누기 다시 시도", "Try sharing again")}
                </button>
              </div>
            ) : null}
            {!localLogId ? (
              <>
                <p className={styles.hint}>{tQuick("statusPrompt")}</p>
                <div
                  className={styles.statusChoices}
                  data-onboarding-target="status-save"
                >
                  {(["DONE", "IN_PROGRESS", "WISHLIST"] as Status[]).map(
                    (value) => (
                      <button
                        key={value}
                        data-testid={`record-status-${value}`}
                        type="button"
                        disabled={saving}
                        onClick={() => setPendingStatus(value)}
                        aria-pressed={pendingStatus === value}
                      >
                        {
                          statusOptions.find((option) => option.value === value)
                            ?.label
                        }
                      </button>
                    ),
                  )}
                </div>
                <p className={styles.hint}>
                  {copy(
                    "상태를 고른 뒤 아래의 ‘기록 남기기’를 눌러요. 그날의 순간은 원할 때만 더해요.",
                    "Choose a status, then tap ‘Keep this record’ below. Add the moment only if you like.",
                  )}
                </p>
                <details className={styles.context}>
                  <summary>
                    {copy("그날의 순간 (선택)", "The moment (optional)")}
                  </summary>
                  {contextFields}
                </details>
              </>
            ) : !editing ? (
              <div className={styles.confirmation}>
                <Check size={32} aria-hidden="true" />
                <h3>
                  {copy("타임라인에 남겨두었어요.", "Kept on your timeline.")}
                </h3>
                <p>
                  {copy(
                    "더 남기고 싶을 때 그날의 순간과 메모를 더해요.",
                    "Add the moment and a note whenever you want.",
                  )}
                </p>
                <p className={styles.hint}>
                  {copy(
                    "이 기기에 보관했어요. 연결되면 다른 기기에도 이어져요.",
                    "Kept on this device. It will sync when connected.",
                  )}
                </p>
                {banner?.bookshelf ? (
                  <p className={styles.hint}>
                    {banner.shelfMajor == null
                      ? tBookshelf("findingShelf")
                      : tBookshelf("shelvedIn", {
                          category: tBookshelf(
                            `categories.${banner.shelfMajor}`,
                          ),
                        })}
                  </p>
                ) : null}
                {savedRecord ? (
                  <SavedDiscussionLink
                    record={savedRecord}
                    sourceTitle={selected}
                    onOpen={onDone}
                  />
                ) : null}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondary}
                    data-testid="record-edit-details"
                    onClick={() => setEditing(true)}
                  >
                    {copy("그날의 순간·메모 더하기", "Add to this moment")}
                  </button>
                  <button
                    type="button"
                    className={styles.primary}
                    data-testid="record-done"
                    onClick={() => {
                      if (onDone) onDone();
                      else handleCancel();
                    }}
                  >
                    {copy("완료", "Done")}
                  </button>
                </div>
                <div className={styles.actions}>
                  <IntlLink
                    href="/timeline"
                    className={styles.quiet}
                    onClick={onDone}
                  >
                    {copy("타임라인에서 보기", "View my timeline")}
                    <ArrowRight size={16} />
                  </IntlLink>
                  {savedRecord ? (
                    <button
                      type="button"
                      className={styles.quiet}
                      onClick={() => {
                        onDone?.();
                        onCreated(savedRecord, { shareCard: true });
                      }}
                    >
                      <Share2 size={16} />
                      {copy("공유 카드 만들기", "Create a share card")}
                    </button>
                  ) : null}
                </div>
                <SavedAndroidPlayCta recordId={localLogId} />
              </div>
            ) : (
              <>
                <label className={styles.field}>
                  <span>
                    <Clock size={16} />
                    {tQuick("detailStatus")}
                  </span>
                  <select
                    data-testid="record-edit-status"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as Status)
                    }
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <section className={styles.context}>
                  <h3>{copy("그날의 순간", "The moment")}</h3>
                  {contextFields}
                </section>
                <RecordFeelings
                  value={rating}
                  type={selected.type}
                  onChange={setRating}
                />
                <label className={styles.field}>
                  <span>
                    <MessageSquare size={16} />
                    {tQuick("detailNote")}
                  </span>
                  <textarea
                    data-testid="record-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={tQuick("notePlaceholder")}
                    rows={4}
                  />
                </label>
                <div className={styles.shareChoices}>
                  <label>
                    <input
                      type="checkbox"
                      checked={shareToDiscussion}
                      onChange={(event) =>
                        setShareToDiscussion(event.target.checked)
                      }
                    />
                    {tQuick("shareToPublic")}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={shareCard}
                      onChange={(event) => setShareCard(event.target.checked)}
                    />
                    {tQuick("createShareCard")}
                  </label>
                </div>
                {shareToDiscussion ? (
                  <p className={styles.hint}>
                    {copy(
                      "작품과 메모를 다른 사람들도 볼 수 있어요. 날짜·장소·상황은 공개되지 않아요.",
                      "Your title and note will be public. Date, place and occasion stay private.",
                    )}
                  </p>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
      {selected && !localLogId ? (
        <div className={styles.saveFooter} data-testid="record-initial-footer">
          <p className={styles.hint} aria-live="polite">
            {pendingStatus
              ? statusOptions.find((option) => option.value === pendingStatus)
                  ?.label
              : copy("상태를 골라주세요.", "Choose a status.")}
          </p>
          <button
            type="button"
            data-testid="record-save-initial"
            disabled={!canSave || !pendingStatus || !watchedDate}
            className={styles.primary}
            onClick={() => {
              if (pendingStatus) void handleInitialSave(pendingStatus);
            }}
          >
            {saving
              ? tQuick("saving")
              : copy("기록 남기기", "Keep this record")}
          </button>
        </div>
      ) : null}
      {selected && localLogId && editing ? (
        <div
          className={`${styles.actions} ${styles.saveFooter}`}
          data-testid="record-edit-footer"
        >
          <button
            type="button"
            disabled={saving}
            className={styles.secondary}
            onClick={cancelEdit}
          >
            {copy("나중에 더할게요", "Maybe later")}
          </button>
          <button
            type="button"
            data-testid="record-save-details"
            disabled={!canSave || !watchedDate}
            className={styles.primary}
            onClick={() => void handleUpdateSave()}
          >
            {saving
              ? tQuick("saving")
              : copy("이 순간 보관하기", "Keep this moment")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
