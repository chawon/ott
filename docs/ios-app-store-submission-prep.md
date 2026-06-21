# iOS App Store Submission Prep

기준일: 2026-06-21

이 문서는 TestFlight 추가 빌드가 EAS Free iOS quota에 막혀 `2026-07-01` 이후로 밀린 동안 App Store 심사 제출 준비를 먼저 끝내기 위한 작업 기준이다.

## 1. 현재 상태

- App: `ottline`
- Bundle ID: `app.ottline`
- Apple ID / ascAppId: `6780318110`
- EAS project id: `efe8f7e5-75d8-45a9-9a4e-88bfeba07b98`
- 현재 작업 브랜치: `fix/ios-log-parity`
- 재시도 기준 SHA: `76d82da9526d8ce97b7c09dda65286eef1479f26`
- 현재 `apps/native/app.json` committed `ios.buildNumber`: `14`
- 다음 실제 App Store Connect build 목표: `1.0.0 (15)`
- 주의: `apps/native/eas.json`의 TestFlight build profile은 `autoIncrement: true`다. 현재 workflow에서는 EAS가 submitted build number를 한 번 올리므로, 실제 `15`를 만들려면 committed baseline을 `14`로 둔다.
- 마지막 TestFlight 재시도: GitHub run `27902317186`, SHA `253c98c81bb113ecc2dec8f7dc43c49efc8e015e`
- 결과: typecheck/test는 통과했으나 EAS Free plan iOS build quota exhausted로 build/upload 전 중단. build `15`는 App Store Connect에 올라간 상태가 아니다.

## 2. Apple 공식 요구사항 요약

Apple 문서 기준 제출 전 고정해야 할 항목은 아래와 같다.

- App Review 전에는 crash/bug 테스트, 완전하고 정확한 metadata, 연락 가능한 contact 정보, 계정 기반 기능에 대한 full access 또는 demo mode, live backend, 비자명 기능 설명을 준비해야 한다. 출처: https://developer.apple.com/app-store/review/guidelines/
- UGC가 있으면 objectionable material filtering, offensive content report, timely response, abusive user block, published contact information이 필요하다. 출처: https://developer.apple.com/app-store/review/guidelines/
- privacy policy는 App Store Connect metadata와 앱 안에서 접근 가능해야 하며, 데이터 수집/사용/보존/삭제 정책을 설명해야 한다. 계정 생성이 있으면 앱 안 account deletion 경로가 필요하다. 출처: https://developer.apple.com/app-store/review/guidelines/
- TestFlight 외부 테스트에는 beta app description, beta app review information, feedback email이 필요하다. 출처: https://developer.apple.com/testflight/
- 스크린샷은 `.jpeg`, `.jpg`, `.png` 형식으로 1-10장을 올린다. iPhone은 6.9" 스크린샷을 우선 준비하고, 없으면 6.5" 요구를 맞춘다. 출처: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- App Review information은 App Store Connect의 해당 platform version에 넣고, iOS app version submission은 다른 platform과 별도로 진행한다. 출처: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/overview-of-submitting-for-review

## 3. App Store Connect 입력 초안

### App Information

- Name: `ottline`
- Subtitle: `영상과 책을 남기는 타임라인`
- Bundle ID: `app.ottline`
- SKU: `ottline-ios-2026`
- Primary language: Korean
- Category: `Lifestyle`
- Secondary category: `Entertainment`
- Price: Free
- Age rating: App Store Connect 설문에서 최종 산정
- Support URL: `https://ottline.app/feedback`
- Marketing URL: `https://ottline.app/about`
- Privacy Policy URL: `https://ottline.app/privacy`
- Copyright: 법적 소유자명 확인 필요. repo 문서에 임의로 적지 않는다.

### Promotional Text 초안

영상과 책을 검색해 바로 남기고, 나중에 타임라인에서 다시 꺼내보세요.

### Description 초안

ottline은 영화, 시리즈, 책을 한 타임라인에 남기는 개인 기록장입니다.

