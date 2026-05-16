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
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { searchTitles } from '../../../lib/api';
import { inputDateToIso, statusLabel, todayInputValue, typeLabel } from '../../../lib/format';
import { uuid } from '../../../lib/id';
import { enqueueLogOutbox, upsertLogLocal } from '../../../lib/localDb';
import { syncNow } from '../../../lib/sync';
import { buildOutboxPayload } from '../../../lib/syncPayload';
import type { Occasion, Place, Status, Title, TitleSearchItem, TitleType, WatchLog } from '../../../lib/types';

type FilterType = 'ALL' | TitleType;

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'movie', label: '영화' },
  { value: 'series', label: '시리즈' },
  { value: 'book', label: '책' },
];

const STATUSES: Status[] = ['DONE', 'IN_PROGRESS', 'WISHLIST'];

const PLACES: { value: Place; label: string }[] = [
  { value: 'HOME', label: '집' },
  { value: 'THEATER', label: '극장' },
  { value: 'CAFE', label: '카페' },
  { value: 'TRANSIT', label: '이동 중' },
  { value: 'LIBRARY', label: '도서관' },
  { value: 'BOOKSTORE', label: '서점' },
];

const OCCASIONS: { value: Occasion; label: string }[] = [
  { value: 'ALONE', label: '혼자' },
  { value: 'FRIENDS', label: '친구' },
  { value: 'FAMILY', label: '가족' },
  { value: 'DATE', label: '데이트' },
  { value: 'BREAK', label: '휴식' },
];

const OTT_OPTIONS = ['넷플릭스', '디즈니+', '티빙', '웨이브', '왓챠', '쿠팡플레이', '극장', '도서관'];

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
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [results, setResults] = useState<TitleSearchItem[]>([]);
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await searchTitles(query.trim(), filter);
        setResults(items.slice(0, 20));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [query, filter]);

  const ratingValue = useMemo(() => {
    const parsed = Number(rating);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.min(5, Math.max(0.5, parsed));
  }, [rating]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    const now = new Date().toISOString();
    const title = titleFromSearch(selected, selected.titleId ?? uuid());
    const log: WatchLog = {
      id: uuid(),
      title,
      status,
      rating: ratingValue,
      note: note.trim() || null,
      spoiler: false,
      ott,
      seasonNumber: null,
      episodeNumber: null,
      origin: 'LOG',
      watchedAt: inputDateToIso(watchedAt),
      place,
      occasion,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    try {
      await upsertLogLocal(log);
      await enqueueLogOutbox(log, buildOutboxPayload(log, now));
      await syncNow({ registerIfNeeded: true }).catch(() => null);
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
      Alert.alert('저장 완료', '타임라인에 기록했어요.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '기록 저장에 실패했습니다.';
      Alert.alert('저장 실패', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.kicker}>ottline iOS</Text>
          <Text style={styles.title}>무엇을 남길까요?</Text>
          <Text style={styles.desc}>검색해서 고르고, 지금 기기에 먼저 저장한 뒤 자동으로 동기화합니다.</Text>
        </View>

        <View style={styles.searchBox}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="작품명, 책 제목 검색"
            placeholderTextColor={Colors.onSurfaceVariant}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {loading ? <ActivityIndicator color={Colors.secondary} /> : null}
        </View>

        <View style={styles.segment}>
          {FILTERS.map((item) => (
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
              {[typeLabel(selected.type), selected.year, selected.author].filter(Boolean).join(' · ')}
            </Text>

            <Text style={styles.fieldLabel}>상태</Text>
            <View style={styles.optionRow}>
              {STATUSES.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setStatus(item)}
                  style={[styles.chip, status === item && styles.chipActive]}
                >
                  <Text style={[styles.chipText, status === item && styles.chipTextActive]}>
                    {statusLabel(item, selected.type)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>날짜와 별점</Text>
            <View style={styles.inlineInputs}>
              <TextInput value={watchedAt} onChangeText={setWatchedAt} style={styles.smallInput} />
              <TextInput
                value={rating}
                onChangeText={setRating}
                placeholder="별점 0.5-5"
                placeholderTextColor={Colors.onSurfaceVariant}
                keyboardType="decimal-pad"
                style={styles.smallInput}
              />
            </View>

            <Text style={styles.fieldLabel}>장소</Text>
            <View style={styles.optionRow}>
              {PLACES.map((item) => (
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

            <Text style={styles.fieldLabel}>상황</Text>
            <View style={styles.optionRow}>
              {OCCASIONS.map((item) => (
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

            <Text style={styles.fieldLabel}>플랫폼</Text>
            <View style={styles.optionRow}>
              {OTT_OPTIONS.map((item) => (
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

            <Text style={styles.fieldLabel}>메모</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="짧게 남겨두면 나중에 다시 찾기 쉬워요."
              placeholderTextColor={Colors.onSurfaceVariant}
              style={[styles.input, styles.noteInput]}
            />

            <View style={styles.actionRow}>
              <Pressable onPress={() => setSelected(null)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>다시 선택</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={saving}
                style={[styles.primaryButton, saving && styles.disabledButton]}
              >
                <Text style={styles.primaryButtonText}>{saving ? '저장 중' : '기록 저장'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.results}>
            {results.map((item) => (
              <Pressable key={`${item.provider}:${item.providerId}`} style={styles.result} onPress={() => setSelected(item)}>
                {item.posterUrl ? (
                  <Image source={{ uri: item.posterUrl }} style={styles.poster} />
                ) : (
                  <View style={styles.posterEmpty}>
                    <Text style={styles.posterEmptyText}>{typeLabel(item.type)}</Text>
                  </View>
                )}
                <View style={styles.resultBody}>
                  <Text style={styles.resultTitle}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {[typeLabel(item.type), item.year, item.author].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingTop: 64, paddingBottom: 120, gap: 16 },
  header: { gap: 8 },
  kicker: { ...Typography.accent },
  title: { ...Typography.headlineLg, fontSize: 30 },
  desc: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  searchBox: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, minHeight: 48, color: Colors.onSurface, ...Typography.bodyLg },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segmentItem: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: Colors.surface,
  },
  segmentItemActive: { borderColor: Colors.primaryContainer, backgroundColor: '#e7f0fb' },
  segmentText: { ...Typography.labelLg },
  segmentTextActive: { color: Colors.primaryContainer },
  results: { gap: 10 },
  result: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
    padding: 10,
  },
  poster: { width: 56, height: 78, borderRadius: 10, backgroundColor: Colors.surfaceMuted },
  posterEmpty: {
    width: 56,
    height: 78,
    borderRadius: 10,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterEmptyText: { ...Typography.labelSm },
  resultBody: { flex: 1, justifyContent: 'center', gap: 4 },
  resultTitle: { ...Typography.headlineSm },
  meta: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  card: {
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { ...Typography.headlineMd },
  fieldLabel: { ...Typography.labelLg, marginTop: 4 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.primaryContainer, backgroundColor: '#e7f0fb' },
  chipText: { ...Typography.labelLg },
  chipTextActive: { color: Colors.primaryContainer },
  inlineInputs: { flexDirection: 'row', gap: 10 },
  smallInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    color: Colors.onSurface,
  },
  noteInput: {
    minHeight: 92,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceMuted,
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
    backgroundColor: Colors.primaryContainer,
  },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
  },
  secondaryButtonText: { color: Colors.onSurface, fontWeight: '800' },
  disabledButton: { opacity: 0.55 },
});
