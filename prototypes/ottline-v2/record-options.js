// Recording presets mirror QuickLogCard and shared/bookPlatforms.ts.
// Labels are also the stored values; preserve existing/custom values as entered.
const videoGroups = {
  ko: [
    {label: 'OTT', options: ['넷플릭스', '디즈니플러스', '티빙', '웨이브', '쿠팡플레이', '애플티비', '프라임비디오', '왓챠']},
    {label: '유료 방송', options: ['채널', 'VOD']},
    {label: '물리 매체', options: ['DVD', '블루레이']},
    {label: '극장', options: ['CGV', '롯데시네마', '메가박스', '씨네Q']},
  ],
  en: [
    {label: 'OTT', options: ['Netflix', 'Disney+', 'TVING', 'Wavve', 'Coupang Play', 'Apple TV', 'Prime Video', 'Watcha']},
    {label: 'Paid TV', options: ['TV Channel', 'VOD']},
    {label: 'Physical Media', options: ['DVD', 'Blu-ray']},
    {label: 'Theater', options: ['CGV', 'Lotte Cinema', 'Megabox', 'CineQ']},
  ],
};

const bookGroups = {
  ko: [
    {label: '서점', options: ['교보문고', '영풍문고', '예스24', '알라딘']},
    {label: '전자책', options: ['리디', '밀리의서재', '윌라', '플레이북']},
    {label: '도서관', options: ['공공도서관', '대학도서관', '학교도서관']},
  ],
  en: [
    {label: 'Bookstore', options: ['Amazon', 'Bookshop.org', 'Local bookstore']},
    {label: 'E-book', options: ['Kindle', 'Apple Books', 'Google Play Books', 'Kobo']},
    {label: 'Audiobook', options: ['Audible']},
    {label: 'Library', options: ['Libby', 'Public Library', 'University Library', 'School Library']},
  ],
};

export function platformGroups(type, lang) {
  const groups = (type === 'book' ? bookGroups : videoGroups)[lang === 'en' ? 'en' : 'ko'];
  return groups.map(({label, options}) => ({label, options: [...options]}));
}
