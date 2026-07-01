import { router, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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
  View,
} from 'react-native';
import ViewShot, { releaseCapture } from 'react-native-view-shot';
import { ReportShareCard, reportShareCardCaptureSize } from '../../components/ReportShareCard';
import type { ThemeColors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { getPersonalReport, getUserProfile, trackEvent, webUrl } from '../../lib/api';
import { typeLabel } from '../../lib/format';
import {
  occasionLabels,
  placeLabels,
  reportCopy,
  type NativeLocale,
} from '../../lib/i18n';
import { listLogsLocal } from '../../lib/localDb';
import { useNativePreferences } from '../../lib/nativePreferences';
import { buildPersonalReport } from '../../lib/report';
import {
  buildSeasonalRecapShareCardPayload,
  reportShareCardFileName,
  seasonalRecapShareCardFileName,
  type ReportShareKind,
} from '../../lib/shareCard';
import { syncNow } from '../../lib/sync';
import type { Occasion, PersonalReport, Place, TitleType, UserProfile } from '../../lib/types';
import { useAuthStore } from '../../store/authStore';

const DATE_LOCALE: Record<NativeLocale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
};

function formatCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function metric(value: number | string) {
  return typeof value === 'number' ? String(value) : value;
}

function percent(value: number) {
  return `${value}%`;
}

function topTypeLabel(value: string, locale: NativeLocale) {
  if (value === 'movie' || value === 'series' || value === 'book') {
    return typeLabel(value as TitleType, locale);
  }
  return '-';
}

function placeLabel(value: string, locale: NativeLocale) {
  return value === '-' ? '-' : (placeLabels[locale][value as Place] ?? value);
}

function occasionLabel(value: string, locale: NativeLocale) {
  return value === '-' ? '-' : (occasionLabels[locale][value as Occasion] ?? value);
}

