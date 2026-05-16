# Native 앱 (React Native + Expo)

> React Native + Expo Router 기반 iOS 네이티브 TestFlight 후보 — `apps/native/`

## 관련 페이지
- [[twa]]
- [[kmp]]
- [[dna-aura]]

---

## 현황

`feature/ios-native-testflight` 브랜치에서 iOS TestFlight 준비 작업을 진행 중이다. App Store 실제 제출은 Apple Developer Program과 App Store Connect 상태 확인 후 별도 진행한다.

- v1 범위: 기록 핵심
- 화면: 기록, 타임라인, 계정, 문의함
- iOS Bundle Identifier: `app.ottline`
- Android native package: `app.ottline.mobile`
- Android 공식 배포 경로는 계속 `apps/twa` 기반 Bubblewrap TWA다.
- DNA Aura/Journey 실험 화면은 v1에서 제외하고 후속 실험으로 둔다.

## 기술 스택

| 항목 | 선택 |
|---|---|
| 프레임워크 | React Native + Expo SDK |
| 라우팅 | expo-router (파일 기반) |
| 상태 관리 | Zustand (`store/authStore.ts`) |
| 로컬 저장소 | expo-sqlite, expo-secure-store |
| 스타일 | StyleSheet (react-native), Pretendard 폰트 |
| 테스트 | Jest |

## 앱 구조

```
apps/native/
  app/
    _layout.tsx              # 루트 레이아웃, DB/인증 초기화
    (tabs)/
      _layout.tsx            # 탭 네비게이터
      log/index.tsx          # 검색 + QuickLog 저장
      timeline/index.tsx     # local-first 타임라인
      account/index.tsx      # 페어링/초기화/계정 삭제
    feedback/index.tsx       # 문의함
  lib/
    api.ts                   # API 연동
    localDb.ts               # expo-sqlite local-first 저장소
    sync.ts                  # outbox push/pull
    syncPayload.ts           # /api/sync/push payload 생성
    types.ts                 # API/로컬 타입
    secureStore.ts           # expo-secure-store 웹 폴백 (localStorage)
  store/authStore.ts         # Zustand 인증 상태
  constants/
    colors.ts
    typography.ts
```

## 실행 방법

```bash
npm install
npm run start --workspace native
npm run ios --workspace native
```

TestFlight 빌드는 Apple 계정/서명 준비 후 `apps/native/eas.json`의 `testflight` 프로필로 실행한다.

## 테스트

```bash
npm run typecheck --workspace native
npm run test --workspace native -- --runInBand
```

`__tests__/syncPayload.test.ts` — `/api/sync/push` payload 생성 단위 테스트

## 구현 완료 기능

- 제목 검색 후 로컬 QuickLog 저장
- `expo-sqlite` 기반 titles/logs/outbox/settings 저장
- outbox 기반 `/api/sync/push` 및 `/api/sync/pull`
- 페어링 코드 발급/기기 연결
- 로컬 초기화와 서버 데이터 전체 삭제 진입
- 문의 등록과 내 문의 목록 표시
