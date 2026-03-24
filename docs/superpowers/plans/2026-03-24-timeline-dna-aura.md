# Timeline DNA Aura Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자의 시청 기록에서 26종 특질(DNA)을 추출하여, Journey 화면의 포스터 카드에 글로우 강도 + 색상으로 "나다움"을 시각화한다.

**Architecture:** `lib/types.ts`에 TraitKey/DnaTraitMap 타입 추가 → `lib/traits.ts`에 특질 메타데이터 집중 → `lib/gamification.ts`에 DNA 계산 함수 추가 → UI 컴포넌트(HeroBar, JourneyNode)에 props 연결 → `journey/index.tsx`에서 조합. `calcAuraScore`는 처음부터 `{ score, matchedTrait }` 형태로 설계해 mid-plan API 변경을 방지한다.

**Tech Stack:** React Native, Expo Router, TypeScript, react-native-reanimated, Jest (unit tests for pure functions)

---

## 파일 맵

| 파일 | 역할 |
|------|------|
| `apps/native/lib/types.ts` | TraitKey, DnaTraitMap 타입 추가 |
| `apps/native/lib/traits.ts` | 특질별 라벨/아이콘/색상/판정 메타 (신규) |
| `apps/native/lib/gamification.ts` | calcDnaTraits, calcAuraScore 함수 추가 |
| `apps/native/components/journey/HeroBar.tsx` | topTraits prop 추가, DNA 칩 UI |
| `apps/native/components/journey/JourneyNode.tsx` | auraScore, auraColor prop 추가, 글로우 적용 |
| `apps/native/app/(tabs)/journey/index.tsx` | DNA 계산 → 컴포넌트 연결 |
| `apps/native/__tests__/gamification.dna.test.ts` | calcDnaTraits, calcAuraScore 단위 테스트 (신규) |
| `apps/native/jest.config.js` | Jest 설정 (신규) |
| `apps/native/__mocks__/react-native.js` | RN mock (신규) |

---

## Task 1: 타입 정의 추가

**Files:**
- Modify: `apps/native/lib/types.ts`

- [ ] **Step 1: TraitKey, DnaTraitMap 타입을 파일 끝에 추가**

```typescript
// DNA 특질 타입
export type TraitKey =
  // 콘텐츠 타입
  | 'book_maniac' | 'movie_lover' | 'series_lover' | 'omnivore'
  // 장소
  | 'homebody' | 'theater_maniac' | 'cafe_type' | 'transit_type' | 'outdoor_type'
  // 상황
  | 'solo_viewer' | 'social_viewer'
  // 패턴
  | 'binge_watcher' | 'completionist' | 'collector' | 'note_taker'
  | 'generous_rater' | 'picky_rater'
  // 플랫폼
  | 'netflix_loyal' | 'tving_loyal' | 'wavve_loyal' | 'watcha_loyal'
  | 'disney_loyal' | 'appletv_loyal' | 'global_ott' | 'k_ott' | 'platform_explorer';

export interface DnaTraitMap {
  traits: Partial<Record<TraitKey, number>>; // 각 특질 점수 0~1
  topTraits: TraitKey[];                     // 점수 내림차순 상위 최대 3개
}

export interface AuraResult {
  score: number;             // 0~1
  matchedTrait: TraitKey | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/native/lib/types.ts
git commit -m "feat(native): DNA 특질 타입 추가 (TraitKey, DnaTraitMap, AuraResult)"
```

---

## Task 2: 특질 메타데이터 파일 생성

**Files:**
- Create: `apps/native/lib/traits.ts`

> 주의: `completionist`와 `theater_maniac`은 둘 다 골드 계열이지만 색조를 달리해 시각적으로 구분한다.
> `completionist` → `#ffd700` (순금), `theater_maniac` → `#e8b84b` (앤틱 골드)

- [ ] **Step 1: 특질별 메타(라벨, 아이콘, 글로우 색상)를 상수로 정의**

