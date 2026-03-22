# ottline 네이티브 모바일 앱 — "발자취 여정" UI/UX 계획

> 작성일: 2026-03-22
> 참조 샘플: `stitch_my_list_profile/` (DESIGN.md, code.html, screen.png)

## 개요

현재 ottline은 Next.js 웹 + TWA(Android 래퍼) 방식으로 모바일을 지원한다.
목표: **타임라인 중심, 나의 발자취를 보여주는 게임형 네이티브 앱**.

샘플 디자인의 색상 시스템이 기존 ottline 브랜드(`#1e4d8c`)와 완벽하게 일치하여 디자인 연속성을 자연스럽게 확보할 수 있다.

**핵심 결정**: React Native + Expo로 `apps/native/` 추가. 기존 백엔드 API 그대로 재활용, 서버 변경 없음.

---

## 디자인 시스템: "The Luminescent Layer"

샘플 DESIGN.md 기반 — "Neon Stratosphere" 철학.

> 철학: 극한의 배경 블러, 중첩 글래스 레이어, 의도적 "빛 누수"로 2D 화면을 다층 환경으로 변환.

### 색상 토큰
```
background:                 #0b1326  (deep navy)
surface-container-low:      #131b2e
surface-container-highest:  #2d3449
primary (glow text):        #a9c7ff
primary-container:          #1e4d8c  ← ottline 기존 색상
secondary (cyan glow):      #7bd0ff
tertiary (rare reward):     #ffb781  (배지 전용)
on-background:              #dae2fd
outline-variant:            #434750
```

### 핵심 디자인 규칙
- **No-Line Rule**: 1px 실선 구분자 금지. 배경색 변화 또는 16px 여백으로 대체
- **Glass & Gradient**: `rgba(45,52,73,0.4)` + `backdrop-filter: blur(20px)` — 모든 카드
- **Ambient Glow**: `box-shadow: 0 20px 40px -10px rgba(56,189,248,0.15)` — 그림자 대체
- **Ghost Border**: 1.5px, `outline-variant` 20% opacity, radius `xl` (1.5rem)
- **No Pure Black, No Sharp Corners**: radius 최소 `0.75rem`

### 타이포그래피
- 폰트: **Plus Jakarta Sans** (단일 패밀리)
- Display: ExtraBold, letter-spacing -2% (레벨업 숫자)
- Headline: text-shadow `secondary` 10% opacity (소프트 글로우)
- Label: 대문자, letter-spacing +5% (날짜, 타입 태그 — 시계 텔레메트리 느낌)

---

## 앱 구조

### 기술 스택
| 라이브러리 | 용도 |
|-----------|------|
| `expo-router` v4 | 파일시스템 라우팅 + 딥링크 |
| `expo-sqlite` + `drizzle-orm` | 로컬 DB (웹 Dexie 대체) |
| `expo-secure-store` | userId/deviceId 저장 |
| `react-native-reanimated` v3 | XPBar, GlowDot 애니메이션 |
| `react-native-svg` | 구불구불 경로(SVG Path) |
| `@tanstack/react-query` | 서버 상태 + 오프라인 캐시 |
| `zustand` | 인증·게임화 클라이언트 상태 |
| `expo-notifications` | 스트릭 리마인더 |

