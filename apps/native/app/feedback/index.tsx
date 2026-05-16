import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { createFeedbackThread, listFeedbackThreads } from '../../lib/api';
import { formatShortDate } from '../../lib/format';
import type { FeedbackCategory, FeedbackThreadSummary } from '../../lib/types';
import { useAuthStore } from '../../store/authStore';

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'QUESTION', label: '질문' },
  { value: 'BUG', label: '버그' },
  { value: 'IDEA', label: '제안' },
  { value: 'OTHER', label: '기타' },
];

export default function FeedbackScreen() {
  const { ensureRegistered } = useAuthStore();
  const [threads, setThreads] = useState<FeedbackThreadSummary[]>([]);
  const [category, setCategory] = useState<FeedbackCategory>('QUESTION');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      await createFeedbackThread({
        category,
        subject: subject.trim() || 'iOS 앱 문의',
        body: body.trim(),
      });
      setSubject('');
      setBody('');
      setStatus('문의가 등록됐어요.');
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '문의 등록에 실패했습니다.');
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
          <Text style={styles.kicker}>Feedback</Text>
          <Text style={styles.title}>문의함</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>새 문의</Text>
        <View style={styles.segment}>
          {CATEGORIES.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setCategory(item.value)}
              style={[styles.chip, category === item.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === item.value && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder="제목"
          placeholderTextColor={Colors.onSurfaceVariant}
          style={styles.input}
        />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="문의 내용을 남겨주세요."
          placeholderTextColor={Colors.onSurfaceVariant}
          multiline
          style={[styles.input, styles.bodyInput]}
        />
        <Pressable disabled={busy || !body.trim()} onPress={submit} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{busy ? '등록 중' : '문의 등록'}</Text>
        </Pressable>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>내 문의</Text>
        {threads.length === 0 ? (
          <Text style={styles.desc}>아직 문의가 없어요.</Text>
        ) : (
          threads.map((thread) => (
            <View key={thread.id} style={styles.thread}>
              <View style={styles.threadTop}>
                <Text style={styles.threadSubject}>{thread.subject || '제목 없음'}</Text>
                <Text style={styles.threadStatus}>{thread.status}</Text>
              </View>
              <Text style={styles.desc}>{thread.lastMessagePreview}</Text>
              <Text style={styles.date}>{formatShortDate(thread.updatedAt)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingTop: 56, paddingBottom: 80, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  backText: { fontSize: 30, lineHeight: 32, color: Colors.primaryContainer },
  kicker: { ...Typography.accent },
  title: { ...Typography.headlineLg, fontSize: 30 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { ...Typography.headlineSm },
  desc: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { borderColor: Colors.primaryContainer, backgroundColor: '#e7f0fb' },
  chipText: { ...Typography.labelLg },
  chipTextActive: { color: Colors.primaryContainer },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 12,
    color: Colors.onSurface,
    ...Typography.bodyLg,
  },
  bodyInput: { minHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  status: { ...Typography.bodyMd, color: Colors.secondary },
  thread: { borderTopWidth: 1, borderTopColor: Colors.outlineVariant, paddingTop: 12, gap: 4 },
  threadTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  threadSubject: { ...Typography.bodyLg, flex: 1, fontWeight: '700' },
  threadStatus: { ...Typography.labelLg, color: Colors.primaryContainer },
  date: { ...Typography.labelSm },
});