```typescript
import { TraitKey } from './types';

export interface TraitMeta {
  label: string;
  icon: string;
  color: string;
}

export const TRAIT_META: Record<TraitKey, TraitMeta> = {
  // 콘텐츠 타입
  book_maniac:       { label: '책 매니아',    icon: '📚', color: '#ffb781' },
  movie_lover:       { label: '영화광',        icon: '🎬', color: '#7bd0ff' },
  series_lover:      { label: '시리즈광',      icon: '📺', color: '#a78bfa' },
  omnivore:          { label: '잡식형',        icon: '🌈', color: '#dae2fd' },
  // 장소
  homebody:          { label: '집순이형',      icon: '🏠', color: '#fb923c' },
  theater_maniac:    { label: '극장 매니아',   icon: '🎭', color: '#e8b84b' }, // 앤틱 골드
  cafe_type:         { label: '카페형',        icon: '☕', color: '#d4a574' },
  transit_type:      { label: '이동형',        icon: '🚇', color: '#60a5fa' },
  outdoor_type:      { label: '야외형',        icon: '🌿', color: '#4ade80' },
  // 상황
  solo_viewer:       { label: '혼자형',        icon: '🎧', color: '#94a3b8' },
  social_viewer:     { label: '같이형',        icon: '👥', color: '#f472b6' },
  // 패턴
  binge_watcher:     { label: '몰아보기형',    icon: '🔁', color: '#c084fc' },
  completionist:     { label: '완주러',        icon: '🏆', color: '#ffd700' }, // 순금
  collector:         { label: '수집가형',      icon: '📋', color: '#818cf8' },
  note_taker:        { label: '기록 장인',     icon: '✍️', color: '#34d399' },
  generous_rater:    { label: '후한 편',       icon: '⭐', color: '#fbbf24' },
  picky_rater:       { label: '깐깐한 편',     icon: '🎯', color: '#f87171' },
  // 플랫폼
  netflix_loyal:     { label: '넷플릭스파',    icon: '🔴', color: '#E50914' },
  tving_loyal:       { label: '티빙파',        icon: '🟡', color: '#FF0558' },
  wavve_loyal:       { label: '웨이브파',      icon: '🔵', color: '#0090F5' },
  watcha_loyal:      { label: '왓챠파',        icon: '🟣', color: '#FF153C' },
  disney_loyal:      { label: '디즈니+파',     icon: '🏰', color: '#113CCF' },
  appletv_loyal:     { label: '애플TV파',      icon: '🍎', color: '#A2AAAD' },
  global_ott:        { label: '글로벌 OTT파',  icon: '🌍', color: '#7bd0ff' },
  k_ott:             { label: 'K-OTT파',       icon: '🇰🇷', color: '#f472b6' },
  platform_explorer: { label: '플랫폼 탐험가', icon: '🗺️', color: '#dae2fd' },
};

/** 특질 색상 반환. null이면 기본 dim 색상 */
export function getAuraColor(trait: TraitKey | null): string {
  if (!trait) return '#434750'; // Colors.outlineVariant
  return TRAIT_META[trait].color;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/native/lib/traits.ts
git commit -m "feat(native): 특질 메타데이터 상수 파일 추가 (TRAIT_META)"
```

---

## Task 3: Jest 설정 및 DNA 계산 함수 구현 (TDD)

**Files:**
- Create: `apps/native/jest.config.js`
- Create: `apps/native/__mocks__/react-native.js`
- Create: `apps/native/__tests__/gamification.dna.test.ts`
- Modify: `apps/native/lib/gamification.ts`
- Modify: `apps/native/package.json`

- [ ] **Step 1: Jest 최소 설정 추가**

`apps/native/package.json`의 `devDependencies`에 추가:
```json
"jest": "^29.7.0",
"@types/jest": "^29.5.12",
"ts-jest": "^29.1.4"
```

`apps/native/package.json`의 `scripts`에 추가:
```json
"test": "jest"
```

