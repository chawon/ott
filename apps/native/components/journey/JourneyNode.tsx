import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withRepeat, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { WatchLog } from '../../lib/types';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

const PLACE_ICON: Record<string, string> = {
  HOME: '🏠', THEATER: '🎭', TRANSIT: '🚇', CAFE: '☕',
  OFFICE: '💼', LIBRARY: '📖', BOOKSTORE: '📚', SCHOOL: '🏫',
  PARK: '🌿', OUTDOOR: '🌳', ETC: '📍',
};

const PLACE_SHORT: Record<string, string> = {
  HOME: '집', THEATER: '극장', TRANSIT: '이동중', CAFE: '카페',
  OFFICE: '사무실', LIBRARY: '도서관', BOOKSTORE: '서점', SCHOOL: '학교',
  PARK: '공원', OUTDOOR: '야외', ETC: '기타',
};

const OCCASION_ICON: Record<string, string> = {
  ALONE: '🎧', DATE: '💑', FAMILY: '👨‍👩‍👧', FRIENDS: '👥', BREAK: '🛋️', ETC: '✨',
};

const OTT_COLOR: Record<string, string> = {
  'Netflix': '#E50914', '왓챠': '#FF153C', '티빙': '#FF0558',
  '웨이브': '#0090F5', '시즌': '#7B2FBE', '애플 TV+': '#A2AAAD',
  'Apple TV+': '#A2AAAD', '디즈니+': '#113CCF', '쿠팡플레이': '#1ABAF4',
  'Watcha': '#FF153C', 'Tving': '#FF0558', 'Wavve': '#0090F5',
};

const TYPE_LABEL: Record<string, string> = {
  movie: 'MOVIE', series: 'SERIES', book: 'BOOK',
};

const TYPE_COLOR: Record<string, string> = {
  movie: Colors.secondary,
  series: Colors.secondary,
  book: Colors.tertiary,
};

interface JourneyNodeProps {
  log: WatchLog;
  index: number;
  onPress: () => void;
  auraScore: number;   // 0~1
  auraColor: string;   // hex color
}