방금 본 작품이나 읽은 책을 검색하고, 상태와 날짜, 장소, 플랫폼, 짧은 메모를 남길 수 있습니다. 기록은 먼저 기기에 저장되고, 페어링 코드로 연결한 계정에 동기화됩니다.

타임라인에서는 내가 남긴 기록을 다시 찾아보고, CSV로 내보내거나 공유 카드로 저장할 수 있습니다. 공개로 남긴 기록은 함께 화면에서 다른 사람의 댓글과 반응을 받을 수 있습니다.

추천 피드보다 내가 남긴 기록을 오래 보관하는 데 집중합니다. 이메일이나 비밀번호 없이 시작할 수 있고, 설정에서 로컬 데이터 초기화와 서버 데이터 전체 삭제를 분리해 관리할 수 있습니다.

### Keywords 초안

ott, movie, series, book, diary, timeline, record, watchlist, reading, review

### What's New 초안

첫 iOS TestFlight 기반 네이티브 앱입니다. 영상과 책 검색, 기록하기, 타임라인, 함께 기록, 프로필, 공유 카드, CSV 내보내기, 회고 알림을 iPhone 화면에 맞춰 제공합니다.

## 4. Privacy Label 초안

최종 입력 전 App Store Connect privacy questionnaire에서 실제 SDK/수집 항목 기준으로 다시 확인한다.

- Tracking: 사용하지 않음. IDFA/ATT 기반 tracking 없음.
- User Content: 기록 제목, 상태, 평점, 날짜, 장소, 플랫폼, 메모, 공개 글, 댓글, 문의 메시지, 프로필 닉네임/아바타/성향.
- Identifiers: pairing account `userId`, `deviceId`, `installId`, pairing code, session id.
- Usage Data: 앱 실행, route, 검색/선택/저장/동기화/공유/알림 permission/open 같은 제품 analytics event, locale, theme, app version, build number.
- Diagnostics: 별도 crash/diagnostics SDK를 넣지 않았다면 ottline 자체 수집 항목으로는 입력하지 않는다. TestFlight/Apple 진단은 Apple 제공 범위로 구분한다.
- Purposes: App Functionality, Analytics, Customer Support.
- Data linked to user: pairing account에 연결되는 records/profile/comments/feedback/analytics는 pseudonymous account 기준으로 연결될 수 있다.
- Deletion: 앱 설정의 서버 데이터 전체 삭제로 pairing account의 서버 기록/댓글/문의/analytics/기기 연결을 삭제한다. 로컬 초기화는 현재 기기 저장소만 비운다.

## 5. App Review Notes 초안

아래 문구는 App Store Connect의 App Review Information / Notes에 옮길 수 있는 초안이다.

```text
ottline is a native iOS app for keeping a personal timeline of movies, series, and books. It is not a WebView wrapper.

No email or password account is required. On first launch, reviewers can search a title and save a log immediately. The app creates an anonymous pairing-code account and stores credentials locally. To test continuity, open Account, issue a pairing code, and enter it on another device.

Production backend is live at https://ottline.app. The app uses the same production API as the web app. There are no in-app purchases, subscriptions, paid features, or third-party login flows.

Core flows to review:
1. Search a movie, series, or book from the Log tab.
2. Save a log by choosing a status, then add optional rating, date, platform, place, occasion, season/episode, and note.
3. Open Timeline, filter records, export CSV, create a share card, and post a record to Together.
4. Open Together, view public records, add a comment, and react.
5. Open Account, edit profile, issue a pairing code, create a recovery card, export data, and delete server data.
6. Enable recap reminders only after explicit opt-in and confirm the permission UI.

The app does not read video playback contents from other apps. iOS recap reminders are local notifications and are optional.

If preloaded data is needed, use the pairing code provided in this review note. [INSERT REVIEW PAIRING CODE BEFORE SUBMISSION]
```

리뷰용 pairing code는 제출 직전에 별도 테스트 계정에서 만들고 App Store Connect에만 붙인다. repo에는 커밋하지 않는다.

