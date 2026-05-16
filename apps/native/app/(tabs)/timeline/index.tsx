import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { formatShortDate, statusLabel, typeLabel } from '../../../lib/format';
import { listLogsLocal } from '../../../lib/localDb';
import { syncNow } from '../../../lib/sync';
import type { Status, TitleType, WatchLog } from '../../../lib/types';

type StatusFilter = 'ALL' | Status;
type TypeFilter = 'ALL' | TitleType;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'DONE', label: '완료' },
  { value: 'IN_PROGRESS', label: '진행 중' },
  { value: 'WISHLIST', label: '위시' },
];

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'movie', label: '영화' },
  { value: 'series', label: '시리즈' },
  { value: 'book', label: '책' },
];

export default function TimelineScreen() {
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

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
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && log.title.type !== typeFilter) return false;
      if (!q) return true;
      return [
        log.title.name,
        log.note,
        log.ott,
        log.title.author,
        log.title.publisher,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [logs, query, statusFilter, typeFilter]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>Timeline</Text>
        <Text style={styles.title}>내 타임라인</Text>
        <Text style={styles.desc}>기기 저장소 기준으로 즉시 보이고, 아래로 당기면 서버와 맞춥니다.</Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="제목, 메모, 플랫폼 검색"
        placeholderTextColor={Colors.onSurfaceVariant}
        style={styles.searchInput}
      />

      <View style={styles.filterBlock}>
        <View style={styles.segment}>
          {STATUS_FILTERS.map((item) => (
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
          {TYPE_FILTERS.map((item) => (
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
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primaryContainer} />
        </View>
      ) : visibleLogs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>아직 표시할 기록이 없어요.</Text>
          <Text style={styles.desc}>기록 탭에서 첫 작품을 남기면 바로 여기에 쌓입니다.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visibleLogs.map((log) => (
            <View key={log.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{typeLabel(log.title.type)}</Text>
                </View>
                <Text style={styles.date}>{formatShortDate(log.watchedAt)}</Text>
              </View>
              <Text style={styles.logTitle}>{log.title.name}</Text>
              <Text style={styles.meta}>
                {[statusLabel(log.status, log.title.type), log.ott, log.rating ? `${log.rating}/5` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {log.note ? <Text style={styles.note}>{log.note}</Text> : null}
              {log.syncStatus && log.syncStatus !== 'synced' ? (
                <Text style={styles.syncState}>
                  {log.syncStatus === 'pending' ? '동기화 대기 중' : '동기화 재시도 필요'}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingTop: 64, paddingBottom: 120, gap: 16 },
  header: { gap: 8 },
  kicker: { ...Typography.accent },
  title: { ...Typography.headlineLg, fontSize: 30 },
  desc: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  searchInput: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    color: Colors.onSurface,
    ...Typography.bodyLg,
  },
  filterBlock: { gap: 8 },
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
  center: { padding: 32, alignItems: 'center' },
  empty: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.outline,
    padding: 24,
    gap: 8,
  },
  emptyTitle: { ...Typography.headlineSm },
  list: { gap: 10 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
    padding: 14,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { ...Typography.labelSm, color: Colors.primaryContainer },
  date: { ...Typography.labelLg },
  logTitle: { ...Typography.headlineSm },
  meta: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  note: { ...Typography.bodyMd, marginTop: 4 },
  syncState: { ...Typography.labelLg, color: Colors.warning, marginTop: 4 },
});
