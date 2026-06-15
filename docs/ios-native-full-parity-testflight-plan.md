# iOS 네이티브 앱 전체동등 TestFlight 계획

기준일: 2026-06-13

## 1. 목표

ottline iOS 앱을 PWA, TWA, WebView 래퍼가 아닌 Expo React Native 기반 네이티브 앱으로 구현한다.

이번 계획의 완료 기준은 App Store 정식 출시가 아니라, 현재 `main` 기준 코드에 네이티브 iOS 앱을 안전하게 편입하고 GitHub Actions에서 iOS 빌드와 TestFlight 제출을 재현 가능하게 만드는 것이다. 로컬 개발 환경은 WSL on ARM Linux이므로 iOS 빌드 성공은 로컬 검증 기준에서 제외하고, GitHub Actions와 EAS Build/Submit을 source of truth로 둔다.

## 2. 현재 사실

- `main`에는 추적되는 `apps/native` 소스가 없다.
- 로컬 작업트리의 `apps/native`는 현재 기준 소스가 아니라 ignored `node_modules` 잔여물이다.
- `feature/ios-native-testflight`에는 Expo Router 기반 `apps/native` 후보 구현이 있다.
- `feature/ios-native-testflight`는 오래된 web/api/deploy/docs 변경과 대량 lockfile 변경이 섞여 있으므로 브랜치 전체 merge 금지다.
- `feature/ios-native-testflight`에서 선별 이식할 수 있는 항목은 `apps/native`, root workspace/package-lock 변경 중 네이티브 앱에 필요한 부분, 그리고 필요한 Expo/EAS 설정뿐이다.
- `feat/native-mobile-app`는 별도 React Native/Expo 후보지만 gamification/onboarding 중심 프로토타입이므로 이번 full parity/TestFlight 계획의 기준 구현으로 삼지 않는다.
- Android production 경로는 계속 `apps/twa`이며, iOS 네이티브 작업 중 `apps/twa` 배포/패키지 계약을 변경하지 않는다.
- `app.ottline`은 Android production 패키지명으로 이미 사용 중이지만, iOS bundle identifier는 별도 플랫폼 네임스페이스라 같은 값 사용이 가능하다. App Store Connect 등록 가능 여부는 Apple Developer 계정에서 실제 확인해야 한다.

### 진행 업데이트: 2026-06-13

