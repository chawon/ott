import { Platform } from 'react-native';
import * as ExpoSecureStore from 'expo-secure-store';

export const STORAGE_KEYS = {
  userId: 'ottline.native.userId',
  deviceId: 'ottline.native.deviceId',
  pairingCode: 'ottline.native.pairingCode',
  analyticsClientId: 'ottline.native.analyticsClientId',
  themePreference: 'ottline.native.themePreference',
} as const;

export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return ExpoSecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  return ExpoSecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  return ExpoSecureStore.deleteItemAsync(key);
}

export async function getItemWithLegacyFallbackAsync(
  key: string,
  legacyKey: string,
): Promise<string | null> {
  const current = await getItemAsync(key);
  if (current) return current;

  const legacy = await getItemAsync(legacyKey);
  if (!legacy) return null;

  await setItemAsync(key, legacy);
  await deleteItemAsync(legacyKey);
  return legacy;
}
