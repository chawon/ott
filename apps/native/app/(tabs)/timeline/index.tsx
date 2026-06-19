import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ThemeColors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { trackEvent } from '../../../lib/api';
import {
  formatShortDate,
  seasonEpisodeLabel,
  statusLabel,
  typeLabel,
} from '../../../lib/format';
import { listLogsLocal } from '../../../lib/localDb';
import { syncNow } from '../../../lib/sync';
import { useLogRevision } from '../../../lib/syncEvents';
import {
  filterTimelineLogs,
  type OccasionFilter,
  type OriginFilter,
  type PlaceFilter,
  type StatusFilter,
  type TimelineSort,
  type TypeFilter,
} from '../../../lib/timelineFilters';
import { buildTimelineCsv, timelineCsvFileName } from '../../../lib/timelineCsv';
import type { Occasion, Place, WatchLog } from '../../../lib/types';
import {
  occasionLabels,
  placeLabels,
  timelineCopy,
} from '../../../lib/i18n';
import { useNativePreferences } from '../../../lib/nativePreferences';

const STATUS_FILTER_VALUES: StatusFilter[] = ['ALL', 'DONE', 'IN_PROGRESS', 'WISHLIST'];
const TYPE_FILTER_VALUES: TypeFilter[] = ['ALL', 'movie', 'series', 'book'];
const ORIGIN_FILTER_VALUES: OriginFilter[] = ['ALL', 'LOG', 'COMMENT'];
const PLACE_FILTER_VALUES: PlaceFilter[] = [
  'ALL',
  'HOME',
  'THEATER',
  'TRANSIT',
  'CAFE',
  'OFFICE',
  'LIBRARY',
  'BOOKSTORE',
  'SCHOOL',
  'PARK',
  'OUTDOOR',
  'ETC',
];
const OCCASION_FILTER_VALUES: OccasionFilter[] = ['ALL', 'ALONE', 'DATE', 'FAMILY', 'FRIENDS', 'BREAK', 'ETC'];
const SORT_FILTER_VALUES: TimelineSort[] = ['history', 'watchedAt'];

