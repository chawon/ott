import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { ThemeColors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import {
  createComment,
  getDiscussion,
  getMyDiscussionReaction,
  listComments,
  searchTitles,
  toggleDiscussionReaction,
  trackEvent,
} from '../../lib/api';
import { formatShortDate, statusLabel, typeLabel } from '../../lib/format';
import { uuid } from '../../lib/id';
import {
  countLogsLocal,
  enqueueLogOutbox,
  listLogsByTitleLocal,
  upsertLogLocal,
} from '../../lib/localDb';
import { publicDiscussionCopy, type NativeLocale } from '../../lib/i18n';
import { useNativePreferences } from '../../lib/nativePreferences';
import { syncNow } from '../../lib/sync';
import { buildOutboxPayload } from '../../lib/syncPayload';
import type {
  Comment,
  DiscussionListItem,
  DiscussionReactionSummary,
  DiscussionReactionType,
  MentionRef,
  Provider,
  Status,
  Title,
  TitleSearchItem,
  WatchLog,
} from '../../lib/types';
import { useAuthStore } from '../../store/authStore';

const REACTIONS: DiscussionReactionType[] = ['DONE', 'CURIOUS', 'SAVE'];

const EMPTY_SUMMARY: DiscussionReactionSummary = {
  done: 0,
  curious: 0,
  save: 0,
};

type SelectedMention = MentionRef & {
  name: string;
  year?: number | null;
};

type PublicDiscussionCopy = (typeof publicDiscussionCopy)[NativeLocale];

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function normalizeProvider(value: DiscussionListItem['titleProvider']): Provider | undefined {
  return value === 'TMDB' || value === 'LOCAL' || value === 'NAVER' ? value : undefined;
}

function titleFromDiscussion(item: DiscussionListItem): Title {
  return {
    id: item.titleId,
    type: item.titleType,
    name: item.titleName,
    year: item.titleYear ?? null,
    posterUrl: item.posterUrl ?? null,
    provider: normalizeProvider(item.titleProvider),
    providerId: item.titleProviderId ?? undefined,
  };
}

function reactionStatus(type: DiscussionReactionType): Status {
  return type === 'DONE' ? 'DONE' : 'WISHLIST';
}

function reactionLabel(type: DiscussionReactionType, copy: PublicDiscussionCopy, title?: Title) {
  if (type === 'DONE') return title?.type === 'book' ? copy.reactionDoneBook : copy.reactionDoneDefault;
  if (type === 'CURIOUS') return copy.reactionCurious;
  return copy.reactionSave;
}

function summaryCount(summary: DiscussionReactionSummary, type: DiscussionReactionType) {
  if (type === 'DONE') return summary.done ?? 0;
  if (type === 'CURIOUS') return summary.curious ?? 0;
  return summary.save ?? 0;
}

function formatCommentBody(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export default function PublicDiscussionDetailScreen() {
  const { colors, locale } = useNativePreferences();
  const copy = publicDiscussionCopy[locale];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const discussionId = singleParam(id);
  const { userId, deviceId, ensureRegistered } = useAuthStore();
  const [detail, setDetail] = useState<DiscussionListItem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [summary, setSummary] = useState<DiscussionReactionSummary>(EMPTY_SUMMARY);
  const [selectedTypes, setSelectedTypes] = useState<DiscussionReactionType[]>([]);
  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<SelectedMention[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<TitleSearchItem[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [pendingReaction, setPendingReaction] = useState<DiscussionReactionType | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const title = useMemo(() => (detail ? titleFromDiscussion(detail) : null), [detail]);

  useEffect(() => {
    const query = mentionQuery.trim();
    if (query.length < 2) {
      setMentionResults([]);
      setMentionLoading(false);
      return;
    }

    let cancelled = false;
    setMentionLoading(true);
    const timer = setTimeout(async () => {
      try {
        const items = await searchTitles(query, 'ALL');
        if (cancelled) return;
        setMentionResults(
          items
            .filter((item) => item.provider === 'TMDB' && item.type !== 'book')
            .slice(0, 6),
        );
      } catch {
        if (!cancelled) setMentionResults([]);
      } finally {
        if (!cancelled) setMentionLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mentionQuery]);

  const load = useCallback(async () => {
    if (!discussionId) return;
    setLoading(true);
    setMessage(null);
    try {
      const nextDetail = await getDiscussion(discussionId);
      const [nextComments, reactionState] = await Promise.all([
        listComments(discussionId, 200),
        userId && deviceId ? getMyDiscussionReaction(discussionId).catch(() => null) : null,
      ]);
      setDetail(nextDetail);
      setComments(nextComments);
      setSummary(reactionState?.summary ?? nextDetail.reactionSummary ?? EMPTY_SUMMARY);
      setSelectedTypes(reactionState?.selectedTypes ?? []);
      trackEvent({
        eventName: 'discussion_open',
        properties: {
          source: 'ios_native_together',
          titleType: nextDetail.titleType,
          commentCount: nextDetail.commentCount,
        },
      }).catch(() => null);
    } catch (error) {
      Alert.alert(copy.loadErrorTitle, error instanceof Error ? error.message : copy.loadErrorFallback);
    } finally {
      setLoading(false);
    }
  }, [copy.loadErrorFallback, copy.loadErrorTitle, deviceId, discussionId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function ensureLocalRecord(type: DiscussionReactionType) {
    if (!title) return 'missing-title' as const;
    const existing = await listLogsByTitleLocal(title.id);
    if (existing.length > 0) return 'exists' as const;

    const logCountBeforeSave = await countLogsLocal();
    const now = new Date().toISOString();
    const status = reactionStatus(type);
    const log: WatchLog = {
      id: uuid(),
      title: { ...title, updatedAt: now },
      status,
      rating: null,
      note: null,
      spoiler: false,
      ott: null,
      seasonNumber: null,
      episodeNumber: null,
      seasonPosterUrl: null,
      seasonYear: null,
      origin: 'LOG',
      watchedAt: now,
      place: null,
      occasion: null,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    await upsertLogLocal(log);
    await enqueueLogOutbox(log, buildOutboxPayload(log, now));
    trackEvent({
      eventName: 'log_create',
      properties: {
        source: 'ios_native_public_reaction',
        reactionType: type,
        titleType: title.type,
        status,
      },
    }).catch(() => null);
    if (logCountBeforeSave === 0) {
      trackEvent({
        eventName: 'first_log_create',
        properties: {
          source: 'ios_native_public_reaction',
          reactionType: type,
          titleType: title.type,
        },
      }).catch(() => null);
    }
    await syncNow({ registerIfNeeded: true }).catch(() => null);
    return 'created' as const;
  }

  async function toggleReaction(type: DiscussionReactionType) {
    if (!discussionId || pendingReaction) return;
    setPendingReaction(type);
    setMessage(null);
    try {
      await ensureRegistered();
      const state = await toggleDiscussionReaction(discussionId, type);
      setSummary(state.summary);
      setSelectedTypes(state.selectedTypes ?? []);
      trackEvent({
        eventName: 'reaction_set',
        properties: {
          source: 'ios_native_together',
          reactionType: type,
          selected: state.selected,
          titleType: title?.type ?? null,
        },
      }).catch(() => null);

      if (!state.selected) {
        setMessage(copy.reactionCancelled);
        return;
      }

      const localResult = await ensureLocalRecord(type);
      setMessage(
        localResult === 'created'
          ? formatCopy(copy.reactionSavedToTimeline, {
              status: statusLabel(reactionStatus(type), title?.type, locale),
            })
          : copy.alreadyInTimeline,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.reactionError);
    } finally {
      setPendingReaction(null);
    }
  }

  async function postComment() {
    if (!discussionId || !body.trim() || posting) return;
    setPosting(true);
    setMessage(null);
    try {
      await ensureRegistered();
      const created = await createComment(discussionId, {
        body: body.trim(),
        mentions: mentions.map(({ provider, providerId, titleType }) => ({
          provider,
          providerId,
          titleType,
        })),
        syncLog: true,
      });
      setComments((prev) => [...prev, created]);
      setBody('');
      setMentions([]);
      setMentionQuery('');
      setMentionResults([]);
      await syncNow({ registerIfNeeded: true }).catch(() => null);
      trackEvent({
        eventName: 'comment_create',
        properties: {
          source: 'ios_native_together',
          titleType: title?.type ?? null,
          bodyLength: created.body.length,
          mentionCount: mentions.length,
        },
      }).catch(() => null);
      setMessage(copy.commentCreated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.commentError);
    } finally {
      setPosting(false);
    }
  }

  function addMention(item: TitleSearchItem) {
    const exists = mentions.some(
      (mention) => mention.provider === item.provider && mention.providerId === item.providerId,
    );
    if (exists || item.provider !== 'TMDB' || item.type === 'book') return;
    const next: SelectedMention = {
      provider: item.provider,
      providerId: item.providerId,
      titleType: item.type,
      name: item.name,
      year: item.year ?? null,
    };
    setMentions((prev) => [...prev, next]);
    const token = `@{${item.name}}`;
    setBody((prev) => (prev.trim() ? `${prev.trim()} ${token}` : token));
    setMentionQuery('');
    setMentionResults([]);
  }

  function removeMention(provider: string, providerId: string) {
    setMentions((prev) =>
      prev.filter((mention) => !(mention.provider === provider && mention.providerId === providerId)),
    );
  }

  if (!discussionId) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.emptyTitle}>{copy.invalidRoute}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primaryContainer} />
          </View>
        ) : detail && title ? (
          <>
            <View style={styles.heroCard}>
              {detail.posterUrl ? (
                <Image source={{ uri: detail.posterUrl }} style={styles.poster} />
              ) : (
                <View style={styles.posterEmpty}>
                  <Text style={styles.posterEmptyText}>{typeLabel(detail.titleType, locale)}</Text>
                </View>
              )}
              <View style={styles.heroBody}>
                <Text style={styles.itemTitle}>{detail.titleName}</Text>
                <Text style={styles.meta}>
                  {[
                    typeLabel(detail.titleType, locale),
                    detail.titleYear,
                    formatCopy(copy.commentsCount, { count: comments.length }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/title/[id]',
                      params: { id: detail.titleId },
                    })
                  }
                  style={styles.linkButton}
                >
                  <Text style={styles.linkButtonText}>{copy.viewMyLogs}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{copy.reactionsTitle}</Text>
              <View style={styles.reactionRow}>
                {REACTIONS.map((type) => {
                  const selected = selectedTypes.includes(type);
                  const pending = pendingReaction === type;
                  return (
                    <Pressable
                      key={type}
                      disabled={pendingReaction != null}
                      onPress={() => toggleReaction(type)}
                      style={[styles.reactionChip, selected && styles.reactionChipActive, pending && styles.disabled]}
                    >
                      <Text style={[styles.reactionText, selected && styles.reactionTextActive]}>
                        {reactionLabel(type, copy, title)} {summaryCount(summary, type)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {message ? <Text style={styles.message}>{message}</Text> : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {formatCopy(copy.commentsCount, { count: comments.length })}
              </Text>
              <View style={styles.comments}>
                {comments.length === 0 ? (
                  <View style={styles.emptyInline}>
                    <Text style={styles.desc}>{copy.emptyComments}</Text>
                  </View>
                ) : (
                  comments.map((comment) => {
                    const mine = userId && comment.userId === userId;
                    return (
                      <View key={comment.id} style={[styles.comment, mine && styles.myComment]}>
                        <View style={styles.commentTop}>
                          <Text style={styles.author}>
                            {comment.authorName}
                            {mine ? ` · ${copy.mineSuffix}` : ''}
                          </Text>
                          <Text style={styles.date}>{formatShortDate(comment.createdAt, locale)}</Text>
                        </View>
                        <Text style={styles.commentBody}>{formatCommentBody(comment.body)}</Text>
                      </View>
                    );
                  })
                )}
              </View>

              <View style={styles.mentionBox}>
                <Text style={styles.fieldLabel}>{copy.mentionTitle}</Text>
                <Text style={styles.desc}>{copy.mentionDesc}</Text>
                <TextInput
                  value={mentionQuery}
                  onChangeText={setMentionQuery}
                  placeholder={copy.mentionPlaceholder}
                  placeholderTextColor={colors.onSurfaceVariant}
                  selectionColor={colors.primaryContainer}
                  style={styles.mentionInput}
                  autoCorrect={false}
                />
                {mentionLoading ? <Text style={styles.date}>{copy.mentionSearchLoading}</Text> : null}
                {mentions.length > 0 ? (
                  <View style={styles.mentionChips}>
                    {mentions.map((mention) => (
                      <Pressable
                        key={`${mention.provider}:${mention.providerId}`}
                        onPress={() => removeMention(mention.provider, mention.providerId)}
                        style={styles.mentionChip}
                      >
                        <Text style={styles.mentionChipText}>@{mention.name} ×</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {mentionResults.length > 0 ? (
                  <View style={styles.mentionResults}>
                    {mentionResults.map((item) => (
                      <Pressable
                        key={`${item.provider}:${item.providerId}`}
                        onPress={() => addMention(item)}
                        style={styles.mentionResult}
                      >
                        <View style={styles.mentionResultBody}>
                          <Text style={styles.mentionTitle}>{item.name}</Text>
                          <Text style={styles.date}>
                            {[typeLabel(item.type, locale), item.year].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <Text style={styles.addText}>{copy.addMention}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={copy.commentPlaceholder}
                placeholderTextColor={colors.onSurfaceVariant}
                selectionColor={colors.primaryContainer}
                multiline
                style={styles.commentInput}
              />
              <Pressable
                disabled={!body.trim() || posting}
                onPress={postComment}
                style={[styles.primaryButton, (!body.trim() || posting) && styles.disabled]}
              >
                <Text style={styles.primaryButtonText}>{posting ? copy.posting : copy.commentSubmit}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{copy.notFoundTitle}</Text>
            <Text style={styles.desc}>{copy.notFoundDesc}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingTop: 0, paddingBottom: 120, gap: 16 },
    desc: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    center: { padding: 32, alignItems: 'center', justifyContent: 'center' },
    heroCard: {
      flexDirection: 'row',
      gap: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      padding: 14,
    },
    poster: { width: 76, height: 112, borderRadius: 14, backgroundColor: colors.surfaceMuted },
    posterEmpty: {
      width: 76,
      height: 112,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    posterEmptyText: { ...Typography.labelSm, color: colors.onSurfaceVariant },
    heroBody: { flex: 1, gap: 8, justifyContent: 'center' },
    itemTitle: { ...Typography.headlineMd, color: colors.onSurface },
    meta: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    linkButton: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    linkButtonText: { ...Typography.labelLg, color: colors.primaryContainer },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 12,
    },
    sectionTitle: { ...Typography.headlineSm, color: colors.onSurface },
    fieldLabel: { ...Typography.labelLg, color: colors.onSurface },
    reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    reactionChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    reactionChipActive: { borderColor: colors.primaryContainer, backgroundColor: colors.primaryContainer },
    reactionText: { ...Typography.labelLg, color: colors.onSurface },
    reactionTextActive: { color: colors.background },
    message: { ...Typography.bodyMd, color: colors.secondary },
    comments: { gap: 10 },
    comment: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
      gap: 6,
    },
    myComment: { borderColor: colors.success, backgroundColor: colors.surfaceStrong },
    commentTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    author: { ...Typography.labelLg, color: colors.onSurface },
    date: { ...Typography.labelLg, color: colors.onSurfaceVariant },
    commentBody: { ...Typography.bodyMd, color: colors.onSurface },
    mentionBox: {
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
      gap: 8,
    },
    mentionInput: {
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      color: colors.onSurface,
      ...Typography.bodyMd,
    },
    mentionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    mentionChip: {
      borderRadius: 999,
      backgroundColor: colors.primaryContainer,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    mentionChipText: { ...Typography.labelLg, color: colors.background },
    mentionResults: { gap: 6 },
    mentionResult: {
      minHeight: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 9,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    mentionResultBody: { flex: 1, gap: 3 },
    mentionTitle: { ...Typography.bodyMd, color: colors.onSurface, fontWeight: '700' },
    addText: { ...Typography.labelLg, color: colors.primaryContainer },
    empty: {
      borderRadius: 20,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.outline,
      padding: 24,
      gap: 8,
    },
    emptyInline: {
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.outline,
      padding: 18,
    },
    emptyTitle: { ...Typography.headlineSm, color: colors.onSurface },
    commentInput: {
      minHeight: 96,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 12,
      paddingTop: 12,
      color: colors.onSurface,
      textAlignVertical: 'top',
      ...Typography.bodyMd,
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: colors.background, fontWeight: '800' },
    disabled: { opacity: 0.5 },
  });
}
