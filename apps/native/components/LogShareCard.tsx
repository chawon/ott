import { Image, StyleSheet, Text, View } from 'react-native';
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
  const value = log.rating.toFixed(1);
  if (log.title.type === 'book') {
    if (log.rating >= 4) return `${copy.ratingBookGood} ${value}`;
    if (log.rating >= 2.5) return `${copy.ratingBookOkay} ${value}`;
    return `${copy.ratingBad} ${value}`;
  }
  if (log.rating >= 4) return `${copy.ratingGood} ${value}`;
  if (log.rating >= 2.5) return `${copy.ratingOkay} ${value}`;
  return `${copy.ratingBad} ${value}`;
}

function cleanTitle(title: string, type: WatchLog['title']['type']) {
  if (type !== 'book') return title;
  const withoutParens = title
    .replace(/\s*[([{][^)\]}]+[)\]}]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const colonIndex = withoutParens.search(/:\s+/);
  const dashIndex = withoutParens.search(/\s[-–—]\s+/);
  let cutIndex = -1;
  if (colonIndex !== -1) cutIndex = colonIndex;
  if (dashIndex !== -1) cutIndex = cutIndex === -1 ? dashIndex : Math.min(cutIndex, dashIndex);
  const trimmed = cutIndex === -1 ? withoutParens : withoutParens.slice(0, cutIndex).trim();
  return trimmed.length > 0 ? trimmed : title;
}

function noteForCard(note: string | null | undefined, type: WatchLog['title']['type']) {
  if (!note?.trim()) return null;
  const maxLines = type === 'book' ? 3 : 2;
  const maxLength = type === 'book' ? 120 : 80;
  const normalized = note
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, maxLines)
    .join('\n');
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

export function LogShareCard({ log, locale = 'ko' }: LogShareCardProps) {
  const rating = ratingLabel(log, locale);
  const posterUrl = log.seasonPosterUrl ?? log.title.posterUrl ?? null;
  const title = cleanTitle(log.title.name, log.title.type);
  const note = noteForCard(log.note, log.title.type);
  const episode = seasonEpisodeLabel(log.seasonNumber, log.episodeNumber);
  const status = [statusLabel(log.status, log.title.type, locale), episode].filter(Boolean).join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.posterBlock}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.posterImage} />
        ) : (
          <View style={styles.posterFallback}>
            <Text style={styles.posterInitial}>{log.title.name.slice(0, 1)}</Text>
            <Text style={styles.posterType}>{typeLabel(log.title.type, locale)}</Text>
          </View>
        )}
        <View style={styles.posterScrim} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleBlock}>
          <Text adjustsFontSizeToFit numberOfLines={3} style={[styles.title, log.title.type === 'book' && styles.bookTitle]}>
            {title}
          </Text>
          {note ? (
            <Text numberOfLines={log.title.type === 'book' ? 3 : 2} style={styles.note}>
              “{note}”
            </Text>
          ) : null}
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipIcon}>👀</Text>
              <Text style={styles.chipText} numberOfLines={1}>
                {status}
              </Text>
            </View>
            {rating ? (
              <View style={styles.chip}>
                <Text style={styles.chipIcon}>⭐</Text>
                <Text style={styles.chipText} numberOfLines={1}>
                  {rating}
                </Text>
              </View>
            ) : null}
            <View style={styles.chip}>
              <Text style={styles.chipIcon}>🗓</Text>
              <Text style={styles.chipText} numberOfLines={1}>
                {formatShortDate(log.watchedAt, locale)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>ottline.app</Text>
          <Text style={styles.footerText}>{typeLabel(log.title.type, locale)}</Text>
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
    backgroundColor: '#0b0c10',
    overflow: 'hidden',
  },
  posterBlock: {
    height: 336,
    backgroundColor: '#0b0c10',
    overflow: 'hidden',
    position: 'relative',
  },
  posterImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  posterFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0b1224',
  },
  posterInitial: {
    width: 70,
    height: 70,
    borderRadius: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 70,
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
  },
  posterType: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  posterScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 96,
    backgroundColor: 'rgba(11,18,36,0.48)',
  },
  body: {
    height: 144,
    backgroundColor: '#0b1224',
    paddingHorizontal: 22,
    paddingTop: 15,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  titleBlock: { gap: 7 },
  title: { color: '#ffffff', fontSize: 22, lineHeight: 24, fontWeight: '800' },
  bookTitle: { fontSize: 19, lineHeight: 22 },
  note: { color: '#dbe4ff', fontSize: 10, lineHeight: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: {
    minHeight: 22,
    maxWidth: 148,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipIcon: { fontSize: 9, lineHeight: 11 },
  chipText: { color: '#cbd5f5', fontSize: 9, lineHeight: 11, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  footerText: { color: 'rgba(255,255,255,0.72)', fontSize: 9, fontWeight: '700' },
});
