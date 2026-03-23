import { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { PF } from '../../constants/typography';
import { searchTitles, syncPush } from '../../lib/api';
import type { Place, Occasion } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import type { TitleSearchItem, Status } from '../../lib/types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.94;
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 10) / 2;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  totalLogs?: number;
}

const TYPE_LABELS: Record<string, string> = { movie: 'MOVIE', series: 'TV', book: 'BOOK' };
const TYPE_COLORS: Record<string, string> = {
  movie: Colors.secondary,
  series: Colors.secondary,
  book: Colors.tertiary,
};

type FilterType = 'ALL' | 'movie' | 'series' | 'book';
const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'movie', label: '영화' },
  { key: 'series', label: 'TV 프로그램' },
  { key: 'book', label: '도서' },
];

const STATUS_OPTIONS: { value: Status; label: string; emoji: string }[] = [
  { value: 'DONE', label: '완료', emoji: '✓' },
  { value: 'IN_PROGRESS', label: '보는 중', emoji: '▶' },
  { value: 'WISHLIST', label: '보고 싶어요', emoji: '♡' },
];
const STATUS_COLORS: Record<Status, string> = {
  DONE: Colors.secondary,
  IN_PROGRESS: Colors.primary,
  WISHLIST: Colors.tertiary,
};

const VIDEO_PLATFORMS: { group: string; options: string[] }[] = [
  { group: 'OTT', options: ['넷플릭스', '디즈니플러스', '티빙', '웨이브', '쿠팡플레이', '애플티비', '프라임비디오', '왓챠'] },
  { group: '유료 방송', options: ['채널', 'VOD'] },
  { group: '물리 매체', options: ['DVD', '블루레이'] },
  { group: '극장', options: ['CGV', '롯데시네마', '메가박스', '씨네Q'] },
];

const BOOK_PLATFORMS: { group: string; options: string[] }[] = [
  { group: '서점', options: ['교보문고', '영풍문고', '예스24', '알라딘'] },
  { group: '전자책', options: ['리디', '밀리의서재', '윌라', '플레이북'] },
  { group: '도서관', options: ['공공도서관', '대학도서관', '학교도서관'] },
];

const PLACE_OPTIONS: { value: Place; label: string }[] = [
  { value: 'HOME', label: '집' },
  { value: 'THEATER', label: '극장' },
  { value: 'CAFE', label: '카페' },
  { value: 'OFFICE', label: '회사' },
  { value: 'SCHOOL', label: '학교' },
  { value: 'LIBRARY', label: '도서관' },
  { value: 'BOOKSTORE', label: '서점' },
  { value: 'PARK', label: '공원' },
  { value: 'OUTDOOR', label: '야외' },
  { value: 'TRANSIT', label: '이동 중' },
  { value: 'ETC', label: '기타' },
];

const OCCASION_OPTIONS: { value: Occasion; label: string }[] = [
  { value: 'ALONE', label: '혼자' },
  { value: 'DATE', label: '데이트' },
  { value: 'FAMILY', label: '가족' },
  { value: 'FRIENDS', label: '친구' },
  { value: 'BREAK', label: '휴식' },
  { value: 'ETC', label: '기타' },
];

const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 500, 1000];
function getNextMilestone(n: number) {
  return MILESTONES.find((m) => m > n) ?? Math.ceil((n + 1) / 100) * 100;
}

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const todayStr = () => new Date().toISOString().split('T')[0];

