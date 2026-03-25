import * as SecureStore from './secureStore';

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
    headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// 인증
export async function register(): Promise<{ userId: string; deviceId: string; pairingCode: string }> {
  return request('/api/auth/register', { method: 'POST' });
}

export async function pair(code: string, oldUserId?: string): Promise<{ userId: string; deviceId: string }> {
  return request('/api/auth/pair', {
    method: 'POST',
    body: JSON.stringify({ code, oldUserId }),
  });
}

// 타이틀 검색
export async function searchTitles(q: string, type?: string) {
  const params = new URLSearchParams({ q });
  if (type && type !== 'ALL') params.set('type', type);
  return request<{ items: import('./types').TitleSearchItem[] }>(`/api/titles/search?${params}`);
}

// 동기화
export async function syncPull(since?: string): Promise<{ logs: import('./types').WatchLog[] }> {
  const params = since ? `?since=${encodeURIComponent(since)}` : '';
  return request(`/api/sync/pull${params}`);
}

export async function syncPush(operations: unknown[]): Promise<void> {
  await request('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify({ operations }),
  });
}
