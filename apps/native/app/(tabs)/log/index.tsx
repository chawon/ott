import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { ThemeColors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import {
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
import { countLogsLocal, enqueueLogOutbox, upsertLogLocal } from '../../../lib/localDb';
import { syncNow } from '../../../lib/sync';
import { buildOutboxPayload } from '../../../lib/syncPayload';
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
  Title,
  TitleSearchItem,
  TitleType,
  TmdbEpisode,
  TmdbSeason,
  WatchLog,
} from '../../../lib/types';

type FilterType = 'ALL' | TitleType;

const FILTER_VALUES: FilterType[] = ['ALL', 'movie', 'series', 'book'];
const STATUSES: Status[] = ['DONE', 'IN_PROGRESS', 'WISHLIST'];

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

export default function LogScreen() {
  const { colors, locale } = useNativePreferences();
  const copy = logCopy[locale];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const filters = useMemo(
    () =>
      FILTER_VALUES.map((value) => ({
        value,
        label: value === 'ALL' ? copy.all : typeLabel(value, locale),
      })),
    [copy.all, locale],
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
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [results, setResults] = useState<TitleSearchItem[]>([]);
  const [popular, setPopular] = useState<TitleSearchItem[]>([]);
  const [selected, setSelected] = useState<TitleSearchItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) {
      setResults([]);
      if (filter === 'book') {
        setPopular([]);
        return;
      }
      timer.current = setTimeout(async () => {
        setLoading(true);
        try {
          const items = await popularTitles(12);
          setPopular(
            items
              .filter((item) => filter === 'ALL' || item.type === filter)
              .slice(0, 6),
          );
        } catch {
          setPopular([]);
        } finally {
          setLoading(false);
        }
      }, 150);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await searchTitles(query.trim(), filter);
        setResults(items.slice(0, 20));
        setPopular([]);
        trackEvent({
          eventName: 'title_search',
          properties: {
            source: 'ios_native_log',
            queryLength: query.trim().length,
            mediaType: filter,
            resultCount: items.length,
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

  const ratingValue = useMemo(() => {
    const parsed = Number(rating);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.min(5, Math.max(0.5, parsed));
  }, [rating]);

  async function save() {
    if (!selected) return;
    setSaving(true);

    try {
      const now = new Date().toISOString();
      const isFirstLog = (await countLogsLocal()) === 0;
      const title = titleFromSearch(selected, selected.titleId ?? uuid());
      const log: WatchLog = {
        id: uuid(),
        title,
        status,
        rating: ratingValue,
        note: note.trim() || null,
        spoiler: false,
        ott,
        seasonNumber: selectedSeason,
        episodeNumber: selectedEpisode,
        seasonPosterUrl,
        seasonYear,
        origin: 'LOG',
        watchedAt: inputDateToIso(watchedAt),
        place,
        occasion,
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
          status,
          hasRating: ratingValue != null,
          hasNote: !!note.trim(),
          hasSeason: selectedSeason != null,
          hasEpisode: selectedEpisode != null,
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
      setSelected(null);
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
      Alert.alert(copy.saveSuccessTitle, copy.saveSuccessMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.saveErrorMessage;
      Alert.alert(copy.saveErrorTitle, message);
    } finally {
      setSaving(false);
    }
  }

  function selectTitle(item: TitleSearchItem, source: 'search' | 'popular_title') {
    setSelected(item);
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
            placeholder={copy.searchPlaceholder}
            placeholderTextColor={colors.onSurfaceVariant}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {loading ? <ActivityIndicator color={colors.secondary} /> : null}
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

            <Text style={styles.fieldLabel}>{copy.status}</Text>
            <View style={styles.optionRow}>
              {STATUSES.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setStatus(item)}
                  style={[styles.chip, status === item && styles.chipActive]}
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

            <Text style={styles.fieldLabel}>{copy.dateAndRating}</Text>
            <View style={styles.inlineInputs}>
              <TextInput value={watchedAt} onChangeText={setWatchedAt} style={styles.smallInput} />
              <TextInput
                value={rating}
                onChangeText={setRating}
                placeholder={copy.ratingPlaceholder}
                placeholderTextColor={colors.onSurfaceVariant}
                keyboardType="decimal-pad"
                style={styles.smallInput}
              />
            </View>

            <Text style={styles.fieldLabel}>{copy.place}</Text>
            <View style={styles.optionRow}>
              {places.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => setPlace(place === item.value ? null : item.value)}
                  style={[styles.chip, place === item.value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, place === item.value && styles.chipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{copy.occasion}</Text>
            <View style={styles.optionRow}>
              {occasions.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => setOccasion(occasion === item.value ? null : item.value)}
                  style={[styles.chip, occasion === item.value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, occasion === item.value && styles.chipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{copy.platform}</Text>
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

            <Text style={styles.fieldLabel}>{copy.note}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={copy.notePlaceholder}
              placeholderTextColor={colors.onSurfaceVariant}
              style={[styles.input, styles.noteInput]}
            />

            <View style={styles.actionRow}>
              <Pressable onPress={() => setSelected(null)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>{copy.cancelSelection}</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={saving}
                style={[styles.primaryButton, saving && styles.disabledButton]}
              >
                <Text style={styles.primaryButtonText}>{saving ? copy.saving : copy.saveAction}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.results}>
            {!query.trim() && popular.length > 0 ? (
              <Text style={styles.sectionLabel}>{copy.popularTitle}</Text>
            ) : null}
            {(query.trim() ? results : popular).map((item) => (
              <Pressable
                key={`${item.provider}:${item.providerId}`}
                style={styles.result}
                onPress={() => selectTitle(item, query.trim() ? 'search' : 'popular_title')}
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
  chipActive: { borderColor: colors.primaryContainer, backgroundColor: colors.surfaceMuted },
  chipText: { ...Typography.labelLg, color: colors.onSurfaceVariant },
  chipTextActive: { color: colors.primaryContainer },
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
});
}
