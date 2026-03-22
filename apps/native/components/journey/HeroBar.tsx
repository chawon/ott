import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { LevelInfo } from '../../lib/types';

interface HeroBarProps {
  level: LevelInfo;
  streak: number;
  movieCount: number;
  seriesCount: number;
  bookCount: number;
  badgeCount: number;
  totalBadges: number;
}

export function HeroBar({ level, streak, movieCount, seriesCount, bookCount, badgeCount, totalBadges }: HeroBarProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(level.progress, { duration: 800 });
  }, [level.progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const streakIcon = streak >= 30 ? '🔥🔥🔥' : streak >= 7 ? '🔥🔥' : streak >= 1 ? '🔥' : '○';

  return (
    <View style={styles.container}>
      {/* 레벨 + 스트릭 */}
      <View style={styles.row}>
        <View style={styles.levelRow}>
          <Text style={styles.levelNum}>Lv.{level.level}</Text>
          <Text style={styles.levelTitle}>{level.title}</Text>
        </View>
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>{streakIcon} {streak}일 연속</Text>
          </View>
        )}
      </View>

      {/* XP 바 */}
      <View style={styles.xpTrack}>
        <Animated.View style={[styles.xpFill, barStyle]} />
      </View>
      <Text style={styles.xpLabel}>
        {level.currentXP} / {level.nextXP} XP
      </Text>

      {/* 통계 */}
      <View style={styles.statsRow}>
        <StatChip icon="🎬" value={movieCount} />
        <StatChip icon="📺" value={seriesCount} />
        <StatChip icon="📚" value={bookCount} />
        <View style={styles.divider} />
        <Text style={styles.badgeCount}>배지 {badgeCount}/{totalBadges}</Text>
      </View>
    </View>
  );
}

function StatChip({ icon, value }: { icon: string; value: number }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(45, 52, 73, 0.4)',
    borderRadius: 20,
    padding: 16,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  levelNum: {
    ...Typography.displayMd,
    fontSize: 28,
  },
  levelTitle: {
    ...Typography.labelLg,
    color: Colors.onSurfaceVariant,
  },
  streakBadge: {
    backgroundColor: 'rgba(123,208,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${Colors.secondary}33`,
  },
  streakText: {
    ...Typography.accent,
    fontSize: 11,
  },
  xpTrack: {
    height: 6,
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 4,
  },
  xpFill: {
    height: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: 999,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  xpLabel: {
    ...Typography.labelSm,
    color: Colors.secondary,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statIcon: {
    fontSize: 13,
  },
  statValue: {
    ...Typography.labelSm,
    color: Colors.onSurface,
    letterSpacing: 0,
  },
  divider: {
    flex: 1,
  },
  badgeCount: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
});