- `feature/ios-native-full-parity` 브랜치에서 `feature/ios-native-testflight`의 `apps/native` seed를 선별 이식했다.
- root workspace를 `apps/*`로 넓히고 native 검증 script를 추가했다.
- native iOS CI workflow와 수동 TestFlight workflow 초안을 추가했다. TestFlight workflow는 EAS가 `apps/native/app.json`에 `expo.extra.eas.projectId`를 기록하고 `apps/native/eas.json`의 `submit.testflight.ios.ascAppId`가 채워지기 전에는 명확한 메시지로 중단한다.
- `apps/native/app.json`에서 Android native package 설정을 제거해 Android production 경로(`apps/twa`)와 혼동하지 않게 했다.
- `expo-localization`을 추가하고 native API 계층에서 `Accept-Language`, `X-Client-Id`, `platform=ios_native` analytics 기반을 추가했다.
- native analytics 공통 payload에 `platform=ios_native`, `deviceType=mobile`, `osFamily=iOS`, `installState=app_store_testflight`, `appVersion`, `buildNumber`, `sessionId`, `installId`, `locale`, `theme`, `route`를 포함하도록 정리했다. 앱 부팅 시 `app_open`을 전송하고 route 변경은 이후 이벤트 공통 context에 반영한다.
- 백엔드 analytics validation과 DB check constraint를 `ios_native`까지 허용하도록 확장했고, admin analytics overview에 iOS 앱 버전/build number 세그먼트를 추가했다.
- QuickLog 빈 검색 인기 작품 보충, `title_search`/`title_select`/`log_create`/`first_log_create` native analytics, 제목 상세 route, 제목별 로컬 기록 목록, 상태 수정 local-first outbox를 추가했다.
- QuickLog 시리즈 선택 시 `/api/tmdb/tv/{providerId}/seasons`와 `/api/tmdb/tv/{providerId}/seasons/{seasonNumber}`로 시즌/에피소드를 불러오고, `seasonNumber`/`episodeNumber`/`seasonPosterUrl`/`seasonYear`를 로컬 기록과 sync outbox payload에 포함한다. 타임라인, 제목 상세, 기록 공유 카드에서도 시즌/에피소드 라벨을 표시한다.
- 제목 상세에서 상태, 별점, 날짜, OTT/플랫폼, 장소, 상황, 메모, 시즌/에피소드를 local-first로 수정하고 update outbox에 적재한다. 수정 시 native SQLite history를 쌓고, 히스토리 패널은 로컬 history를 우선 표시한 뒤 `/api/logs/{id}/history?limit=50` 서버 history로 보강한다.
- 타임라인의 검색/status/type/origin/OTT/place/occasion/titleId 필터와 history/watchedAt 정렬을 네이티브 로컬 로그 기준으로 추가했다. 현재 필터 결과는 웹 CSV 컬럼 순서로 변환해 `CSV 공유` 액션에서 `ottline-timeline-*.csv` 파일로 저장/첨부 공유되도록 구현했다.
- `NativePreferencesProvider`를 추가해 기기 locale 기반 `ko`/`en` 판별과 시스템 light/dark theme 팔레트를 앱 shell에 공급한다. 탭 제목, 안내 화면(`about`, `faq`, `privacy`, `offline`), 기록하기, 타임라인, 제목 상세, 함께 목록, 공개 상세, 계정 화면, 복구 카드, 문의함 목록/상세, 내 리포트, 리포트 공유 카드, status/type/date 포맷 helper는 locale-aware 구조로 전환했고, 안내 화면, 기록하기, 타임라인, 제목 상세, 함께 목록, 공개 상세, 계정, 문의함, 내 리포트, app shell은 dark theme 색상을 사용한다. 계정 화면에는 앱 전용 `system`/`light`/`dark` 수동 theme 설정을 추가했고, 선택값은 SecureStore에 저장되어 analytics theme context에도 반영된다.
- `함께` 탭을 추가해 `/api/discussions/latest`, `/api/discussions/all`, `/api/discussions/{id}`, 댓글 목록/작성, 리액션 조회/토글을 네이티브 화면에 연결했다. 리액션 선택 시 웹과 동일하게 필요한 로컬 기록을 생성해 outbox sync 경로로 보낸다.
- 댓글 작성 후 서버에서 생성/갱신될 수 있는 기록 side-effect를 반영하기 위해 즉시 `syncNow`를 호출한다. 댓글 멘션 검색/선택 UI를 추가했으며, 현재 서버 멘션 생성 경로에 맞춰 TMDB 영화/시리즈 결과를 우선 지원한다.
- 문의함 상세 route를 추가해 `GET /api/feedback/threads/{id}` 기반 메시지 타임라인과 관리자 답변 확인을 지원한다. 문의 생성 후 상세로 이동하고 `feedback_create` analytics를 전송한다.
- 공개 글/댓글 UGC 신고 진입점을 추가했다. 공개 상세에서 `공개 글 신고`와 `댓글 신고`를 누르면 기존 문의함 작성 화면으로 이동하며 신고 대상, 작품명, 공개 글/댓글 ID가 본문에 미리 채워진다. 신고 접수는 기존 `POST /api/feedback/threads` 운영 흐름을 재사용한다.
- 설정/계정 화면에 `GET/PATCH /api/auth/profile` 기반 닉네임·성향 프로필 저장과 `GET/DELETE /api/auth/devices`, `DELETE /api/auth/devices/all` 기반 연결 기기 목록/해제 흐름을 추가했다. 페어링 코드 복구 카드는 네이티브 카드 preview를 `react-native-view-shot`으로 PNG 캡처하고 `expo-sharing` share sheet로 저장/공유할 수 있게 했다.
- `내 리포트` route를 추가해 `GET /api/nalytic/me/report` 기반 개인 리포트, profile 기반 제목 개인화, 타임라인/계정 진입점을 구현했다. 서버 리포트 fetch 실패 시 native 로컬 로그에서 웹과 같은 계산식으로 fallback 리포트를 만든다. 주간/월간 리포트 공유 카드는 native 카드 view를 `react-native-view-shot`으로 story PNG 캡처하고 `expo-sharing` share sheet로 저장/공유하며 `report_share_card_create` analytics를 전송한다.
- 제목 상세의 개별 기록에 `공유 카드` 액션을 추가했다. native 카드 view를 `react-native-view-shot`으로 story PNG 캡처하고 `expo-sharing` share sheet로 저장/공유하며 `share_card_create` analytics를 전송한다.
- `about`, `faq`, `privacy`, `offline` 네이티브 안내 화면과 계정 화면 진입점을 추가했다. App Store review/support에 필요한 서비스 설명, FAQ, 데이터 정책, 오프라인 동작 설명을 앱 내부에서 확인할 수 있다.
- `expo-notifications`를 추가하고 계정 화면에 명시적 opt-in 기반 `회고 알림` 설정을 추가했다. 허용 시 locale-aware 주간/월간 로컬 알림을 예약하고, 알림 탭은 `/me/report`로 이동하며 `notification_permission`/`notification_open` analytics를 전송한다. 실제 iPhone/TestFlight 수신과 tap route 검증은 남은 확인 항목이다.
- 확인 완료: `npm ci`, `npm run native:typecheck`, `npm run native:test`, `apps/native`의 `npx expo-doctor`, `apps/api`의 `./gradlew compileJava`, 수정한 admin analytics 파일의 `npx biome check`. 시즌/에피소드, native analytics context, 제목 상세 수정/history 반영 후 `npm run native:typecheck`, `npm run native:test`, `apps/native`의 `npx expo-doctor`, `apps/api`의 `./gradlew compileJava`, admin analytics Biome check, `git diff --check`, 신규 파일 whitespace scan을 재확인했다.
- 전체 web lint는 기존 FAQ/layout/privacy/share-resolve/offline 파일의 unrelated Biome 이슈로 실패하므로 이번 변경 검증에는 포함하지 않았다.

