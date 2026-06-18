import { seasonEpisodeLabel, statusLabel, typeLabel } from '../lib/format';

describe('format helpers', () => {
  it('formats season and episode labels', () => {
    expect(seasonEpisodeLabel(2, 3)).toBe('S2 · E3');
    expect(seasonEpisodeLabel(2, null)).toBe('S2');
    expect(seasonEpisodeLabel(null, 3)).toBe('E3');
    expect(seasonEpisodeLabel(null, null)).toBeNull();
  });

  it('formats status and type labels by locale', () => {
    expect(typeLabel('book')).toBe('책');
    expect(typeLabel('book', 'en')).toBe('Book');
    expect(statusLabel('DONE', 'book')).toBe('읽었어요');
    expect(statusLabel('DONE', 'book', 'en')).toBe('Read');
  });
});
