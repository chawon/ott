// Fictional titles and synthetic records. No production account or viewing data.
const text = (ko, en) => ({ ko, en });
const item = (id, type, ko, en, creatorKo, creatorEn, year, kdc) => ({
  id, type, title: text(ko, en), creator: text(creatorKo, creatorEn), year,
  cover: `./assets/${id}.jpg`, kdc,
});
export const catalog = [
  item('quiet-days', 'movie', '우리의 조용한 날들', 'Our Quiet Days', '이서윤 감독', 'A film by Seoyun Lee', 2026),
  item('blue-hour', 'series', '블루 아워', 'Blue Hour', '8부작 · 드라마', '8 episodes · Drama', 2026),
  item('sea-notes', 'book', '바다가 남긴 문장', 'Notes from the Sea', '정해원', 'Haewon Jung', 2025, 8),
  item('night-train', 'movie', '밤의 열차', 'The Night Train', '김도현 감독', 'A film by Dohyun Kim', 2024),
  item('small-forest', 'movie', '작은 숲의 계절', 'A Season in the Woods', '박수진 감독', 'A film by Sujin Park', 2025),
  item('orbit', 'series', '궤도 밖에서', 'Beyond the Orbit', '6부작 · SF', '6 episodes · Science fiction', 2026),
  item('winter-library', 'book', '겨울 도서관', 'The Winter Library', '서윤서', 'Yunseo Seo', 2026, 8),
  item('slow-light', 'book', '느린 빛의 관찰', 'Watching the Slow Light', '한지우', 'Jiwoo Han', 2024, 4),
];
const entry = (id, titleId, status, day, ko, en, rating = null) => ({
  id, titleId, status, watchedAt: `${day}T12:00:00Z`, updatedAt: `${day}T12:00:00Z`,
  note: text(ko, en), rating, syncStatus: 'synced',
});
export const initialRecords = [
  entry('record-quiet', 'quiet-days', 'DONE', '2026-11-01', '별일 없는 하루도, 누군가에겐 오래 남을 이야기.', 'An ordinary day can still be a story worth keeping.', 5),
  entry('record-blue', 'blue-hour', 'IN_PROGRESS', '2026-10-30', '밤이 시작되기 전, 그 짧고 푸른 시간.', 'That brief blue moment before the night begins.', 4),
  entry('record-sea', 'sea-notes', 'IN_PROGRESS', '2026-10-28', '책장을 넘길 때마다 조금씩 느려지는 마음.', 'A little slower, a little quieter, with every page.', null),
  entry('record-train', 'night-train', 'DONE', '2026-10-24', '도착보다 함께 가는 시간이 좋았다.', 'It was the time together, more than the destination.', 4),
  entry('record-forest', 'small-forest', 'DONE', '2026-10-20', '초록색 장면들이 오래 생각날 것 같다.', 'I think those green scenes will stay with me.', 5),
  entry('record-library', 'winter-library', 'WISHLIST', '2026-10-16', '첫눈이 오면 읽어보고 싶은 책.', 'A book to open with the first snow.', null),
];
export const remoteRecords = [
  entry('remote-quiet', 'quiet-days', 'DONE', '2026-11-02', '다시 보니 처음엔 놓쳤던 표정이 보였다.', 'Watching again, I noticed an expression I missed.', 5),
  entry('remote-orbit', 'orbit', 'IN_PROGRESS', '2026-10-19', '먼 곳의 이야기인데, 이상하게 가까이 느껴진다.', 'A story so far away, yet somehow close to home.', 4),
  entry('remote-light', 'slow-light', 'DONE', '2026-09-14', '산책하며 지나쳤던 것들을 다시 바라보게 된다.', 'It made me notice the little things on my walks.', 4),
];
export const posts = [
  {id:'post-quiet',titleId:'quiet-days',date:'2026-11-01',likes:8,note:text('평범한 날에도 이야기는 있었구나. 마지막 장면이 참 좋았어요.','There was a story in that ordinary day. I loved the final scene.')},
  {id:'post-sea',titleId:'sea-notes',date:'2026-10-31',likes:5,note:text('하루에 한 장씩 읽고 있어요. 서두르지 않아도 좋은 책.','One page a day. A book that lets you take your time.')},
  {id:'post-forest',titleId:'small-forest',date:'2026-10-30',likes:12,note:text('주말 오후에 다시 꺼내 보고 싶은 영화가 하나 더 생겼어요.','One more film to revisit on a quiet weekend afternoon.')},
];
export const sampleCode = 'M7K2P9WX';