`apps/native/jest.config.js` 신규 생성:
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
  },
};
```

`apps/native/__mocks__/react-native.js` 신규 생성:
```js
module.exports = {};
```

- [ ] **Step 2: 의존성 설치 및 동작 확인**

```bash
cd apps/native && npm install
npx jest --version
```
Expected: Jest 버전 번호 출력 (예: `29.x.x`)

- [ ] **Step 3: 실패하는 테스트 작성**

> 주의: `calcAuraScore`는 처음부터 `AuraResult` (`{ score, matchedTrait }`)를 반환한다.
> `place`/`occasion`이 없는 로그도 안전하게 처리되도록 makeLog에 기본값을 지정한다.

`apps/native/__tests__/gamification.dna.test.ts`:
```typescript
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
    expect(result.matchedTrait).toBe('book_maniac'); // 첫 번째 매칭
  });

  it('topTraits 빈 배열이면 score 0', () => {
    const log = makeLog();
    const result = calcAuraScore(log, []);
    expect(result.score).toBe(0);
    expect(result.matchedTrait).toBeNull();
  });
});
```

- [ ] **Step 4: 테스트 실행 — 실패 확인**

```bash
cd apps/native && npm test
```
Expected: FAIL (함수가 아직 없으므로)

- [ ] **Step 5: calcDnaTraits, calcAuraScore 구현**

`apps/native/lib/gamification.ts` 파일 상단 import에 추가:
```typescript
import { DnaTraitMap, TraitKey, AuraResult } from './types';
```

파일 끝에 추가:
```typescript
// ─── 특질 판정 헬퍼 ───────────────────────────────────────────────

function ratio(logs: WatchLog[], predicate: (l: WatchLog) => boolean): number {
  if (logs.length === 0) return 0;
  return logs.filter(predicate).length / logs.length;
}

function avgRating(logs: WatchLog[]): number {
  const rated = logs.filter((l) => l.rating != null);
  if (rated.length === 0) return 0;
  return rated.reduce((s, l) => s + (l.rating ?? 0), 0) / rated.length;
}

// ─── 특질별 점수 계산 ─────────────────────────────────────────────

export function calcDnaTraits(logs: WatchLog[]): DnaTraitMap {
  const active = logs.filter((l) => !l.deletedAt);
  if (active.length === 0) return { traits: {}, topTraits: [] };

  const scores: Partial<Record<TraitKey, number>> = {};

  // 콘텐츠 타입
  const bookR   = ratio(active, (l) => l.title.type === 'book');
  const movieR  = ratio(active, (l) => l.title.type === 'movie');
  const seriesR = ratio(active, (l) => l.title.type === 'series');
  if (bookR >= 0.3)   scores['book_maniac']  = bookR;
  if (movieR >= 0.5)  scores['movie_lover']  = movieR;
  if (seriesR >= 0.5) scores['series_lover'] = seriesR;
  if (bookR >= 0.2 && movieR >= 0.2 && seriesR >= 0.2)
    scores['omnivore'] = Math.min(bookR, movieR, seriesR);

  // 장소
  const homeR    = ratio(active, (l) => l.place === 'HOME');
  const theaterR = ratio(active, (l) => l.place === 'THEATER');
  const cafeR    = ratio(active, (l) => l.place === 'CAFE');
  const transitR = ratio(active, (l) => l.place === 'TRANSIT');
  const outdoorR = ratio(active, (l) => l.place === 'PARK' || l.place === 'OUTDOOR');
  if (homeR >= 0.5)     scores['homebody']       = homeR;
  if (theaterR >= 0.2)  scores['theater_maniac'] = theaterR;
  if (cafeR >= 0.2)     scores['cafe_type']      = cafeR;
  if (transitR >= 0.2)  scores['transit_type']   = transitR;
  if (outdoorR >= 0.15) scores['outdoor_type']   = outdoorR;

  // 상황
  const aloneR  = ratio(active, (l) => l.occasion === 'ALONE');
  const socialR = ratio(active, (l) => ['DATE', 'FRIENDS', 'FAMILY'].includes(l.occasion ?? ''));
  if (aloneR >= 0.5)  scores['solo_viewer']   = aloneR;
  if (socialR >= 0.4) scores['social_viewer'] = socialR;

  // 패턴
  const bingeR      = ratio(active, (l) => l.title.type === 'series' && l.episodeNumber != null);
  const completionR = ratio(active, (l) => l.status === 'DONE');
  const collectorR  = ratio(active, (l) => l.status === 'WISHLIST');
  const noteTakerR  = ratio(active, (l) => !!l.note && l.note.trim().length > 0);
  const avg         = avgRating(active);
  if (bingeR >= 0.3)      scores['binge_watcher']  = bingeR;
  if (completionR >= 0.8) scores['completionist']  = completionR;
  if (collectorR >= 0.4)  scores['collector']      = collectorR;
  if (noteTakerR >= 0.5)  scores['note_taker']     = noteTakerR;
  if (avg >= 4.0)         scores['generous_rater'] = avg / 5;
  if (avg > 0 && avg <= 2.5) scores['picky_rater'] = 1 - avg / 5;

  // 플랫폼
  const nfR      = ratio(active, (l) => l.ott === 'Netflix');
  const tvingR   = ratio(active, (l) => l.ott === '티빙');
  const wavveR   = ratio(active, (l) => l.ott === '웨이브');
  const watchaR  = ratio(active, (l) => l.ott === '왓챠');
  const disneyR  = ratio(active, (l) => l.ott === '디즈니+');
  const appleR   = ratio(active, (l) => l.ott === 'Apple TV+' || l.ott === '애플 TV+');
  const globalR  = nfR + disneyR + appleR;
  const kOttR    = tvingR + wavveR + watchaR;

  if (nfR >= 0.5)     scores['netflix_loyal']     = nfR;
  if (tvingR >= 0.5)  scores['tving_loyal']        = tvingR;
  if (wavveR >= 0.5)  scores['wavve_loyal']         = wavveR;
  if (watchaR >= 0.5) scores['watcha_loyal']        = watchaR;
  if (disneyR >= 0.5) scores['disney_loyal']        = disneyR;
  if (appleR >= 0.5)  scores['appletv_loyal']       = appleR;
  if (globalR >= 0.5) scores['global_ott']          = globalR;
  if (kOttR >= 0.5)   scores['k_ott']               = kOttR;

  const platforms = [nfR, tvingR, wavveR, watchaR, disneyR, appleR];
  const diversePlatforms = platforms.filter((r) => r >= 0.15).length;
  if (diversePlatforms >= 3) scores['platform_explorer'] = diversePlatforms / platforms.length;

  // 상위 3개 추출
  const topTraits = (Object.entries(scores) as [TraitKey, number][])
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => k);

  return { traits: scores, topTraits };
}

