import { StyleSheet, Text, View } from 'react-native';
import { titleDetailCopy, type NativeLocale } from '../lib/i18n';
import { formatShortDate, seasonEpisodeLabel, statusLabel, typeLabel } from '../lib/format';
import type { WatchLog } from '../lib/types';

type LogShareCardProps = {
  log: WatchLog;
  locale?: NativeLocale;
};

function ratingLabel(log: WatchLog, locale: NativeLocale) {
  if (typeof log.rating !== 'number') return null;
  const copy = titleDetailCopy[locale];
  if (log.title.type === 'book') {
    if (log.rating >= 4) return `${copy.ratingBookGood} · ${log.rating}/5`;
    if (log.rating >= 2.5) return `${copy.ratingBookOkay} · ${log.rating}/5`;
    return `${copy.ratingBad} · ${log.rating}/5`;
  }
  if (log.rating >= 4) return `${copy.ratingGood} · ${log.rating}/5`;
  if (log.rating >= 2.5) return `${copy.ratingOkay} · ${log.rating}/5`;
  return `${copy.ratingBad} · ${log.rating}/5`;
}

export function LogShareCard({ log, locale = 'ko' }: LogShareCardProps) {
  const copy = titleDetailCopy[locale];
  const rating = ratingLabel(log, locale);
  const meta = [
    typeLabel(log.title.type, locale),
    statusLabel(log.status, log.title.type, locale),
    seasonEpisodeLabel(log.seasonNumber, log.episodeNumber),
    formatShortDate(log.watchedAt, locale),
  ];

  return (
    <View style={styles.card}>
      <View style={styles.posterBlock}>
        <Text style={styles.posterInitial}>{log.title.name.slice(0, 1)}</Text>
        <Text style={styles.posterType}>{typeLabel(log.title.type, locale)}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.watermarkRow}>
          <Text style={styles.watermark}>ottline.app</Text>
          <Text style={styles.kicker}>{copy.logShareKicker}</Text>
        </View>

        <View style={styles.titleBlock}>
          <Text adjustsFontSizeToFit numberOfLines={3} style={styles.title}>
            {log.title.name}
          </Text>
          <Text style={styles.meta}>{meta.filter(Boolean).join(' · ')}</Text>
        </View>

        {rating ? (
          <View style={styles.ratingPill}>
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
        ) : null}

        {log.note ? (
          <View style={styles.noteBox}>
            <Text numberOfLines={5} style={styles.note}>
              {log.note}
            </Text>
          </View>
        ) : (
          <View style={styles.noteBox}>
            <Text style={styles.noteMuted}>{copy.logShareDefaultNote}</Text>
          </View>
        )}

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{log.ott ?? 'ottline'}</Text>
          <Text style={styles.footerText}>{copy.logShareTagline}</Text>
        </View>
      </View>
    </View>
  );
}

export const logShareCardCaptureSize = {
  width: 1080,
  height: 1920,
} as const;

const styles = StyleSheet.create({
  card: {
    width: 270,
    height: 480,
    borderRadius: 22,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  posterBlock: {
    height: 148,
    backgroundColor: '#1e4d8c',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  posterInitial: {
    width: 70,
    height: 70,
    borderRadius: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 70,
    backgroundColor: 'rgba(255,255,255,0.18)',
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
  },
  posterType: { color: '#bfdbfe', fontSize: 12, fontWeight: '800' },
  body: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    justifyContent: 'space-between',
  },
  watermarkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  watermark: { color: '#1e4d8c', fontSize: 11, fontWeight: '800' },
  kicker: { color: '#64748b', fontSize: 10, fontWeight: '800' },
  titleBlock: { gap: 8 },
  title: { color: '#111827', fontSize: 30, lineHeight: 36, fontWeight: '800' },
  meta: { color: '#64748b', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  ratingPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ratingText: { color: '#1d4ed8', fontSize: 12, fontWeight: '800' },
  noteBox: {
    minHeight: 82,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 13,
    justifyContent: 'center',
  },
  note: { color: '#334155', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  noteMuted: { color: '#64748b', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  footerText: { color: '#64748b', fontSize: 10, fontWeight: '800' },
});
