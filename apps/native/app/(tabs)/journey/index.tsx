import { useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { syncPull } from '../../../lib/api';
import { calcGamification } from '../../../lib/gamification';
import { WatchLog } from '../../../lib/types';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { HeroBar } from '../../../components/journey/HeroBar';
import { JourneyNode } from '../../../components/journey/JourneyNode';

const { width: SCREEN_W } = Dimensions.get('window');

// 구불구불 SVG 경로 생성 (아이템 수 기반)
function buildSvgPath(count: number): string {
  if (count === 0) return '';
  const segH = 180;
  const totalH = count * segH;
  const cx = SCREEN_W / 2;
  const amp = SCREEN_W * 0.3;

  let d = `M${cx} 0`;
  for (let i = 0; i < count; i++) {
    const y1 = i * segH + segH * 0.4;
    const y2 = i * segH + segH;
    const x1 = i % 2 === 0 ? cx + amp : cx - amp;
    d += ` C${x1} ${y1} ${x1} ${y1} ${cx} ${y2}`;
  }
  return d;
}

function groupByMonth(logs: WatchLog[]) {
  const groups: { key: string; label: string; logs: WatchLog[] }[] = [];
  let currentKey = '';
  for (const log of logs) {
    const d = new Date(log.watchedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key !== currentKey) {
      currentKey = key;
      const label = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
      groups.push({ key, label, logs: [log] });
    } else {
      groups[groups.length - 1].logs.push(log);
    }
  }
  return groups;
}

export default function JourneyScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sync-pull'],
    queryFn: () => syncPull(),
    select: (d) => d.logs,
  });

  const logs: WatchLog[] = data ?? [];
  const sorted = [...logs]
    .filter((l) => !l.deletedAt)
    .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime());

  const gami = calcGamification(logs);
  const movieCount = logs.filter((l) => l.title.type === 'movie' && l.status === 'DONE' && !l.deletedAt).length;
  const seriesCount = logs.filter((l) => l.title.type === 'series' && l.status === 'DONE' && !l.deletedAt).length;
  const bookCount = logs.filter((l) => l.title.type === 'book' && l.status === 'DONE' && !l.deletedAt).length;
  const unlockedBadges = gami.badges.filter((b) => b.unlocked).length;

  const svgPath = buildSvgPath(sorted.length);
  const svgHeight = sorted.length * 180 + 100;

  // 월별 그룹 평탄화 (인덱스 연속 유지)
  const flatItems: Array<{ type: 'header'; label: string } | { type: 'log'; log: WatchLog; globalIdx: number }> = [];
  const groups = groupByMonth(sorted);
  let globalIdx = 0;
  for (const g of groups) {
    flatItems.push({ type: 'header', label: g.label });
    for (const log of g.logs) {
      flatItems.push({ type: 'log', log, globalIdx });
      globalIdx++;
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* 배경 대기 글로우 */}
      <View style={[styles.glow, { top: -120, left: -100, backgroundColor: Colors.primaryContainer }]} />
      <View style={[styles.glow, { top: '40%', right: -80, backgroundColor: Colors.secondary, width: 250, height: 250, borderRadius: 125 }]} />
      <View style={[styles.glow, { bottom: -80, left: '20%', backgroundColor: Colors.tertiary, width: 200, height: 200, borderRadius: 100 }]} />

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ottline</Text>
      </View>

      <HeroBar
        level={gami.level}
        streak={gami.streak}
        movieCount={movieCount}
        seriesCount={seriesCount}
        bookCount={bookCount}
        badgeCount={unlockedBadges}
        totalBadges={gami.badges.length}
      />

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.secondary} size="large" />
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={{ color: Colors.error }}>로드 실패. 다시 시도해주세요.</Text>
        </View>
      )}

      {!isLoading && sorted.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyText}>첫 발자취를 남겨보세요 👣</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* SVG 경로 오버레이 */}
        {sorted.length > 0 && (
          <Svg
            width={SCREEN_W}
            height={svgHeight}
            style={StyleSheet.absoluteFillObject}
            opacity={0.3}
          >
            <Defs>
              <LinearGradient id="pathGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={Colors.secondary} />
                <Stop offset="0.5" stopColor={Colors.primaryContainer} />
                <Stop offset="1" stopColor={Colors.secondary} />
              </LinearGradient>
            </Defs>
            <Path
              d={svgPath}
              stroke="url(#pathGrad)"
              strokeWidth={5}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        )}

        {/* 아이템 렌더 */}
        {flatItems.map((item, i) => {
          if (item.type === 'header') {
            return (
              <View key={`h-${item.label}`} style={styles.monthHeader}>
                <Text style={styles.monthText}>{item.label}</Text>
              </View>
            );
          }
          return (
            <JourneyNode
              key={item.log.id}
              log={item.log}
              index={item.globalIdx}
              onPress={() => router.push(`/log/${item.log.id}` as any)}
            />
          );
        })}

        {/* Next Milestone Locked */}
        {sorted.length > 0 && (
          <View style={styles.milestoneLocked}>
            <View style={styles.lockCircle}>
              <Text style={styles.lockIcon}>🔒</Text>
            </View>
            <Text style={styles.lockLabel}>NEXT MILESTONE LOCKED</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.06,
    zIndex: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  headerTitle: {
    ...Typography.headlineLg,
    fontStyle: 'italic',
    fontSize: 22,
    color: Colors.primary,
  },
  scroll: {
    flex: 1,
    marginTop: 8,
  },
  scrollContent: {
    position: 'relative',
  },
  monthHeader: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  monthText: {
    ...Typography.labelLg,
    color: Colors.onSurfaceVariant,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 999,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    ...Typography.bodyLg,
    color: Colors.onSurfaceVariant,
  },
  milestoneLocked: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  lockCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: `${Colors.outlineVariant}44`,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    fontSize: 28,
    opacity: 0.4,
  },
  lockLabel: {
    ...Typography.labelSm,
    color: Colors.outline,
    letterSpacing: 3,
  },
});