// ─── 개별 로그 나다움 점수 ────────────────────────────────────────

/**
 * topTraits(최대 3개) 중 해당 로그와 매칭되는 수 ÷ 3 → score(0~1)
 * 첫 번째 매칭 특질을 matchedTrait으로 반환 (aura 색상 결정에 사용)
 */
export function calcAuraScore(log: WatchLog, topTraits: TraitKey[]): AuraResult {
  if (topTraits.length === 0) return { score: 0, matchedTrait: null };

  let matches = 0;
  let matchedTrait: TraitKey | null = null;
  for (const trait of topTraits) {
    if (logMatchesTrait(log, trait)) {
      matches++;
      if (!matchedTrait) matchedTrait = trait;
    }
  }
  return { score: matches / 3, matchedTrait };
}

function logMatchesTrait(log: WatchLog, trait: TraitKey): boolean {
  switch (trait) {
    case 'book_maniac':    return log.title.type === 'book';
    case 'movie_lover':    return log.title.type === 'movie';
    case 'series_lover':   return log.title.type === 'series';
    case 'omnivore':       return true;
    case 'homebody':       return log.place === 'HOME';
    case 'theater_maniac': return log.place === 'THEATER';
    case 'cafe_type':      return log.place === 'CAFE';
    case 'transit_type':   return log.place === 'TRANSIT';
    case 'outdoor_type':   return log.place === 'PARK' || log.place === 'OUTDOOR';
    case 'solo_viewer':    return log.occasion === 'ALONE';
    case 'social_viewer':  return ['DATE', 'FRIENDS', 'FAMILY'].includes(log.occasion ?? '');
    case 'binge_watcher':  return log.title.type === 'series' && log.episodeNumber != null;
    case 'completionist':  return log.status === 'DONE';
    case 'collector':      return log.status === 'WISHLIST';
    case 'note_taker':     return !!log.note && log.note.trim().length > 0;
    case 'generous_rater': return (log.rating ?? 0) >= 4;
    case 'picky_rater':    return (log.rating ?? 0) > 0 && (log.rating ?? 0) <= 2.5;
    case 'netflix_loyal':     return log.ott === 'Netflix';
    case 'tving_loyal':       return log.ott === '티빙';
    case 'wavve_loyal':       return log.ott === '웨이브';
    case 'watcha_loyal':      return log.ott === '왓챠';
    case 'disney_loyal':      return log.ott === '디즈니+';
    case 'appletv_loyal':     return log.ott === 'Apple TV+' || log.ott === '애플 TV+';
    case 'global_ott':        return ['Netflix', '디즈니+', 'Apple TV+', '애플 TV+'].includes(log.ott ?? '');
    case 'k_ott':             return ['티빙', '웨이브', '왓챠'].includes(log.ott ?? '');
    case 'platform_explorer': return !!log.ott;
    default: return false;
  }
}
```

- [ ] **Step 6: 테스트 실행 — 통과 확인**

```bash
cd apps/native && npm test
```
Expected: 모든 테스트 PASS (10개)

- [ ] **Step 7: Commit**

```bash
git add apps/native/lib/gamification.ts apps/native/__tests__/gamification.dna.test.ts \
        apps/native/jest.config.js apps/native/__mocks__/react-native.js \
        apps/native/package.json apps/native/package-lock.json