function formatDate(value: string | null | undefined, locale: NativeLocale) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(DATE_LOCALE[locale], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function seriesEpisode(report: PersonalReport) {
  if (typeof report.continueSeriesSeasonNumber === 'number' && typeof report.continueSeriesEpisodeNumber === 'number') {
    return `S${report.continueSeriesSeasonNumber} · E${report.continueSeriesEpisodeNumber}`;
  }
  if (typeof report.continueSeriesSeasonNumber === 'number') {
    return `S${report.continueSeriesSeasonNumber}`;
  }
  if (typeof report.continueSeriesEpisodeNumber === 'number') {
    return `E${report.continueSeriesEpisodeNumber}`;
  }
  return null;
}

export default function ReportScreen() {
  const { colors, locale } = useNativePreferences();
  const copy = reportCopy[locale];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { ensureRegistered } = useAuthStore();
  const [report, setReport] = useState<PersonalReport | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [source, setSource] = useState<'server' | 'local'>('server');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareKind, setShareKind] = useState<ReportShareKind | null>(null);
  const [seasonalShareBusy, setSeasonalShareBusy] = useState(false);
  const shareCardRef = useRef<ViewShot>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await ensureRegistered();
      await syncNow({ registerIfNeeded: true }).catch(() => null);
      const nextReport = await getPersonalReport();
      const nextProfile = await getUserProfile().catch(() => null);
      setReport(nextReport);
      setProfile(nextProfile);
      setSource('server');
      trackEvent({
        eventName: 'report_open',
        properties: {
          source: 'ios_native_report',
          totalLogs: nextReport.totalLogs,
        },
      }).catch(() => null);
    } catch (serverError) {
      try {
        const localLogs = await listLogsLocal();
        const localReport = buildPersonalReport(localLogs);
        setReport(localReport);
        setSource('local');
        trackEvent({
          eventName: 'report_open',
          properties: {
            source: 'ios_native_report_local',
            totalLogs: localReport.totalLogs,
            fallback: true,
          },
        }).catch(() => null);
      } catch (fallbackError) {
        setError(
          fallbackError instanceof Error
            ? fallbackError.message
            : serverError instanceof Error
              ? serverError.message
              : copy.errorFallback,
        );
      }
    } finally {
      setLoading(false);
    }
  }, [copy.errorFallback, ensureRegistered]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!shareKind || !report) return;

    const kindToShare = shareKind;
    const reportToShare = report;
    let cancelled = false;
    let capturedUri: string | null = null;

    async function captureAndShare() {
      try {
        const available = await Sharing.isAvailableAsync();
        if (!available) throw new Error(copy.shareUnavailable);
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (cancelled) return;

        capturedUri = await shareCardRef.current?.capture?.() ?? null;
        if (!capturedUri) throw new Error(copy.shareErrorFallback);

        await Sharing.shareAsync(capturedUri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: reportShareCardFileName(kindToShare),
        });
        trackEvent({
          eventName: 'report_share_card_create',
          properties: {
            source: 'ios_native_report',
            kind: kindToShare,
            totalLogs: reportToShare.totalLogs,
            reportSource: source,
          },
        }).catch(() => null);
      } catch (shareError) {
        Alert.alert(
          copy.shareErrorTitle,
          shareError instanceof Error ? shareError.message : copy.shareErrorFallback,
        );
      } finally {
        if (capturedUri) releaseCapture(capturedUri);
        if (!cancelled) setShareKind(null);
      }
    }

    captureAndShare();

    return () => {
      cancelled = true;
      if (capturedUri) releaseCapture(capturedUri);
    };
  }, [copy.shareErrorFallback, copy.shareErrorTitle, copy.shareUnavailable, report, shareKind, source]);

  function shareReportCard(kind: ReportShareKind) {
    if (!report || shareKind) return;
    setShareKind(kind);
  }

  async function shareSeasonalRecapCard() {
    if (!report?.seasonalRecap || seasonalShareBusy) return;
    const payload = buildSeasonalRecapShareCardPayload(report, locale);
    if (!payload) return;

    setSeasonalShareBusy(true);
    try {
      const response = await fetch(webUrl('/og/share-card'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(copy.shareErrorFallback);

      const filename = seasonalRecapShareCardFileName();
      const file = new FileSystem.File(FileSystem.Paths.cache, filename);
      file.write(new Uint8Array(await response.arrayBuffer()));
      await Sharing.shareAsync(file.uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: filename,
      });
      trackEvent({
        eventName: 'h1_recap_share',
        properties: {
          source: 'ios_native_report',
          totalLogs: report.seasonalRecap.totalLogs,
          posterCount: report.seasonalRecap.posters.length,
          reportSource: source,
        },
      }).catch(() => null);
    } catch (shareError) {
      Alert.alert(
        copy.shareErrorTitle,
        shareError instanceof Error ? shareError.message : copy.shareErrorFallback,
      );
    } finally {
      setSeasonalShareBusy(false);
    }
  }

  const reportTitle = profile?.nickname?.trim()
    ? formatCopy(copy.namedReportTitle, { name: profile.nickname.trim() })
    : copy.myReportTitle;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.kicker}>{copy.kicker}</Text>
          <Text style={styles.title}>{reportTitle}</Text>
          <Text style={styles.desc}>{copy.desc}</Text>
        </View>
      </View>
      {source === 'local' ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{copy.localNotice}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{copy.errorTitle}</Text>
          <Text style={styles.desc}>{error}</Text>
        </View>
      ) : report ? (
        <>
          {report.seasonalRecap ? (
            <View style={styles.seasonalCard}>
              <View style={styles.seasonalPosterGrid}>
                {report.seasonalRecap.posters.slice(0, 6).map((item, index) => (
                  <View key={`${item.titleId}-${index}`} style={styles.seasonalPosterSlot}>
                    {item.posterUrl ? (
                      <Image source={{ uri: item.posterUrl }} style={styles.seasonalPoster} />
                    ) : (
                      <View style={styles.seasonalPosterFallback}>
                        <Text numberOfLines={3} style={styles.seasonalPosterFallbackText}>
                          {item.title}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
              <View style={styles.seasonalBody}>
                <Text style={styles.seasonalKicker}>{copy.h1Period}</Text>
                <Text style={styles.seasonalTitle}>{copy.h1Title}</Text>
                <Text style={styles.desc}>
                  {formatCopy(copy.h1Desc, { count: report.seasonalRecap.totalLogs })}
                </Text>
                <View style={styles.seasonalStats}>
                  <InfoRow styles={styles} label={copy.h1TotalRecords} value={metric(report.seasonalRecap.totalLogs)} />
                  <InfoRow
                    styles={styles}
                    label={copy.h1TopType}
                    value={topTypeLabel(report.seasonalRecap.topType, locale)}
                  />
                  <InfoRow
                    styles={styles}
                    label={copy.h1NoteRate}
                    value={percent(report.seasonalRecap.noteFillPct)}
                  />
                </View>
                <Pressable
                  disabled={seasonalShareBusy}
                  onPress={shareSeasonalRecapCard}
                  style={[styles.seasonalAction, seasonalShareBusy && styles.disabledButton]}
                >
                  <Text style={styles.seasonalActionText}>
                    {seasonalShareBusy ? copy.cardGenerating : copy.h1ShareAction}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.metricsGrid}>
            <MetricCard styles={styles} label={copy.totalLogs} value={metric(report.totalLogs)} />
            <MetricCard styles={styles} label={copy.thisMonthLogs} value={metric(report.thisMonthLogs)} />
            <MetricCard styles={styles} label={copy.completeRate} value={percent(report.doneRatePct)} />
            <MetricCard styles={styles} label={copy.ratingRate} value={percent(report.ratingFillPct)} />
            <MetricCard styles={styles} label={copy.memoRate} value={percent(report.noteFillPct)} />
            <MetricCard
              styles={styles}
              label={copy.lastLog}
              value={formatDate(report.lastLoggedAt, locale)}
              compact
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{copy.revisitTitle}</Text>
            <View style={styles.revisitGrid}>
              <InfoBlock
                styles={styles}
                label={copy.weeklyLogs}
                value={metric(report.previousWeekLogs)}
                actionLabel={shareKind === 'weekly' ? copy.cardGenerating : copy.weeklyCardAction}
                onAction={() => shareReportCard('weekly')}
                disabled={shareKind !== null}
              />
              <InfoBlock
                styles={styles}
                label={copy.monthlyGenre}
                value={
                  report.monthlyTopGenre !== '-'
                    ? formatCopy(copy.monthlyGenreCount, {
                        genre: report.monthlyTopGenre,
                        count: report.monthlyTopGenreCount,
                      })
                    : copy.thisMonthGenreEmpty
                }
                actionLabel={shareKind === 'monthly' ? copy.cardGenerating : copy.monthlyCardAction}
                onAction={() => shareReportCard('monthly')}
                disabled={shareKind !== null}
              />
              <InfoBlock
                styles={styles}
                label={copy.daysSinceLastLog}
                value={formatCopy(copy.daysSuffix, { count: report.daysSinceLastLog })}
              />
              <InfoBlock
                styles={styles}
                label={copy.continueSeries}
                value={report.continueSeriesTitle ?? copy.noSeries}
                detail={seriesEpisode(report)}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{copy.statsTitle}</Text>
            <InfoRow styles={styles} label={copy.topType} value={topTypeLabel(report.topType, locale)} />
            <InfoRow styles={styles} label={copy.topPlace} value={placeLabel(report.topPlace, locale)} />
            <InfoRow styles={styles} label={copy.topOccasion} value={occasionLabel(report.topOccasion, locale)} />
            <InfoRow
              styles={styles}
              label={copy.streak}
              value={formatCopy(copy.currentLongestStreak, {
                current: report.streakDays,
                longest: report.longestStreakDays,
              })}
            />
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
          <Text style={styles.desc}>{copy.emptyDesc}</Text>
        </View>
      )}

      {shareKind && report ? (
        <ViewShot
          ref={shareCardRef}
          options={{
            format: 'png',
            quality: 1,
            result: 'tmpfile',
            width: reportShareCardCaptureSize.width,
            height: reportShareCardCaptureSize.height,
          }}
          style={styles.shareCaptureArea}
        >
          <ReportShareCard kind={shareKind} locale={locale} report={report} />
        </ViewShot>
      ) : null}
    </ScrollView>
  );
}

function MetricCard({
  styles,
  label,
  value,
  compact = false,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, compact && styles.metricValueCompact]}>{value}</Text>
    </View>
  );
}

function InfoBlock({
  styles,
  label,
  value,
  detail,
  actionLabel,
  onAction,
  disabled = false,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
  detail?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
      {detail ? <Text style={styles.desc}>{detail}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable disabled={disabled} onPress={onAction} style={[styles.infoAction, disabled && styles.disabledButton]}>
          <Text style={styles.infoActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function InfoRow({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.infoRowValue}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingTop: 56, paddingBottom: 100, gap: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerBody: { flex: 1, gap: 5 },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    backText: { fontSize: 30, lineHeight: 32, color: colors.primaryContainer },
    kicker: { ...Typography.accent, color: colors.tertiary },
    title: { ...Typography.headlineLg, color: colors.onBackground, fontSize: 28 },
    desc: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    notice: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
    },
    noticeText: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    center: { padding: 32, alignItems: 'center', justifyContent: 'center' },
    seasonalCard: {
      borderRadius: 8,
      backgroundColor: '#fef9ee',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    seasonalPosterGrid: {
      height: 260,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 3,
      backgroundColor: '#ecebe9',
      padding: 3,
    },
    seasonalPosterSlot: {
      width: '32.7%',
      height: '49%',
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: '#faf5d7',
    },
    seasonalPoster: {
      width: '100%',
      height: '100%',
    },
    seasonalPosterFallback: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: 10,
    },
    seasonalPosterFallbackText: {
      ...Typography.labelSm,
      color: '#0f0f0f',
    },
    seasonalBody: { padding: 16, gap: 12 },
    seasonalKicker: { ...Typography.accent, color: '#ff9933' },
    seasonalTitle: { ...Typography.headlineLg, color: '#0f0f0f' },
    seasonalStats: { gap: 10 },
    seasonalAction: {
      minHeight: 48,
      borderRadius: 8,
      backgroundColor: '#ff9933',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    seasonalActionText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    metricCard: {
      width: '48%',
      minHeight: 96,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      padding: 14,
      justifyContent: 'space-between',
    },
    metricLabel: { ...Typography.labelLg, color: colors.onSurfaceVariant },
    metricValue: { ...Typography.headlineLg, color: colors.primaryContainer },
    metricValueCompact: { ...Typography.headlineSm, color: colors.primaryContainer },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 12,
    },
    sectionTitle: { ...Typography.headlineSm, color: colors.onSurface },
    revisitGrid: { gap: 10 },
    infoBlock: {
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
      gap: 5,
    },
    infoValue: { ...Typography.headlineSm, color: colors.onSurface },
    infoAction: {
      minHeight: 38,
      borderRadius: 12,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    infoActionText: { color: colors.background, fontWeight: '800', fontSize: 12 },
    disabledButton: { opacity: 0.55 },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.outlineVariant,
      paddingTop: 10,
    },
    infoRowValue: {
      ...Typography.bodyMd,
      color: colors.onSurface,
      flex: 1,
      textAlign: 'right',
      fontWeight: '700',
    },
    empty: {
      borderRadius: 20,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.outline,
      padding: 24,
      gap: 8,
    },
    emptyTitle: { ...Typography.headlineSm, color: colors.onSurface },
    shareCaptureArea: {
      position: 'absolute',
      left: -10000,
      top: 0,
      width: 270,
      height: 480,
      backgroundColor: '#f8f6f2',
    },
  });
}
