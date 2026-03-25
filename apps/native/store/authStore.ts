import { create } from 'zustand';
import * as SecureStore from '../lib/secureStore';

interface AuthState {
  userId: string | null;
  deviceId: string | null;
  isLoaded: boolean;
  setCredentials: (userId: string, deviceId: string) => Promise<void>;
  loadCredentials: () => Promise<void>;
  clearCredentials: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  deviceId: null,
  isLoaded: false,

  loadCredentials: async () => {
    const userId = await SecureStore.getItemAsync('userId');
    const deviceId = await SecureStore.getItemAsync('deviceId');
    set({ userId, deviceId, isLoaded: true });
  },

  setCredentials: async (userId: string, deviceId: string) => {
    await SecureStore.setItemAsync('userId', userId);
    await SecureStore.setItemAsync('deviceId', deviceId);
    set({ userId, deviceId });
  },

  clearCredentials: async () => {
    await SecureStore.deleteItemAsync('userId');
    await SecureStore.deleteItemAsync('deviceId');
    set({ userId: null, deviceId: null });
  },
}));
