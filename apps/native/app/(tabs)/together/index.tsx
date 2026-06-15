import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ThemeColors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { listDiscussions } from '../../../lib/api';
import { formatShortDate, typeLabel } from '../../../lib/format';
import { togetherCopy, type NativeLocale } from '../../../lib/i18n';
import { useNativePreferences } from '../../../lib/nativePreferences';
import type { DiscussionListItem } from '../../../lib/types';

type Scope = 'latest' | 'all';
type Sort = 'latest' | 'comments';
type TogetherCopy = (typeof togetherCopy)[NativeLocale];

function formatCount(template: string, count: number) {
  return template.replace('{count}', String(count));
}

function reactionText(item: DiscussionListItem, copy: TogetherCopy) {
  const summary = item.reactionSummary;
  if (!summary) return null;
  const parts = [
    summary.done ? formatCount(copy.reactionsDone, summary.done) : null,
    summary.curious ? formatCount(copy.reactionsCurious, summary.curious) : null,
    summary.save ? formatCount(copy.reactionsSave, summary.save) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function TogetherScreen() {
  const { colors, locale } = useNativePreferences();
  const copy = togetherCopy[locale];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<DiscussionListItem[]>([]);
  const [scope, setScope] = useState<Scope>('latest');
  const [sort, setSort] = useState<Sort>('latest');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await listDiscussions(scope, scope === 'all' ? 100 : 20);
      setItems(next);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : copy.errorFallback);
    } finally {
      setLoading(false);
    }
  }, [copy.errorFallback, scope]);

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

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((item) => item.titleName.toLowerCase().includes(q))
      : items;
    return [...filtered].sort((a, b) => {
      if (sort === 'comments') return b.commentCount - a.commentCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, query, sort]);

  const scopes = useMemo(
    () => [
      { value: 'latest' as const, label: copy.latest },
      { value: 'all' as const, label: copy.allScope },
    ],
    [copy.latest, copy.allScope],
  );
  const sorts = useMemo(
    () => [
      { value: 'latest' as const, label: copy.latestSort },
      { value: 'comments' as const, label: copy.commentsSort },
    ],
    [copy.latestSort, copy.commentsSort],
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>{copy.kicker}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.desc}>{copy.desc}</Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={copy.searchPlaceholder}
        placeholderTextColor={colors.onSurfaceVariant}
        selectionColor={colors.primaryContainer}
        style={styles.searchInput}
      />

      <View style={styles.filterBlock}>
        <View style={styles.segment}>
          {scopes.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setScope(item.value)}
              style={[styles.chip, scope === item.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, scope === item.value && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.segment}>
          {sorts.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setSort(item.value)}
              style={[styles.chip, sort === item.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, sort === item.value && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
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
      ) : visibleItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
          <Text style={styles.desc}>{copy.emptyDesc}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visibleItems.map((item) => {
            const reactions = reactionText(item, copy);
            return (
              <Pressable
                key={item.id}
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: '/public/[id]',
                    params: { id: item.id },
                  })
                }
              >
                {item.posterUrl ? (
                  <Image source={{ uri: item.posterUrl }} style={styles.poster} />
                ) : (
                  <View style={styles.posterEmpty}>
                    <Text style={styles.posterEmptyText}>{typeLabel(item.titleType, locale)}</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.badgeText}>{typeLabel(item.titleType, locale)}</Text>
                    <Text style={styles.date}>{formatShortDate(item.createdAt, locale)}</Text>
                  </View>
                  <Text style={styles.itemTitle}>{item.titleName}</Text>
                  <Text style={styles.meta}>
                    {[item.titleYear, formatCount(copy.commentCount, item.commentCount)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {reactions ? <Text style={styles.reactions}>{reactions}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingTop: 64, paddingBottom: 120, gap: 16 },
    header: { gap: 8 },
    kicker: { ...Typography.accent, color: colors.tertiary },
    title: { ...Typography.headlineLg, color: colors.onBackground, fontSize: 30 },
    desc: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
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
    segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipActive: { borderColor: colors.primaryContainer, backgroundColor: colors.surfaceStrong },
    chipText: { ...Typography.labelLg, color: colors.onSurface },
    chipTextActive: { color: colors.primaryContainer },
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
      flexDirection: 'row',
      gap: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      padding: 12,
    },
    poster: { width: 58, height: 84, borderRadius: 12, backgroundColor: colors.surfaceMuted },
    posterEmpty: {
      width: 58,
      height: 84,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    posterEmptyText: { ...Typography.labelSm, color: colors.onSurfaceVariant },
    cardBody: { flex: 1, gap: 5 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    badgeText: { ...Typography.labelSm, color: colors.primaryContainer },
    date: { ...Typography.labelLg, color: colors.onSurfaceVariant },
    itemTitle: { ...Typography.headlineSm, color: colors.onSurface },
    meta: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    reactions: { ...Typography.labelLg, color: colors.secondary },
  });
}
