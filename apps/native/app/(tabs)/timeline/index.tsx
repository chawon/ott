import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import Svg, { Path } from 'react-native-svg';
import ViewShot, { releaseCapture } from 'react-native-view-shot';
import { LogShareCard, logShareCardCaptureSize } from '../../../components/LogShareCard';
import { NativeSelect } from '../../../components/NativeSelect';
import { NativeTabIcon } from '../../../components/NativeTabIcon';
import { SwipeableTabScreen } from '../../../components/SwipeableTabScreen';
import type { ThemeColors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { createComment, createDiscussion, getUserProfile, trackEvent } from '../../../lib/api';
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
import { logShareCardFileName } from '../../../lib/shareCard';
import type { Occasion, Place, UserProfile, WatchLog } from '../../../lib/types';
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

function formatCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function DownloadIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4v10" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="m7.5 10.5 4.5 4.5 4.5-4.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 19h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shareBusyId, setShareBusyId] = useState<string | null>(null);
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [shareTargetLog, setShareTargetLog] = useState<WatchLog | null>(null);
  const shareCardRef = useRef<ViewShot>(null);
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

  const loadProfile = useCallback(async () => {
    const nextProfile = await getUserProfile().catch(() => null);
    setProfile(nextProfile);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadProfile();
    }, [load, loadProfile]),
  );

  useEffect(() => {
    load();
  }, [load, logRevision]);

  const profileNickname = profile?.nickname?.trim() ?? '';
  const headerTitle = profileNickname
    ? formatCopy(copy.titlePersonalized, { nickname: profileNickname })
    : copy.title;

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

  const activeFilterCount = useMemo(() => {
    return [
      statusFilter !== 'ALL',
      typeFilter !== 'ALL',
      originFilter !== 'ALL',
      platformFilter.trim().length > 0,
      placeFilter !== 'ALL',
      occasionFilter !== 'ALL',
      sortFilter !== 'history',
      Boolean(titleIdFilter),
    ].filter(Boolean).length;
  }, [
    occasionFilter,
    originFilter,
    placeFilter,
    platformFilter,
    sortFilter,
    statusFilter,
    titleIdFilter,
    typeFilter,
  ]);

  function clearFilters() {
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setOriginFilter('ALL');
    setPlaceFilter('ALL');
    setOccasionFilter('ALL');
    setPlatformFilter('');
    setSortFilter('history');
  }

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

  useEffect(() => {
    if (!shareTargetLog || shareBusyId !== shareTargetLog.id) return;

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
            source: 'ios_native_timeline',
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
          setShareBusyId(null);
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
    shareBusyId,
    shareTargetLog,
  ]);

  function shareLogCard(log: WatchLog) {
    if (shareBusyId) return;
    setShareTargetLog(log);
    setShareBusyId(log.id);
  }

  async function publishLog(log: WatchLog) {
    if (publishBusyId) return;
    setPublishBusyId(log.id);
    try {
      await syncNow({ registerIfNeeded: true }).catch(() => null);
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
          source: 'ios_native_timeline',
          titleType: log.title.type,
          hasNote: Boolean(log.note?.trim()),
        },
      }).catch(() => null);
      Alert.alert(copy.publicShareTitle, copy.publicShareMessage);
    } catch (error) {
      Alert.alert(copy.publicShareErrorTitle, error instanceof Error ? error.message : copy.publicShareErrorFallback);
    } finally {
      setPublishBusyId(null);
    }
  }

  return (
    <SwipeableTabScreen routeKey="/(tabs)/timeline">
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primaryContainer} />}
      >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <NativeTabIcon active boxHeight={28} boxWidth={32} colors={colors} name="timeline" size={18} />
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {headerTitle}
          </Text>
        </View>
        <Text style={styles.desc}>{copy.desc}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={() => router.push('/me/report')} style={styles.reportButton}>
          <Text style={styles.reportButtonText}>{copy.reportAction}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={copy.csvShare}
          disabled={exporting || visibleLogs.length === 0}
          onPress={shareCsv}
          style={[styles.csvButton, (exporting || visibleLogs.length === 0) && styles.disabledButton]}
        >
          {exporting ? (
            <ActivityIndicator color={colors.primaryContainer} />
          ) : (
            <DownloadIcon color={colors.primaryContainer} />
          )}
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={copy.searchPlaceholder}
        placeholderTextColor={colors.onSurfaceVariant}
        style={styles.searchInput}
      />

      <View style={styles.filterBar}>
        <View style={styles.filterHeaderRow}>
          <View style={styles.filterHeaderText}>
            <Text style={styles.filterSummary}>
              {filterSummary} · {visibleLogs.length} {copy.countSuffix}
            </Text>
            <Text style={styles.filterHint}>
              {activeFilterCount > 0
                ? copy.activeFilters.replace('{count}', String(activeFilterCount))
                : copy.filterCollapsedHint}
            </Text>
          </View>
          <Pressable onPress={() => setFiltersOpen((value) => !value)} style={styles.filterToggleButton}>
            <Text style={styles.filterToggleText}>{filtersOpen ? copy.filterClose : copy.filterOpen}</Text>
          </Pressable>
        </View>

        {filtersOpen ? (
          <View style={styles.filterPanel}>
            <NativeSelect
              colors={colors}
              label={copy.filterStatus}
              selectedValue={statusFilter}
              valueLabel={statusFilter === 'ALL' ? copy.all : statusFilters.find((item) => item.value === statusFilter)?.label ?? null}
              placeholder={copy.all}
              sections={[{ options: statusFilters.map((item) => ({ value: item.value, label: item.label })) }]}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              onClear={() => setStatusFilter('ALL')}
              clearLabel={copy.all}
            />

            <NativeSelect
              colors={colors}
              label={copy.filterType}
              selectedValue={typeFilter}
              valueLabel={typeFilter === 'ALL' ? copy.all : typeFilters.find((item) => item.value === typeFilter)?.label ?? null}
              placeholder={copy.all}
              sections={[{ options: typeFilters.map((item) => ({ value: item.value, label: item.label })) }]}
              onChange={(value) => setTypeFilter(value as TypeFilter)}
              onClear={() => setTypeFilter('ALL')}
              clearLabel={copy.all}
            />

            <NativeSelect
              colors={colors}
              label={copy.filterOrigin}
              selectedValue={originFilter}
              valueLabel={originFilter === 'ALL' ? copy.all : originFilters.find((item) => item.value === originFilter)?.label ?? null}
              placeholder={copy.all}
              sections={[{ options: originFilters.map((item) => ({ value: item.value, label: item.label })) }]}
              onChange={(value) => setOriginFilter(value as OriginFilter)}
              onClear={() => setOriginFilter('ALL')}
              clearLabel={copy.all}
            />

            <NativeSelect
              colors={colors}
              label={copy.filterSort}
              selectedValue={sortFilter}
              valueLabel={sortFilter === 'history' ? copy.historySort : copy.watchedAtSort}
              placeholder={copy.historySort}
              sections={[{ options: sortFilters.map((item) => ({ value: item.value, label: item.label })) }]}
              onChange={(value) => setSortFilter(value as TimelineSort)}
              onClear={() => setSortFilter('history')}
              clearLabel={copy.historySort}
            />

            <Text style={styles.filterGroupLabel}>{copy.filterPlatform}</Text>
            <TextInput
              value={platformFilter}
              onChangeText={setPlatformFilter}
              placeholder={copy.platformPlaceholder}
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.searchInput}
            />

            <NativeSelect
              colors={colors}
              label={copy.filterPlace}
              selectedValue={placeFilter}
              valueLabel={placeFilter === 'ALL' ? copy.placeAll : placeFilters.find((item) => item.value === placeFilter)?.label ?? null}
              placeholder={copy.placeAll}
              sections={[{ options: placeFilters.map((item) => ({ value: item.value, label: item.label })) }]}
              onChange={(value) => setPlaceFilter(value as PlaceFilter)}
              onClear={() => setPlaceFilter('ALL')}
              clearLabel={copy.placeAll}
            />

            <NativeSelect
              colors={colors}
              label={copy.filterOccasion}
              selectedValue={occasionFilter}
              valueLabel={occasionFilter === 'ALL' ? copy.occasionAll : occasionFilters.find((item) => item.value === occasionFilter)?.label ?? null}
              placeholder={copy.occasionAll}
              sections={[{ options: occasionFilters.map((item) => ({ value: item.value, label: item.label })) }]}
              onChange={(value) => setOccasionFilter(value as OccasionFilter)}
              onClear={() => setOccasionFilter('ALL')}
              clearLabel={copy.occasionAll}
            />

            <Pressable onPress={clearFilters} style={styles.clearFilterButton}>
              <Text style={styles.clearFilterText}>{copy.clearFilters}</Text>
            </Pressable>
          </View>
        ) : null}
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
          {visibleLogs.map((log) => {
            const isBook = log.title.type === 'book';
            const isComment = log.origin === 'COMMENT';
            return (
            <View
              key={log.id}
              style={[styles.card, isBook && styles.cardBook, isComment && styles.cardComment]}
            >
              <Pressable
                style={styles.cardPressArea}
                onPress={() =>
                  router.push({
                    pathname: '/title/[id]',
                    params: { id: log.title.id },
                  })
                }
              >
                {log.seasonPosterUrl ?? log.title.posterUrl ? (
                  <Image source={{ uri: log.seasonPosterUrl ?? log.title.posterUrl ?? '' }} style={styles.poster} />
                ) : (
                  <View style={styles.posterEmpty}>
                    <Text style={styles.posterEmptyText}>{typeLabel(log.title.type, locale)}</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{typeLabel(log.title.type, locale)}</Text>
                    </View>
                    <Text style={styles.date}>{formatShortDate(log.watchedAt, locale)}</Text>
                  </View>
                  <Text style={styles.logTitle} numberOfLines={1} ellipsizeMode="tail">
                    {log.title.name}
                  </Text>
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
                </View>
              </Pressable>
              <View style={styles.logActionRow}>
                <Pressable
                  disabled={shareBusyId === log.id}
                  onPress={() => shareLogCard(log)}
                  style={[styles.smallActionButton, shareBusyId === log.id && styles.disabledButton]}
                >
                  <Text style={styles.smallActionText}>
                    {shareBusyId === log.id ? copy.sharingCard : copy.shareCard}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={publishBusyId === log.id}
                  onPress={() => publishLog(log)}
                  style={[styles.smallPrimaryButton, publishBusyId === log.id && styles.disabledButton]}
                >
                  <Text style={styles.smallPrimaryText}>
                    {publishBusyId === log.id ? copy.publishing : copy.sharePublic}
                  </Text>
                </Pressable>
              </View>
            </View>
            );
          })}
        </View>
      )}
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
      </ScrollView>
    </SwipeableTabScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 24, paddingBottom: 120, gap: 14 },
  header: { gap: 5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  title: { ...Typography.headlineLg, color: colors.onSurface, flexShrink: 1 },
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
    width: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primaryContainer,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
	  filterBar: {
	    borderRadius: 16,
	    borderWidth: 1,
	    borderColor: colors.outlineVariant,
	    backgroundColor: colors.surface,
	    padding: 12,
	    gap: 12,
	  },
	  filterHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	  filterHeaderText: { flex: 1, gap: 3 },
	  filterSummary: { ...Typography.labelLg, color: colors.primaryContainer },
	  filterHint: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
	  filterToggleButton: {
	    minHeight: 42,
	    borderRadius: 12,
	    backgroundColor: colors.surfaceMuted,
	    alignItems: 'center',
	    justifyContent: 'center',
	    paddingHorizontal: 14,
	  },
	  filterToggleText: { ...Typography.labelLg, color: colors.onSurface, fontWeight: '800' },
	  filterPanel: {
	    borderTopWidth: 1,
	    borderTopColor: colors.outlineVariant,
	    paddingTop: 12,
	    gap: 8,
	  },
	  filterGroupLabel: { ...Typography.labelSm, color: colors.onSurfaceVariant, marginTop: 4 },
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
	  clearFilterButton: {
	    minHeight: 44,
	    borderRadius: 12,
	    borderWidth: 1,
	    borderColor: colors.outlineVariant,
	    backgroundColor: colors.surfaceMuted,
	    alignItems: 'center',
	    justifyContent: 'center',
	    marginTop: 4,
	  },
	  clearFilterText: { ...Typography.labelLg, color: colors.onSurface },
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
      padding: 16,
      gap: 10,
    },
    cardBook: {
      backgroundColor: colors.surfaceMuted,
    },
    cardComment: {
      backgroundColor: colors.surface,
    },
    cardPressArea: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
    cardBody: { flex: 1, gap: 5 },
    poster: { width: 80, height: 128, borderRadius: 12, backgroundColor: colors.surfaceMuted },
    posterEmpty: {
      width: 80,
      height: 128,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
	  posterEmptyText: { ...Typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center' },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
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
	  logActionRow: { flexDirection: 'row', gap: 8, paddingTop: 4 },
	  smallActionButton: {
	    flex: 1,
	    minHeight: 42,
	    borderRadius: 12,
	    borderWidth: 1,
	    borderColor: colors.primaryContainer,
	    backgroundColor: colors.surface,
	    alignItems: 'center',
	    justifyContent: 'center',
	  },
	  smallActionText: { ...Typography.labelLg, color: colors.primaryContainer },
	  smallPrimaryButton: {
	    flex: 1,
	    minHeight: 42,
	    borderRadius: 12,
	    backgroundColor: colors.primaryContainer,
	    alignItems: 'center',
	    justifyContent: 'center',
	  },
	  smallPrimaryText: { ...Typography.labelLg, color: colors.background },
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
