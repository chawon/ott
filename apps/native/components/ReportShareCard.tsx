import { StyleSheet, Text, View } from 'react-native';
import { reportCopy, type NativeLocale } from '../lib/i18n';
import { buildReportShareCardContent, type ReportShareKind } from '../lib/shareCard';
import type { PersonalReport } from '../lib/types';

type ReportShareCardProps = {
  kind: ReportShareKind;
  locale: NativeLocale;
  report: PersonalReport;
};

export function ReportShareCard({ kind, locale, report }: ReportShareCardProps) {
  const content = buildReportShareCardContent(kind, report, locale);
  const copy = reportCopy[locale];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.watermark}>ottline.app</Text>
        <Text style={styles.kicker}>
          {kind === 'weekly' ? copy.weeklyShareKicker : copy.monthlyShareKicker}
        </Text>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.subtitle}>{content.subtitle}</Text>
      </View>

      <View style={styles.stats}>
        {content.stats.map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statValue}>
              {stat.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.revisitBox}>
        <Text style={styles.revisitLabel}>{copy.reasonTitle}</Text>
        <Text style={styles.revisitText}>{copy.reasonBody}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{copy.tagline}</Text>
        <Text style={styles.footerText}>ottline</Text>
      </View>
    </View>
  );
}

export const reportShareCardCaptureSize = {
  width: 1080,
  height: 1920,
} as const;

const styles = StyleSheet.create({
  card: {
    width: 270,
    height: 480,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    padding: 22,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  watermark: { color: '#1e4d8c', fontSize: 11, fontWeight: '800' },
  kicker: { color: '#64748b', fontSize: 10, fontWeight: '800' },
  titleBlock: { gap: 10 },
  title: { color: '#111827', fontSize: 30, lineHeight: 37, fontWeight: '800' },
  subtitle: { color: '#475569', fontSize: 13, lineHeight: 20, fontWeight: '600' },
  stats: { gap: 10 },
  statCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 5,
  },
  statLabel: { color: '#64748b', fontSize: 10, fontWeight: '800' },
  statValue: { color: '#1e4d8c', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  revisitBox: {
    borderRadius: 16,
    backgroundColor: '#111827',
    padding: 14,
    gap: 6,
  },
  revisitLabel: { color: '#93c5fd', fontSize: 10, fontWeight: '800' },
  revisitText: { color: '#e5e7eb', fontSize: 11, lineHeight: 17, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  footerText: { color: '#64748b', fontSize: 10, fontWeight: '800' },
});