git commit -m "feat(native): DNA 특질 계산 함수 구현 및 단위 테스트 추가"
```

---

## Task 4: HeroBar에 DNA 칩 표시

**Files:**
- Modify: `apps/native/components/journey/HeroBar.tsx`

> 사전 확인: 파일에 `xpLabel` Text 스타일이 있고 `statsRow` View 위에 위치하는지 확인.
> 현재 구조: xpTrack → xpLabel → statsRow 순서.

- [ ] **Step 1: import 추가 및 topTraits prop 추가**

파일 상단 import 추가:
```typescript
import { TraitKey } from '../../lib/types';
import { TRAIT_META } from '../../lib/traits';
```

`HeroBarProps` 인터페이스에 추가:
```typescript
topTraits: TraitKey[];
```

`HeroBar` 함수 시그니처 수정:
```typescript
export function HeroBar({ level, streak, movieCount, seriesCount, bookCount, badgeCount, totalBadges, topTraits }: HeroBarProps) {
```

- [ ] **Step 2: XP 라벨 아래 DNA 칩 렌더링 추가**

`xpLabel` Text 바로 아래(`statsRow` View 위)에 삽입:
```tsx
{topTraits.length > 0 && (
  <View style={styles.dnaRow}>
    {topTraits.map((trait) => {
      const meta = TRAIT_META[trait];
      return (
        <View
          key={trait}
          style={[styles.dnaChip, { borderColor: `${meta.color}55` }]}
        >
          <Text style={styles.dnaChipIcon}>{meta.icon}</Text>
          <Text style={[styles.dnaChipLabel, { color: meta.color }]}>
            {meta.label}
          </Text>
        </View>
      );
    })}
  </View>
)}
```

- [ ] **Step 3: 스타일 추가**

`StyleSheet.create` 안에 추가:
```typescript
dnaRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 6,
  marginBottom: 10,
},
dnaChip: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 999,
  borderWidth: 1,
  backgroundColor: 'rgba(255,255,255,0.04)',
},
dnaChipIcon: {
  fontSize: 11,
},
dnaChipLabel: {
  fontSize: 11,
  fontWeight: '600',
  letterSpacing: 0.2,
},
```

- [ ] **Step 4: 타입 체크**

```bash
cd apps/native && npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add apps/native/components/journey/HeroBar.tsx
git commit -m "feat(native): HeroBar에 DNA 특질 칩 표시 추가"
```

---

## Task 5: JourneyNode에 Aura 글로우 적용

**Files:**
- Modify: `apps/native/components/journey/JourneyNode.tsx`

> 사전 확인: 현재 `JourneyNodeProps`는 `log`, `index`, `onPress` 3개.
> 카드는 `TouchableOpacity style={styles.card}`, 포스터는 `View style={styles.posterWrapper}` 구조.

- [ ] **Step 1: auraScore, auraColor prop 추가**

`JourneyNodeProps`에 추가:
```typescript
auraScore: number;   // 0~1
auraColor: string;   // hex color
```

- [ ] **Step 2: 카드 크기/그림자를 auraScore 기반 동적 계산**

`JourneyNode` 함수 안 `const isRight` 선언 아래에 추가:
```typescript
const cardWidth = auraScore >= 0.7 ? 230 : auraScore >= 0.3 ? 220 : 200;
const shadowRadius = auraScore >= 0.7 ? 32 : auraScore >= 0.3 ? 20 : 8;
const shadowOpacity = auraScore >= 0.7 ? 0.5 : auraScore >= 0.3 ? 0.25 : 0.08;
const cardOpacity = auraScore < 0.3 ? 0.72 : 1;
const borderAlpha = auraScore >= 0.7 ? 'cc' : auraScore >= 0.3 ? '66' : '22';
```

- [ ] **Step 3: TouchableOpacity style에 동적 값 적용**

기존:
```tsx
style={[styles.card, log.status === 'WISHLIST' && styles.cardWishlist]}
```
변경:
```tsx
style={[
  styles.card,
  log.status === 'WISHLIST' && styles.cardWishlist,
  {
    width: cardWidth,
    opacity: cardOpacity,
    shadowColor: auraColor,
    shadowRadius,
    shadowOpacity,
    borderColor: `${auraColor}${borderAlpha}`,
  },
]}
```

- [ ] **Step 4: 포스터 테두리에 auraColor 반영 (고점수만)**

기존 `posterWrapper` View:
```tsx
<View style={styles.posterWrapper}>
```
변경:
```tsx
<View style={[
  styles.posterWrapper,
  auraScore >= 0.7 && { borderWidth: 1.5, borderColor: `${auraColor}88` },
]}>
```

- [ ] **Step 5: 타입 체크**

```bash
cd apps/native && npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 6: Commit**

