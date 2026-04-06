# Native 앱 (React Native + Expo)

> React Native + Expo Router 기반 네이티브 모바일 앱 — `apps/native/`

## 관련 페이지
- [[twa]]
- [[kmp]]
- [[dna-aura]]

---

## 현황

`feat/native-mobile-app` 브랜치에서 개발 중 (2026-03-25 기준). main에 미머지.

## 기술 스택

| 항목 | 선택 |
|---|---|
| 프레임워크 | React Native + Expo SDK |
| 라우팅 | expo-router (파일 기반) |
| 상태 관리 | Zustand (`store/authStore.ts`) |
| 서버 상태 | TanStack React Query |
| 로컬 저장소 | expo-sqlite, expo-secure-store |
| 스타일 | StyleSheet (react-native), Pretendard 폰트 |
| 테스트 | Jest |

## 앱 구조

```
apps/native/
  app/
    _layout.tsx              # 루트 레이아웃, 인증 분기
    onboarding/index.tsx     # 온보딩 화면
    (tabs)/
      _layout.tsx            # 탭 네비게이터
      journey/index.tsx      # Journey 화면 (DNA Aura 연결)
      log/index.tsx          # 기록 화면
      profile/index.tsx      # 프로필 화면
  components/
    journey/HeroBar.tsx      # DNA 특질 칩 3개 표시
    journey/JourneyNode.tsx  # Aura 글로우 강도 적용 카드
    log/QuickLogModal.tsx    # 빠른 기록 모달
  lib/
    api.ts                   # syncPull() — API 연동
    gamification.ts          # calcDnaTraits(), calcAuraScore()
    traits.ts                # TRAIT_META, getAuraColor()
    types.ts                 # TraitKey, DnaTraitMap, AuraResult, WatchLog
    secureStore.ts           # expo-secure-store 웹 폴백 (localStorage)
  store/authStore.ts         # Zustand 인증 상태
  constants/
    colors.ts
    typography.ts
```

## 실행 방법

```bash
cd apps/native
npm install

# 웹 (가장 빠름)
NODE_PATH="$(pwd)/node_modules" npx expo start --web
# → http://localhost:8081

# Android 에뮬레이터
NODE_PATH="$(pwd)/node_modules" npx expo start --android

# 실기기 (Expo Go QR 스캔)
NODE_PATH="$(pwd)/node_modules" npx expo start
```

> 모노레포 구조상 `NODE_PATH` 설정 필수 — 없으면 expo-router를 찾지 못함

## 테스트

```bash
cd apps/native
npx jest
```

`__tests__/gamification.dna.test.ts` — DNA 특질 계산 단위 테스트 11개

## 구현 완료 기능

- Journey 화면: 시청 기록을 시간순으로 구불구불한 SVG 경로 위에 노드로 배치
- DNA Aura: 26종 특질 추출 → HeroBar 칩 + JourneyNode 글로우 시각화 (→ [[dna-aura]])
- 기록 화면: QuickLogModal 기반 시청 기록 추가
- 온보딩 화면
- Zustand 기반 인증 상태 관리