### 진행 업데이트: 2026-06-14

- `apps/native/eas.json`의 `build.testflight.autoIncrement`와 `build.production.autoIncrement`를 현재 EAS CLI 스키마에 맞게 boolean `true`로 정리했다.
- `build:configure` 전에는 `apps/native/app.json`에 `extra.eas.projectId` placeholder를 넣지 않도록 정리했고, EAS가 생성한 실제 project id `efe8f7e5-75d8-45a9-9a4e-88bfeba07b98`가 반영됐다.
- 남은 외부 blocker는 Apple Developer Program 활성화, App Store Connect 앱 생성, `ascAppId` 확보, iOS signing credentials/App Store Connect API key 구성이다.
- `npm run native:testflight:check:structure`와 `git diff --check`로 현재 구조를 확인했다.

### 진행 업데이트: 2026-06-15

- Apple Developer Program 승인은 완료됐다.
- 상시 staging 종료와 OCI 축소 대응 문서가 반영된 최신 `main`을 `feature/ios-native-full-parity`에 병합했다.
- 이제 TestFlight 제출 전 남은 외부 blocker는 App Store Connect 앱 생성, `ascAppId` 확보, iOS signing credentials 구성, EAS Submit용 App Store Connect API key 구성이다.
- `apps/native/eas.json`의 `submit.testflight.ios.ascAppId`는 아직 `TODO_ASC_APP_ID`이며, App Store Connect 앱 생성 후 numeric Apple ID로 교체해야 한다.
- `ascAppId`를 채우기 전에는 `npm run native:testflight:check`가 실패하는 것이 정상이고, 구조 확인은 `npm run native:testflight:check:structure`로 수행한다.

## 3. 범위

### 포함

사용자 앱 기준 웹 전체동등을 목표로 한다.

- 기록하기
- 타임라인
- 제목 상세와 기록 수정
- 함께
- 설정
- 내 리포트
- 공유 카드
- 문의함
- about, faq, privacy, offline 성격의 안내 화면
- 페어링 코드 기반 계정 연결
- 로컬 우선 저장소와 outbox sync
- 서버 데이터 전체 삭제
- iOS 회고 리마인드 알림
- iOS analytics 세그먼트
- ko/en 다국어와 light/dark mode

### 제외

- 관리자 화면
- ChatGPT connector
- Android 전용 시청 감지
- Android Usage Access 설정
- Android 네이티브 패키지 전환
- WebView 기반 화면 재사용
- App Store 정식 심사 제출과 출시

## 4. 고정 기술 결정

- Framework: Expo + React Native
- Router: Expo Router
- Bundle ID: `app.ottline`
- API base: `https://ottline.app`
- Local DB: `expo-sqlite`
- Secure credentials: `expo-secure-store`
- Notifications: `expo-notifications`
- Localization: `expo-localization` + 네이티브 메시지 레이어
- Build: EAS Build
- Submit: EAS Submit
- WebView: 사용하지 않음

## 5. 브랜치 전략

1. `main`에서 `feature/ios-native-full-parity`를 새로 만든다.
2. `feature/ios-native-testflight`는 전체 merge하지 않는다.
3. 다음 경로만 선별 이식한다.
   - `apps/native/.gitignore`
   - `apps/native/app.json`
   - `apps/native/eas.json`
   - `apps/native/package.json`
   - `apps/native/tsconfig.json`
   - `apps/native/babel.config.js`
   - `apps/native/metro.config.js`
   - `apps/native/jest.config.js`
   - `apps/native/__mocks__/`
   - `apps/native/__tests__/`
   - `apps/native/assets/`
   - `apps/native/constants/`
   - `apps/native/lib/`
   - `apps/native/store/`
   - `apps/native/app/`
4. root `package.json`는 workspace를 `apps/*`로 넓히되, 현재 `main`의 scripts와 기존 `apps/web` 동작을 유지한다.
5. root `package-lock.json`는 `npm install --package-lock-only` 또는 실제 `npm install` 결과로 재생성하되, web/api/deploy 변경과 섞지 않는다.
6. `apps/native/node_modules`는 커밋하지 않는다.
7. 구현 중 web/api 계약이 필요하면 같은 PR에서 최소 변경으로 추가하고 문서도 갱신한다.

## 6. 선별 이식 후 정리 결과