export function JourneyNode({ log, index, onPress, auraScore, auraColor }: JourneyNodeProps) {
  const isRight = index % 2 === 0;

  // auraScore 기반 시각 강도 계산
  const cardWidth = auraScore >= 0.7 ? 230 : auraScore >= 0.3 ? 220 : 200;
  const shadowRadius = auraScore >= 0.7 ? 32 : auraScore >= 0.3 ? 20 : 8;
  const shadowOpacity = auraScore >= 0.7 ? 0.5 : auraScore >= 0.3 ? 0.25 : 0.08;
  const cardOpacity = auraScore < 0.3 ? 0.72 : 1;
  const borderAlpha = auraScore >= 0.7 ? 'cc' : auraScore >= 0.3 ? '66' : '22';

  const pulse = useSharedValue(1);

  if (log.status === 'IN_PROGRESS') {
    pulse.value = withRepeat(withTiming(1.4, { duration: 900 }), -1, true);
  }

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: log.status === 'IN_PROGRESS' ? 0.4 : 0,
  }));

  const dotColor =
    log.status === 'DONE' ? Colors.statusDone :
    log.status === 'IN_PROGRESS' ? Colors.statusInProgress :
    Colors.statusWishlist;

  const posterUrl = log.title.type === 'series' && log.seasonPosterUrl
    ? log.seasonPosterUrl
    : log.title.posterUrl;

  const date = new Date(log.watchedAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <View style={[styles.wrapper, isRight ? styles.alignRight : styles.alignLeft]}>
      {/* 노드 원 (경로 연결점) */}
      <View style={[styles.dotWrapper, isRight ? styles.dotLeft : styles.dotRight]}>
        <Animated.View style={[styles.pulseBg, { backgroundColor: dotColor }, pulseStyle]} />
        <View style={[styles.dot, { backgroundColor: dotColor, shadowColor: dotColor }]}>
          {log.status === 'DONE' && <Text style={styles.checkmark}>✓</Text>}
          {log.status === 'WISHLIST' && <Text style={styles.checkmark}>○</Text>}
        </View>
      </View>

      {/* 카드 */}
      <TouchableOpacity
        style={[
          styles.card,
          log.status === 'WISHLIST' && styles.cardWishlist,
          {
            width: cardWidth,
            opacity: cardOpacity,
            shadowColor: auraColor,
            shadowRadius,
            shadowOpacity,
            borderColor: `${auraColor}${borderAlpha}`,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* 포스터 */}
        <View style={[
          styles.posterWrapper,
          auraScore >= 0.7 && { borderWidth: 1.5, borderColor: `${auraColor}88` },
        ]}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Text style={styles.posterPlaceholderIcon}>
                {log.title.type === 'book' ? '📚' : log.title.type === 'series' ? '📺' : '🎬'}
              </Text>
            </View>
          )}
          {/* 타입 뱃지 */}
          <View style={[styles.typeBadge, { borderColor: `${TYPE_COLOR[log.title.type]}44` }]}>
            <Text style={[styles.typeLabel, { color: TYPE_COLOR[log.title.type] }]}>
              {TYPE_LABEL[log.title.type]}
            </Text>
          </View>
          {/* 평점 */}
          {log.rating && (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>{'★'.repeat(Math.round(log.rating / 2))}</Text>
            </View>
          )}
          {/* 플랫폼 도트 — 좌상단 */}
          {log.ott && (
            <View style={[styles.ottDot, { backgroundColor: OTT_COLOR[log.ott] ?? Colors.primaryContainer }]}>
              <Text style={styles.ottDotText}>{log.ott.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          {/* 장소+상황 — 포스터 하단 frosted strip */}
          {(log.place || log.occasion) && (
            <View style={styles.contextStrip}>
              {log.place && (
                <Text style={styles.contextStripText}>
                  {PLACE_ICON[log.place]} {PLACE_SHORT[log.place]}
                </Text>
              )}
              {log.place && log.occasion && (
                <Text style={styles.contextDivider}>·</Text>
              )}
              {log.occasion && (
                <Text style={styles.contextStripText}>
                  {OCCASION_ICON[log.occasion]}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* 제목 */}
        <Text style={styles.title} numberOfLines={1}>{log.title.name}</Text>

        {/* 시즌 정보 */}
        {log.seasonNumber && (
          <Text style={styles.season}>시즌 {log.seasonNumber}{log.episodeNumber ? ` · EP${log.episodeNumber}` : ''}</Text>
        )}

        {/* 날짜 */}
        <Text style={styles.date}>{date}</Text>

      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 20,
    position: 'relative',
  },
  alignRight: {
    alignItems: 'flex-end',
    paddingRight: 24,
    paddingLeft: 64,
  },
  alignLeft: {
    alignItems: 'flex-start',
    paddingLeft: 24,
    paddingRight: 64,
  },
  dotWrapper: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLeft: {
    left: 16,
  },
  dotRight: {
    right: 16,
  },
  pulseBg: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  checkmark: {
    color: '#0b1326',
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    width: 220,
    backgroundColor: 'rgba(45, 52, 73, 0.4)',
    borderRadius: 20,
    padding: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  cardWishlist: {
    opacity: 0.6,
  },
  posterWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPlaceholderIcon: {
    fontSize: 40,
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(11,19,38,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(11,19,38,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    color: Colors.tertiary,
    fontSize: 10,
  },
  title: {
    ...Typography.headlineSm,
    fontSize: 15,
    marginBottom: 2,
  },
  season: {
    ...Typography.labelSm,
    color: Colors.secondary,
    marginBottom: 2,
  },
  date: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    marginBottom: 4,
  },
  ottDot: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ottDotText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  contextStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(8,14,28,0.72)',
  },
  contextStripText: {
    fontSize: 10,
    color: 'rgba(221,229,255,0.85)',
  },
  contextDivider: {
    fontSize: 10,
    color: 'rgba(221,229,255,0.3)',
  },
});