export function QuickLogModal({ visible, onClose, onSuccess, totalLogs }: Props) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [results, setResults] = useState<TitleSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TitleSearchItem | null>(null);
  const [step, setStep] = useState<'search' | 'form'>('search');
  const [status, setStatus] = useState<Status>('DONE');
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [watchedAt, setWatchedAt] = useState(todayStr());
  const [place, setPlace] = useState<Place | null>(null);
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [ott, setOtt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { userId, deviceId } = useAuthStore();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }).start();
      setTimeout(() => {
        setQuery(''); setResults([]); setSelected(null);
        setStep('search'); setStatus('DONE'); setRating(0);
        setNote(''); setError(''); setFilter('ALL');
        setWatchedAt(todayStr()); setPlace(null); setOccasion(null); setOtt(null);
      }, 250);
    }
  }, [visible]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchTitles(query, filter === 'ALL' ? undefined : filter);
        setResults(Array.isArray(res) ? res : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [query, filter]);

  const handleSelect = (item: TitleSearchItem) => {
    setSelected(item);
    setWatchedAt(todayStr());
    setOtt(null);
    setStep('form');
  };

  const handleSubmit = async () => {
    if (!selected || !userId || !deviceId) return;
    setSubmitting(true);
    setError('');
    try {
      const logId = uuid();
      const titleId = selected.titleId ?? uuid();
      const now = new Date().toISOString();
      const watchedAtIso = watchedAt
        ? new Date(watchedAt).toISOString()
        : now;
      await syncPush({
        userId, deviceId, clientTime: now,
        changes: {
          titles: [{
            id: titleId, op: 'UPSERT', updatedAt: now,
            payload: {
              type: selected.type, name: selected.name, year: selected.year ?? null,
              provider: selected.provider, providerId: selected.providerId,
              posterUrl: selected.posterUrl ?? null, overview: selected.overview ?? null,
              author: selected.author ?? null, publisher: selected.publisher ?? null,
            },
          }],
          logs: [{
            id: logId, op: 'UPSERT', updatedAt: now,
            payload: {
              titleId,
              status,
              rating: rating > 0 ? rating : null,
              note: note.trim() || null,
              spoiler: false,
              watchedAt: watchedAtIso,
              place: place ?? null,
              occasion: occasion ?? null,
              ott: ott ?? null,
            },
          }],
        },
      });
      onSuccess?.();
      onClose();
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCard = ({ item }: { item: TitleSearchItem }) => {
    const typeColor = TYPE_COLORS[item.type] ?? Colors.secondary;
    const meta = [item.year, item.author ?? (item as any).director].filter(Boolean).join(' • ');
    return (
      <View style={styles.gridCard}>
        <View style={styles.gridPosterWrap}>
          {item.posterUrl ? (
            <Image source={{ uri: item.posterUrl }} style={styles.gridPoster} resizeMode="cover" />
          ) : (
            <View style={[styles.gridPoster, styles.gridPosterEmpty]}>
              <Text style={styles.gridPosterEmoji}>
                {item.type === 'book' ? '📚' : item.type === 'series' ? '📺' : '🎬'}
              </Text>
            </View>
          )}
          <View style={styles.gridTypeBadge}>
            <Text style={[styles.gridTypeLabel, { color: typeColor }]}>
              {TYPE_LABELS[item.type] ?? item.type}
            </Text>
          </View>
        </View>
        <View style={styles.gridBody}>
          <Text style={styles.gridTitle} numberOfLines={2}>{item.name}</Text>
          {meta ? <Text style={styles.gridMeta} numberOfLines={1}>{meta}</Text> : null}
          <TouchableOpacity style={styles.selectBtn} onPress={() => handleSelect(item)} activeOpacity={0.8}>
            <Text style={styles.selectBtnText}>선택하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Achievement hint
  const nextMilestone = totalLogs != null ? getNextMilestone(totalLogs) : null;
  const milestoneProgress = nextMilestone != null && totalLogs != null
    ? Math.max(0, Math.min(1, totalLogs / nextMilestone))
    : null;
  const remaining = nextMilestone != null && totalLogs != null ? nextMilestone - totalLogs : null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />

          {/* ── SEARCH STEP ── */}
          {step === 'search' && (
            <>
              <Text style={styles.heroTitle}>콘텐츠 검색</Text>

              <View style={styles.searchBox}>
                <Text style={styles.searchIconText}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="영화, TV 쇼, 또는 책 검색"
                  placeholderTextColor={Colors.outline}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                  returnKeyType="search"
                />
                {searching && <ActivityIndicator size="small" color={Colors.secondary} />}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
                contentContainerStyle={styles.filterRowContent}
              >
                {FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterPill, filter === f.key && styles.filterPillActive]}
                    onPress={() => setFilter(f.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterPillText, filter === f.key && styles.filterPillTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <FlatList
                data={results}
                keyExtractor={(item) => `${item.provider}-${item.providerId}`}
                renderItem={renderCard}
                numColumns={2}
                columnWrapperStyle={styles.gridRow}
                style={styles.grid}
                contentContainerStyle={styles.gridContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  query.length > 1 && !searching ? (
                    <View style={styles.emptyWrap}>
                      <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
                    </View>
                  ) : null
                }
              />
            </>
          )}

          {/* ── FORM STEP ── */}
          {step === 'form' && selected && (
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formScroll}
            >
              {/* 뒤로 */}
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('search')}>
                <Text style={styles.backBtnText}>← 다시 검색</Text>
              </TouchableOpacity>

              {/* 헤더: 포스터 + 제목 */}
              <View style={styles.formHeader}>
                <View style={styles.formPosterWrap}>
                  {selected.posterUrl ? (
                    <Image source={{ uri: selected.posterUrl }} style={styles.formPoster} resizeMode="cover" />
                  ) : (
                    <View style={[styles.formPoster, styles.formPosterEmpty]}>
                      <Text style={{ fontSize: 40 }}>{selected.type === 'book' ? '📚' : '🎬'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.formHeaderInfo}>
                  <Text style={styles.formSubLabel}>상세 기록 남기기</Text>
                  <Text style={styles.formTitle} numberOfLines={3}>{selected.name}</Text>
                  <Text style={styles.formMeta}>
                    {[selected.year, selected.author].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </View>

              {/* 달성 힌트 */}
              {nextMilestone != null && remaining != null && (
                <View style={styles.achieveCard}>
                  <View style={styles.achieveRow}>
                    <Text style={styles.achieveTitle}>Almost {nextMilestone} records!</Text>
                    <Text style={styles.achieveRemain}>기록 {remaining}개 남음</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${(milestoneProgress ?? 0) * 100}%` as any }]} />
                  </View>
                </View>
              )}

              {/* 상태 */}
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.statusBtn,
                      status === opt.value && {
                        borderColor: STATUS_COLORS[opt.value],
                        backgroundColor: `${STATUS_COLORS[opt.value]}1a`,
                      },
                    ]}
                    onPress={() => setStatus(opt.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.statusEmoji,
                      status === opt.value && { color: STATUS_COLORS[opt.value] },
                    ]}>{opt.emoji}</Text>
                    <Text style={[
                      styles.statusBtnText,
                      status === opt.value && { color: STATUS_COLORS[opt.value] },
                    ]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 언제 */}
              <View style={[styles.bentoCard, styles.bentoCardFull]}>
                <Text style={styles.bentoLabel}>📅 언제</Text>
                <View style={styles.bentoInputWrap}>
                  <TextInput
                    style={styles.bentoInput}
                    value={watchedAt}
                    onChangeText={setWatchedAt}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.outline}
                  />
                </View>
              </View>

              {/* 어디서 */}
              <View style={[styles.bentoCard, styles.bentoCardFull]}>
                <Text style={styles.bentoLabel}>📍 어디서</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.enumPillRow}>
                  {PLACE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.enumPill, place === opt.value && styles.enumPillActive]}
                      onPress={() => setPlace(place === opt.value ? null : opt.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.enumPillText, place === opt.value && styles.enumPillTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* 누구와 */}
              <View style={[styles.bentoCard, styles.bentoCardFull]}>
                <Text style={styles.bentoLabel}>👥 누구와</Text>
                <View style={styles.enumPillRow}>
                  {OCCASION_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.enumPill, occasion === opt.value && styles.enumPillActive]}
                      onPress={() => setOccasion(occasion === opt.value ? null : opt.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.enumPillText, occasion === opt.value && styles.enumPillTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 플랫폼 */}
              {(() => {
                const groups = selected.type === 'book' ? BOOK_PLATFORMS : VIDEO_PLATFORMS;
                return (
                  <View style={[styles.bentoCard, styles.bentoCardFull]}>
                    <Text style={styles.bentoLabel}>🎬 플랫폼</Text>
                    {groups.map((g) => (
                      <View key={g.group} style={styles.platformGroup}>
                        <Text style={styles.platformGroupLabel}>{g.group}</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.platformPillRow}
                        >
                          {g.options.map((opt) => (
                            <TouchableOpacity
                              key={opt}
                              style={[styles.enumPill, ott === opt && styles.enumPillActive]}
                              onPress={() => setOtt(ott === opt ? null : opt)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.enumPillText, ott === opt && styles.enumPillTextActive]}>
                                {opt}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* 별점 */}
              {(() => {
                const ratingOpts = selected.type === 'book'
                  ? [{ value: 5, emoji: '📚', label: '인생책' }, { value: 3, emoji: '🙂', label: '볼만해요' }, { value: 1, emoji: '😕', label: '아쉬워요' }]
                  : [{ value: 5, emoji: '😍', label: '최고예요' }, { value: 3, emoji: '🙂', label: '볼만해요' }, { value: 1, emoji: '😕', label: '아쉬워요' }];
                return (
                  <View style={[styles.bentoCard, styles.bentoCardFull]}>
                    <Text style={styles.bentoLabel}>⭐ 평점</Text>
                    <View style={styles.ratingBtnRow}>
                      {ratingOpts.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.ratingBtn, rating === opt.value && styles.ratingBtnActive]}
                          onPress={() => setRating(rating === opt.value ? 0 : opt.value)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.ratingEmoji}>{opt.emoji}</Text>
                          <Text style={[styles.ratingBtnLabel, rating === opt.value && styles.ratingBtnLabelActive]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })()}

              {/* 메모 */}
              <View style={styles.memoCard}>
                <Text style={styles.bentoLabel}>메모</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="이 작품에 대해 느꼈던 감정을 자유롭게 적어보세요..."
                  placeholderTextColor={Colors.outline}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* 저장 버튼 */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.88}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>기록 저장</Text>
                }
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
    alignSelf: 'center', marginBottom: 20, opacity: 0.4,
  },

  // ── Search Step ──
  heroTitle: {
    fontSize: 30, fontFamily: PF['800'], fontWeight: '800', letterSpacing: -0.5,
    color: Colors.onSurface, marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 14, gap: 10,
  },
  searchIconText: { fontSize: 18 },
  searchInput: { flex: 1, fontSize: 16, fontFamily: PF['500'], fontWeight: '500', color: Colors.onSurface, padding: 0 },
  filterRow: { flexGrow: 0, marginBottom: 16 },
  filterRowContent: { gap: 8, paddingRight: 8 },
  filterPill: {
    paddingHorizontal: 20, paddingVertical: 9,
    borderRadius: 999, backgroundColor: Colors.surfaceContainerLow,
  },
  filterPillActive: {
    backgroundColor: Colors.primaryContainer,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 4,
  },
  filterPillText: { fontSize: 13, fontFamily: PF['700'], fontWeight: '700', color: Colors.onSurfaceVariant },
  filterPillTextActive: { color: Colors.primaryFixed },

  grid: { flex: 1 },
  gridContent: { paddingBottom: 20 },
  gridRow: { gap: 10, marginBottom: 10 },
  gridCard: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(45, 52, 73, 0.4)',
    borderRadius: 20, overflow: 'hidden',
    borderTopWidth: 1, borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gridPosterWrap: {
    width: '100%', aspectRatio: 2 / 3,
    backgroundColor: Colors.surfaceContainerHighest,
    position: 'relative',
  },
  gridPoster: { width: '100%', height: '100%' },
  gridPosterEmpty: { alignItems: 'center', justifyContent: 'center' },
  gridPosterEmoji: { fontSize: 36 },
  gridTypeBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(11,19,38,0.85)',
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  gridTypeLabel: { fontSize: 8, fontFamily: PF['800'], fontWeight: '800', letterSpacing: 0.8 },
  gridBody: { padding: 12, gap: 4 },
  gridTitle: { fontSize: 13, fontFamily: PF['700'], fontWeight: '700', color: Colors.onSurface, lineHeight: 18 },
  gridMeta: { fontSize: 10, fontFamily: PF['600'], fontWeight: '600', color: Colors.outline, marginBottom: 6 },
  selectBtn: {
    paddingVertical: 8, borderRadius: 12, borderWidth: 1,
    borderColor: `${Colors.secondary}50`,
    backgroundColor: `${Colors.secondary}12`,
    alignItems: 'center', marginTop: 2,
  },
  selectBtnText: { fontSize: 11, fontFamily: PF['700'], fontWeight: '700', color: Colors.secondary, letterSpacing: 0.3 },
  emptyWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontFamily: PF['500'], fontWeight: '500', color: Colors.onSurfaceVariant },

  // ── Form Step ──
  formScroll: { paddingBottom: 16 },
  backBtn: { marginBottom: 16, alignSelf: 'flex-start' },
  backBtnText: { fontSize: 14, fontFamily: PF['600'], fontWeight: '600', color: Colors.secondary },

  formHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    marginBottom: 20,
    paddingBottom: 4,
  },
  formPosterWrap: {
    width: 100,
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    flexShrink: 0,
  },
  formPoster: { width: '100%', height: '100%' },
  formPosterEmpty: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerHighest,
  },
  formHeaderInfo: { flex: 1, paddingBottom: 4 },
  formSubLabel: {
    fontSize: 9, fontFamily: PF['800'], fontWeight: '800', letterSpacing: 2,
    textTransform: 'uppercase', color: Colors.secondary,
    marginBottom: 6,
  },
  formTitle: {
    fontSize: 24, fontFamily: PF['800'], fontWeight: '800', letterSpacing: -0.5,
    color: Colors.onSurface, lineHeight: 28, marginBottom: 6,
  },
  formMeta: { fontSize: 12, fontFamily: PF['500'], fontWeight: '500', color: Colors.onSurfaceVariant },

  // Achievement
  achieveCard: {
    backgroundColor: 'rgba(45,52,73,0.4)',
    borderRadius: 20, padding: 16,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16, gap: 10,
  },
  achieveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achieveTitle: { fontSize: 13, fontFamily: PF['700'], fontWeight: '700', color: Colors.tertiary },
  achieveRemain: { fontSize: 11, fontFamily: PF['500'], fontWeight: '500', color: Colors.onSurfaceVariant },
  progressTrack: {
    height: 6, backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 999, overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: 999,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },

  // Status
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statusBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: 16, borderWidth: 1.5,
    borderColor: `${Colors.outlineVariant}40`,
    gap: 4,
  },
  statusEmoji: { fontSize: 14, color: Colors.onSurfaceVariant },
  statusBtnText: { fontSize: 11, fontFamily: PF['700'], fontWeight: '700', color: Colors.onSurfaceVariant },

  // Bento grid
  bentoGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  bentoCard: {
    flex: 1,
    backgroundColor: 'rgba(45,52,73,0.4)',
    borderRadius: 20, padding: 16,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bentoCardFull: { flex: undefined, marginBottom: 12 },
  bentoLabel: {
    fontSize: 9, fontFamily: PF['800'], fontWeight: '800', letterSpacing: 1.5,
    textTransform: 'uppercase', color: Colors.secondary,
    marginBottom: 10,
  },
  bentoInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  bentoIcon: { fontSize: 14, opacity: 0.7 },
  bentoInput: {
    flex: 1, fontSize: 13, fontFamily: PF['500'], fontWeight: '500',
    color: Colors.onSurface, padding: 0,
  },
  enumPillRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },
  enumPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  enumPillActive: {
    backgroundColor: `${Colors.secondary}20`,
    borderColor: Colors.secondary,
  },
  enumPillText: {
    fontSize: 12, fontFamily: PF['600'], fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  enumPillTextActive: {
    color: Colors.secondary,
  },
  platformGroup: {
    marginBottom: 14,
  },
  platformPillRow: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 4,
  },
  platformGroupLabel: {
    fontSize: 8, fontFamily: PF['700'], fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
    color: Colors.outline, marginBottom: 6,
  },

  // Rating
  ratingBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  ratingBtnActive: {
    backgroundColor: `${Colors.primary}18`,
    borderColor: Colors.primary,
  },
  ratingEmoji: { fontSize: 26 },
  ratingBtnLabel: {
    fontSize: 11, fontFamily: PF['600'], fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  ratingBtnLabelActive: { color: Colors.primary },

  // Memo
  memoCard: {
    backgroundColor: 'rgba(45,52,73,0.4)',
    borderRadius: 20, padding: 16,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  noteInput: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: PF['500'], fontWeight: '500', color: Colors.onSurface,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    minHeight: 120,
  },

  errorText: { fontSize: 12, color: Colors.error, textAlign: 'center', marginBottom: 12 },

  // Submit
  submitBtn: {
    paddingVertical: 18, borderRadius: 999,
    alignItems: 'center',
    backgroundColor: Colors.primaryContainer,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  submitBtnText: { fontSize: 17, fontFamily: PF['800'], fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
});
