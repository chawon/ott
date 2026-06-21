import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ViewShot, { releaseCapture } from 'react-native-view-shot';
import { LogShareCard, logShareCardCaptureSize } from '../../components/LogShareCard';
import { NativeSelect } from '../../components/NativeSelect';
import type { ThemeColors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import {
  createDiscussion,
  getDiscussionByTitle,
  getTitle,
  listLogHistory,
  trackEvent,
} from '../../lib/api';
import { formatShortDate, seasonEpisodeLabel, statusLabel, typeLabel } from '../../lib/format';
import { uuid } from '../../lib/id';
import {
  occasionLabels,
  placeLabels,
  titleDetailCopy,
  type NativeLocale,
} from '../../lib/i18n';
import { useNativePreferences } from '../../lib/nativePreferences';
import {
  occasionOptions,
  placeOptionsForTitleType,
  platformSectionsForTitleType,
  ratingLabelForValue,
  ratingOptionsForTitleType,
} from '../../lib/logOptions';
import { logShareCardFileName } from '../../lib/shareCard';
import {
  enqueueUpdateLogOutbox,
  getTitleLocal,
  listHistoryByLogLocal,
  listLogsByTitleLocal,
  upsertHistoryLocal,
  upsertLogLocal,
  upsertTitleLocal,
} from '../../lib/localDb';
import { syncNow } from '../../lib/sync';
import { buildUpdateLogPayload } from '../../lib/syncPayload';
import type { Occasion, Place, Status, Title, WatchLog, WatchLogHistory } from '../../lib/types';

const STATUSES: Status[] = ['DONE', 'IN_PROGRESS', 'WISHLIST'];

type EditDraft = {
  status: Status;
  rating: string;
  note: string;
  ott: string;
  watchedAt: string;
  place: Place | '';
  occasion: Occasion | '';
  seasonNumber: string;
  episodeNumber: string;
};

const DATE_LOCALE: Record<NativeLocale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
};

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function placeLabel(value: Place | '', locale: NativeLocale) {
  if (!value) return titleDetailCopy[locale].nonePlace;
  return placeLabels[locale][value];
}

function occasionLabel(value: Occasion | '', locale: NativeLocale) {
  if (!value) return titleDetailCopy[locale].noneOccasion;
  return occasionLabels[locale][value];
}

