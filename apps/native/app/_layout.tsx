import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/colors';
import { initDb } from '../lib/localDb';

export default function RootLayout() {
  const { loadCredentials } = useAuthStore();
  const [ready, setReady] = useState(false);

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

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primaryContainer} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" backgroundColor={Colors.background} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="feedback/index" />
      </Stack>
    </View>
  );
}
