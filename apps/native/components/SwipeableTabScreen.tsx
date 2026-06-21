import { router } from 'expo-router';
import { ReactNode, useMemo } from 'react';
import { PanResponder, View } from 'react-native';

const TAB_ORDER = ['/(tabs)/log', '/(tabs)/timeline', '/(tabs)/together', '/(tabs)/account'] as const;

export function SwipeableTabScreen({
  children,
  routeKey,
}: {
  children: ReactNode;
  routeKey: (typeof TAB_ORDER)[number];
}) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_evt, gestureState) => {
          if (Math.abs(gestureState.dx) < 50) return;
          const currentIndex = TAB_ORDER.indexOf(routeKey);
          const nextIndex = gestureState.dx < 0 ? currentIndex + 1 : currentIndex - 1;
          const next = TAB_ORDER[nextIndex];
          if (next) router.replace(next);
        },
      }),
    [routeKey],
  );

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