`feature/ios-native-testflight` 후보 구현은 full parity가 아니므로 아래 항목을 현재 브랜치에서 정리했다.

- `apps/native/app.json`
  - `ios.bundleIdentifier`는 `app.ottline` 유지
  - Android production 경로와 혼동하지 않도록 `android.package`는 제거했다.
  - `build:configure` 실행 전에는 `extra.eas.projectId` placeholder를 넣지 않는다. EAS가 생성/연결 후 실제 UUID를 `app.json`에 기록한다.
- `apps/native/eas.json`
  - `testflight`/`production` build profile에 `distribution: "store"`와 `autoIncrement: true` 유지
  - `submit.testflight.ios.ascAppId` placeholder를 외부 준비 후 실제 App Store Connect Apple ID로 교체
  - GitHub Actions용 non-interactive 실행에 필요한 profile 이름을 `testflight`로 고정
- `apps/native/lib/api.ts`
  - `Accept-Language`는 기기 locale 기반 `ko`/`en` 값으로 전송한다.
  - analytics `X-Client-Id` 저장/전송과 iOS native 공통 context를 추가했다.
  - API error 응답은 사용자 메시지로 변환한다.
- `apps/native/lib/localDb.ts`
  - `settings`, `schema_meta`, `titles`, `logs`, `outbox`, `history` 테이블을 사용한다.
  - 알림 enabled state와 sync checkpoint는 settings에 저장한다.
  - report/discussion은 서버 fetch와 로컬 로그 기반 fallback을 우선하며 별도 cache table은 추가하지 않았다.
- `apps/native/store/authStore.ts`
  - SecureStore key namespace를 `ottline.native.*`로 정리했고 기존 seed key fallback을 유지한다.
  - register/pair 후 현재 credential을 store에 반영하고 sync 경로에서 device/user header를 사용한다.
- UI
  - 기록, 타임라인, 제목 상세, 함께, 공개 상세, 계정, 문의함 목록/상세, 내 리포트, 안내 화면 route를 full parity 기준으로 구성했다.

## 7. 네이티브 화면 구조

권장 route 구조:

```text
apps/native/app/
  _layout.tsx
  index.tsx
  (tabs)/
    log/index.tsx
    timeline/index.tsx
    together/index.tsx
    account/index.tsx
  title/[id].tsx
  public/index.tsx
  public/[id].tsx
  feedback/index.tsx
  feedback/[id].tsx
  me/report.tsx
  settings/profile.tsx
  settings/devices.tsx
  settings/data.tsx
  about.tsx
  faq.tsx
  privacy.tsx
  offline.tsx
```

하단 탭은 `기록`, `타임라인`, `함께`, `설정` 4개를 기본으로 한다. 내 리포트와 문의함은 타임라인/설정에서 진입한다.

## 8. 웹 전체동등 패리티 매트릭스

| 영역 | 웹 기준 | seed 상태 | 네이티브 완료 조건 |
|---|---|---:|---|
| 기록하기 | 제목 검색, 인기/최근 추천, 영화/시리즈/책, 상태/별점/메모/OTT/장소/상황, 시즌/에피소드, local-first create/update | 완료 | 빈 검색 추천, `/api/titles/popular`, `/api/tmdb/tv/*/seasons`, 시즌/에피소드 선택, create/update outbox까지 구현 |
| 타임라인 | 목록, 검색, status/type/origin/OTT/place/occasion/titleId 필터, history 정렬, CSV export/share, 리포트 CTA | 완료 | 서버 pull과 로컬 필터 동등, export/share sheet 구현 |
| 제목 상세 | 제목별 기록, 히스토리, 기록 수정, 시즌/에피소드 보강 | 완료 | `GET /api/titles/{id}`, local/server history, status/rating/date/OTT/place/occasion/note/season/episode local-first update sync 구현 |
| 함께 | 최신/전체 공개 글, 상세, 댓글, 멘션, 리액션, 나도 봤어요/읽었어요 기록 생성 | 완료 | discussions/comments/reactions API 전체 구현 및 UGC 대응 UX 포함 |
| 설정 | 페어링, 프로필, 연결 기기, unlink, 복구 카드, 로컬 초기화, 서버 데이터 전체 삭제 | 완료 | profile/devices/recovery card/account deletion 완성 |
| 내 리포트 | `/api/nalytic/me/report` 기반 개인 리포트 | 완료 | report fetch/cache, empty/error/loading, share 진입 구현 |
| 공유 카드 | OG 서버 렌더, PNG 저장/공유 | 완료 | 네이티브 카드 렌더링 또는 서버 이미지 활용 중 하나를 결정하고 iOS share/save 구현 |
| 문의함 | 목록, 작성, 상세, 관리자 답변 확인 | 완료 | thread detail과 답변 확인, preset source, empty/error 상태 구현 |
| 안내 화면 | about, faq, privacy, offline | 완료 | App Store review와 사용자 지원에 필요한 네이티브 안내 화면 구현 |
| i18n/theme | ko/en, light/dark | 완료 | 기기 locale 기반 ko/en provider, 탭/안내 화면/기록하기/타임라인/제목 상세/함께 목록/공개 상세/계정/복구 카드/문의함/내 리포트/리포트 공유 카드/format helper 전환, 시스템 light/dark shell 및 주요 사용자 화면 dark theme 적용, 앱 전용 `system`/`light`/`dark` 수동 theme 설정 구현. 실제 iPhone 조합 확인은 Phase 3 완료 증거에서 진행 |
| 알림 | Android 회고 리마인드와 별개로 회고 알림 성격 | 완료 | 명시적 opt-in 후 locale-aware local notification 예약, 탭 시 앱 route 이동 구현. 실제 iPhone/TestFlight 수신 확인은 실기기 확인표에서 진행 |
| analytics | `/api/nalytic/events`, platform/device/os/install/version 세그먼트 | 완료 | `platform=ios_native`, appVersion/buildNumber/installId/sessionId/route/theme 전송 및 admin iOS 버전/build 세그먼트 구현 |

