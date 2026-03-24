import { calcDnaTraits, calcAuraScore } from '../lib/gamification';
import { WatchLog } from '../lib/types';

function makeLog(overrides: Partial<WatchLog> = {}): WatchLog {
  return {
    id: 'test-id',
    title: { id: 't1', type: 'movie', name: 'Test' },
    status: 'DONE',
    spoiler: false,
    watchedAt: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    place: null,
    occasion: null,
    ott: null,
    rating: null,
    note: null,
    ...overrides,
  };
}

describe('calcDnaTraits', () => {
  it('빈 배열이면 topTraits가 비어있다', () => {
    const result = calcDnaTraits([]);
    expect(result.topTraits).toEqual([]);
  });

  it('책 로그 4개 / 전체 10개면 book_maniac 활성화 (≥30%)', () => {
    const logs = [
      ...Array(4).fill(null).map(() => makeLog({ title: { id: 't', type: 'book', name: 'B' } })),
      ...Array(6).fill(null).map(() => makeLog()),
    ];
    const result = calcDnaTraits(logs);
    expect(result.traits['book_maniac']).toBeGreaterThan(0);
    expect(result.topTraits).toContain('book_maniac');
  });

  it('Netflix 6개 / 전체 10개면 netflix_loyal 활성화 (≥50%)', () => {
    const logs = [
      ...Array(6).fill(null).map(() => makeLog({ ott: 'Netflix' })),
      ...Array(4).fill(null).map(() => makeLog({ ott: '티빙' })),
    ];
    const result = calcDnaTraits(logs);
    expect(result.traits['netflix_loyal']).toBeGreaterThan(0);
    expect(result.topTraits).toContain('netflix_loyal');
  });

  it('topTraits는 최대 3개', () => {
    const logs = Array(20).fill(null).map(() =>
      makeLog({ title: { id: 't', type: 'book', name: 'B' }, place: 'HOME', occasion: 'ALONE' })
    );
    const result = calcDnaTraits(logs);
    expect(result.topTraits.length).toBeLessThanOrEqual(3);
  });

  it('HOME 장소 6개 / 전체 10개면 homebody 활성화 (≥50%)', () => {
    const logs = [
      ...Array(6).fill(null).map(() => makeLog({ place: 'HOME' })),
      ...Array(4).fill(null).map(() => makeLog({ place: 'CAFE' })),
    ];
    const result = calcDnaTraits(logs);
    expect(result.traits['homebody']).toBeGreaterThan(0);
  });

  it('DONE 9개 / 전체 10개면 completionist 활성화 (≥80%)', () => {
    const logs = [
      ...Array(9).fill(null).map(() => makeLog({ status: 'DONE' })),
      makeLog({ status: 'WISHLIST' }),
    ];
    const result = calcDnaTraits(logs);
    expect(result.traits['completionist']).toBeGreaterThan(0);
  });

  it('deletedAt 있는 로그는 계산에서 제외', () => {
    const logs = [
      ...Array(5).fill(null).map(() => makeLog({ title: { id: 't', type: 'book', name: 'B' } })),
      ...Array(5).fill(null).map(() => makeLog({ deletedAt: '2026-01-02', title: { id: 't', type: 'movie', name: 'M' } })),
    ];
    const result = calcDnaTraits(logs);
    // 활성 로그 5개 중 book이 5개 = 100% → book_maniac 활성화
    expect(result.traits['book_maniac']).toBeGreaterThan(0);
  });
});

describe('calcAuraScore', () => {
  it('매칭 특질 없으면 score 0, matchedTrait null 반환', () => {
    const log = makeLog({ title: { id: 't', type: 'movie', name: 'M' } });
    const result = calcAuraScore(log, ['book_maniac', 'homebody', 'solo_viewer']);
    expect(result.score).toBe(0);
    expect(result.matchedTrait).toBeNull();
  });

  it('topTraits 1개 매칭이면 score ≈ 0.33, matchedTrait 반환', () => {
    const log = makeLog({ title: { id: 't', type: 'book', name: 'B' } });
    const result = calcAuraScore(log, ['book_maniac', 'homebody', 'solo_viewer']);
    expect(result.score).toBeCloseTo(1 / 3);
    expect(result.matchedTrait).toBe('book_maniac');
  });

  it('topTraits 3개 모두 매칭이면 score 1.0', () => {
    const log = makeLog({
      title: { id: 't', type: 'book', name: 'B' },
      place: 'HOME',
      occasion: 'ALONE',
    });
    const result = calcAuraScore(log, ['book_maniac', 'homebody', 'solo_viewer']);
    expect(result.score).toBe(1);
    expect(result.matchedTrait).toBe('book_maniac');
  });

  it('topTraits 빈 배열이면 score 0', () => {
    const log = makeLog();
    const result = calcAuraScore(log, []);
    expect(result.score).toBe(0);
    expect(result.matchedTrait).toBeNull();
  });
});