```bash
git add apps/native/components/journey/JourneyNode.tsx
git commit -m "feat(native): JourneyNode에 DNA Aura 글로우 강도/색상 적용"
```

---

## Task 6: Journey 화면 조합 (index.tsx 연결)

**Files:**
- Modify: `apps/native/app/(tabs)/journey/index.tsx`

- [ ] **Step 1: import 추가**

파일 상단에 추가:
```typescript
import { calcDnaTraits, calcAuraScore } from '../../../lib/gamification';
import { getAuraColor } from '../../../lib/traits';
```

- [ ] **Step 2: DNA 계산 추가**

`sorted` 선언 아래에 추가:
```typescript
const dnaResult = calcDnaTraits(logs);
const { topTraits } = dnaResult;
```

- [ ] **Step 3: HeroBar에 topTraits 전달**

기존:
```tsx
<HeroBar
  level={gami.level}
  streak={gami.streak}
  movieCount={movieCount}
  seriesCount={seriesCount}
  bookCount={bookCount}
  badgeCount={unlockedBadges}
  totalBadges={gami.badges.length}
/>
```
변경:
```tsx
<HeroBar
  level={gami.level}
  streak={gami.streak}
  movieCount={movieCount}
  seriesCount={seriesCount}
  bookCount={bookCount}
  badgeCount={unlockedBadges}
  totalBadges={gami.badges.length}
  topTraits={topTraits}
/>
```

- [ ] **Step 4: JourneyNode 호출 부분에 aura 연결**

기존:
```tsx
return (
  <JourneyNode
    key={item.log.id}
    log={item.log}
    index={item.globalIdx}
    onPress={() => router.push(`/log/${item.log.id}` as any)}
  />
);
```
변경:
```tsx
const { score: auraScore, matchedTrait } = calcAuraScore(item.log, topTraits);
const auraColor = getAuraColor(matchedTrait);
return (
  <JourneyNode
    key={item.log.id}
    log={item.log}
    index={item.globalIdx}
    onPress={() => router.push(`/log/${item.log.id}` as any)}
    auraScore={auraScore}
    auraColor={auraColor}
  />
);
```

- [ ] **Step 5: 타입 체크 및 테스트**

```bash
cd apps/native && npx tsc --noEmit && npm test
```
Expected: 타입 에러 없음, 테스트 모두 PASS

- [ ] **Step 6: Commit**

```bash
git add apps/native/app/(tabs)/journey/index.tsx
git commit -m "feat(native): Journey 화면에 DNA Aura 전체 연결 완료"
```

---

## 최종 검증

- [ ] `cd apps/native && npm test` — 전체 통과
- [ ] `cd apps/native && npx tsc --noEmit` — 타입 에러 없음
- [ ] Expo 앱 실행 후 Journey 화면에서:
  - HeroBar 하단에 DNA 특질 칩 1~3개 표시 확인
  - 고점수(≥0.7) 카드: width 230, 글로우 강함 / 저점수(<0.3) 카드: width 200, dim
  - 로그 없을 때(empty state) 빈 화면 정상 동작 확인
  - QuickLog 기록 후 DNA 특질이 즉시 반영되는지 확인