export default function TimelineScreen() {
  const { colors, locale } = useNativePreferences();
  const copy = timelineCopy[locale];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ titleId?: string | string[] }>();
  const titleIdFilter = Array.isArray(params.titleId) ? params.titleId[0] : params.titleId;
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('ALL');
  const [placeFilter, setPlaceFilter] = useState<PlaceFilter>('ALL');
  const [occasionFilter, setOccasionFilter] = useState<OccasionFilter>('ALL');
  const [platformFilter, setPlatformFilter] = useState('');
  const [sortFilter, setSortFilter] = useState<TimelineSort>('history');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const logRevision = useLogRevision();
  const statusFilters = useMemo(
    () =>
      STATUS_FILTER_VALUES.map((value) => ({
        value,
        label:
          value === 'ALL'
            ? copy.all
            : value === 'DONE'
              ? copy.statusDone
              : value === 'IN_PROGRESS'
                ? copy.statusInProgress
                : copy.statusWishlist,
      })),
    [copy],
  );
  const typeFilters = useMemo(
    () =>
      TYPE_FILTER_VALUES.map((value) => ({
        value,
        label: value === 'ALL' ? copy.all : typeLabel(value, locale),
      })),
    [copy.all, locale],
  );
  const originFilters = useMemo(
    () =>
      ORIGIN_FILTER_VALUES.map((value) => ({
        value,
        label: value === 'ALL' ? copy.all : value === 'LOG' ? copy.myOrigin : copy.commentOrigin,
      })),
    [copy],
  );
  const placeFilters = useMemo(
    () =>
      PLACE_FILTER_VALUES.map((value) => ({
        value,
        label: value === 'ALL' ? copy.placeAll : placeLabels[locale][value],
      })),
    [copy.placeAll, locale],
  );
  const occasionFilters = useMemo(
    () =>
      OCCASION_FILTER_VALUES.map((value) => ({
        value,
        label: value === 'ALL' ? copy.occasionAll : occasionLabels[locale][value],
      })),
    [copy.occasionAll, locale],
  );
  const sortFilters = useMemo(
    () =>
      SORT_FILTER_VALUES.map((value) => ({
        value,
        label: value === 'history' ? copy.historySort : copy.watchedAtSort,
      })),
    [copy.historySort, copy.watchedAtSort],
  );

  const load = useCallback(async () => {
    const items = await listLogsLocal();
    setLogs(items);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [load, logRevision]);

  async function refresh() {
    setRefreshing(true);
    try {
      await syncNow();
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const visibleLogs = useMemo(() => {
    return filterTimelineLogs(logs, {
      status: statusFilter,
      type: typeFilter,
      origin: originFilter,
      place: placeFilter,
      occasion: occasionFilter,
      platform: platformFilter,
      query,
      sort: sortFilter,
      titleId: titleIdFilter ?? null,
    });
  }, [
    logs,
    occasionFilter,
    originFilter,
    placeFilter,
    platformFilter,
    query,
    sortFilter,
    statusFilter,
    titleIdFilter,
    typeFilter,
  ]);

  const filterSummary = useMemo(() => {
    const parts = [
      statusFilter !== 'ALL' ? statusFilters.find((item) => item.value === statusFilter)?.label : null,
      typeFilter !== 'ALL' ? typeFilters.find((item) => item.value === typeFilter)?.label : null,
      originFilter !== 'ALL' ? originFilters.find((item) => item.value === originFilter)?.label : null,
      platformFilter.trim() ? platformFilter.trim() : null,
      placeFilter !== 'ALL' ? placeLabels[locale][placeFilter] : null,
      occasionFilter !== 'ALL' ? occasionLabels[locale][occasionFilter] : null,
      titleIdFilter ? copy.byTitle : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : copy.filterAll;
  }, [
    copy.byTitle,
    copy.filterAll,
    locale,
    occasionFilter,
    originFilter,
    originFilters,
    placeFilter,
    platformFilter,
    statusFilter,
    statusFilters,
    titleIdFilter,
    typeFilter,
    typeFilters,
  ]);

  async function shareCsv() {
    if (visibleLogs.length === 0) {
      Alert.alert(copy.csvEmptyTitle, copy.csvEmptyMessage);
      return;
    }

    setExporting(true);
    try {
      const filename = timelineCsvFileName();
      const csv = buildTimelineCsv(visibleLogs);
      const file = new FileSystem.File(FileSystem.Paths.cache, filename);
      file.write(csv, {
        encoding: 'utf8',
      });
      await Sharing.shareAsync(file.uri, {
        dialogTitle: filename,
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
      trackEvent({
        eventName: 'timeline_export',
        properties: {
          source: 'ios_native_timeline',
          count: visibleLogs.length,
          statusFilter,
          typeFilter,
          originFilter,
          platformFilter: platformFilter.trim() || null,
          placeFilter,
          occasionFilter,
          sortFilter,
          titleIdFilter: titleIdFilter ?? null,
          hasQuery: query.trim().length > 0,
        },
      }).catch(() => null);
    } catch {
      Alert.alert(copy.csvFailTitle, copy.csvFailMessage);
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primaryContainer} />}
    >
      <View style={styles.actionRow}>
        <Pressable onPress={() => router.push('/me/report')} style={styles.reportButton}>
          <Text style={styles.reportButtonText}>{copy.reportAction}</Text>
        </Pressable>
        <Pressable
          disabled={exporting || visibleLogs.length === 0}
          onPress={shareCsv}
          style={[styles.csvButton, (exporting || visibleLogs.length === 0) && styles.disabledButton]}
        >
          <Text style={styles.csvButtonText}>{exporting ? copy.sharing : copy.csvShare}</Text>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={copy.searchPlaceholder}
        placeholderTextColor={colors.onSurfaceVariant}
        style={styles.searchInput}
      />

      <View style={styles.filterBlock}>
        <Text style={styles.filterSummary}>{filterSummary} · {visibleLogs.length} {copy.countSuffix}</Text>
        <View style={styles.segment}>
          {statusFilters.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setStatusFilter(item.value)}
              style={[styles.chip, statusFilter === item.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, statusFilter === item.value && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.segment}>
          {typeFilters.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setTypeFilter(item.value)}
              style={[styles.chip, typeFilter === item.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, typeFilter === item.value && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.segment}>
          {originFilters.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setOriginFilter(item.value)}
              style={[styles.chip, originFilter === item.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, originFilter === item.value && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.segment}>
          {sortFilters.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setSortFilter(item.value)}
              style={[styles.chip, sortFilter === item.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, sortFilter === item.value && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={platformFilter}
          onChangeText={setPlatformFilter}
          placeholder={copy.platformPlaceholder}
          placeholderTextColor={colors.onSurfaceVariant}
          style={styles.searchInput}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalSegment}>
          {placeFilters.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setPlaceFilter(item.value)}
              style={[styles.chip, placeFilter === item.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, placeFilter === item.value && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalSegment}>
          {occasionFilters.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setOccasionFilter(item.value)}
              style={[styles.chip, occasionFilter === item.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, occasionFilter === item.value && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      ) : visibleLogs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
          <Text style={styles.desc}>{copy.emptyDesc}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visibleLogs.map((log) => (
            <Pressable
              key={log.id}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/title/[id]',
                  params: { id: log.title.id },
                })
              }
            >
              <View style={styles.cardTop}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{typeLabel(log.title.type, locale)}</Text>
                </View>
                <Text style={styles.date}>{formatShortDate(log.watchedAt, locale)}</Text>
              </View>
              <Text style={styles.logTitle}>{log.title.name}</Text>
              <Text style={styles.meta}>
                {[
                  statusLabel(log.status, log.title.type, locale),
                  log.origin === 'COMMENT' ? copy.commentOrigin : null,
                  log.ott,
                  log.place ? placeLabels[locale][log.place] : null,
                  log.occasion ? occasionLabels[locale][log.occasion] : null,
                  seasonEpisodeLabel(log.seasonNumber, log.episodeNumber),
                  log.rating ? `${log.rating}/5` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {log.note ? <Text style={styles.note}>{log.note}</Text> : null}
              {log.syncStatus && log.syncStatus !== 'synced' ? (
                <Text style={styles.syncState}>
                  {log.syncStatus === 'pending' ? copy.syncPending : copy.syncFailed}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 12, paddingBottom: 120, gap: 14 },
  desc: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
  actionRow: { flexDirection: 'row', gap: 10 },
  reportButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportButtonText: { color: colors.background, fontWeight: '800' },
  csvButton: {
    minHeight: 50,
    minWidth: 104,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  csvButtonText: { color: colors.onSurface, fontWeight: '800' },
  disabledButton: { opacity: 0.5 },
  searchInput: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.onSurface,
    ...Typography.bodyLg,
  },
  filterBlock: { gap: 8 },
  filterSummary: { ...Typography.labelLg, color: colors.primaryContainer },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  horizontalSegment: { gap: 8, paddingRight: 20 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { borderColor: colors.primaryContainer, backgroundColor: colors.surfaceMuted },
  chipText: { ...Typography.labelLg, color: colors.onSurfaceVariant },
  chipTextActive: { color: colors.primaryContainer },
  center: { padding: 32, alignItems: 'center' },
  empty: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.outline,
    padding: 24,
    gap: 8,
  },
  emptyTitle: { ...Typography.headlineSm, color: colors.onSurface },
  list: { gap: 10 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { ...Typography.labelSm, color: colors.primaryContainer },
  date: { ...Typography.labelLg, color: colors.onSurfaceVariant },
  logTitle: { ...Typography.headlineSm, color: colors.onSurface },
  meta: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
  note: { ...Typography.bodyMd, color: colors.onSurface, marginTop: 4 },
  syncState: { ...Typography.labelLg, color: colors.warning, marginTop: 4 },
});
}
