import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ThemeColors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { createFeedbackThread, listFeedbackThreads, trackEvent } from '../../lib/api';
import { formatShortDate } from '../../lib/format';
import { feedbackCopy, type NativeLocale } from '../../lib/i18n';
import { useNativePreferences } from '../../lib/nativePreferences';
import type { FeedbackCategory, FeedbackStatus, FeedbackThreadSummary } from '../../lib/types';
import { useAuthStore } from '../../store/authStore';

const CATEGORIES: FeedbackCategory[] = ['QUESTION', 'BUG', 'IDEA', 'OTHER'];

type FeedbackCopy = (typeof feedbackCopy)[NativeLocale];

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function feedbackCategoryParam(value: string | undefined): FeedbackCategory | null {
  return value === 'QUESTION' || value === 'BUG' || value === 'IDEA' || value === 'OTHER'
    ? value
    : null;
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

export default function FeedbackScreen() {
  const { colors, locale } = useNativePreferences();
  const copy = feedbackCopy[locale];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    body?: string | string[];
    category?: string | string[];
    source?: string | string[];
    subject?: string | string[];
  }>();
  const categoryParam = singleParam(params.category);
  const subjectParam = singleParam(params.subject);
  const bodyParam = singleParam(params.body);
  const sourceParam = singleParam(params.source);
  const { ensureRegistered } = useAuthStore();
  const [threads, setThreads] = useState<FeedbackThreadSummary[]>([]);
  const [category, setCategory] = useState<FeedbackCategory>(() => feedbackCategoryParam(categoryParam) ?? 'QUESTION');
  const [subject, setSubject] = useState(subjectParam ?? '');
  const [body, setBody] = useState(bodyParam ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const nextCategory = feedbackCategoryParam(categoryParam);
    if (nextCategory) setCategory(nextCategory);
    if (subjectParam !== undefined) setSubject(subjectParam);
    if (bodyParam !== undefined) setBody(bodyParam);
  }, [bodyParam, categoryParam, subjectParam]);

  const load = useCallback(async () => {
    try {
      await ensureRegistered();
      setThreads(await listFeedbackThreads());
    } catch {
      setThreads([]);
    }
  }, [ensureRegistered]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      await ensureRegistered();
      const created = await createFeedbackThread({
        category,
        subject: subject.trim() || copy.defaultSubject,
        body: body.trim(),
      });
      trackEvent({
        eventName: 'feedback_create',
        properties: {
          source: sourceParam ?? 'ios_native_feedback',
          category,
          bodyLength: body.trim().length,
        },
      }).catch(() => null);
      setSubject('');
      setBody('');
      setStatus(copy.submitSuccess);
      await load();
      router.push({
        pathname: '/feedback/[id]',
        params: { id: created.id },
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.submitErrorFallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{copy.kicker}</Text>
          <Text style={styles.title}>{copy.listTitle}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{copy.newThread}</Text>
        <View style={styles.segment}>
          {CATEGORIES.map((item) => (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[styles.chip, category === item && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === item && styles.chipTextActive]}>
                {categoryLabel(item, copy)}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder={copy.subjectPlaceholder}
          placeholderTextColor={colors.onSurfaceVariant}
          selectionColor={colors.focus}
          style={styles.input}
        />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={copy.bodyPlaceholder}
          placeholderTextColor={colors.onSurfaceVariant}
          selectionColor={colors.focus}
          multiline
          style={[styles.input, styles.bodyInput]}
        />
        <Pressable disabled={busy || !body.trim()} onPress={submit} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{busy ? copy.submitting : copy.submit}</Text>
        </Pressable>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{copy.myThreads}</Text>
        {threads.length === 0 ? (
          <Text style={styles.desc}>{copy.emptyThreads}</Text>
        ) : (
          threads.map((thread) => (
            <Pressable
              key={thread.id}
              style={styles.thread}
              onPress={() =>
                router.push({
                  pathname: '/feedback/[id]',
                  params: { id: thread.id },
                })
              }
            >
              <View style={styles.threadTop}>
                <Text style={styles.threadSubject}>{thread.subject || copy.noSubject}</Text>
                <Text style={styles.threadStatus}>{statusLabel(thread.status, copy)}</Text>
              </View>
              <Text style={styles.desc}>{thread.lastMessagePreview}</Text>
              <Text style={styles.date}>
                {formatShortDate(thread.updatedAt, locale)}
                {thread.lastAuthorRole === 'ADMIN' ? ` · ${copy.adminReplyArrived}` : ''}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingTop: 56, paddingBottom: 80, gap: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    backText: { fontSize: 30, lineHeight: 32, color: colors.link },
    kicker: { ...Typography.accent, color: colors.onSurfaceVariant },
    title: { ...Typography.headlineLg, color: colors.onBackground, fontSize: 30 },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 12,
    },
    sectionTitle: { ...Typography.headlineSm, color: colors.onSurface },
    desc: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipActive: { borderColor: colors.link, backgroundColor: colors.selectedSurface },
    chipText: { ...Typography.labelLg, color: colors.onSurface },
    chipTextActive: { color: colors.link },
    input: {
      minHeight: 50,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      color: colors.onSurface,
      ...Typography.bodyLg,
    },
    bodyInput: { minHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
    primaryButton: {
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: colors.onAction, fontWeight: '800' },
    status: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    thread: { borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: 12, gap: 4 },
    threadTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    threadSubject: { ...Typography.bodyLg, color: colors.onSurface, flex: 1, fontWeight: '700' },
    threadStatus: { ...Typography.labelLg, color: colors.onSurfaceVariant },
    date: { ...Typography.labelSm, color: colors.onSurfaceVariant },
  });
}
