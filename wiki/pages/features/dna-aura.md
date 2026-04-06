# DNA Aura

> 시청 기록 메타데이터에서 26종 특질을 추출해 Journey 화면에 시각화하는 게임화 시스템

## 관련 페이지
- [[native]]
- [[analytics]]

---

## 개요

사용자의 시청 패턴을 분석해 **DNA 특질(TraitKey)** 을 계산하고, Journey 화면에서 노드 글로우와 HeroBar 칩으로 시각적으로 표현한다. `feat/native-mobile-app` 브랜치에서 구현 (2026-03-25).

## 26종 특질 목록

| 카테고리 | 특질 |
|---|---|
| 콘텐츠 타입 | `book_maniac`, `movie_lover`, `series_lover`, `omnivore` |
| 장소 | `homebody`, `theater_maniac`, `cafe_type`, `transit_type`, `outdoor_type` |
| 상황 | `solo_viewer`, `social_viewer` |
| 패턴 | `binge_watcher`, `completionist`, `collector`, `note_taker`, `generous_rater`, `picky_rater` |
| 플랫폼 충성도 | `netflix_loyal`, `tving_loyal`, `wavve_loyal`, `watcha_loyal`, `disney_loyal`, `appletv_loyal`, `global_ott`, `k_ott`, `platform_explorer` |

## 데이터 흐름

```
WatchLog[] (API)
  → calcDnaTraits()       # 로그 집계 → DnaTraitMap (특질별 점수)
  → calcAuraScore()       # 상위 특질 점수 → 0~1 auraScore
  → getAuraColor()        # auraScore → 색상 hex
  → HeroBar               # 상위 3 특질 칩 렌더링
  → JourneyNode           # auraScore에 따라 글로우 강도 차등 적용
```

## Aura 글로우 강도 기준

| auraScore | 카드 너비 | shadowRadius | 강도 |
|---|---|---|---|
| ≥ 0.7 | 230px | 32 | 강함 |
| ≥ 0.3 | 220px | 20 | 중간 |
| < 0.3 | 200px | 8 | 약함 |

## 관련 파일 (`apps/native/`)

| 파일 | 역할 |
|---|---|
| `lib/types.ts` | TraitKey, DnaTraitMap, AuraResult 타입 정의 |
| `lib/traits.ts` | TRAIT_META (라벨/아이콘/색상), getAuraColor() |
| `lib/gamification.ts` | calcDnaTraits(), calcAuraScore() |
| `components/journey/HeroBar.tsx` | 상위 3 특질 칩 UI |
| `components/journey/JourneyNode.tsx` | Aura 글로우 적용 카드 |
| `app/(tabs)/journey/index.tsx` | 전체 조합 및 데이터 흐름 |
| `__tests__/gamification.dna.test.ts` | 단위 테스트 11개 |