## 9. API 계약

네이티브 앱은 기존 web/api 계약을 우선 재사용한다. 새 API를 추가하기 전 아래 호출부를 먼저 구현한다.

### Auth/Profile/Devices

- `POST /api/auth/register`
- `POST /api/auth/pair`
- `GET /api/auth/devices`
- `DELETE /api/auth/devices/{id}`
- `DELETE /api/auth/devices/all`
- `DELETE /api/auth/account`
- `GET /api/auth/profile`
- `PATCH /api/auth/profile`

### Titles/Logs/Sync

- `GET /api/titles/search?q=...&type=...`
- `GET /api/titles/popular?limit=...`
- `GET /api/titles/{id}`
- `GET /api/tmdb/tv/{providerId}/seasons`
- `GET /api/tmdb/tv/{providerId}/seasons/{seasonNumber}`
- `GET /api/logs?...`는 서버 truth 확인용으로만 사용하고, 기본 쓰기 흐름은 sync 계약을 따른다.
- `GET /api/logs/{id}/history?limit=...`
- `GET /api/sync/pull?since=...`
- `POST /api/sync/push`

### Discussions/Comments/Reactions

- `GET /api/discussions/latest?limit=&minComments=&days=`
- `GET /api/discussions/all?limit=`
- `GET /api/discussions/{id}`
- `GET /api/discussions/{id}/comments?limit=`
- `POST /api/discussions/{id}/comments`
- `GET /api/discussions/{id}/reactions/me`
- `PUT /api/discussions/{id}/reactions`

### Feedback/Analytics

- `GET /api/feedback/threads`
- `POST /api/feedback/threads`
- `GET /api/feedback/threads/{id}`
- `POST /api/nalytic/events`
- `GET /api/nalytic/me/report`

공통 헤더:

- `Accept-Language`: 기기 locale에서 `ko` 또는 `en` 결정
- `X-User-Id`: SecureStore의 현재 user id
- `X-Device-Id`: SecureStore의 현재 device id
- `X-Client-Id`: 네이티브 analytics client id

## 10. Local-first / Sync 설계

쓰기 흐름은 웹과 동일하게 유지한다.

1. 로컬 SQLite에 즉시 반영
2. outbox에 변경 payload 저장
3. `POST /api/sync/push`
4. 성공 시 outbox 제거와 sync status 갱신
5. 실패 시 attempts/lastError 기록 후 다음 foreground/수동 sync에서 재시도
6. `GET /api/sync/pull?since=lastSyncAt`로 서버 변경 반영

필수 구현:

- schema version table
- title/log upsert
- log update outbox
- pull tombstone 처리
- stale reject 발생 시 pull 후 서버 값 기준으로 재적용할 UX
- network offline 감지와 수동 sync
- 앱 foreground 진입 시 sync
- 첫 기록 저장 시 미등록 상태면 register 후 push
- pair 성공 시 기존 로컬 outbox 처리 정책

pair 성공 시 정책:

- 기존 로컬 outbox가 비어 있으면 server pull 후 교체
- 기존 로컬 outbox가 있으면 사용자에게 `이 기기의 미동기화 기록을 먼저 올린 뒤 연결` 또는 `이 기기 기록을 버리고 연결` 선택지를 제공
- 무응답 자동 병합은 금지

## 11. iOS 알림

Android Usage Access 기반 OTT 앱 사용 감지는 iOS에서 제외한다.

iOS v1은 회고 리마인드 성격의 알림만 제공한다.

- 주간 회고
- 월간 장르 회고
- 7일 기록 공백
- 시리즈 이어보기

구현 원칙:

