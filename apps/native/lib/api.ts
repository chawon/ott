import * as SecureStore from './secureStore';
import type {
  FeedbackCategory,
  FeedbackThreadDetail,
  FeedbackThreadSummary,
  SyncPullResponse,
  SyncPushBody,
  TitleSearchItem,
} from './types';

const BASE_URL = 'https://ottline.app';

async function getHeaders(): Promise<Record<string, string>> {
  const userId = await SecureStore.getItemAsync('userId');
  const deviceId = await SecureStore.getItemAsync('deviceId');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': 'ko',
  };
  if (userId) headers['X-User-Id'] = userId;
  if (deviceId) headers['X-Device-Id'] = deviceId;
  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...((options?.headers as Record<string, string>) ?? {}) },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `API ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function register(): Promise<{ userId: string; deviceId: string; pairingCode: string }> {
  return request('/api/auth/register', { method: 'POST' });
}

export async function pair(
  code: string,
  oldUserId?: string | null,
): Promise<{ userId: string; deviceId: string; pairingCode: string }> {
  return request('/api/auth/pair', {
    method: 'POST',
    body: JSON.stringify({ code, oldUserId: oldUserId ?? null }),
  });
}

export async function deleteAccount(): Promise<void> {
  await request('/api/auth/account', { method: 'DELETE' });
}

export async function searchTitles(query: string, type: 'ALL' | 'movie' | 'series' | 'book') {
  const params = new URLSearchParams({ q: query });
  if (type === 'book') params.set('type', 'book');
  const items = await request<TitleSearchItem[]>(`/api/titles/search?${params.toString()}`);
  if (type === 'ALL' || type === 'book') return items;
  return items.filter((item) => item.type === type);
}

export async function syncPush(body: SyncPushBody): Promise<{
  accepted: string[];
  rejected: { id: string; reason: string }[];
}> {
  return request('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function syncPull(since?: string | null): Promise<SyncPullResponse> {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return request(`/api/sync/pull${query}`);
}

export async function listFeedbackThreads(): Promise<FeedbackThreadSummary[]> {
  return request('/api/feedback/threads');
}

export async function createFeedbackThread(input: {
  category: FeedbackCategory;
  subject: string;
  body: string;
}): Promise<FeedbackThreadDetail> {
  return request('/api/feedback/threads', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