## 6. UGC / Moderation 리스크

현재 iOS 앱은 함께 화면에서 공개 글, 댓글, 리액션을 제공한다. Apple Guideline 1.2 기준 UGC 앱은 신고, timely response, abusive user block, contact information이 필요하다.

현재 코드 기준으로 확인한 사실:

- Account/Feedback 경로는 존재한다.
- Support URL은 `https://ottline.app/feedback`로 둘 수 있다.
- 현재 iOS 공개 상세 화면에는 공개 글/댓글 신고 진입점이 없다.
- 현재 iOS에는 abusive user block/mute UX가 없다.

따라서 App Store 정식 심사 제출 전 P0 결정이 필요하다.

1. 공개 글/댓글 신고 진입점을 iOS에 복원하고, report body에 discussion/comment id와 title을 prefill한다.
2. abusive user block/mute에 해당하는 최소 UX와 API 정책을 정한다. API가 없다면 첫 iOS release에서 공개 댓글 작성/표시 범위를 제한하는 대안도 검토한다.
3. App Review Notes에는 실제 앱 안에서 확인 가능한 신고/차단/연락 경로만 적는다.

## 7. Screenshot 계획

우선 iPhone 6.9" portrait 기준으로 준비한다. 필요하면 6.5" fallback을 추가한다.

권장 6장:

1. 기록하기: 영상/책 선택, 검색창, 선택한 작품 정보
2. 기록 입력: 상태, 평점, 플랫폼/장소, 메모
3. 타임라인: 포스터/책 표지 카드, 필터, CSV 아이콘
4. 함께: 공개 기록과 댓글 흐름
5. 설정: 프로필, 페어링 코드, 데이터 관리
6. 공유 카드 또는 리포트: 저장된 기록이 다시 꺼내지는 가치

스크린샷에는 실제 개인정보, 실제 pairing code, 운영자가 아닌 사용자의 민감 메모를 넣지 않는다.

## 8. 2026-07-01 재개 순서

1. EAS Free iOS build quota reset 또는 유료 plan 전환 여부를 확인한다.
2. `apps/native/app.json`의 `ios.buildNumber`가 `14`인지 확인한다. 실제 목표 build `15`를 위해 baseline을 `15`로 올리지 않는다.
3. `npm run native:testflight:check`, `npm run native:typecheck`, `npm run native:test`, `apps/native`의 `npx expo-doctor`, `git diff --check`를 확인한다.
4. GitHub Actions `Native iOS TestFlight` workflow를 `76d82da9526d8ce97b7c09dda65286eef1479f26` 또는 그 이후 검증된 SHA로 실행한다.
5. App Store Connect에서 `1.0.0 (15)` processing/available 상태를 확인한다.
6. TestFlight 설치 후 `docs/ios-native-full-parity-testflight-plan.md` 실기기 확인표를 수행한다.
7. UGC 신고/차단 리스크가 해결됐는지 확인한다.
8. App Store Connect metadata, privacy label, age rating, screenshots, review notes를 채운다.
9. review pairing code를 생성해 App Review Notes에만 입력한다.
10. App Review 제출을 실행한다.

## 9. 제출 전 체크리스트

| 우선순위 | 항목 | 상태 |
|---|---|---|
| P0 | EAS quota reset 후 build `1.0.0 (15)` 업로드 | 대기 |
| P0 | TestFlight 실기기 QA | 대기 |
| P0 | UGC 신고/차단 정책과 iOS UX 정리 | 필요 |
| P0 | Privacy label 최종 입력 | 필요 |
| P0 | App Review Notes에 review pairing code 입력 | 제출 직전 |
| P0 | 6.9" iPhone screenshots 1-10장 | 필요 |
| P0 | Server data deletion flow 실기기 검증 | 대기 |
| P1 | English metadata copy 보강 | 필요 시 |
| P1 | 외부 TestFlight tester group 확대 | 첫 beta review 후 |