- 알림 권한 요청은 설정의 명시적 사용자 액션 뒤에만 수행한다.
- `expo-notifications`로 local notification을 예약한다.
- 알림 tap은 기록하기, 타임라인, 리포트 등 의도된 route로 이동해야 한다.
- 서버 기반 추천/개인화가 필요한 알림은 v1에서 제외하거나 `/api/nalytic/me/report`와 로컬 로그만 사용한다.
- 알림 설정 상태는 SQLite와 iOS permission state를 함께 표시한다.

## 12. Analytics 세그먼트

기존 수집 경로 `/api/nalytic/events`를 유지한다. 이 경로명은 anti-blocking 목적이 있으므로 `/api/analytics/*`로 바꾸지 않는다.

공통 properties:

- `platform`: `ios_native`
- `deviceType`: `mobile`
- `osFamily`: `iOS`
- `installState`: `app_store_testflight`
- `appVersion`: Expo `version`
- `buildNumber`: iOS build number
- `sessionId`
- `installId`
- `locale`
- `theme`
- `route`

필수 이벤트:

- `app_open`
- `title_search`
- `title_select`
- `login_success`
- `first_log_create`
- `log_create`
- `log_update`
- `sync_push`
- `sync_pull`
- `feedback_create`
- `discussion_open`
- `comment_create`
- `reaction_set`
- `share_card_create`
- `notification_permission`
- `notification_open`

관리자 analytics는 기존 세그먼트에 iOS를 optional로 추가한다. Android/TWA 분류 로직과 섞지 않는다.

## 13. App Review / TestFlight 리스크

Apple 공식 문서 기준으로 다음을 계획에 반영한다.

- TestFlight는 App Store Connect 앱의 TestFlight 탭에서 beta 정보, feedback email, beta review 정보를 요구한다. 외부 테스터 공유에는 beta app review 정보가 필요하다. 출처: https://developer.apple.com/testflight/
- TestFlight 외부 테스터는 첫 build가 TestFlight App Review 승인을 받은 뒤 초대할 수 있다. 출처: https://developer.apple.com/testflight/
- TestFlight build는 App Review Guidelines를 따라야 한다. 출처: https://developer.apple.com/app-store/review/guidelines/
- App Review Guideline 4.2는 단순 repackaged website를 거부 위험으로 본다. 따라서 WebView 기반 재사용은 제외하고 네이티브 화면으로 구현한다. 출처: https://developer.apple.com/app-store/review/guidelines/
- 공개 글/댓글/멘션은 UGC이므로 신고/필터링/차단/운영 연락 수단이 필요하다. 네이티브 앱은 공개 글/댓글에서 기존 문의함으로 신고 내용을 prefill해 운영자가 확인하는 흐름을 제공한다. 외부 테스터 확대 전에는 App Store Connect beta review 정보에 이 운영 연락/처리 흐름을 명시한다. 출처: https://developer.apple.com/app-store/review/guidelines/
- 계정 기반 기능은 리뷰어가 접근 가능해야 한다. 네이티브 앱은 이메일/비밀번호 없이 첫 실행 후 익명 pairing-code 계정을 만들 수 있으므로 기본 리뷰 접근에는 별도 로그인 정보가 필요 없다. 사전 데이터가 필요하면 제출 직전 review pairing code를 생성해 App Store Connect review notes에 넣는다.
- privacy nutrition label, support URL, marketing URL, privacy URL, screenshots는 App Store 정식 제출 전 필수다. TestFlight/App Review 입력 초안은 `docs/ios-testflight-review-notes.md`에 둔다.

## 14. EAS / GitHub Actions

Expo 공식 문서 기준 EAS Submit에는 Apple Developer 계정, iOS bundle identifier, App Store Connect API key, `ascAppId`, store distribution build가 필요하다. 출처: https://docs.expo.dev/submit/ios/

### 필요한 GitHub Secrets

필수:

- `EXPO_TOKEN`

선택:

EAS credentials에 App Store Connect API key와 signing credentials를 원격 저장하는 방식을 기본값으로 둔다. GitHub Actions에서 `.p8` 파일을 직접 복원해 EAS Submit에 넘기는 방식을 선택할 때만 아래 secret을 추가한다.

- `EXPO_ASC_API_KEY_BASE64`
- `EXPO_ASC_KEY_ID`
- `EXPO_ASC_ISSUER_ID`
- `EXPO_APPLE_TEAM_ID`
- `EXPO_APPLE_TEAM_TYPE`

`ascAppId`는 secret이 아니라 App Store Connect 앱의 Apple ID 숫자다. `apps/native/eas.json`의 `submit.testflight.ios.ascAppId`에 반영한다.

### 필요한 EAS project 설정

- EAS project 생성 완료: `efe8f7e5-75d8-45a9-9a4e-88bfeba07b98`
- `apps/native/app.json` 또는 `app.config.ts`에 `extra.eas.projectId` 반영
- EAS credentials에 iOS distribution certificate/provisioning profile 구성
- EAS credentials에 App Store Connect API key 구성
- EAS environment `production` 또는 `testflight`에 공개 가능/비공개 값을 분리

