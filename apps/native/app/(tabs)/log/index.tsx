import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ViewShot, { releaseCapture } from 'react-native-view-shot';
import { LogShareCard, logShareCardCaptureSize } from '../../../components/LogShareCard';
import { NativeSelect } from '../../../components/NativeSelect';
import { SwipeableTabScreen } from '../../../components/SwipeableTabScreen';
import type { ThemeColors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import {
  createComment,
  createDiscussion,
  getTmdbDetails,
  getUserProfile,
  listDiscussions,
  listTvEpisodes,
  listTvSeasons,
  popularTitles,
  searchTitles,
  trackEvent,
} from '../../../lib/api';
import {
  inputDateToIso,
  seasonEpisodeLabel,
  statusLabel,
  todayInputValue,
  typeLabel,
} from '../../../lib/format';
import { uuid } from '../../../lib/id';
import {
  countLogsLocal,
  enqueueLogOutbox,
  enqueueUpdateLogOutbox,
  upsertHistoryLocal,
  upsertLogLocal,
} from '../../../lib/localDb';
import { syncNow } from '../../../lib/sync';
import { buildOutboxPayload, buildUpdateLogPayload } from '../../../lib/syncPayload';
import { logShareCardFileName } from '../../../lib/shareCard';
import { avatarUri } from '../../../lib/avatar';
import {
  accountCopy,
  logCopy,
  occasionLabels,
  placeLabels,
  type NativeLocale,
} from '../../../lib/i18n';
import { useNativePreferences } from '../../../lib/nativePreferences';
import type {
  Occasion,
  PersonaKey,
  Place,
  Status,
  DiscussionListItem,
  Title,
  TitleSearchItem,
  TmdbEpisode,
  TmdbSeason,
  UserProfile,
  WatchLog,
  WatchLogHistory,
} from '../../../lib/types';

type ContentFilter = 'video' | 'book';
type TitleSelectSource = 'search' | 'recent_discussion' | 'popular_title';
type AccountCopy = (typeof accountCopy)[NativeLocale];

const FILTER_VALUES: ContentFilter[] = ['video', 'book'];
const STATUSES: Status[] = ['DONE', 'IN_PROGRESS', 'WISHLIST'];
const TITLE_SUGGESTION_LIMIT = 6;

const PLACE_VALUES: Place[] = ['HOME', 'THEATER', 'CAFE', 'TRANSIT', 'LIBRARY', 'BOOKSTORE'];
const OCCASION_VALUES: Occasion[] = ['ALONE', 'FRIENDS', 'FAMILY', 'DATE', 'BREAK'];
const OTT_BASE_OPTIONS = ['Netflix', 'Disney+', 'TVING', 'Wavve', 'Watcha', 'Coupang Play'];
const RATING_VALUES = Array.from({ length: 10 }, (_, index) => (index + 1) / 2);

function titleFromSearch(item: TitleSearchItem, id: string): Title {
  return {
    id,
    type: item.type,
    name: item.name,
    year: item.year ?? null,
    posterUrl: item.posterUrl ?? null,
    overview: item.overview ?? null,
    author: item.author ?? null,
    publisher: item.publisher ?? null,
    isbn10: item.isbn10 ?? null,
    isbn13: item.isbn13 ?? null,
    pubdate: item.pubdate ?? null,
    genres: item.genres ?? null,
    directors: item.directors ?? null,
    cast: item.cast ?? null,
    provider: item.provider,
    providerId: item.providerId,
  };
}

function bookMeta(item: Pick<TitleSearchItem, 'author' | 'publisher' | 'year'>) {
  return [item.author, item.publisher, item.year ? String(item.year) : null].filter(Boolean).join(' · ');
}

function formatCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function personaLabel(value: PersonaKey | null | undefined, copy: AccountCopy) {
  switch (value) {
    case 'book_drifter':
      return copy.personaBookDrifter;
    case 'deep_watcher':
      return copy.personaDeepWatcher;
    case 'midnight_logger':
      return copy.personaMidnightLogger;
    case 'weekend_curator':
      return copy.personaWeekendCurator;
    case 'archive_collector':
      return copy.personaArchiveCollector;
    case 'cinema_keeper':
    default:
      return copy.personaCinemaKeeper;
  }
}

function searchItemKey(item: TitleSearchItem) {
  return `${item.provider}:${item.providerId}:${item.titleId ?? ''}`;
}

function titleFallbackKey(item: Pick<TitleSearchItem, 'type' | 'name' | 'year'>) {
  return `${item.type}:${item.name.trim().toLowerCase()}:${item.year ?? ''}`;
}

function providerFromDiscussion(item: DiscussionListItem): TitleSearchItem['provider'] {
  if (item.titleProvider === 'TMDB' || item.titleProvider === 'NAVER' || item.titleProvider === 'LOCAL') {
    return item.titleProvider;
  }
  return 'LOCAL';
}

function searchItemFromDiscussion(item: DiscussionListItem): TitleSearchItem {
  return {
    provider: providerFromDiscussion(item),
    providerId: item.titleProviderId ?? item.titleId,
    titleId: item.titleId,
    type: item.titleType,
    name: item.titleName,
    year: item.titleYear ?? null,
    posterUrl: item.posterUrl ?? null,
  };
}

function matchesFilter(item: Pick<TitleSearchItem, 'type'>, filter: ContentFilter) {
  return filter === 'book' ? item.type === 'book' : item.type !== 'book';
}

function selectPopularFillers(
  recent: TitleSearchItem[],
  trends: TitleSearchItem[],
  filter: ContentFilter,
  limit: number,
) {
  const providerKeys = new Set(
    recent.map((item) => `${item.provider}:${item.providerId}`),
  );
  const fallbackKeys = new Set(recent.map(titleFallbackKey));
  const selected: TitleSearchItem[] = [];

  for (const item of trends) {
    if (selected.length >= limit) break;
    if (!matchesFilter(item, filter)) continue;
    const providerKey = `${item.provider}:${item.providerId}`;
    const fallbackKey = titleFallbackKey(item);
    if (providerKeys.has(providerKey) || fallbackKeys.has(fallbackKey)) continue;
    providerKeys.add(providerKey);
    fallbackKeys.add(fallbackKey);
    selected.push(item);
  }

  return selected;
}

function historyFromLog(log: WatchLog, recordedAt: string): WatchLogHistory {
  return {
    id: uuid(),
    logId: log.id,
    recordedAt,
    status: log.status,
    rating: log.rating ?? null,
    note: log.note ?? null,
    spoiler: log.spoiler,
    ott: log.ott ?? null,
    seasonNumber: log.seasonNumber ?? null,
    episodeNumber: log.episodeNumber ?? null,
    seasonPosterUrl: log.seasonPosterUrl ?? null,
    seasonYear: log.seasonYear ?? null,
    origin: log.origin ?? 'LOG',
    watchedAt: log.watchedAt,
    place: log.place ?? null,
    occasion: log.occasion ?? null,
  };
}

export default function LogScreen() {
  const { colors, locale } = useNativePreferences();
  const copy = logCopy[locale];
  const accountText = accountCopy[locale];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ reset?: string | string[] }>();
  const resetToken = Array.isArray(params.reset) ? params.reset[0] : params.reset;
  const filters = useMemo(
    () =>
      FILTER_VALUES.map((value) => ({
        value,
        label: value === 'video' ? copy.tabVideo : copy.tabBook,
      })),
    [copy.tabBook, copy.tabVideo],
  );
  const statusOptions = useMemo(
    () =>
      STATUSES.map((value) => ({
        value,
        label: statusLabel(value, 'movie', locale),
      })),
    [locale],
  );
  const ratingOptions = useMemo(
    () =>
      RATING_VALUES.map((value) => ({
        value: String(value),
        label: `${value.toFixed(1)}/5`,
      })),
    [],
  );
  const places = useMemo(
    () => PLACE_VALUES.map((value) => ({ value, label: placeLabels[locale][value] })),
    [locale],
  );
  const occasions = useMemo(
    () => OCCASION_VALUES.map((value) => ({ value, label: occasionLabels[locale][value] })),
    [locale],
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ContentFilter>('video');
  const [results, setResults] = useState<TitleSearchItem[]>([]);
  const [popular, setPopular] = useState<TitleSearchItem[]>([]);
  const [suggestionSources, setSuggestionSources] = useState<Record<string, TitleSelectSource>>({});
  const [selected, setSelected] = useState<TitleSearchItem | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeLog, setActiveLog] = useState<WatchLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shareToDiscussion, setShareToDiscussion] = useState(false);
  const [shareCard, setShareCard] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareTargetLog, setShareTargetLog] = useState<WatchLog | null>(null);
  const [status, setStatus] = useState<Status>('DONE');
  const [rating, setRating] = useState('');
  const [note, setNote] = useState('');
  const [watchedAt, setWatchedAt] = useState(todayInputValue());
  const [place, setPlace] = useState<Place | null>(null);
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [ott, setOtt] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<TmdbSeason[]>([]);
  const [episodes, setEpisodes] = useState<TmdbEpisode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [seasonPosterUrl, setSeasonPosterUrl] = useState<string | null>(null);
  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareCardRef = useRef<ViewShot>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getUserProfile()
        .then((nextProfile) => {
          if (active) setProfile(nextProfile);
        })
        .catch(() => {
          if (active) setProfile(null);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const ottOptions = useMemo(() => {
    if (filter === 'book') {
      return [
        copy.platformBookstore,
        copy.platformLibrary,
        copy.platformKyobo,
        copy.platformYes24,
        copy.platformAladin,
        copy.platformRidi,
        copy.platformMillie,
        copy.platformWilla,
      ];
    }
    return [...OTT_BASE_OPTIONS, copy.platformTheater];
  }, [
    copy.platformAladin,
    copy.platformBookstore,
    copy.platformKyobo,
    copy.platformLibrary,
    copy.platformMillie,
    copy.platformRidi,
    copy.platformTheater,
    copy.platformWilla,
    copy.platformYes24,
    filter,
  ]);
  const statusOptionsForSelect = useMemo(
    () =>
      statusOptions.map((item) => ({
        ...item,
        label: statusLabel(item.value, selected?.type ?? 'movie', locale),
      })),
    [locale, selected?.type, statusOptions],
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) {
      setResults([]);
      timer.current = setTimeout(async () => {
        setLoading(true);
        try {
          const discussions = await listDiscussions('latest', TITLE_SUGGESTION_LIMIT, 14);
          const recent = discussions
            .map(searchItemFromDiscussion)
            .filter((item) => matchesFilter(item, filter))
            .slice(0, TITLE_SUGGESTION_LIMIT);
          const nextSources: Record<string, TitleSelectSource> = Object.fromEntries(
            recent.map((item) => [searchItemKey(item), 'recent_discussion' as const]),
          );
          const missingCount = Math.max(0, TITLE_SUGGESTION_LIMIT - recent.length);

          if (filter !== 'book' && missingCount > 0) {
            const trends = await popularTitles(TITLE_SUGGESTION_LIMIT * 2).catch(() => []);
            const fillers = selectPopularFillers(recent, trends, filter, missingCount);
            fillers.forEach((item) => {
              nextSources[searchItemKey(item)] = 'popular_title';
            });
            setPopular([...recent, ...fillers]);
          } else {
            setPopular(recent);
          }
          setSuggestionSources(nextSources);
        } catch {
          setPopular([]);
          setSuggestionSources({});
        } finally {
          setLoading(false);
        }
      }, 150);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const searchType = filter === 'book' ? 'book' : 'ALL';
        const items = await searchTitles(query.trim(), searchType);
        const filteredItems = items.filter((item) => matchesFilter(item, filter));
        setResults(filteredItems.slice(0, 20));
        setPopular([]);
        setSuggestionSources({});
        trackEvent({
          eventName: 'title_search',
          properties: {
            source: 'ios_native_log',
            queryLength: query.trim().length,
            mediaType: filter,
            resultCount: filteredItems.length,
          },
        }).catch(() => null);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [query, filter]);

  useEffect(() => {
    if (!selected || selected.type === 'book' || selected.provider !== 'TMDB' || selected.genres) return;
    let cancelled = false;
    const selectedType = selected.type;
    const providerId = selected.providerId;

    getTmdbDetails(selectedType, providerId)
      .then((details) => {
        if (cancelled) return;
        setSelected((current) => {
          if (!current || current.provider !== 'TMDB' || current.providerId !== providerId) return current;
          return {
            ...current,
            name: details.name ?? current.name,
            year: details.year ?? current.year,
            overview: details.overview ?? current.overview,
            posterUrl: details.posterUrl ?? current.posterUrl,
            genres: details.genres ?? current.genres ?? null,
            directors: details.directors ?? current.directors ?? null,
            cast: details.cast ?? current.cast ?? null,
          };
        });
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [selected?.genres, selected?.provider, selected?.providerId, selected?.type]);

  useEffect(() => {
    let cancelled = false;

    async function loadSeasons() {
      if (!selected || selected.type !== 'series' || !selected.providerId || selected.provider === 'LOCAL') return;
      setSeasonLoading(true);
      setSeasonError(null);
      try {
        const items = await listTvSeasons(selected.providerId);
        if (!cancelled) setSeasons(items);
      } catch (error) {
        if (!cancelled) {
          setSeasons([]);
          setSeasonError(error instanceof Error ? error.message : copy.seasonLoadError);
        }
      } finally {
        if (!cancelled) setSeasonLoading(false);
      }
    }

    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason(null);
    setSelectedEpisode(null);
    setSeasonPosterUrl(null);
    setSeasonYear(null);
    setSeasonError(null);

    loadSeasons();

    return () => {
      cancelled = true;
    };
  }, [copy.seasonLoadError, selected]);

  useEffect(() => {
    let cancelled = false;

    async function loadEpisodes() {
      if (!selected || selected.type !== 'series' || !selected.providerId || selected.provider === 'LOCAL') return;
      if (typeof selectedSeason !== 'number') return;
      setEpisodeLoading(true);
      try {
        const items = await listTvEpisodes(selected.providerId, selectedSeason);
        if (!cancelled) setEpisodes(items);
      } catch {
        if (!cancelled) setEpisodes([]);
      } finally {
        if (!cancelled) setEpisodeLoading(false);
      }
    }

    setEpisodes([]);
    setSelectedEpisode(null);
    if (typeof selectedSeason === 'number') {
      const season = seasons.find((item) => item.seasonNumber === selectedSeason);
      setSeasonPosterUrl(season?.posterUrl ?? null);
      setSeasonYear(typeof season?.year === 'number' ? season.year : null);
      loadEpisodes();
    } else {
      setSeasonPosterUrl(null);
      setSeasonYear(null);
    }

    return () => {
      cancelled = true;
    };
  }, [selected, selectedSeason, seasons]);

  const ratingValue = useMemo(() => {
    const parsed = Number(rating);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.min(5, Math.max(0.5, parsed));
  }, [rating]);

  function resetForm() {
    setFilter('video');
    setSelected(null);
    setActiveLog(null);
    setQuery('');
    setResults([]);
    setStatus('DONE');
    setRating('');
    setNote('');
    setWatchedAt(todayInputValue());
    setPlace(null);
    setOccasion(null);
    setOtt(null);
    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason(null);
    setSelectedEpisode(null);
    setSeasonPosterUrl(null);
    setSeasonYear(null);
    setSeasonError(null);
    setShareToDiscussion(false);
    setShareCard(false);
    setMessage(null);
  }

  useEffect(() => {
    if (!resetToken) return;
    resetForm();
  }, [resetToken]);

  async function persistNewLog(nextStatus: Status, includeDetails: boolean) {
    if (!selected) return null;
    const now = new Date().toISOString();
    const isFirstLog = (await countLogsLocal()) === 0;
    const title = titleFromSearch(selected, selected.titleId ?? uuid());
    const log: WatchLog = {
      id: uuid(),
      title,
      status: nextStatus,
      rating: includeDetails ? ratingValue : null,
      note: includeDetails ? note.trim() || null : null,
      spoiler: false,
      ott: includeDetails ? ott : null,
      seasonNumber: includeDetails ? selectedSeason : null,
      episodeNumber: includeDetails ? selectedEpisode : null,
      seasonPosterUrl: includeDetails ? seasonPosterUrl : null,
      seasonYear: includeDetails ? seasonYear : null,
      origin: 'LOG',
      watchedAt: inputDateToIso(watchedAt),
      place: includeDetails ? place : null,
      occasion: includeDetails ? occasion : null,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    await upsertLogLocal(log);
    await enqueueLogOutbox(log, buildOutboxPayload(log, now));
    await syncNow({ registerIfNeeded: true }).catch(() => null);
    trackEvent({
      eventName: 'log_create',
      properties: {
        titleType: title.type,
        status: nextStatus,
        hasRating: includeDetails && ratingValue != null,
        hasNote: includeDetails && !!note.trim(),
        hasSeason: includeDetails && selectedSeason != null,
        hasEpisode: includeDetails && selectedEpisode != null,
        source: 'ios_native_log',
      },
    }).catch(() => null);
    if (isFirstLog) {
      trackEvent({
        eventName: 'first_log_create',
        properties: {
          titleType: title.type,
          source: 'ios_native_log',
        },
      }).catch(() => null);
    }
    setActiveLog(log);
    return log;
  }

  async function persistLogDetails(baseLog: WatchLog, nextStatus = status) {
    const now = new Date().toISOString();
    const updated: WatchLog = {
      ...baseLog,
      status: nextStatus,
      rating: ratingValue,
      note: note.trim() || null,
      ott,
      seasonNumber: selectedSeason,
      episodeNumber: selectedEpisode,
      seasonPosterUrl,
      seasonYear,
      watchedAt: inputDateToIso(watchedAt),
      place,
      occasion,
      updatedAt: now,
      syncStatus: 'pending',
    };

    const history = historyFromLog(updated, now);
    await upsertLogLocal(updated);
    await upsertHistoryLocal([history]);
    await enqueueUpdateLogOutbox(updated, buildUpdateLogPayload(updated, now));
    await syncNow({ registerIfNeeded: true }).catch(() => null);
    trackEvent({
      eventName: 'log_update',
      properties: {
        titleType: updated.title.type,
        status: updated.status,
        hasRating: ratingValue != null,
        hasNote: !!note.trim(),
        hasSeason: selectedSeason != null,
        hasEpisode: selectedEpisode != null,
        source: 'ios_native_log',
      },
    }).catch(() => null);
    setActiveLog(updated);
    return updated;
  }

  async function publishLogToDiscussion(log: WatchLog) {
    const discussion = await createDiscussion(log.title.id);
    if (log.note?.trim()) {
      await createComment(discussion.id, {
        body: log.note.trim(),
        mentions: [],
        syncLog: false,
      });
    }
    trackEvent({
      eventName: 'discussion_share',
      properties: {
        source: 'ios_native_log',
        titleType: log.title.type,
        hasNote: Boolean(log.note?.trim()),
      },
    }).catch(() => null);
  }

  async function saveStatusChoice(nextStatus: Status) {
    setStatus(nextStatus);
    setSaving(true);
    setMessage(null);
    try {
      if (activeLog) {
        await persistLogDetails(activeLog, nextStatus);
      } else {
        await persistNewLog(nextStatus, false);
      }
      setMessage(copy.quickSaveDone);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : copy.saveErrorMessage;
      Alert.alert(copy.saveErrorTitle, nextMessage);
    } finally {
      setSaving(false);
    }
  }

  async function saveDetails() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);

    try {
      const log = activeLog
        ? await persistLogDetails(activeLog)
        : await persistNewLog(status, true);
      if (!log) return;

      let optionalActionFailed = false;
      if (shareToDiscussion) {
        try {
          await publishLogToDiscussion(log);
        } catch (error) {
          optionalActionFailed = true;
          Alert.alert(
            copy.publicShareErrorTitle,
            error instanceof Error ? error.message : copy.publicShareErrorFallback,
          );
        }
      }
      if (shareCard) {
        setShareTargetLog(log);
        setShareBusy(true);
      }

      resetForm();
      if (!shareCard && !optionalActionFailed) Alert.alert(copy.saveSuccessTitle, copy.saveSuccessMessage);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : copy.saveErrorMessage;
      Alert.alert(copy.saveErrorTitle, nextMessage);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!shareTargetLog || !shareBusy) return;

    const logToShare = shareTargetLog;
    let cancelled = false;
    let capturedUri: string | null = null;

    async function captureAndShare() {
      try {
        const available = await Sharing.isAvailableAsync();
        if (!available) throw new Error(copy.shareUnavailable);
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (cancelled) return;

        capturedUri = await shareCardRef.current?.capture?.() ?? null;
        if (!capturedUri) throw new Error(copy.shareCaptureError);

        await Sharing.shareAsync(capturedUri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: logShareCardFileName(logToShare),
        });
        trackEvent({
          eventName: 'share_card_create',
          properties: {
            source: 'ios_native_log',
            titleType: logToShare.title.type,
            hasNote: Boolean(logToShare.note?.trim()),
            hasRating: typeof logToShare.rating === 'number',
          },
        }).catch(() => null);
      } catch (error) {
        Alert.alert(copy.shareErrorTitle, error instanceof Error ? error.message : copy.shareErrorFallback);
      } finally {
        if (capturedUri) releaseCapture(capturedUri);
        if (!cancelled) {
          setShareBusy(false);
          setShareTargetLog(null);
        }
      }
    }

    captureAndShare();

    return () => {
      cancelled = true;
      if (capturedUri) releaseCapture(capturedUri);
    };
  }, [
    copy.shareCaptureError,
    copy.shareErrorFallback,
    copy.shareErrorTitle,
    copy.shareUnavailable,
    shareBusy,
    shareTargetLog,
  ]);

  function selectTitle(item: TitleSearchItem, source: TitleSelectSource) {
    setSelected(item);
    setActiveLog(null);
    setFilter(item.type === 'book' ? 'book' : 'video');
    setStatus('DONE');
    setRating('');
    setNote('');
    setWatchedAt(todayInputValue());
    setPlace(null);
    setOccasion(null);
    setOtt(null);
    setMessage(null);
    setShareToDiscussion(false);
    setShareCard(false);
    trackEvent({
      eventName: 'title_select',
      properties: {
        source,
        titleType: item.type,
        provider: item.provider,
        providerId: item.providerId,
      },
    }).catch(() => null);
  }

  const profileNickname = profile?.nickname?.trim() ?? '';
  const profileComplete = Boolean(profileNickname && profile?.personaKey);
  const headerTitle = profileComplete
    ? formatCopy(filter === 'book' ? copy.profileBookTitle : copy.profileVideoTitle, { nickname: profileNickname })
    : copy.title;
  const headerDescription = profileComplete
    ? formatCopy(copy.profileDesc, { persona: personaLabel(profile?.personaKey, accountText) })
    : copy.desc;

  return (
    <SwipeableTabScreen routeKey="/(tabs)/log">
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            {profileComplete ? (
              <Image source={{ uri: avatarUri(profile?.personaKey) }} style={styles.headerAvatar} />
            ) : null}
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {headerTitle}
              </Text>
              <Text style={styles.desc}>{headerDescription}</Text>
            </View>
          </View>

          <View style={styles.segment}>
            {filters.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => {
                  if (filter !== item.value) {
                    setFilter(item.value);
                    setSelected(null);
                    setActiveLog(null);
                    setResults([]);
                    setPopular([]);
                    setQuery('');
                    setMessage(null);
                  }
                }}
                style={[styles.segmentItem, filter === item.value && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, filter === item.value && styles.segmentTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.searchBox}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={filter === 'book' ? copy.searchBookPlaceholder : copy.searchVideoPlaceholder}
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {loading ? <ActivityIndicator color={colors.secondary} /> : null}
          </View>

          {selected ? (
            <View style={styles.card}>
              <View style={styles.selectedHero}>
                {(seasonPosterUrl ?? selected.posterUrl) ? (
                  <Image
                    source={{ uri: seasonPosterUrl ?? selected.posterUrl ?? '' }}
                    style={styles.selectedPoster}
                  />
                ) : (
                  <View style={styles.selectedPosterEmpty}>
                    <Text style={styles.posterEmptyText}>{typeLabel(selected.type, locale)}</Text>
                  </View>
                )}
                <View style={styles.selectedBody}>
                  <Text style={styles.sectionTitle} numberOfLines={1} ellipsizeMode="tail">
                    {selected.name}
                  </Text>
                  <Text style={styles.meta}>
                    {selected.type === 'book'
                      ? [typeLabel(selected.type, locale), bookMeta(selected)].filter(Boolean).join(' · ')
                      : [
                          typeLabel(selected.type, locale),
                          seasonYear ?? selected.year,
                          seasonEpisodeLabel(selectedSeason, selectedEpisode),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                  </Text>
                  {selected.genres && selected.genres.length > 0 ? (
                    <View style={styles.genreRow}>
                      {selected.genres.slice(0, 4).map((genre) => (
                        <Text key={genre} style={styles.genreChip} numberOfLines={1}>
                          {genre}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {selected.directors && selected.directors.length > 0 ? (
                    <Text style={styles.detailMeta} numberOfLines={1} ellipsizeMode="tail">
                      {locale === 'ko' ? '감독' : 'Director'} · {selected.directors.join(', ')}
                    </Text>
                  ) : null}
                  {selected.cast && selected.cast.length > 0 ? (
                    <Text style={styles.detailMeta} numberOfLines={1} ellipsizeMode="tail">
                      {locale === 'ko' ? '주연' : 'Cast'} · {selected.cast.join(', ')}
                    </Text>
                  ) : null}
                  {selected.type === 'book' && selected.overview ? (
                    <Text style={styles.overview} numberOfLines={2} ellipsizeMode="tail">
                      {selected.overview}
                    </Text>
                  ) : null}
                </View>
              </View>
              {message ? <Text style={styles.successText}>{message}</Text> : null}

              {!activeLog ? (
                <View style={styles.statusPrompt}>
                  <Text style={styles.fieldLabel}>{copy.status}</Text>
                  <View style={styles.statusRow}>
                    {STATUSES.map((item) => (
                      <Pressable
                        key={item}
                        disabled={saving}
                        onPress={() => saveStatusChoice(item)}
                        style={[styles.chip, status === item && styles.chipActive, saving && styles.disabledButton]}
                      >
                        <Text style={[styles.chipText, status === item && styles.chipTextActive]}>
                          {statusLabel(item, selected.type, locale)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.detailStack}>
                  <NativeSelect
                    colors={colors}
                    label={copy.status}
                    selectedValue={status}
                    valueLabel={statusOptionsForSelect.find((item) => item.value === status)?.label ?? null}
                    placeholder={copy.none}
                    sections={[{ options: statusOptionsForSelect }]}
                    onChange={(value) => setStatus(value as Status)}
                    clearLabel={copy.none}
                  />

                  {selected.type === 'series' ? (
                    <>
                      <NativeSelect
                        colors={colors}
                        label={copy.season}
                        selectedValue={String(selectedSeason ?? '')}
                        valueLabel={selectedSeason == null ? null : `${copy.season} ${selectedSeason}`}
                        placeholder={copy.none}
                        sections={[
                          {
                            options: [
                              { value: '', label: copy.none },
                              ...seasons.map((item) => ({
                                value: String(item.seasonNumber),
                                label: `${copy.season} ${item.seasonNumber}${item.name ? ` · ${item.name}` : ''}`,
                              })),
                            ],
                          },
                        ]}
                        onChange={(value) => {
                          if (!value) {
                            setSelectedSeason(null);
                            return;
                          }
                          setSelectedSeason(Number(value));
                        }}
                        onClear={() => setSelectedSeason(null)}
                        clearLabel={copy.none}
                        helperText={seasonLoading ? copy.seasonLoading : seasonError}
                      />

                      <NativeSelect
                        colors={colors}
                        label={copy.episode}
                        selectedValue={String(selectedEpisode ?? '')}
                        valueLabel={selectedEpisode == null ? null : `EP ${selectedEpisode}`}
                        placeholder={copy.none}
                        sections={[
                          {
                            options: [
                              { value: '', label: copy.none },
                              ...episodes.map((item) => ({
                                value: String(item.episodeNumber),
                                label: `EP ${item.episodeNumber}${item.name ? ` · ${item.name}` : ''}`,
                              })),
                            ],
                          },
                        ]}
                        onChange={(value) => {
                          if (!value) {
                            setSelectedEpisode(null);
                            return;
                          }
                          setSelectedEpisode(Number(value));
                        }}
                        onClear={() => setSelectedEpisode(null)}
                        clearLabel={copy.none}
                        disabled={selectedSeason == null}
                        helperText={episodeLoading ? copy.episodeLoading : null}
                      />
                    </>
                  ) : null}

                  <View style={styles.dateRow}>
                    <View style={styles.dateField}>
                      <Text style={styles.fieldLabel}>{copy.dateAndRating}</Text>
                      <TextInput value={watchedAt} onChangeText={setWatchedAt} style={styles.smallInput} />
                    </View>
                    <View style={styles.dateField}>
                      <NativeSelect
                        colors={colors}
                        label={copy.ratingPlaceholder}
                        selectedValue={rating}
                        valueLabel={rating ? `${Number(rating).toFixed(1)}/5` : null}
                        placeholder={copy.none}
                        sections={[{ options: ratingOptions }]}
                        onChange={(value) => setRating(value)}
                        onClear={() => setRating('')}
                        clearLabel={copy.none}
                      />
                    </View>
                  </View>

                  <NativeSelect
                    colors={colors}
                    label={copy.place}
                    selectedValue={place ?? ''}
                    valueLabel={place ? places.find((item) => item.value === place)?.label ?? null : null}
                    placeholder={copy.none}
                    sections={[{ options: places }]}
                    onChange={(value) => setPlace(value as Place)}
                    onClear={() => setPlace(null)}
                    clearLabel={copy.none}
                  />

                  <NativeSelect
                    colors={colors}
                    label={copy.occasion}
                    selectedValue={occasion ?? ''}
                    valueLabel={occasion ? occasions.find((item) => item.value === occasion)?.label ?? null : null}
                    placeholder={copy.none}
                    sections={[{ options: occasions }]}
                    onChange={(value) => setOccasion(value as Occasion)}
                    onClear={() => setOccasion(null)}
                    clearLabel={copy.none}
                  />

                  <NativeSelect
                    colors={colors}
                    label={copy.platform}
                    selectedValue={ott ?? ''}
                    valueLabel={ott}
                    placeholder={copy.none}
                    sections={[{ options: ottOptions.map((item) => ({ value: item, label: item })) }]}
                    onChange={(value) => setOtt(value)}
                    onClear={() => setOtt(null)}
                    clearLabel={copy.none}
                  />

                  <View style={styles.noteStack}>
                    <Text style={styles.fieldLabel}>{copy.note}</Text>
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      multiline
                      placeholder={copy.notePlaceholder}
                      placeholderTextColor={colors.onSurfaceVariant}
                      style={[styles.input, styles.noteInput]}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>{copy.saveAndShare}</Text>
                  <View style={styles.toggleRow}>
                    <Pressable
                      onPress={() => setShareToDiscussion((value) => !value)}
                      style={[styles.toggleButton, shareToDiscussion && styles.toggleButtonActive]}
                    >
                      <Text style={[styles.toggleText, shareToDiscussion && styles.toggleTextActive]}>
                        {shareToDiscussion ? '✓ ' : ''}
                        {copy.shareToPublic}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShareCard((value) => !value)}
                      style={[styles.toggleButton, shareCard && styles.toggleButtonActive]}
                    >
                      <Text style={[styles.toggleText, shareCard && styles.toggleTextActive]}>
                        {shareCard ? '✓ ' : ''}
                        {copy.createShareCard}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable onPress={resetForm} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>{copy.cancelSelection}</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveDetails}
                      disabled={saving}
                      style={[styles.primaryButton, saving && styles.disabledButton]}
                    >
                      <Text style={styles.primaryButtonText}>
                        {saving ? copy.saving : copy.saveDetailsAction}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.results}>
              {!query.trim() && popular.length > 0 ? (
                <Text style={styles.sectionLabel}>{copy.suggestionsTitle}</Text>
              ) : null}
              {(query.trim() ? results : popular).map((item) => (
                <Pressable
                  key={searchItemKey(item)}
                  style={styles.result}
                  onPress={() =>
                    selectTitle(
                      item,
                      query.trim() ? 'search' : suggestionSources[searchItemKey(item)] ?? 'popular_title',
                    )
                  }
                >
                  {item.posterUrl ? (
                    <Image source={{ uri: item.posterUrl }} style={styles.poster} />
                  ) : (
                    <View style={styles.posterEmpty}>
                      <Text style={styles.posterEmptyText}>{typeLabel(item.type, locale)}</Text>
                    </View>
                  )}
                  <View style={styles.resultBody}>
                    <Text style={styles.resultTitle}>{item.name}</Text>
                    <Text style={styles.meta}>
                      {[typeLabel(item.type, locale), item.year, item.author].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {!loading && query.trim() && results.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>{copy.noResultsTitle}</Text>
                  <Text style={styles.desc}>{copy.noResultsDesc}</Text>
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
        {shareTargetLog ? (
          <ViewShot
            ref={shareCardRef}
            options={{
              format: 'png',
              quality: 1,
              result: 'tmpfile',
              width: logShareCardCaptureSize.width,
              height: logShareCardCaptureSize.height,
            }}
            style={styles.shareCaptureArea}
          >
            <LogShareCard log={shareTargetLog} locale={locale} />
          </ViewShot>
        ) : null}
      </KeyboardAvoidingView>
    </SwipeableTabScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingTop: 12, paddingBottom: 120, gap: 14 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerAvatar: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
    },
    headerText: { flex: 1, minWidth: 0, gap: 5 },
    title: { ...Typography.headlineLg, color: colors.onSurface, fontSize: 28 },
    desc: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    searchBox: {
      minHeight: 56,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    input: { flex: 1, minHeight: 48, color: colors.onSurface, ...Typography.bodyLg },
    segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    segmentItem: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: colors.surface,
    },
    segmentItemActive: { borderColor: colors.primaryContainer, backgroundColor: colors.surfaceMuted },
    segmentText: { ...Typography.labelLg, color: colors.onSurfaceVariant },
    segmentTextActive: { color: colors.primaryContainer },
    results: { gap: 10 },
    sectionLabel: { ...Typography.labelLg, color: colors.onSurfaceVariant },
    result: {
      flexDirection: 'row',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      padding: 10,
    },
    poster: { width: 56, height: 78, borderRadius: 10, backgroundColor: colors.surfaceMuted },
    posterEmpty: {
      width: 56,
      height: 78,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    posterEmptyText: { ...Typography.labelSm, color: colors.onSurfaceVariant },
    resultBody: { flex: 1, justifyContent: 'center', gap: 4 },
    resultTitle: { ...Typography.headlineSm, color: colors.onSurface },
    meta: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    successText: {
      ...Typography.labelLg,
      color: colors.primaryContainer,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    emptyBox: {
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.outline,
      padding: 18,
      gap: 6,
    },
    emptyTitle: { ...Typography.headlineSm, color: colors.onSurface },
    card: {
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      padding: 16,
      gap: 12,
    },
    sectionTitle: { ...Typography.headlineMd, color: colors.onSurface },
    selectedHero: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
    selectedPoster: { width: 80, height: 128, borderRadius: 12, backgroundColor: colors.surfaceMuted },
    selectedPosterEmpty: {
      width: 80,
      height: 128,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    selectedBody: { flex: 1, gap: 6, minWidth: 0 },
    genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    genreChip: {
      maxWidth: 96,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 8,
      paddingVertical: 3,
      ...Typography.labelSm,
      color: colors.onSurfaceVariant,
    },
    detailMeta: { ...Typography.labelSm, color: colors.onSurfaceVariant },
    overview: { ...Typography.labelSm, color: colors.onSurfaceVariant, lineHeight: 17 },
    fieldLabel: { ...Typography.labelLg, color: colors.onSurfaceVariant, marginTop: 4 },
    statusPrompt: { gap: 8 },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    detailStack: { gap: 12 },
    dateRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    dateField: { flex: 1, gap: 6 },
    noteStack: { gap: 6 },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    horizontalOptions: { gap: 8, paddingRight: 4 },
    loadingText: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    errorText: { ...Typography.bodyMd, color: colors.error },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    chipActive: { borderColor: colors.primaryContainer, backgroundColor: colors.surfaceMuted },
    chipText: { ...Typography.labelLg, color: colors.onSurfaceVariant },
    chipTextActive: { color: colors.primaryContainer },
    inlineInputs: { flexDirection: 'row', gap: 10 },
    smallInput: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      color: colors.onSurface,
    },
    noteInput: {
      minHeight: 92,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 12,
      paddingTop: 12,
      textAlignVertical: 'top',
    },
    toggleRow: { flexDirection: 'row', gap: 8 },
    toggleButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    toggleButtonActive: {
      borderColor: colors.primaryContainer,
      backgroundColor: colors.surfaceMuted,
    },
    toggleText: { ...Typography.labelLg, color: colors.onSurfaceVariant, textAlign: 'center' },
    toggleTextActive: { color: colors.primaryContainer },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    primaryButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryContainer,
    },
    primaryButtonText: { color: colors.background, fontWeight: '800' },
    secondaryButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    secondaryButtonText: { color: colors.onSurface, fontWeight: '800' },
    disabledButton: { opacity: 0.55 },
    shareCaptureArea: {
      position: 'absolute',
      left: -10000,
      top: 0,
      width: 270,
      height: 480,
      backgroundColor: '#15120f',
    },
  });
}
