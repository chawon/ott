// Adapt the development API without filling missing fields with sample data.
const text = value => typeof value === 'string' ? value : '';
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
const secureImageHosts = new Set(['image.tmdb.org', 'books.google.com', 'books.google.co.kr', 't1.daumcdn.net', 'search1.kakaocdn.net', 'shopping-phinf.pstatic.net', 'image.yes24.com']);

export function coverURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' && secureImageHosts.has(url.hostname)) url.protocol = 'https:';
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local') || !/[a-z]/i.test(url.hostname) || url.hostname.startsWith('[')) return '';
    return url.href;
  } catch { return ''; }
}

export function adaptRecords(items) {
  const records = [], catalog = [], seen = new Set();
  for (const raw of items) {
    if (!raw || typeof raw.id !== 'string' || !raw.id || seen.has(raw.id)) continue;
    seen.add(raw.id);
    const source = raw.title || {};
    // A title may have several season/episode records with distinct artwork.
    const titleId = `api:${raw.id}`;
    const type = ['movie', 'series', 'book'].includes(source.type) ? source.type : 'unknown';
    catalog.push({
      id: titleId, sourceId: text(source.id), type,
      title: text(source.name) || {ko:'제목이 없는 작품', en:'Untitled'},
      creator: text(type === 'book' ? source.author : Array.isArray(source.directors) ? source.directors.join(', ') : ''),
      year: Number.isInteger(raw.seasonYear) ? raw.seasonYear : Number.isInteger(source.year) ? source.year : '',
      cover: coverURL(raw.seasonPosterUrl) || coverURL(source.posterUrl),
      isbn: text(source.isbn13) || text(source.isbn10),
    });
    records.push({
      id: raw.id, titleId, sourceTitleId: text(source.id),
      status: ['DONE', 'IN_PROGRESS', 'WISHLIST'].includes(raw.status) ? raw.status : 'UNKNOWN',
      watchedAt: date(raw.watchedAt), createdAt: date(raw.createdAt), updatedAt: date(raw.updatedAt),
      place: text(raw.place) || null, occasion: text(raw.occasion) || null,
      note: text(raw.note), rating: typeof raw.rating === 'number' && raw.rating >= 0 && raw.rating <= 5 ? raw.rating : null,
      seasonNumber: Number.isInteger(raw.seasonNumber) ? raw.seasonNumber : null,
      episodeNumber: Number.isInteger(raw.episodeNumber) ? raw.episodeNumber : null,
      ott: text(raw.ott), syncStatus:'synced',
    });
  }
  return {records, catalog};
}

export async function fetchAllRecords(request, onProgress = () => {}) {
  const items = [], cursors = new Set();
  let cursor = null;
  do {
    const query = new URLSearchParams({limit:'50'});
    if (cursor) query.set('cursor', cursor);
    const page = await request(`/logs/page?${query}`);
    if (!page || !Array.isArray(page.items) || (page.nextCursor != null && typeof page.nextCursor !== 'string')) throw Object.assign(new Error('Invalid page'), {code:'INVALID_RESPONSE'});
    items.push(...page.items);
    onProgress(items.length);
    cursor = page.nextCursor || null;
    if (cursor && cursors.has(cursor)) throw Object.assign(new Error('Repeated cursor'), {code:'INVALID_RESPONSE'});
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return adaptRecords(items);
}