### 디렉토리 구조
```
apps/native/                    ← 신규 (Expo SDK 52+)
  app/
    _layout.tsx                 ← 인증 게이트 (SecureStore)
    onboarding/
      index.tsx                 ← 신규 등록 or 페어링 코드 입력
    (tabs)/
      _layout.tsx               ← Bottom Tab (투명 유리 플로팅)
      journey/index.tsx         ← 메인: 발자취 타임라인
      log/index.tsx             ← Quick Log (모달 시트)
      profile/index.tsx         ← 스탯 + 배지
  components/
    journey/
      JourneyPath.tsx           ← SVG 구불구불 경로 오버레이
      JourneyNode.tsx           ← 개별 기록 카드 (글래스모피즘)
      HeroBar.tsx               ← 레벨 + 스트릭 상단 바
      MonthDivider.tsx          ← 연월 구분자
    log/
      QuickLogForm.tsx
      TitleSearchBox.tsx
    profile/
      BadgeGrid.tsx
      StatsGrid.tsx
    ui/
      GlassCard.tsx             ← 글래스카드 베이스
      XPBar.tsx                 ← 애니메이션 진행바
      GlowDot.tsx               ← 경로 노드 (맥박 애니메이션)
  lib/
    api.ts                      ← fetch wrapper (X-User-Id/X-Device-Id 헤더)
    db.ts                       ← expo-sqlite + drizzle 스키마
    outbox.ts                   ← 오프라인 큐 (웹 sync.ts 이식)

shared/
  types/index.ts                ← 기존 apps/web/lib/types.ts 이동
  utils/gamification.ts        ← 웹·앱 공유 게임화 계산 로직
```

---

## Journey Screen (메인 화면)

샘플 `code.html`의 레이아웃을 React Native로 직역.

### 레이아웃 구조
```
<SafeAreaView bg=#0b1326>
  ← 배경 대기 글로우 (fixed, 3개 blur 원)
  ← HeroBar (sticky)
  <ScrollView>
    ← SVG JourneyPath (absolute overlay, 구불구불 경로)
    [월 구분자]
    [JourneyNode 우측 오프셋]   ← 홀수
    [JourneyNode 좌측 오프셋]   ← 짝수 (교번)
    ...
    [MilestoneLocked]           ← "NEXT MILESTONE LOCKED"
  </ScrollView>
  ← FloatingBottomNav
</SafeAreaView>
```

### HeroBar
```
┌─────────────────────────────────────────┐  glass-card
│  Lv.6 "시네마 탐험가"        🔥 5일 연속  │
│  ████████████████░░░  680/1000 XP       │  ← XPBar (animated)
│  🎬 32편   📺 18편   📚 12권  배지 8/15  │
└─────────────────────────────────────────┘
```

