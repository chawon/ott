# Timeline DNA Aura 디자인 스펙

**작성일:** 2026-03-24
**브랜치:** feat/native-mobile-app
**대상:** `apps/native` — Journey(타임라인) 화면

---

## 1. 배경 및 목적

현재 Journey 화면은 구불구불한 SVG 경로 위에 포스터 카드를 좌/우 교차 배치하는 여정 맵 형태다.
개선 목표는 두 가지다:

1. **정보 밀도** — 카드가 담고 있는 메타 정보(TPO, 플랫폼, 타입, 상황)를 더 의미 있게 전달
2. **시각적 완성도** — 다크 네온 팔레트를 활용해 앱다운 완성도 달성

핵심 아이디어: 사용자의 기록 데이터에서 **시청 특질(DNA)** 을 추출하고, 각 포스터 카드가 그 특질과 얼마나 일치하는지를 **글로우 강도 + 테두리 색상**으로 시각화한다.

---

## 2. 설계 방향 — DNA Aura + Frame Type 혼합

### 2-1. DNA Aura (글로우 강도)
- 나다움 점수(0~1)에 따라 포스터 카드의 **그림자 반경과 불투명도**가 달라짐
- 점수 높음(≥ 0.7): 포스터 카드 크기 소폭 확대 + 테두리 글로우 강함
- 점수 중간(0.3~0.7): 기본 크기 + 테두리 글로우 보통
- 점수 낮음(< 0.3): 카드 살짝 dim + 테두리 약함

### 2-2. Frame Type (테두리 색상)
특질 유형에 따라 글로우 색상을 다르게 적용한다.

| 특질 | 판단 기준 | 글로우 색상 |
|------|----------|------------|
| 📚 책 매니아 | type=book 비율 ≥ 30% | `#ffb781` (tertiary/앰버) |
| 📺 OTT 매니아 | ott 필드 있는 비율 ≥ 50% | `#7bd0ff` (secondary/시안) |
| 🎭 극장 매니아 | place=THEATER 비율 ≥ 20% | `#ffd700` (골드) |
| 🔁 몰아보기형 | series+episodeNumber 비율 ≥ 30% | `#a78bfa` (퍼플) |
| 🎧 혼자형 | occasion=ALONE 비율 ≥ 50% | `#94a3b8` (슬레이트) |
| 👥 같이형 | occasion=DATE/FRIENDS/FAMILY 비율 ≥ 40% | `#f472b6` (핑크) |
| 🏠 집순이형 | place=HOME 비율 ≥ 50% | `#fb923c` (오렌지) |

---

## 3. 컴포넌트별 변경 범위

### 3-1. `lib/gamification.ts` — DNA 계산 확장
- `calcDnaTraits(logs: WatchLog[]): DnaTraitMap` 함수 추가
  - 반환: 특질별 점수 맵 `{ traitKey: score }` (0~1)
  - 상위 3개 특질 추출 (`topTraits: TraitKey[]`)
- `calcAuraScore(log: WatchLog, topTraits: TraitKey[]): number` 함수 추가
  - 개별 로그가 상위 3개 특질과 몇 개 일치하는지 → 0~1 점수 반환

### 3-2. `lib/types.ts` — 타입 추가
```ts
export type TraitKey =
  | 'book_maniac'
  | 'ott_maniac'
  | 'theater_maniac'
  | 'binge_watcher'
  | 'solo_viewer'
  | 'social_viewer'
  | 'homebody';

export interface DnaTraitMap {
  traits: Record<TraitKey, number>;   // 각 특질 점수 0~1
  topTraits: TraitKey[];              // 상위 최대 3개
}
```

### 3-3. `components/journey/HeroBar.tsx` — DNA 태그 추가
- props에 `topTraits: TraitKey[]` 추가
- XP 바 아래에 상위 특질 태그 칩 1~3개 표시
- 예: `[🎭 극장파] [🎧 혼자봄] [🔁 몰아보기]`

### 3-4. `components/journey/JourneyNode.tsx` — Aura 적용
- props에 `auraScore: number`, `auraColor: string` 추가
- 카드 `shadowColor`, `shadowRadius`, `shadowOpacity`를 auraScore 기반으로 동적 계산
- 카드 `borderColor`를 auraColor로 교체
- auraScore에 따라 카드 width 소폭 조정 (고점수: 230, 중간: 220, 저점수: 200)
- 포스터 테두리에 auraColor 반영

### 3-5. `app/(tabs)/journey/index.tsx` — 조합 및 전달
- `calcDnaTraits` 호출 → `dnaTraits` 산출
- 각 log에 `calcAuraScore` 적용 → auraScore
- auraScore + topTraits → auraColor 결정 로직
- `HeroBar`에 `topTraits` 전달
- `JourneyNode`에 `auraScore`, `auraColor` 전달

---

## 4. Aura 색상 결정 로직

```
개별 로그의 가장 일치하는 특질 → 해당 특질 색상을 auraColor로 사용
일치 특질 없음 → Colors.outlineVariant (기본, dim)
```

우선순위: 사용자 topTraits 중 해당 로그와 매칭되는 첫 번째 특질의 색상 사용

---

## 5. 검증 시나리오

1. **특질 추출**: 책 로그 10개 중 4개면 책 매니아 특질이 활성화되는지
2. **Aura 강약**: 동일 화면에서 고점수 카드와 저점수 카드의 글로우 차이가 육안으로 구분되는지
3. **HeroBar DNA 태그**: topTraits 0개 / 1개 / 3개 각 경우에 레이아웃이 깨지지 않는지
4. **빈 로그 상태**: 로그가 없을 때 DNA 계산이 빈 값으로 안전하게 처리되는지
5. **기존 기능 회귀**: QuickLog, Sync, 기존 JourneyNode 탭 동작 정상 여부

---

## 6. 범위 외 (이번 사이클 제외)

- 장르 기반 특질 (TMDB 장르 데이터 연동 필요 — 별도 사이클)
- 특질 상세 화면 / 배지 연동
- 서버 사이드 DNA 분석

---

## 7. Definition of Done

- [ ] `calcDnaTraits`, `calcAuraScore` 함수 구현 및 단위 검증
- [ ] HeroBar에 DNA 태그 칩 표시
- [ ] JourneyNode에 auraScore/auraColor 기반 글로우 적용
- [ ] 고/중/저 auraScore 카드 크기 차이 적용
- [ ] `npm run lint` 통과
- [ ] 모바일 레이아웃 확인 (iOS/Android)
