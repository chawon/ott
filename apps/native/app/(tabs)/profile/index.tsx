import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { syncPull } from '../../../lib/api';
import { calcGamification } from '../../../lib/gamification';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

export default function ProfileScreen() {
  const { data } = useQuery({
    queryKey: ['sync-pull'],
    queryFn: () => syncPull(),
    select: (d) => d.logs,
  });

  const logs = (data ?? []).filter((l) => !l.deletedAt);
  const gami = calcGamification(logs);
  const done = logs.filter((l) => l.status === 'DONE').length;
  const unlockedBadges = gami.badges.filter((b) => b.unlocked);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>나의 발자취</Text>

        {/* 레벨 카드 */}
        <View style={styles.card}>
          <Text style={styles.levelNum}>Lv.{gami.level.level}</Text>
          <Text style={styles.levelTitle}>{gami.level.title}</Text>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { flex: gami.level.progress }]} />
            <View style={[styles.xpEmpty, { flex: 1 - gami.level.progress }]} />
          </View>
          <Text style={styles.xpLabel}>{gami.level.currentXP} / {gami.level.nextXP} XP</Text>
        </View>

        {/* 통계 */}
        <View style={styles.statsGrid}>
          <StatBox label="총 기록" value={logs.length} />
          <StatBox label="완료" value={done} />
          <StatBox label="연속" value={`🔥 ${gami.streak}일`} />
          <StatBox label="최장 스트릭" value={`${gami.longestStreak}일`} />
          <StatBox label="영화" value={logs.filter((l) => l.title.type === 'movie' && l.status === 'DONE').length} />
          <StatBox label="드라마" value={logs.filter((l) => l.title.type === 'series' && l.status === 'DONE').length} />
        </View>

        {/* 배지 */}
        <Text style={styles.sectionTitle}>배지 ({unlockedBadges.length}/{gami.badges.length})</Text>
        <View style={styles.badgeGrid}>
          {gami.badges.map((badge) => (
            <View key={badge.slug} style={[styles.badgeItem, !badge.unlocked && styles.badgeLocked]}>
              <Text style={styles.badgeIcon}>{badge.icon}</Text>
              <Text style={styles.badgeLabel} numberOfLines={1}>{badge.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 100 },
  heading: { ...Typography.headlineLg, marginBottom: 20, fontStyle: 'italic' },

  card: {
    backgroundColor: 'rgba(45, 52, 73, 0.4)',
    borderRadius: 20,
    padding: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    marginBottom: 20,
    gap: 4,
  },
  levelNum: { ...Typography.displayLg, fontSize: 52 },
  levelTitle: { ...Typography.labelLg, color: Colors.onSurfaceVariant, marginBottom: 12 },
  xpTrack: { flexDirection: 'row', height: 6, width: '100%', borderRadius: 999, overflow: 'hidden', backgroundColor: Colors.surfaceContainerHighest },
  xpFill: { backgroundColor: Colors.secondary },
  xpEmpty: { backgroundColor: 'transparent' },
  xpLabel: { ...Typography.labelSm, color: Colors.secondary, marginTop: 4 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statBox: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { ...Typography.headlineMd, fontSize: 22, color: Colors.primary },
  statLabel: { ...Typography.labelSm, color: Colors.onSurfaceVariant, marginTop: 2 },

  sectionTitle: { ...Typography.headlineSm, marginBottom: 12 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeItem: {
    width: '30%',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  badgeLocked: { opacity: 0.35 },
  badgeIcon: { fontSize: 28 },
  badgeLabel: { ...Typography.labelSm, fontSize: 9, textAlign: 'center' },
});
