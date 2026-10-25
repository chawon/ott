import { buildOutboxPayload, buildUpdateLogPayload } from '../lib/syncPayload';
import { searchItemFromDiscussion, titleFromDiscussion, titleFromSearch } from '../lib/titleAdapters';
import type { DiscussionListItem, Title, TitleSearchItem, WatchLog } from '../lib/types';

const recordedAt = '2026-10-14T09:00:00.000Z';
const bookDiscussion: DiscussionListItem = {
  id: 'discussion-1',
  titleId: 'server-book-id',
  titleProvider: 'KAKAO',
  titleProviderId: '9788936433598',
  titleType: 'book',
  titleName: '채식주의자',
  titleYear: 2007,
  posterUrl: 'https://example.com/book.jpg',
  commentCount: 1,
  createdAt: recordedAt,
};

function bookLog(title: Title): WatchLog {
  return {
    id: 'log-1',
    title,
    status: 'DONE',
    rating: 4.5,
    note: '다시 읽은 기록',
    spoiler: false,
    watchedAt: '2026-10-01T03:00:00.000Z',
    createdAt: recordedAt,
    syncStatus: 'pending',
  };
}

describe('native book provider identity', () => {
  it('keeps Kakao identity from a recent discussion through the saved log and outbox', () => {
    const selected = searchItemFromDiscussion(bookDiscussion);
    const log = bookLog(titleFromSearch(selected, selected.titleId!));
    const outbox = buildOutboxPayload(log, recordedAt);

    expect(log.title).toMatchObject({
      id: 'server-book-id',
      type: 'book',
      provider: 'KAKAO',
      providerId: '9788936433598',
    });
    expect(outbox.title).toMatchObject({
      id: 'server-book-id',
      payload: { provider: 'KAKAO', providerId: '9788936433598' },
    });
    expect(outbox.log.payload?.titleId).toBe('server-book-id');
  });

  it('keeps Kakao identity when a public book reaction creates a local-first record', () => {
    const log = bookLog(titleFromDiscussion(bookDiscussion));
    const outbox = buildOutboxPayload(log, recordedAt);

    expect(outbox.title).toMatchObject({
      id: 'server-book-id',
      payload: { provider: 'KAKAO', providerId: '9788936433598' },
    });
    expect(outbox.log.payload?.titleId).toBe('server-book-id');
  });

  it('keeps legacy Naver book identity and manual fields when updating a record', () => {
    const log = bookLog(titleFromDiscussion({ ...bookDiscussion, titleProvider: 'NAVER' }));
    const outbox = buildUpdateLogPayload(log, recordedAt);

    expect(outbox.title).toMatchObject({
      id: 'server-book-id',
      payload: { provider: 'NAVER', providerId: '9788936433598' },
    });
    expect(outbox.log.payload).toMatchObject({
      titleId: 'server-book-id',
      status: 'DONE',
      rating: 4.5,
      note: '다시 읽은 기록',
      watchedAt: '2026-10-01T03:00:00.000Z',
    });
  });

  it('preserves book search metadata and the existing server title ID in the outbox', () => {
    const selected: TitleSearchItem = {
      provider: 'KAKAO',
      providerId: '9788936433598',
      titleId: 'existing-edition-id',
      type: 'book',
      name: '채식주의자',
      author: '한강',
      publisher: '창비',
      isbn10: '8936433598',
      isbn13: '9788936433598',
      pubdate: '20071030',
    };
    const log = bookLog(titleFromSearch(selected, selected.titleId!));
    const outbox = buildOutboxPayload(log, recordedAt);

    expect(outbox.title).toMatchObject({
      id: 'existing-edition-id',
      payload: {
        provider: 'KAKAO',
        providerId: '9788936433598',
        author: '한강',
        publisher: '창비',
        isbn10: '8936433598',
        isbn13: '9788936433598',
        pubdate: '20071030',
      },
    });
    expect(outbox.log.payload?.titleId).toBe('existing-edition-id');
  });

  it.each(['TMDB', 'LOCAL', 'NAVER', 'GOOGLE_BOOKS'])('preserves %s provider handling', (provider) => {
    const discussion = { ...bookDiscussion, titleProvider: provider };
    expect(searchItemFromDiscussion(discussion).provider).toBe(provider);
    expect(titleFromDiscussion(discussion).provider).toBe(provider);
  });

  it('preserves Google volume identity through recent selections and public reactions', () => {
    const discussion = { ...bookDiscussion, titleProvider: 'GOOGLE_BOOKS', titleProviderId: 'opaque-volume' };
    const selected = searchItemFromDiscussion(discussion);
    for (const title of [titleFromSearch(selected, selected.titleId!), titleFromDiscussion(discussion)]) {
      expect(buildOutboxPayload(bookLog(title), recordedAt).title).toMatchObject({
        id: 'server-book-id',
        payload: { provider: 'GOOGLE_BOOKS', providerId: 'opaque-volume' },
      });
    }
  });

  it.each([null, undefined, 'UNSUPPORTED'])('preserves fallback for provider %s', (provider) => {
    const discussion = { ...bookDiscussion, titleProvider: provider, titleProviderId: null };
    expect(searchItemFromDiscussion(discussion)).toMatchObject({
      provider: 'LOCAL',
      providerId: 'server-book-id',
      titleId: 'server-book-id',
    });
    expect(titleFromDiscussion(discussion).provider).toBeUndefined();
  });
});