Expo EAS environment variable은 visibility가 `plain text`, `sensitive`, `secret`으로 나뉜다. client code에 포함되는 값은 공개 가능하다는 전제로만 사용한다. 출처: https://docs.expo.dev/eas/environment-variables/

EAS Submit의 `eas.json` iOS submit profile은 `ascAppId`, `appleTeamId`, `ascApiKeyPath`, `ascApiKeyIssuerId`, `ascApiKeyId` 같은 필드를 지원한다. 로컬 `.p8` 파일 방식을 쓰면 workflow에서 임시 파일을 만들고 해당 path를 profile 또는 CLI 인자로 연결하는 방식을 실제 EAS CLI 버전으로 검증한다. 출처: https://docs.expo.dev/eas/json/#submitios

### `.github/workflows/native-ios-ci.yml`

PR과 main push에서 실행한다.

```yaml
name: Native iOS CI

on:
  pull_request:
    paths:
      - "apps/native/**"
      - "package.json"
      - "package-lock.json"
      - ".github/workflows/native-ios-ci.yml"
  push:
    branches: [main]
    paths:
      - "apps/native/**"
      - "package.json"
      - "package-lock.json"
      - ".github/workflows/native-ios-ci.yml"

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm ci
      - run: npm run typecheck --workspace native
      - run: npm run test --workspace native -- --runInBand
      - run: npx expo-doctor
        working-directory: apps/native
```

실제 구현 시 `.nvmrc`가 없으면 현재 repo의 Node 기준에 맞춰 `node-version`을 명시한다.

### `.github/workflows/native-ios-testflight.yml`

수동 실행만 허용한다.

```yaml
name: Native iOS TestFlight

on:
  workflow_dispatch:
    inputs:
      ref:
        description: "Git ref or SHA to build"
        required: true
      message:
        description: "EAS build message"
        required: false

jobs:
  testflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.ref }}
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm ci
      - name: Verify TestFlight configuration
        run: npm run native:testflight:check
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm run typecheck --workspace native
      - run: npm run test --workspace native -- --runInBand
      - name: Build and submit to TestFlight
        working-directory: apps/native
        run: >
          eas build
          --platform ios
          --profile testflight
          --non-interactive
          --auto-submit
          --message "${{ inputs.message || github.sha }}"
      - name: Summary
        if: always()
        working-directory: apps/native
        run: |
          echo "### Native iOS TestFlight" >> "$GITHUB_STEP_SUMMARY"
          echo "- ref: ${{ inputs.ref }}" >> "$GITHUB_STEP_SUMMARY"
          echo "- commit: $GITHUB_SHA" >> "$GITHUB_STEP_SUMMARY"
          echo "- EAS dashboard: https://expo.dev/accounts" >> "$GITHUB_STEP_SUMMARY"
```

구현 시 `eas.json`의 submit profile과 EAS credentials 연결이 정확히 맞는지 먼저 검증한다. EAS CLI가 summary용 build URL을 안정적으로 JSON 출력하는 방식은 실제 CLI 버전에서 확인 후 보강한다.

## 15. 외부 준비 체크리스트

- Apple Developer Program 활성화
- Certificates, Identifiers & Profiles에서 Bundle ID `app.ottline` 등록
- App Store Connect 앱 생성
- SKU 결정
- Primary language 결정: Korean 또는 English
- `ascAppId` 확인
- App Store Connect API key 생성
- API key 권한 확인
- EAS project 생성
- EAS iOS signing credentials 생성
- TestFlight beta app description 작성
- TestFlight feedback email 지정
- TestFlight beta app review information 작성
- `docs/ios-testflight-review-notes.md` 내용을 실제 App Store Connect 입력값에 맞게 갱신
- `npm run native:testflight:check` 통과 확인
- 내부 테스터 그룹 생성
- 외부 테스터는 첫 TestFlight App Review 승인 후 진행

## 16. 구현 순서

### Phase 0. 기준 브랜치와 문서

- `feature/ios-native-full-parity` 생성
- 이 문서를 feature branch에 포함
- `feature/ios-native-testflight` diff에서 이식 대상 재확인
- local ignored `apps/native/node_modules` 제거 여부는 사용자 확인 후 처리

### Phase 1. Skeleton 편입

- `apps/native` seed 선별 이식
- workspace/package-lock 정리
- Expo Router 부팅 확인
- typecheck/test/expo-doctor 통과
- GitHub native CI 추가

완료 증거:

- `git diff --stat`에 web/api/deploy 삭제나 구버전 되돌림이 없다.
- `npm ci` 성공
- `npm run typecheck --workspace native` 성공
- `npm run test --workspace native -- --runInBand` 성공
- `apps/native`에서 `npx expo-doctor` 성공 또는 조치 가능한 warning 문서화