function inputDateValue(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function inputDateToIso(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function nullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function ratingValue(value: string) {
  const parsed = nullableNumber(value);
  if (parsed == null || parsed <= 0) return null;
  return Math.min(5, Math.max(0.5, parsed));
}

function draftFromLog(log: WatchLog): EditDraft {
  return {
    status: log.status,
    rating: typeof log.rating === 'number' ? String(log.rating) : '',
    note: log.note ?? '',
    ott: log.ott ?? '',
    watchedAt: inputDateValue(log.watchedAt),
    place: log.place ?? '',
    occasion: log.occasion ?? '',
    seasonNumber: typeof log.seasonNumber === 'number' ? String(log.seasonNumber) : '',
    episodeNumber: typeof log.episodeNumber === 'number' ? String(log.episodeNumber) : '',
  };
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

function formatHistoryDate(value: string, locale: NativeLocale) {
  return new Date(value).toLocaleString(DATE_LOCALE[locale], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TitleDetailScreen() {
  const { colors, locale } = useNativePreferences();
  const copy = titleDetailCopy[locale];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const titleId = singleParam(id);
  const [title, setTitle] = useState<Title | null>(null);
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [expandedHistoryLogId, setExpandedHistoryLogId] = useState<string | null>(null);
  const [historyByLog, setHistoryByLog] = useState<Record<string, WatchLogHistory[]>>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [historyErrorByLog, setHistoryErrorByLog] = useState<Record<string, string | null>>({});
  const [shareBusyId, setShareBusyId] = useState<string | null>(null);
  const [discussionBusy, setDiscussionBusy] = useState(false);
  const [shareTargetLog, setShareTargetLog] = useState<WatchLog | null>(null);
  const shareCardRef = useRef<ViewShot>(null);
  const optionTitleType = title?.type ?? 'movie';
  const ratingOptions = useMemo(
    () => ratingOptionsForTitleType(optionTitleType, locale),
    [locale, optionTitleType],
  );
  const placeOptions = useMemo(
    () => placeOptionsForTitleType(optionTitleType, locale),
    [locale, optionTitleType],
  );
  const platformSections = useMemo(
    () => platformSectionsForTitleType(optionTitleType, locale),
    [locale, optionTitleType],
  );
  const occasionSelectOptions = useMemo(() => occasionOptions(locale), [locale]);

  const load = useCallback(async () => {
    if (!titleId) return;
    setLoading(true);
    try {
      let nextTitle = await getTitleLocal(titleId);
      if (!nextTitle) {
        nextTitle = await getTitle(titleId);
        await upsertTitleLocal(nextTitle);
      }
      setTitle(nextTitle);
      setLogs(await listLogsByTitleLocal(titleId));
      trackEvent({
        eventName: 'title_select',
        properties: {
          source: 'ios_native_title_detail',
          titleType: nextTitle.type,
          provider: nextTitle.provider ?? null,
          providerId: nextTitle.providerId ?? null,
        },
      }).catch(() => null);
    } catch (error) {
      Alert.alert(copy.loadErrorTitle, error instanceof Error ? error.message : copy.loadErrorFallback);
    } finally {
      setLoading(false);
    }
  }, [copy.loadErrorFallback, copy.loadErrorTitle, titleId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveUpdatedLog(log: WatchLog, updates: Partial<WatchLog>) {
    setSavingId(log.id);
    try {
      const now = new Date().toISOString();
      const updated: WatchLog = {
        ...log,
        ...updates,
        updatedAt: now,
        syncStatus: 'pending',
      };
      const historyEntry = historyFromLog(updated, now);
      await upsertLogLocal(updated);
      await upsertHistoryLocal([historyEntry]);
      await enqueueUpdateLogOutbox(updated, buildUpdateLogPayload(updated, now));
      setLogs((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setHistoryByLog((prev) => ({
        ...prev,
        [updated.id]: [historyEntry, ...(prev[updated.id] ?? [])],
      }));
      trackEvent({
        eventName: 'log_update',
        properties: {
          source: 'ios_native_title_detail',
          titleType: updated.title.type,
          status: updated.status,
          hasRating: typeof updated.rating === 'number',
          hasSeason: typeof updated.seasonNumber === 'number',
          hasEpisode: typeof updated.episodeNumber === 'number',
        },
      }).catch(() => null);
      await syncNow({ registerIfNeeded: true }).catch(() => null);
    } catch (error) {
      Alert.alert(copy.updateErrorTitle, error instanceof Error ? error.message : copy.updateErrorFallback);
    } finally {
      setSavingId(null);
    }
  }

  async function updateStatus(log: WatchLog, status: Status) {
    if (log.status === status || savingId) return;
    await saveUpdatedLog(log, { status });
  }

  function startEditing(log: WatchLog) {
    setEditingLogId(log.id);
    setDraft(draftFromLog(log));
  }

  function cancelEditing() {
    setEditingLogId(null);
    setDraft(null);
  }

  function updateDraft(updates: Partial<EditDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...updates } : prev));
  }

  async function saveDraft(log: WatchLog) {
    if (!draft || savingId) return;
    const seasonNumber = nullableNumber(draft.seasonNumber);
    const episodeNumber = nullableNumber(draft.episodeNumber);
    await saveUpdatedLog(log, {
      status: draft.status,
      rating: ratingValue(draft.rating),
      note: draft.note.trim() || null,
      ott: draft.ott.trim() || null,
      watchedAt: inputDateToIso(draft.watchedAt, log.watchedAt),
      place: draft.place || null,
      occasion: draft.occasion || null,
      seasonNumber,
      episodeNumber,
      seasonPosterUrl: seasonNumber === log.seasonNumber ? log.seasonPosterUrl ?? null : null,
      seasonYear: seasonNumber === log.seasonNumber ? log.seasonYear ?? null : null,
    });
    cancelEditing();
  }

  async function toggleHistory(logId: string) {
    if (expandedHistoryLogId === logId) {
      setExpandedHistoryLogId(null);
      return;
    }

    setExpandedHistoryLogId(logId);
    setHistoryLoadingId(logId);
    setHistoryErrorByLog((prev) => ({ ...prev, [logId]: null }));
    try {
      const localItems = await listHistoryByLogLocal(logId, 50);
      if (localItems.length > 0) {
        setHistoryByLog((prev) => ({ ...prev, [logId]: localItems }));
      }
      const remoteItems = await listLogHistory(logId, 50);
      await upsertHistoryLocal(remoteItems);
      setHistoryByLog((prev) => ({ ...prev, [logId]: remoteItems }));
    } catch (error) {
      const localItems = await listHistoryByLogLocal(logId, 50).catch(() => []);
      if (localItems.length > 0) {
        setHistoryByLog((prev) => ({ ...prev, [logId]: localItems }));
      } else {
        setHistoryErrorByLog((prev) => ({
          ...prev,
          [logId]: error instanceof Error ? error.message : copy.historyLoadError,
        }));
      }
    } finally {
      setHistoryLoadingId(null);
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
            source: 'ios_native_title_detail',
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
  }, [copy.shareCaptureError, copy.shareErrorFallback, copy.shareErrorTitle, copy.shareUnavailable, shareBusyId, shareTargetLog]);

  function shareLogCard(log: WatchLog) {
    if (shareBusyId) return;
    setShareTargetLog(log);
    setShareBusyId(log.id);
  }

  async function openTogetherDiscussion() {
    if (!titleId || discussionBusy) return;
    setDiscussionBusy(true);
    try {
      const existing = await getDiscussionByTitle(titleId).catch(() => null);
      const discussion = existing ?? await createDiscussion(titleId);
      trackEvent({
        eventName: 'discussion_open',
        properties: {
          source: 'ios_native_title_detail',
          titleType: title?.type ?? null,
          created: !existing,
        },
      }).catch(() => null);
      router.push({
        pathname: '/public/[id]',
        params: { id: discussion.id },
      });
    } catch (error) {
      Alert.alert(copy.togetherErrorTitle, error instanceof Error ? error.message : copy.togetherErrorFallback);
    } finally {
      setDiscussionBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.kicker}>{copy.titleKicker}</Text>
          <Text style={styles.title}>{title?.name ?? copy.defaultTitle}</Text>
          {title ? (
            <Text style={styles.desc}>
              {[typeLabel(title.type, locale), title.year, title.author].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
      </View>

      {title ? (
        <View style={styles.togetherCard}>
          <View style={styles.togetherBody}>
            <Text style={styles.fieldLabel}>{copy.togetherTitle}</Text>
            <Text style={styles.meta}>{copy.togetherDesc}</Text>
          </View>
          <Pressable
            disabled={discussionBusy}
            onPress={openTogetherDiscussion}
            style={[styles.togetherButton, discussionBusy && styles.disabledButton]}
          >
            <Text style={styles.togetherButtonText}>
              {discussionBusy ? copy.togetherBusy : copy.togetherAction}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{copy.noLogsTitle}</Text>
          <Text style={styles.desc}>{copy.noLogsDesc}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {logs.map((log) => {
            const isEditing = editingLogId === log.id && draft;
            const isHistoryExpanded = expandedHistoryLogId === log.id;
            const histories = historyByLog[log.id] ?? [];

            return (
              <View key={log.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.date}>{formatShortDate(log.watchedAt, locale)}</Text>
                  {log.syncStatus && log.syncStatus !== 'synced' ? (
                    <Text style={styles.syncState}>
                      {log.syncStatus === 'pending' ? copy.syncPending : copy.syncFailed}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.meta}>
                  {[
                    statusLabel(log.status, log.title.type, locale),
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

                {isEditing ? (
                  <View style={styles.editBox}>
                    <Text style={styles.fieldLabel}>{copy.status}</Text>
                    <View style={styles.statusRow}>
                      {STATUSES.map((item) => (
                        <Pressable
                          key={item}
                          onPress={() => updateDraft({ status: item })}
                          style={[styles.chip, draft.status === item && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, draft.status === item && styles.chipTextActive]}>
                            {statusLabel(item, log.title.type, locale)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <View style={styles.inlineInputs}>
                      <TextInput
                        value={draft.watchedAt}
                        onChangeText={(value) => updateDraft({ watchedAt: value })}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.onSurfaceVariant}
                        selectionColor={colors.primaryContainer}
                        style={styles.input}
                      />
                      <View style={styles.inlineSelect}>
                        <NativeSelect
                          colors={colors}
                          label={copy.rating}
                          selectedValue={draft.rating}
                          valueLabel={ratingLabelForValue(draft.rating, log.title.type, locale)}
                          placeholder={copy.noneRating}
                          sections={[{ options: ratingOptions }]}
                          onChange={(value) => updateDraft({ rating: value })}
                          onClear={() => updateDraft({ rating: '' })}
                          clearLabel={copy.noneRating}
                        />
                      </View>
                    </View>

                    <NativeSelect
                      colors={colors}
                      label={log.title.type === 'book' ? copy.platformBookPlaceholder : copy.platformVideoPlaceholder}
                      selectedValue={draft.ott}
                      valueLabel={draft.ott || null}
                      placeholder={log.title.type === 'book' ? copy.platformBookPlaceholder : copy.platformVideoPlaceholder}
                      sections={platformSections}
                      onChange={(value) => updateDraft({ ott: value })}
                      onClear={() => updateDraft({ ott: '' })}
                      clearLabel={log.title.type === 'book' ? copy.platformBookPlaceholder : copy.platformVideoPlaceholder}
                    />

                    <NativeSelect
                      colors={colors}
                      label={copy.place}
                      selectedValue={draft.place}
                      valueLabel={draft.place ? placeLabel(draft.place, locale) : null}
                      placeholder={copy.nonePlace}
                      sections={[{ options: placeOptions }]}
                      onChange={(value) => updateDraft({ place: value as Place })}
                      onClear={() => updateDraft({ place: '' })}
                      clearLabel={copy.nonePlace}
                    />

                    <NativeSelect
                      colors={colors}
                      label={copy.occasion}
                      selectedValue={draft.occasion}
                      valueLabel={draft.occasion ? occasionLabel(draft.occasion, locale) : null}
                      placeholder={copy.noneOccasion}
                      sections={[{ options: occasionSelectOptions }]}
                      onChange={(value) => updateDraft({ occasion: value as Occasion })}
                      onClear={() => updateDraft({ occasion: '' })}
                      clearLabel={copy.noneOccasion}
                    />

                    {log.title.type === 'series' ? (
                      <View style={styles.inlineInputs}>
                        <TextInput
                          value={draft.seasonNumber}
                          onChangeText={(value) => updateDraft({ seasonNumber: value.replace(/[^0-9]/g, '') })}
                          placeholder={copy.seasonPlaceholder}
                          placeholderTextColor={colors.onSurfaceVariant}
                          selectionColor={colors.primaryContainer}
                          keyboardType="number-pad"
                          style={styles.input}
                        />
                        <TextInput
                          value={draft.episodeNumber}
                          onChangeText={(value) => updateDraft({ episodeNumber: value.replace(/[^0-9]/g, '') })}
                          placeholder={copy.episodePlaceholder}
                          placeholderTextColor={colors.onSurfaceVariant}
                          selectionColor={colors.primaryContainer}
                          keyboardType="number-pad"
                          style={styles.input}
                        />
                      </View>
                    ) : null}

                    <TextInput
                      value={draft.note}
                      onChangeText={(value) => updateDraft({ note: value })}
                      multiline
                      placeholder={copy.notePlaceholder}
                      placeholderTextColor={colors.onSurfaceVariant}
                      selectionColor={colors.primaryContainer}
                      style={[styles.input, styles.noteInput]}
                    />

                    <View style={styles.actionRow}>
                      <Pressable onPress={cancelEditing} style={styles.secondaryButton}>
                        <Text style={styles.secondaryButtonText}>{copy.cancel}</Text>
                      </Pressable>
                      <Pressable
                        disabled={savingId === log.id}
                        onPress={() => saveDraft(log)}
                        style={[styles.primaryButton, savingId === log.id && styles.disabledButton]}
                      >
                        <Text style={styles.primaryButtonText}>
                          {savingId === log.id ? copy.saving : copy.saveEdit}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.statusRow}>
                    {STATUSES.map((item) => (
                      <Pressable
                        key={item}
                        disabled={savingId === log.id}
                        onPress={() => updateStatus(log, item)}
                        style={[styles.chip, log.status === item && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, log.status === item && styles.chipTextActive]}>
                          {statusLabel(item, log.title.type, locale)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                <View style={styles.actionRow}>
                  <Pressable onPress={() => startEditing(log)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>{copy.edit}</Text>
                  </Pressable>
                  <Pressable onPress={() => toggleHistory(log.id)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>
                      {isHistoryExpanded ? copy.closeHistory : copy.history}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={shareBusyId === log.id}
                    onPress={() => shareLogCard(log)}
                    style={[styles.primaryButton, shareBusyId === log.id && styles.disabledButton]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {shareBusyId === log.id ? copy.sharing : copy.share}
                    </Text>
                  </Pressable>
                </View>

                {isHistoryExpanded ? (
                  <View style={styles.historyBox}>
                    <Text style={styles.fieldLabel}>{copy.historyTitle}</Text>
                    {historyLoadingId === log.id ? (
                      <Text style={styles.meta}>{copy.historyLoading}</Text>
                    ) : historyErrorByLog[log.id] ? (
                      <Text style={styles.errorText}>{historyErrorByLog[log.id]}</Text>
                    ) : histories.length === 0 ? (
                      <Text style={styles.meta}>{copy.historyEmpty}</Text>
                    ) : (
                      histories.map((item) => (
                        <View key={item.id} style={styles.historyItem}>
                          <Text style={styles.historyTitle}>
                            {[
                              formatHistoryDate(item.recordedAt, locale),
                              statusLabel(item.status, log.title.type, locale),
                              seasonEpisodeLabel(item.seasonNumber, item.episodeNumber),
                              item.rating ? `${item.rating}/5` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                          <Text style={styles.meta}>
                            {[
                              item.ott,
                              item.place ? placeLabels[locale][item.place] : null,
                              item.occasion ? occasionLabels[locale][item.occasion] : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                          {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
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
	    togetherCard: {
	      borderRadius: 18,
	      borderWidth: 1,
	      borderColor: colors.outlineVariant,
	      backgroundColor: colors.surface,
	      padding: 14,
	      gap: 12,
	    },
	    togetherBody: { gap: 4 },
	    togetherButton: {
	      minHeight: 46,
	      borderRadius: 14,
	      backgroundColor: colors.primaryContainer,
	      alignItems: 'center',
	      justifyContent: 'center',
	    },
	    togetherButtonText: { ...Typography.labelLg, color: colors.background },
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
    list: { gap: 12 },
    card: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 10,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    date: { ...Typography.labelLg, color: colors.onSurfaceVariant },
    syncState: { ...Typography.labelLg, color: colors.warning },
    meta: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    note: { ...Typography.bodyMd, color: colors.onSurface },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    fieldLabel: { ...Typography.labelLg, color: colors.onSurface },
    editBox: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
      gap: 10,
    },
    inlineInputs: { flexDirection: 'row', gap: 8 },
    inlineSelect: { flex: 1 },
    input: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      color: colors.onSurface,
      paddingHorizontal: 12,
      ...Typography.bodyMd,
    },
    noteInput: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
    actionRow: { flexDirection: 'row', gap: 8 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    chipActive: { borderColor: colors.primaryContainer, backgroundColor: colors.surfaceStrong },
    chipText: { ...Typography.labelLg, color: colors.onSurface },
    chipTextActive: { color: colors.primaryContainer },
    primaryButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: colors.background, fontWeight: '800' },
    secondaryButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: { color: colors.onSurface, fontWeight: '800' },
    disabledButton: { opacity: 0.55 },
    historyBox: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
      gap: 8,
    },
    historyItem: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      padding: 10,
      gap: 4,
    },
    historyTitle: { ...Typography.labelLg, color: colors.onSurface },
    errorText: { ...Typography.bodyMd, color: colors.error },
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
