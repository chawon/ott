import Constants from 'expo-constants';
import { getLocales } from 'expo-localization';
import { Appearance } from 'react-native';
import { buildAnalyticsProperties, IOS_NATIVE_PLATFORM } from './analytics';
import * as SecureStore from './secureStore';
import { STORAGE_KEYS } from './secureStore';
import { uuid } from './id';
import type {
  FeedbackCategory,
  Comment,
  CreateCommentRequest,
  DeviceSummary,
  Discussion,
  DiscussionListItem,
  DiscussionReactionState,
  DiscussionReactionType,
  FeedbackThreadDetail,
  FeedbackThreadSummary,
  PersonalReport,
  SyncPullResponse,
  SyncPushBody,
  Title,
  TmdbEpisode,
  TmdbSeason,
  TitleSearchItem,
  UpdateUserProfileRequest,
  UserProfile,
  WatchLogHistory,
} from './types';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const BASE_URL = (configuredBaseUrl || 'https://ottline.app').replace(/\/+$/, '');
const SESSION_ID = `ios-${uuid()}`;
let currentAnalyticsRoute: string | null = null;
let currentAnalyticsTheme: string | null = null;

export function setAnalyticsRoute(route: string | null | undefined) {
  currentAnalyticsRoute = route || null;
}

export function setAnalyticsTheme(theme: string | null | undefined) {
  currentAnalyticsTheme = theme || null;
}

export function webUrl(path: string) {
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function acceptLanguage() {
  const storedLocale = await SecureStore.getItemAsync(STORAGE_KEYS.localePreference);
  if (storedLocale === 'ko' || storedLocale === 'en') return storedLocale;

  const locale = getLocales()[0];
  const language = (locale?.languageCode ?? locale?.languageTag ?? 'ko').toLowerCase();
  return language.startsWith('ko') ? 'ko' : 'en';
}

function nativeAppVersion() {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? null;
}

function nativeBuildNumber() {
  return Constants.expoConfig?.ios?.buildNumber ?? Constants.nativeBuildVersion ?? null;
}

export async function ensureAnalyticsClientId() {
  const existing = await SecureStore.getItemAsync(STORAGE_KEYS.analyticsClientId);
  if (existing) return existing;

  const next = uuid();
  await SecureStore.setItemAsync(STORAGE_KEYS.analyticsClientId, next);
  return next;
}

async function getHeaders(): Promise<Record<string, string>> {
  const [userId, deviceId, clientId] = await Promise.all([
    SecureStore.getItemWithLegacyFallbackAsync(STORAGE_KEYS.userId, 'userId'),
    SecureStore.getItemWithLegacyFallbackAsync(STORAGE_KEYS.deviceId, 'deviceId'),
    ensureAnalyticsClientId(),
  ]);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': await acceptLanguage(),
    'X-Client-Id': clientId,
    'X-Client-Platform': IOS_NATIVE_PLATFORM,
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

export async function getUserProfile(): Promise<UserProfile> {
  return request('/api/auth/profile');
}

export async function updateUserProfile(input: UpdateUserProfileRequest): Promise<UserProfile> {
  return request('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function listDevices(): Promise<DeviceSummary[]> {
  return request('/api/auth/devices');
}

export async function revokeDevice(id: string): Promise<void> {
  await request(`/api/auth/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function revokeAllDevices(): Promise<void> {
  await request('/api/auth/devices/all', { method: 'DELETE' });
}

export async function getPersonalReport(): Promise<PersonalReport> {
  return request('/api/nalytic/me/report');
}

export async function trackEvent(input: {
  eventName: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const installId = await ensureAnalyticsClientId();
  const appVersion = nativeAppVersion();
  await request('/api/nalytic/events', {
    method: 'POST',
    body: JSON.stringify({
      eventName: input.eventName,
      platform: IOS_NATIVE_PLATFORM,
      sessionId: SESSION_ID,
      clientVersion: appVersion,
      properties: buildAnalyticsProperties(
        {
          appVersion,
          buildNumber: nativeBuildNumber(),
          installId,
          locale: await acceptLanguage(),
          route: currentAnalyticsRoute,
          sessionId: SESSION_ID,
          theme: currentAnalyticsTheme ?? Appearance.getColorScheme(),
        },
        input.properties,
      ),
    }),
  });
}

export async function searchTitles(query: string, type: 'ALL' | 'movie' | 'series' | 'book') {
  const params = new URLSearchParams({ q: query });
  if (type === 'book') params.set('type', 'book');
  const items = await request<TitleSearchItem[]>(`/api/titles/search?${params.toString()}`);
  if (type === 'ALL' || type === 'book') return items;
  return items.filter((item) => item.type === type);
}

export async function popularTitles(limit = 6): Promise<TitleSearchItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  return request(`/api/titles/popular?${params.toString()}`);
}

export async function getTitle(id: string): Promise<Title> {
  return request(`/api/titles/${encodeURIComponent(id)}`);
}

export async function listLogHistory(logId: string, limit = 50): Promise<WatchLogHistory[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  return request(`/api/logs/${encodeURIComponent(logId)}/history?${params.toString()}`);
}

export async function listTvSeasons(providerId: string): Promise<TmdbSeason[]> {
  return request(`/api/tmdb/tv/${encodeURIComponent(providerId)}/seasons`);
}

export async function listTvEpisodes(providerId: string, seasonNumber: number): Promise<TmdbEpisode[]> {
  return request(`/api/tmdb/tv/${encodeURIComponent(providerId)}/seasons/${seasonNumber}`);
}

export async function listDiscussions(
  scope: 'latest' | 'all' = 'latest',
  limit = scope === 'all' ? 100 : 20,
  days?: number,
): Promise<DiscussionListItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (typeof days === 'number') params.set('days', String(days));
  return request(`/api/discussions/${scope}?${params.toString()}`);
}

export async function getDiscussion(id: string): Promise<DiscussionListItem> {
  return request(`/api/discussions/${encodeURIComponent(id)}`);
}

export async function getDiscussionByTitle(titleId: string): Promise<Discussion | null> {
  return request(`/api/discussions?titleId=${encodeURIComponent(titleId)}`);
}

export async function createDiscussion(titleId: string): Promise<Discussion> {
  return request('/api/discussions', {
    method: 'POST',
    body: JSON.stringify({ titleId }),
  });
}

export async function listComments(discussionId: string, limit = 200): Promise<Comment[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  return request(`/api/discussions/${encodeURIComponent(discussionId)}/comments?${params.toString()}`);
}

export async function createComment(
  discussionId: string,
  input: CreateCommentRequest,
): Promise<Comment> {
  return request(`/api/discussions/${encodeURIComponent(discussionId)}/comments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getMyDiscussionReaction(
  discussionId: string,
): Promise<DiscussionReactionState> {
  return request(`/api/discussions/${encodeURIComponent(discussionId)}/reactions/me`);
}

export async function toggleDiscussionReaction(
  discussionId: string,
  type: DiscussionReactionType,
): Promise<DiscussionReactionState> {
  return request(`/api/discussions/${encodeURIComponent(discussionId)}/reactions`, {
    method: 'PUT',
    body: JSON.stringify({ type }),
  });
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

export async function getFeedbackThread(id: string): Promise<FeedbackThreadDetail> {
  return request(`/api/feedback/threads/${encodeURIComponent(id)}`);
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
