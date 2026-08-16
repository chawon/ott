import { Image, StyleSheet, Text, View } from 'react-native';
import { titleDetailCopy, type NativeLocale } from '../lib/i18n';
import { formatShortDate, seasonEpisodeLabel, statusLabel, typeLabel } from '../lib/format';
import { getLogShareCardCaptureSize, type LogShareCardOptions } from '../lib/shareCard';
import type { WatchLog } from '../lib/types';

type LogShareCardProps = {
  log: WatchLog;
  locale?: NativeLocale;
  options?: LogShareCardOptions;
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

const DEFAULT_OPTIONS: LogShareCardOptions = {
  format: 'story',
  showRatingLabel: true,
  showNote: true,
  showProfileSignature: false,
};

export function LogShareCard({ log, locale = 'ko', options = DEFAULT_OPTIONS }: LogShareCardProps) {
  const copy = titleDetailCopy[locale];
  const rating = ratingLabel(log, locale);
  const posterUrl = log.seasonPosterUrl ?? log.title.posterUrl ?? null;
  const isFeed = options.format === 'feed';
  const dimensions = getLogShareCardCaptureSize(options.format);
  const profileSignature = options.showProfileSignature ? options.profileNickname?.trim() : null;
  const meta = [
    typeLabel(log.title.type, locale),
    statusLabel(log.status, log.title.type, locale),
    seasonEpisodeLabel(log.seasonNumber, log.episodeNumber),
    formatShortDate(log.watchedAt, locale),
  ];

  return (
    <View style={[styles.card, { height: dimensions.height / 4 }]}>
      <View style={[styles.posterBlock, isFeed && styles.posterBlockFeed]}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.posterImage} />
        ) : (
          <View style={styles.posterFallback}>
            <Text style={styles.posterInitial}>{log.title.name.slice(0, 1)}</Text>
            <Text style={styles.posterType}>{typeLabel(log.title.type, locale)}</Text>
          </View>
        )}
      </View>

      <View style={[styles.body, isFeed && styles.bodyFeed]}>
        <View style={styles.watermarkRow}>
          <Text style={styles.watermark}>ottline.app</Text>
          <Text style={styles.kicker}>{copy.logShareKicker}</Text>
        </View>

        <View style={styles.titleBlock}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={isFeed ? 2 : 3}
            style={[styles.title, isFeed && styles.titleFeed]}
          >
            {log.title.name}
          </Text>
          <Text style={styles.meta}>{meta.filter(Boolean).join(' · ')}</Text>
        </View>

        {options.showRatingLabel && rating ? (
          <View style={styles.ratingPill}>
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
        ) : null}

        {options.showNote && log.note ? (
          <View style={[styles.noteBox, isFeed && styles.noteBoxFeed]}>
            <Text numberOfLines={isFeed ? 3 : 5} style={styles.note}>
              {log.note}
            </Text>
          </View>
        ) : null}

        <View style={styles.footerRow}>
          <Text numberOfLines={1} style={[styles.footerText, styles.footerPrimary]}>
            {profileSignature ? `${profileSignature} · ottline.app` : log.ott ?? 'ottline'}
          </Text>
          <Text numberOfLines={1} style={styles.footerText}>
            {copy.logShareTagline}
          </Text>
        </View>
      </View>
    </View>
  );
}

export const logShareCardCaptureSize = getLogShareCardCaptureSize();

const styles = StyleSheet.create({
  card: {
    width: 270,
    height: 480,
    borderRadius: 22,
    backgroundColor: '#15120f',
    overflow: 'hidden',
  },
  posterBlock: {
    height: 148,
    backgroundColor: '#ff9933',
    overflow: 'hidden',
  },
  posterBlockFeed: { height: 104 },
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
  },
  posterInitial: {
    width: 70,
    height: 70,
    borderRadius: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 70,
    backgroundColor: 'rgba(15,15,15,0.12)',
    color: '#0f0f0f',
    fontSize: 36,
    fontWeight: '800',
  },
  posterType: { color: '#0f0f0f', fontSize: 12, fontWeight: '800' },
  body: {
    flex: 1,
    backgroundColor: '#f8f6f2',
    padding: 20,
    justifyContent: 'space-between',
  },
  bodyFeed: { padding: 14 },
  watermarkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  watermark: { color: '#1e4d8c', fontSize: 11, fontWeight: '800' },
  kicker: { color: '#ff9933', fontSize: 10, fontWeight: '800' },
  titleBlock: { gap: 8 },
  title: { color: '#0f0f0f', fontSize: 30, lineHeight: 36, fontWeight: '800' },
  titleFeed: { fontSize: 24, lineHeight: 29 },
  meta: { color: '#4a4a4a', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  ratingPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#faf5d7',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ratingText: { color: '#0f0f0f', fontSize: 12, fontWeight: '800' },
  noteBox: {
    minHeight: 82,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ecebe9',
    backgroundColor: '#ffffff',
    padding: 13,
    justifyContent: 'center',
  },
  noteBoxFeed: { minHeight: 58, padding: 10 },
  note: { color: '#4a4a4a', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  noteMuted: { color: '#4a4a4a', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  footerPrimary: { flexShrink: 1 },
  footerText: { color: '#4a4a4a', fontSize: 10, fontWeight: '800' },
});