### JourneyNode 스펙
- 크기: 224dp, 좌우 교번 `translateX(±32)`
- glass-card: `rgba(45,52,73,0.4)` + blur(20px) + ghost border
- 포스터: 전체 너비, 비율 유지, rounded-xl
- 타입 뱃지: MOVIE (secondary #7bd0ff), BOOK (tertiary #ffb781), SERIES (secondary)
- 노드 원: 32dp, secondary 색, glow shadow
  - DONE: 체크 아이콘
  - IN_PROGRESS: 맥박 애니메이션 (pulse)
  - WISHLIST: 점선 원, 회색

### SVG 경로
```jsx
// react-native-svg
<Svg style={StyleSheet.absoluteFillObject} opacity={0.3}>
  <Defs>
    <LinearGradient id="pathGrad" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#7BD0FF" />
      <Stop offset="0.5" stopColor="#1E4D8C" />
      <Stop offset="1" stopColor="#7BD0FF" />
    </LinearGradient>
  </Defs>
  <Path
    d="M200 0 C200 80 350 120 350 200 C350 280 50 320 50 400..."
    stroke="url(#pathGrad)"
    strokeWidth={6}
    strokeLinecap="round"
    fill="none"
  />
</Svg>
```

### FloatingBottomNav
```
[glass 둥근 알약 컨테이너, bottom-6]
  [Timeline 아이콘 · active = sky glow]
  [중앙 FAB: gradient, -top-6 돌출, + 아이콘]
  [Profile 아이콘]
```

---

## 게임화 시스템

### 레벨 (클라이언트 계산 — 서버 변경 없음)
```typescript
// shared/utils/gamification.ts
// XP: DONE=10, IN_PROGRESS=3, WISHLIST=1

const LEVELS = [
  { level: 1,  title: '새내기 탐험가',  minXP: 0    },
  { level: 2,  title: '호기심 관람객',  minXP: 50   },
  { level: 3,  title: '콘텐츠 수집가',  minXP: 120  },
  { level: 4,  title: '스크린 헌터',    minXP: 250  },
  { level: 5,  title: '장르 개척자',    minXP: 450  },
  { level: 6,  title: '시네마 탐험가',  minXP: 700  },
  { level: 7,  title: '비평가 지망생',  minXP: 1000 },
  { level: 8,  title: '마스터 뷰어',    minXP: 1400 },
  { level: 9,  title: '오타쿠 레전드',  minXP: 1900 },
  { level: 10, title: '콘텐츠 전설',    minXP: 2500 },
];
```

### 배지 (tertiary #ffb781 — "rare" 연출)
| slug | 조건 |
|------|------|
| `first_step` | 첫 DONE |
| `week_warrior` | 7일 연속 스트릭 |
| `cinema_10` | 영화 10편 DONE |
| `bookworm` | 책 5권 DONE |
| `binge_series` | 시리즈 5편 DONE |
| `night_owl` | 자정~4시 로그 3회 |
| `omnivore` | 영화+드라마+책 모두 DONE |
| `level_5` | 레벨 5 달성 |

배지 획득 시 `BadgeUnlockModal` — reanimated 줌인 + glow 팝업.

### 스트릭
- 기존 `apps/web/lib/report.ts`의 `calcStreak()` 이식
- HeroBar: 1~6일 🔥, 7~29일 🔥🔥, 30일+ 🔥🔥🔥
- `expo-notifications`: 매일 오후 9시 리마인더

---

## 백엔드 재활용 (API 변경 없음)

```
인증:    POST /api/auth/register → {userId, deviceId} → expo-secure-store
페어링:  POST /api/auth/pair
데이터:  GET  /api/sync/pull?since={lastSyncAt} → expo-sqlite upsert
기록:    expo-sqlite 즉시 저장 → outbox → POST /api/sync/push
검색:    GET  /api/titles/search?q=...
```

모든 요청: `X-User-Id`, `X-Device-Id` 헤더 (웹과 동일).

---

## 구현 단계

| Phase | 내용 | 기간 |
|-------|------|------|
| 1. 뼈대 | Expo 초기화, 모노레포 편입, 인증, DB 스키마, 탭 구조 | 1주 |
| 2. Journey | sync pull 연동, JourneyNode, SVG Path, HeroBar, BottomNav | 2주 |
| 3. Quick Log | TitleSearchBox, QuickLogForm, Outbox 오프라인 | 1주 |
| 4. 게임화 | gamification.ts, BadgeUnlockModal, Profile, 스트릭 알림 | 1주 |
| 5. 배포 | EAS Build, iOS/Android 스토어 제출 | 0.5주 |

---

## 참조 파일

| 목적 | 파일 |
|------|------|
| 타입 공유 원본 | `apps/web/lib/types.ts` → `shared/types/index.ts` |
| 스트릭 계산 원본 | `apps/web/lib/report.ts` → `shared/utils/gamification.ts` |
| Outbox 패턴 참조 | `apps/web/lib/sync.ts` → `apps/native/lib/outbox.ts` |
| 브랜드/패키지ID | `apps/twa/twa-manifest.json` |
| 인증 흐름 참조 | `apps/web/lib/api.ts` |
| 샘플 디자인 | `stitch_my_list_profile/` (DESIGN.md, code.html, screen.png) |

---

## 검증 시나리오

1. **Journey 동기화**: 웹에서 로그한 기록이 앱 타임라인에 발자취로 표시
2. **오프라인 Quick Log**: 비행기 모드 기록 → 복구 시 자동 sync
3. **레벨업 연출**: XP 임계치 초과 시 애니메이션
4. **배지 획득**: 조건 달성 시 BadgeUnlockModal 팝업
5. **스트릭**: 연속 기록 증가 → 끊기면 리셋 + 알림
6. **페어링**: 기존 웹 계정 코드 입력 → 동일 데이터 sync