### Phase 2. Local-first core

- SQLite schema versioning
- register/pair/secure credentials
- title search/popular
- log create/update
- sync push/pull
- stale reject 처리
- offline/foreground sync

완료 증거:

- local DB 단위 테스트
- sync payload 단위 테스트
- offline create 후 online sync 수동 검증
- pair 전후 데이터 정책 검증

### Phase 3. 사용자 화면 full parity

- 기록하기 full parity
- 타임라인 full parity
- 제목 상세/수정/history
- 함께/discussion/comment/reaction
- 설정/profile/devices/recovery card/data deletion
- 리포트
- 공유 카드
- 문의함 상세
- 안내 화면
- i18n/theme/accessibility

완료 증거:

- 패리티 매트릭스 모든 행 완료
- iPhone 실기기 또는 TestFlight build에서 핵심 플로우 녹화/스크린샷
- ko/en 및 light/dark 확인

### Phase 4. iOS platform features

- `expo-notifications`
- permission state UI
- local reminder scheduling
- notification open route handling
- analytics install/session context
- admin analytics optional iOS segment

완료 증거:

- 알림 권한 거부/허용 상태 검증
- 예약 알림 수신
- 알림 tap route 이동
- admin analytics에서 `platform=ios_native` 이벤트 확인

### Phase 5. TestFlight pipeline

- App Store Connect/EAS 외부 준비
- `eas.json` submit profile 완성
- GitHub TestFlight workflow 추가
- workflow_dispatch로 SHA 지정 build
- EAS Build 성공
- EAS Submit 성공
- App Store Connect TestFlight build processing 완료 확인
- 내부 테스터 설치

완료 증거:

- GitHub run URL
- EAS build URL
- App Store Connect build number
- TestFlight processing/available 상태
- iPhone 설치 후 핵심 플로우 확인표

## 17. 실기기 확인표

TestFlight 설치 후 iPhone에서 확인한다.

- 첫 실행
- ko locale
- en locale
- light mode
- dark mode
- 제목 검색
- 빈 검색 추천
- 첫 기록 저장
- 오프라인 기록 저장
- 재접속 후 sync
- 타임라인 pull
- 기록 검색/필터
- 기록 수정
- 제목 상세
- 시리즈 시즌/에피소드
- 페어링 코드 발급
- 기존 코드로 연결
- 연결 기기 목록
- 기기 unlink
- 복구 카드 생성/저장
- 서버 데이터 전체 삭제
- 함께 목록
- 공개 글 상세
- 댓글 작성
- 리액션
- 나도 봤어요/읽었어요 기록 생성
- 문의 등록
- 관리자 답변 확인
- 내 리포트
- 공유 카드 생성
- 공유 sheet
- 회고 알림 권한 요청
- 회고 알림 발송
- 알림 tap route 이동
- analytics `platform=ios_native`

## 18. 완료 기준

아래가 모두 현재 증거로 확인되어야 완료다.

- `apps/native`가 현재 `main` 기준 repo에 안전하게 편입됐다.
- root workspace/package-lock 변경이 네이티브 앱 추가에 필요한 범위로 제한됐다.
- Android TWA production 경로와 `apps/twa` 계약을 변경하지 않았다.
- WebView 없이 사용자 앱 주요 화면이 React Native 화면으로 구현됐다.
- 패리티 매트릭스의 네이티브 완료 조건이 모두 충족됐다.
- `npm ci`가 clean checkout에서 성공한다.
- `npm run typecheck --workspace native`가 성공한다.
- `npm run test --workspace native -- --runInBand`가 성공한다.
- `apps/native`에서 `npx expo-doctor`가 성공하거나 남은 warning이 TestFlight 차단이 아님을 문서화했다.
- `npm run native:testflight:check:structure`가 성공한다.
- GitHub Actions native CI가 성공한다.
- GitHub Actions native iOS TestFlight workflow를 수동 실행할 수 있다.
- EAS iOS store build가 성공한다.
- EAS Submit이 성공한다.
- App Store Connect TestFlight에 build가 올라간다.
- 내부 테스터가 TestFlight에서 설치할 수 있다.
- iPhone 실기기 확인표의 필수 항목이 통과했다.
- TestFlight/App Review 리스크 중 UGC 신고 흐름, review access, privacy/support URL에 대한 대응이 문서화됐다.

## 19. 이번 문서 이후 첫 실행 명령

문서 확정 후 실제 구현 시작 시:

```bash
git checkout -b feature/ios-native-full-parity
git restore --source feature/ios-native-testflight -- apps/native
git restore --source feature/ios-native-testflight -- package.json package-lock.json
git status --short
git diff --stat main...
```

그 다음 `git diff`에서 web/api/deploy/docs/wiki 되돌림이 섞이지 않았는지 확인하고, 필요한 경우 root package 파일은 현재 `main` 기준으로 다시 수작업 정리한다.
