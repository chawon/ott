import { useEffect, useMemo, useRef, useState } from 'react';
import * as Sharing from 'expo-sharing';
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
import {
  DateOverrideField,
  RatingSelector,
  ratingOptionsForType,
} from '../../../components/LogFormControls';
import { LogShareCard, logShareCardCaptureSize } from '../../../components/LogShareCard';
import type { ThemeColors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import {
  createComment,
  createDiscussion,
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
import {
  logCopy,
  occasionLabels,
  placeLabels,
} from '../../../lib/i18n';
import { useNativePreferences } from '../../../lib/nativePreferences';
import type {
  Occasion,
  Place,
  Status,
  DiscussionListItem,
  Title,
  TitleSearchItem,
  TmdbEpisode,
  TmdbSeason,
  WatchLog,
  WatchLogHistory,
} from '../../../lib/types';

type ContentFilter = 'video' | 'book';
type TitleSelectSource = 'search' | 'recent_discussion' | 'popular_title';

const FILTER_VALUES: ContentFilter[] = ['video', 'book'];
const STATUSES: Status[] = ['DONE', 'IN_PROGRESS', 'WISHLIST'];
const TITLE_SUGGESTION_LIMIT = 6;

const PLACE_VALUES: Place[] = ['HOME', 'THEATER', 'CAFE', 'TRANSIT', 'LIBRARY', 'BOOKSTORE'];
const OCCASION_VALUES: Occasion[] = ['ALONE', 'FRIENDS', 'FAMILY', 'DATE', 'BREAK'];
const OTT_BASE_OPTIONS = ['Netflix', 'Disney+', 'TVING', 'Wavve', 'Watcha', 'Coupang Play'];

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
    provider: item.provider,
    providerId: item.providerId,
  };
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const filters = useMemo(
    () =>
      FILTER_VALUES.map((value) => ({
        value,
        label: value === 'video' ? copy.tabVideo : copy.tabBook,
      })),
    [copy.tabBook, copy.tabVideo],
  );
  const places = useMemo(
    () => PLACE_VALUES.map((value) => ({ value, label: placeLabels[locale][value] })),
    [locale],
  );
  const occasions = useMemo(
    () => OCCASION_VALUES.map((value) => ({ value, label: occasionLabels[locale][value] })),
    [locale],
  );
  const ottOptions = useMemo(
    () => [...OTT_BASE_OPTIONS, copy.platformTheater, copy.platformLibrary],
    [copy.platformLibrary, copy.platformTheater],
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ContentFilter>('video');
  const [results, setResults] = useState<TitleSearchItem[]>([]);
  const [popular, setPopular] = useState<TitleSearchItem[]>([]);
  const [suggestionSources, setSuggestionSources] = useState<Record<string, TitleSelectSource>>({});
  const [selected, setSelected] = useState<TitleSearchItem | null>(null);
  const [activeLog, setActiveLog] = useState<WatchLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shareToDiscussion, setShareToDiscussion] = useState(false);
  const [shareCard, setShareCard] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareTargetLog, setShareTargetLog] = useState<WatchLog | null>(null);
  const [status, setStatus] = useState<Status>('IN_PROGRESS');
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [watchedAt, setWatchedAt] = useState(todayInputValue());
  const [useWatchedAt, setUseWatchedAt] = useState(false);
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
  const ratingOptions = useMemo(
    () => ratingOptionsForType(selected?.type, locale),
    [locale, selected?.type],
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

  const ratingValue = rating;
  const isWishlist = status === 'WISHLIST';

  function resetForm() {
    setSelected(null);
    setActiveLog(null);
    setQuery('');
    setResults([]);
    setStatus('IN_PROGRESS');
    setRating(null);
    setNote('');
    setWatchedAt(todayInputValue());
    setUseWatchedAt(false);
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
      watchedAt: includeDetails && useWatchedAt ? inputDateToIso(watchedAt) : now,
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
      watchedAt: useWatchedAt ? inputDateToIso(watchedAt) : baseLog.watchedAt,
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

  function updateStatusChoice(nextStatus: Status) {
    setStatus(nextStatus);
    if (nextStatus === 'WISHLIST') {
      setRating(null);
      setPlace(null);
      setOccasion(null);
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
    setStatus('IN_PROGRESS');
    setRating(null);
    setNote('');
    setWatchedAt(todayInputValue());
    setUseWatchedAt(false);
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

  function statusActionLabel(item: Status, type: Title['type']) {
    if (type === 'book') {
      if (item === 'DONE') return copy.statusDoneBook;
      if (item === 'IN_PROGRESS') return copy.statusInProgressBook;
      return copy.statusWishlistBook;
    }
    if (item === 'DONE') return copy.statusDoneVideo;
    if (item === 'IN_PROGRESS') return copy.statusInProgressVideo;
    return copy.statusWishlistVideo;
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.desc}>{copy.desc}</Text>
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
          {loading ? <ActivityIndicator color={colors.onSurfaceVariant} /> : null}
        </View>

        <View style={styles.segment}>
          {filters.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setFilter(item.value)}
              style={[styles.segmentItem, filter === item.value && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, filter === item.value && styles.segmentTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {selected ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{selected.name}</Text>
            <Text style={styles.meta}>
              {[
                typeLabel(selected.type, locale),
                seasonYear ?? selected.year,
                selected.author,
                seasonEpisodeLabel(selectedSeason, selectedEpisode),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {!activeLog ? (
              <View style={styles.initialSaveBox}>
                <Text style={styles.statusPrompt}>{copy.statusPrompt}</Text>
                <View style={styles.statusChoiceGrid}>
                  {STATUSES.map((item) => (
                    <Pressable
                      key={item}
                      disabled={saving}
                      onPress={() => saveStatusChoice(item)}
                      style={[styles.statusChoiceButton, saving && styles.disabledButton]}
                    >
                      <Text style={styles.statusChoiceText}>{statusActionLabel(item, selected.type)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.helperText}>{copy.savedLocally}</Text>
                <Pressable onPress={resetForm} style={styles.initialCancelButton}>
                  <Text style={styles.secondaryButtonText}>{copy.cancelSelection}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.detailBox}>
                <Text style={styles.successText}>{message ?? copy.saveSuccessPrompt}</Text>
                <Text style={styles.sectionLabel}>{copy.optionalDetailsTitle}</Text>

                <Text style={styles.fieldLabel}>{copy.detailStatus}</Text>
                <View style={styles.optionRow}>
                  {STATUSES.map((item) => (
                    <Pressable
                      key={item}
                      disabled={saving}
                      onPress={() => updateStatusChoice(item)}
                      style={[styles.chip, status === item && styles.chipActive, saving && styles.disabledButton]}
                    >
                      <Text style={[styles.chipText, status === item && styles.chipTextActive]}>
                        {statusLabel(item, selected.type, locale)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {selected.type === 'series' ? (
                  <>
                    <Text style={styles.fieldLabel}>{copy.season}</Text>
                    {seasonLoading ? <Text style={styles.loadingText}>{copy.seasonLoading}</Text> : null}
                    {seasonError ? <Text style={styles.errorText}>{seasonError}</Text> : null}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.horizontalOptions}
                    >
                      <Pressable
                        onPress={() => setSelectedSeason(null)}
                        style={[styles.chip, selectedSeason == null && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, selectedSeason == null && styles.chipTextActive]}>{copy.none}</Text>
                      </Pressable>
                      {seasons.map((item) => (
                        <Pressable
                          key={item.seasonNumber}
                          onPress={() => setSelectedSeason(item.seasonNumber)}
                          style={[styles.chip, selectedSeason === item.seasonNumber && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, selectedSeason === item.seasonNumber && styles.chipTextActive]}>
                            {copy.season} {item.seasonNumber}
                            {item.name ? ` · ${item.name}` : ''}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <Text style={styles.fieldLabel}>{copy.episode}</Text>
                    {episodeLoading ? <Text style={styles.loadingText}>{copy.episodeLoading}</Text> : null}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.horizontalOptions}
                    >
                      <Pressable
                        disabled={selectedSeason == null}
                        onPress={() => setSelectedEpisode(null)}
                        style={[
                          styles.chip,
                          selectedEpisode == null && styles.chipActive,
                          selectedSeason == null && styles.disabledButton,
                        ]}
                      >
                        <Text style={[styles.chipText, selectedEpisode == null && styles.chipTextActive]}>{copy.none}</Text>
                      </Pressable>
                      {episodes.map((item) => (
                        <Pressable
                          key={item.episodeNumber}
                          onPress={() => setSelectedEpisode(item.episodeNumber)}
                          style={[styles.chip, selectedEpisode === item.episodeNumber && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, selectedEpisode === item.episodeNumber && styles.chipTextActive]}>
                            EP {item.episodeNumber}
                            {item.name ? ` · ${item.name}` : ''}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                ) : null}

                <Text style={styles.fieldLabel}>{copy.detailRating}</Text>
                <RatingSelector
                  colors={colors}
                  disabled={isWishlist}
                  noneLabel={copy.none}
                  onChange={setRating}
                  options={ratingOptions}
                  value={rating}
                />

                <Text style={styles.fieldLabel}>{copy.detailPlatform}</Text>
                <View style={styles.optionRow}>
                  {ottOptions.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setOtt(ott === item ? null : item)}
                      style={[styles.chip, ott === item && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, ott === item && styles.chipTextActive]}>
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>{copy.detailPlace}</Text>
                <View style={[styles.optionRow, isWishlist && styles.disabledButton]}>
                  {places.map((item) => (
                    <Pressable
                      key={item.value}
                      disabled={isWishlist}
                      onPress={() => setPlace(place === item.value ? null : item.value)}
                      style={[styles.chip, place === item.value && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, place === item.value && styles.chipTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>{copy.detailOccasion}</Text>
                <View style={[styles.optionRow, isWishlist && styles.disabledButton]}>
                  {occasions.map((item) => (
                    <Pressable
                      key={item.value}
                      disabled={isWishlist}
                      onPress={() => setOccasion(occasion === item.value ? null : item.value)}
                      style={[styles.chip, occasion === item.value && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, occasion === item.value && styles.chipTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <DateOverrideField
                  activeLabel={copy.dateSelecting}
                  colors={colors}
                  enabled={useWatchedAt}
                  label={copy.dateOther}
                  locale={locale}
                  modalTitle={copy.detailDate}
                  onChange={setWatchedAt}
                  onToggle={setUseWatchedAt}
                  value={watchedAt}
                />

                <Text style={styles.fieldLabel}>{copy.detailNote}</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  multiline
                  placeholder={copy.notePlaceholder}
                  placeholderTextColor={colors.onSurfaceVariant}
                  style={[styles.input, styles.noteInput]}
                />
              </View>
            )}

            {activeLog ? (
              <>
                <Text style={styles.fieldLabel}>{copy.saveAndShare}</Text>
                <View style={styles.toggleRow}>
                  <Pressable
                    onPress={() => setShareToDiscussion((value) => !value)}
                    style={[styles.toggleButton, shareToDiscussion && styles.toggleButtonActive]}
                  >
                    <Text style={[styles.toggleText, shareToDiscussion && styles.toggleTextActive]}>
                      {shareToDiscussion ? '✓ ' : ''}{copy.shareToPublic}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShareCard((value) => !value)}
                    style={[styles.toggleButton, shareCard && styles.toggleButtonActive]}
                  >
                    <Text style={[styles.toggleText, shareCard && styles.toggleTextActive]}>
                      {shareCard ? '✓ ' : ''}{copy.createShareCard}
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
              </>
            ) : null}
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
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 12, paddingBottom: 120, gap: 14 },
  header: { gap: 5 },
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
  input: { ...Typography.bodyLg, flex: 1, minHeight: 48, color: colors.onSurface },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segmentItem: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.surface,
  },
  segmentItemActive: { borderColor: colors.link, backgroundColor: colors.selectedSurface },
  segmentText: { ...Typography.labelLg, color: colors.onSurfaceVariant },
  segmentTextActive: { color: colors.link },
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
    color: colors.success,
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
  initialSaveBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
    gap: 12,
  },
  statusPrompt: { ...Typography.bodyMd, color: colors.onSurface, textAlign: 'center', fontWeight: '700' },
  statusChoiceGrid: { flexDirection: 'row', gap: 8 },
  statusChoiceButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.link,
    backgroundColor: colors.selectedSurface,
    paddingHorizontal: 8,
  },
  statusChoiceText: { ...Typography.labelLg, color: colors.link, textAlign: 'center' },
  helperText: { ...Typography.labelLg, color: colors.onSurfaceVariant, textAlign: 'center' },
  initialCancelButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  detailBox: { gap: 12 },
  fieldLabel: { ...Typography.labelLg, color: colors.onSurfaceVariant, marginTop: 4 },
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
  chipActive: { borderColor: colors.link, backgroundColor: colors.selectedSurface },
  chipText: { ...Typography.labelLg, color: colors.onSurfaceVariant },
  chipTextActive: { color: colors.link },
  inlineInputs: { flexDirection: 'row', gap: 10 },
  smallInput: {
    flex: 1,
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
    borderColor: colors.link,
    backgroundColor: colors.selectedSurface,
  },
  toggleText: { ...Typography.labelLg, color: colors.onSurfaceVariant, textAlign: 'center' },
  toggleTextActive: { color: colors.link },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.action,
  },
  primaryButtonText: { color: colors.onAction, fontWeight: '800' },
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
