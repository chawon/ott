import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ThemeColors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { getFeedbackThread, trackEvent } from '../../lib/api';
import { formatShortDate } from '../../lib/format';
import { feedbackCopy, type NativeLocale } from '../../lib/i18n';
import { useNativePreferences } from '../../lib/nativePreferences';
import type {
  FeedbackAuthorRole,
  FeedbackCategory,
  FeedbackStatus,
  FeedbackThreadDetail,
} from '../../lib/types';
import { useAuthStore } from '../../store/authStore';

type FeedbackCopy = (typeof feedbackCopy)[NativeLocale];

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function categoryLabel(value: FeedbackCategory, copy: FeedbackCopy) {
  switch (value) {
    case 'BUG':
      return copy.categoryBug;
    case 'IDEA':
      return copy.categoryIdea;
    case 'OTHER':
      return copy.categoryOther;
    case 'QUESTION':
    default:
      return copy.categoryQuestion;
  }
}

function statusLabel(value: FeedbackStatus, copy: FeedbackCopy) {
  switch (value) {
    case 'ANSWERED':
      return copy.statusAnswered;
    case 'CLOSED':
      return copy.statusClosed;
    case 'OPEN':
    default:
      return copy.statusOpen;
  }
}

function roleLabel(value: FeedbackAuthorRole, copy: FeedbackCopy) {
  return value === 'ADMIN' ? copy.roleAdmin : copy.roleUser;
}

export default function FeedbackDetailScreen() {
  const { colors, locale } = useNativePreferences();
  const copy = feedbackCopy[locale];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = singleParam(id);
  const { ensureRegistered } = useAuthStore();
  const [detail, setDetail] = useState<FeedbackThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!threadId) return;
    setError(null);
    try {
      await ensureRegistered();
      const next = await getFeedbackThread(threadId);
      setDetail(next);
      trackEvent({
        eventName: 'feedback_open',
        properties: {
          source: 'ios_native_feedback',
          status: next.status,
          category: next.category,
          messageCount: next.messages.length,
        },
      }).catch(() => null);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.detailErrorFallback);
    } finally {
      setLoading(false);
    }
  }, [copy.detailErrorFallback, ensureRegistered, threadId]);

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

  if (!threadId) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.emptyTitle}>{copy.invalidRoute}</Text>
      </View>
    );
  }

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
          <Text style={styles.title}>{detail?.subject || copy.detailTitleFallback}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{copy.errorTitle}</Text>
          <Text style={styles.desc}>{error}</Text>
        </View>
      ) : detail ? (
        <>
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{categoryLabel(detail.category, copy)}</Text>
              </View>
              <View style={[styles.badge, detail.status === 'ANSWERED' && styles.badgeAnswered]}>
                <Text
                  style={[
                    styles.badgeText,
                    detail.status === 'ANSWERED' && styles.badgeAnsweredText,
                  ]}
                >
                  {statusLabel(detail.status, copy)}
                </Text>
              </View>
            </View>
            <Text style={styles.sectionTitle}>{detail.subject || copy.defaultSubject}</Text>
            <Text style={styles.desc}>
              {formatCopy(copy.createdUpdated, {
                created: formatShortDate(detail.createdAt, locale),
                updated: formatShortDate(detail.updatedAt, locale),
              })}
            </Text>
            <Text style={styles.desc}>{copy.desc}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{copy.conversation}</Text>
            {detail.messages.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.desc}>{copy.messageEmpty}</Text>
              </View>
            ) : (
              detail.messages.map((message) => {
                const admin = message.authorRole === 'ADMIN';
                return (
                  <View key={message.id} style={[styles.message, admin && styles.adminMessage]}>
                    <View style={styles.messageTop}>
                      <Text style={[styles.author, admin && styles.adminAuthor]}>
                        {roleLabel(message.authorRole, copy)}
                      </Text>
                      <Text style={styles.date}>{formatShortDate(message.createdAt, locale)}</Text>
                    </View>
                    <Text style={styles.messageBody}>{message.body}</Text>
                  </View>
                );
              })
            )}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{copy.detailEmptyTitle}</Text>
          <Text style={styles.desc}>{copy.detailEmptyDesc}</Text>
        </View>
      )}
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
    center: { padding: 32, alignItems: 'center', justifyContent: 'center' },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 12,
    },
    sectionTitle: { ...Typography.headlineSm, color: colors.onSurface },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badge: {
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    badgeAnswered: { backgroundColor: colors.primaryContainer },
    badgeText: { ...Typography.labelLg, color: colors.primaryContainer },
    badgeAnsweredText: { color: colors.background },
    message: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
      gap: 8,
    },
    adminMessage: { borderColor: colors.primaryContainer, backgroundColor: colors.surfaceStrong },
    messageTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    author: { ...Typography.labelLg, color: colors.onSurface },
    adminAuthor: { color: colors.primaryContainer },
    date: { ...Typography.labelLg, color: colors.onSurfaceVariant },
    messageBody: { ...Typography.bodyMd, color: colors.onSurface },
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
  });
}
