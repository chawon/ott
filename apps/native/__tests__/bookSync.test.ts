jest.mock('expo-constants', () => ({ __esModule: true, default: {} }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'ko' }] }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../store/authStore', () => ({
  useAuthStore: { getState: () => ({ userId: 'test-user', deviceId: 'test-device' }) },
}));
jest.mock('../lib/localDb', () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn(),
  getTitleLocal: jest.fn(),
  listOutbox: jest.fn(),
  markLogDeletedLocal: jest.fn(),
  recordOutboxError: jest.fn(),
  removeOutboxItem: jest.fn(),
  setLogSyncStatus: jest.fn(),
  upsertLogLocal: jest.fn(),
  upsertTitleLocal: jest.fn(),
}));

import * as ExpoSecureStore from 'expo-secure-store';
import { searchTitles } from '../lib/api';
import * as localDb from '../lib/localDb';
import { STORAGE_KEYS } from '../lib/secureStore';
import { syncNow } from '../lib/sync';
import { buildOutboxPayload } from '../lib/syncPayload';
import { titleFromSearch } from '../lib/titleAdapters';
import type { Provider, Title, TitleSearchItem, WatchLog } from '../lib/types';

const db = jest.mocked(localDb);
const originalFetch = global.fetch;
const recordedAt = '2026-10-14T09:00:00.000Z';
const serverTime = '2026-10-14T09:01:00.000Z';
let fetchMock: jest.MockedFunction<typeof fetch>;
let outbox: Awaited<ReturnType<typeof localDb.listOutbox>>;
let storedLogs: Map<string, WatchLog>;
let storedTitles: Map<string, Title>;
let settings: Map<string, string>;

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200 });
}

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock = jest.fn();
  global.fetch = fetchMock;
  outbox = [];
  storedLogs = new Map();
  storedTitles = new Map();
  settings = new Map();
  jest.mocked(ExpoSecureStore.getItemAsync).mockImplementation(async (key) => {
    if (key === STORAGE_KEYS.userId) return 'test-user';
    if (key === STORAGE_KEYS.deviceId) return 'test-device';
    if (key === STORAGE_KEYS.analyticsClientId) return 'test-client';
    if (key === STORAGE_KEYS.localePreference) return 'ko';
    return null;
  });
  db.listOutbox.mockImplementation(async () => [...outbox]);
  db.removeOutboxItem.mockImplementation(async (id) => {
    outbox = outbox.filter((item) => item.id !== id);
  });
  db.getSetting.mockImplementation(async (key) => settings.get(key) ?? null);
  db.setSetting.mockImplementation(async (key, value) => {
    if (value === null) settings.delete(key);
    else settings.set(key, value);
  });
  db.upsertTitleLocal.mockImplementation(async (title) => { storedTitles.set(title.id, title); });
  db.getTitleLocal.mockImplementation(async (id) => storedTitles.get(id) ?? null);
  db.upsertLogLocal.mockImplementation(async (log) => { storedLogs.set(log.id, log); });
});

afterEach(() => { global.fetch = originalFetch; });

describe('book search and sync lifecycle', () => {
  it.each<Provider>(['KAKAO', 'NAVER', 'GOOGLE_BOOKS'])(
    'keeps %s book identity through search, offline retry, push and canonical pull',
    async (provider) => {
      const canonicalTitleId = provider === 'NAVER' ? 'existing-naver-id' : 'canonical-kakao-id';
      const locale = provider === 'GOOGLE_BOOKS' ? 'en' : 'ko';
      jest.mocked(ExpoSecureStore.getItemAsync).mockImplementation(async (key) => {
        if (key === STORAGE_KEYS.userId) return 'test-user';
        if (key === STORAGE_KEYS.deviceId) return 'test-device';
        if (key === STORAGE_KEYS.analyticsClientId) return 'test-client';
        if (key === STORAGE_KEYS.localePreference) return locale;
        return null;
      });
      const searchItem: TitleSearchItem = {
        provider,
        providerId: provider === 'GOOGLE_BOOKS' ? 'opaque-volume' : provider === 'NAVER' ? '8936433598' : '9788936433598',
        titleId: provider === 'NAVER' ? canonicalTitleId : undefined,
        type: 'book',
        name: '채식주의자',
        author: '한강',
        publisher: '창비',
        isbn10: '8936433598',
        isbn13: '9788936433598',
        pubdate: '20071030',
      };
      fetchMock.mockResolvedValueOnce(jsonResponse([searchItem]));

      const [selected] = await searchTitles('채식주의자', 'book');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/api/titles/search?${new URLSearchParams({ q: '채식주의자', type: 'book' })}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept-Language': locale,
            'X-Book-Search-Capability': 'google_books_v1',
          }),
        }),
      );
      const log: WatchLog = {
        id: 'book-log',
        title: titleFromSearch(selected, selected.titleId ?? 'local-book-id'),
        status: 'DONE',
        rating: 4.5,
        note: '내가 입력한 메모',
        spoiler: false,
        watchedAt: '2026-10-01T03:00:00.000Z',
        createdAt: recordedAt,
        updatedAt: recordedAt,
        syncStatus: 'pending',
      };
      const payload = buildOutboxPayload(log, recordedAt);
      storedLogs.set(log.id, log);
      outbox.push({
        id: 'outbox-book', logId: log.id, payload, createdAt: recordedAt, attempts: 0, lastError: null,
      });
      fetchMock.mockRejectedValue(new TypeError('Network request failed'));

      await expect(syncNow()).rejects.toThrow('Network request failed');
      expect(db.recordOutboxError).toHaveBeenCalledWith('outbox-book', 'Network request failed');
      expect(db.setLogSyncStatus).toHaveBeenCalledWith(log.id, 'failed');
      expect(outbox).toHaveLength(1);
      expect(outbox[0].payload).toEqual(payload);
      expect(settings.has('lastSyncAt')).toBe(false);

      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(jsonResponse({ rejected: [] }));
      fetchMock.mockResolvedValueOnce(jsonResponse({
        serverTime,
        changes: {
          titles: [{ ...log.title, id: canonicalTitleId, updatedAt: serverTime }],
          logs: [{
            ...payload.log.payload,
            id: log.id,
            titleId: canonicalTitleId,
            createdAt: recordedAt,
            updatedAt: serverTime,
          }],
        },
      }));

      await expect(syncNow()).resolves.toEqual({ pushed: 1, pulled: 1, skipped: false });
      expect(fetchMock.mock.calls[0][0]).toEqual(expect.stringContaining('/api/sync/push'));
      const pushed = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(pushed.changes.titles[0]).toMatchObject({
        id: selected.titleId ?? 'local-book-id',
        payload: {
          provider, providerId: searchItem.providerId,
          author: '한강', publisher: '창비', isbn10: '8936433598', isbn13: '9788936433598',
          pubdate: '20071030',
        },
      });
      expect(storedLogs.get(log.id)).toMatchObject({
        title: { id: canonicalTitleId, provider, providerId: searchItem.providerId },
        status: 'DONE', rating: 4.5, note: '내가 입력한 메모',
        watchedAt: '2026-10-01T03:00:00.000Z', syncStatus: 'synced',
      });
      expect(outbox).toHaveLength(0);
      expect(settings.get('lastSyncAt')).toBe(serverTime);
    },
  );
});
