import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withRepeat, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { WatchLog } from '../../lib/types';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

const PLACE_LABEL: Record<string, string> = {
  HOME: '🏠 집', THEATER: '🎭 극장', TRANSIT: '🚇 이동중',
  CAFE: '☕ 카페', OFFICE: '💼 사무실', LIBRARY: '📖 도서관',
  BOOKSTORE: '📚 서점', SCHOOL: '🏫 학교', PARK: '🌿 공원',
  OUTDOOR: '🌳 야외', ETC: '📍 기타',
};

const OCCASION_LABEL: Record<string, string> = {
  ALONE: '혼자', DATE: '데이트', FAMILY: '가족',
  FRIENDS: '친구와', BREAK: '휴식중', ETC: '기타',
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
}

export function JourneyNode({ log, index, onPress }: JourneyNodeProps) {
  const isRight = index % 2 === 0;
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
        style={[styles.card, log.status === 'WISHLIST' && styles.cardWishlist]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* 포스터 */}
        <View style={styles.posterWrapper}>
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
        </View>

        {/* 제목 */}
        <Text style={styles.title} numberOfLines={1}>{log.title.name}</Text>

        {/* 시즌 정보 */}
        {log.seasonNumber && (
          <Text style={styles.season}>시즌 {log.seasonNumber}{log.episodeNumber ? ` · EP${log.episodeNumber}` : ''}</Text>
        )}

        {/* 날짜 */}
        <Text style={styles.date}>{date}</Text>

        {/* 장소/상황 */}
        {(log.place || log.occasion) && (
          <Text style={styles.context} numberOfLines={1}>
            {log.place ? PLACE_LABEL[log.place] : ''}
            {log.place && log.occasion ? ' · ' : ''}
            {log.occasion ? OCCASION_LABEL[log.occasion] : ''}
          </Text>
        )}
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
  context: {
    ...Typography.labelSm,
    color: Colors.outlineVariant,
    fontSize: 10,
  },
});
