import { create } from 'zustand';
import { pair, register } from '../lib/api';
import * as SecureStore from '../lib/secureStore';
import type { Credentials } from '../lib/types';

interface AuthState extends Credentials {
  isLoaded: boolean;
  loadCredentials: () => Promise<void>;
  setCredentials: (credentials: { userId: string; deviceId: string; pairingCode: string }) => Promise<void>;
  ensureRegistered: () => Promise<{ userId: string; deviceId: string; pairingCode: string }>;
  pairWithCode: (code: string) => Promise<{ userId: string; deviceId: string; pairingCode: string }>;
  clearCredentials: () => Promise<void>;
}

async function readCredentials(): Promise<Credentials> {
  const [userId, deviceId, pairingCode] = await Promise.all([
    SecureStore.getItemAsync('userId'),
    SecureStore.getItemAsync('deviceId'),
    SecureStore.getItemAsync('pairingCode'),
  ]);
  return { userId, deviceId, pairingCode };
}

async function writeCredentials(credentials: { userId: string; deviceId: string; pairingCode: string }) {
  await Promise.all([
    SecureStore.setItemAsync('userId', credentials.userId),
    SecureStore.setItemAsync('deviceId', credentials.deviceId),
    SecureStore.setItemAsync('pairingCode', credentials.pairingCode),
  ]);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  userId: null,
  deviceId: null,
  pairingCode: null,
  isLoaded: false,

  loadCredentials: async () => {
    const credentials = await readCredentials();
    set({ ...credentials, isLoaded: true });
  },

  setCredentials: async (credentials) => {
    await writeCredentials(credentials);
    set({ ...credentials, isLoaded: true });
  },

  ensureRegistered: async () => {
    const current = get();
    if (current.userId && current.deviceId && current.pairingCode) {
      return {
        userId: current.userId,
        deviceId: current.deviceId,
        pairingCode: current.pairingCode,
      };
    }
    const credentials = await register();
    await get().setCredentials(credentials);
    return credentials;
  },

  pairWithCode: async (code) => {
    const current = get();
    const credentials = await pair(code.trim().toUpperCase(), current.userId);
    await get().setCredentials(credentials);
    return credentials;
  },

  clearCredentials: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync('userId'),
      SecureStore.deleteItemAsync('deviceId'),
      SecureStore.deleteItemAsync('pairingCode'),
    ]);
    set({ userId: null, deviceId: null, pairingCode: null, isLoaded: true });
  },
}));
