import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { NativeAppHeader } from '../components/NativeAppHeader';
import { useAuthStore } from '../store/authStore';
import { initDb } from '../lib/localDb';
import {
  configureNotificationPresentation,
  routeFromNotificationResponse,
} from '../lib/notifications';
import { setAnalyticsRoute, trackEvent } from '../lib/api';
import {
  NativePreferencesProvider,
  useNativePreferences,
} from '../lib/nativePreferences';

export default function RootLayout() {
  return (
    <NativePreferencesProvider>
      <RootLayoutContent />
    </NativePreferencesProvider>
  );
}

function RootLayoutContent() {
  const { loadCredentials } = useAuthStore();
  const { colors, colorScheme } = useNativePreferences();
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const appOpenTracked = useRef(false);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      await Promise.all([loadCredentials(), initDb()]);
      if (mounted) setReady(true);
    }
    boot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setAnalyticsRoute(pathname ?? null);
    if (!ready || appOpenTracked.current) return;
    appOpenTracked.current = true;
    trackEvent({
      eventName: 'app_open',
      properties: {
        source: 'ios_native_app',
        route: pathname ?? '/',
      },
    }).catch(() => null);
  }, [pathname, ready]);

  useEffect(() => {
    if (!ready) return;
    configureNotificationPresentation();

    function openNotificationRoute(response: Notifications.NotificationResponse | null | undefined) {
      const route = routeFromNotificationResponse(response);
      if (!route) return;
      router.push(route);
      trackEvent({
        eventName: 'notification_open',
        properties: {
          source: 'ios_native_notification',
          route,
        },
      }).catch(() => null);
      Notifications.clearLastNotificationResponse();
    }

    openNotificationRoute(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotificationRoute);
    return () => {
      subscription.remove();
    };
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primaryContainer} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} backgroundColor={colors.background} />
      <NativeAppHeader />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="title/[id]" />
          <Stack.Screen name="public/[id]" />
          <Stack.Screen name="me/report" />
          <Stack.Screen name="feedback/index" />
          <Stack.Screen name="feedback/[id]" />
          <Stack.Screen name="about" />
          <Stack.Screen name="faq" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="offline" />
        </Stack>
      </View>
    </View>
  );
}
