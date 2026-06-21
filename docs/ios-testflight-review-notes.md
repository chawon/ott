# iOS TestFlight Review Notes

기준일: 2026-06-20

이 문서는 App Store Connect의 TestFlight beta review information과 내부 QA에 옮길 내용을 정리한다. App Store Connect 앱 생성, EAS project 연결, signing credentials, EAS Submit API key 구성은 완료됐으며, 실제 제출 전후의 값은 아래 기준으로 유지한다.

## App 정보 초안

- App name: ottline
- Bundle ID: `app.ottline`
- Apple ID / ascAppId: `6780318110`
- EAS project id: `efe8f7e5-75d8-45a9-9a4e-88bfeba07b98`
- Current committed build baseline: `1.0.0 (9)`
- Current source SHA: `aa77a6b62cd8ab63994cd19c6e969986bbac140d`
- SKU: 외부 준비 시 결정
- Primary language: Korean 우선, English 지원
- Category: Entertainment 또는 Lifestyle 중 App Store Connect에서 최종 결정
- Support URL: `https://ottline.app/feedback`
- Marketing URL: `https://ottline.app/about`
- Privacy URL: `https://ottline.app/privacy`

## Beta App Description 초안

ottline is a private timeline for movies, series, and books. Testers can search titles, save local-first logs, sync them with a pairing-code account, revisit their timeline and reports, join public discussions, and manage data from native iOS screens without using a WebView wrapper.

## Beta Review Information 초안

### Sign-in and Review Access

No email or password account is required.

1. Launch the app.
2. Save a first log from the Log tab, or open Account and issue a pairing code.
3. The app creates an anonymous pairing-code account and stores credentials locally.
4. To test cross-device continuity, issue a pairing code in Account and enter it on another device.

If Apple requires preloaded data, create a review pairing code from a test account before submission and paste it into the App Store Connect review notes.

### Core Flows To Review

- Search a movie, series, or book.
- Save a log by choosing a status first, then optionally add rating, date, note, place, occasion, season/episode, platform, public sharing, and a share card.
- Open Timeline, search/filter logs, export CSV, create a log share card, and post a log to Together.
- Open a title detail, edit a log, view history, and open the title's Together discussion.
- Open Together, view a public post, add a comment, react, and use the report action.
- Open Account, edit profile, issue a pairing code, create a recovery card, export CSV by type, and manage local/server data.
- Open My Report and share a recap card.
- Enable recap reminders and confirm permission UI.

### UGC / Moderation

Public discussions and comments are user-generated content. In the native app, public post and comment report actions open the Feedback screen with target details prefilled. Reports are submitted through the existing feedback thread API and reviewed by the operator. The Account screen also links to Feedback for general support.

### Data Deletion

Account includes a server data deletion action. It deletes the current pairing account's server logs, comments, feedback, analytics events, recommendation cache, and linked devices. Local reset is a separate device-only action.

### Privacy Notes

The app does not read video playback contents from other apps. iOS recap reminders are local notifications enabled only after explicit opt-in. Analytics events use `/api/nalytic/events` and include native platform context such as `platform=ios_native`, app version, build number, locale, theme, route, install id, and session id.

## Internal TestFlight 확인 항목

- Apple Developer Program approval is active. (`2026-06-15` 완료)
- App Store Connect app record for `ottline` / `app.ottline` is created. (`2026-06-15` 완료)
- App Store Connect `ascAppId` is set in `apps/native/eas.json`. (`6780318110`)
- EAS project id is set in `apps/native/app.json`. (`efe8f7e5-75d8-45a9-9a4e-88bfeba07b98`)
- EAS iOS signing credentials are configured. (`2026-06-18` 이후 TestFlight 제출 성공으로 확인)
- EAS App Store Connect API key is configured. (`2026-06-18` 이후 TestFlight 제출 성공으로 확인)
- GitHub secret `EXPO_TOKEN` is present. (`Native iOS TestFlight` workflow 성공으로 확인)
- Native iOS TestFlight workflow succeeds. (`27805741470`, build `1.0.0 (7)`)
- Before every new TestFlight dispatch, bump `apps/native/app.json` `ios.buildNumber` to the next unused integer. Do not rely on `autoIncrement` alone after a failed upload or a previously submitted build number.
- App Store Connect build processing completes. (Apple processing 완료 후 TestFlight 탭에서 확인)
- Internal tester can install the build from TestFlight. (진행 중)
- iPhone checklist in `docs/ios-native-full-parity-testflight-plan.md` passes. (진행 중)

## 최근 TestFlight 제출 이력

- `2026-06-18`: PR `#67`, main SHA `d18cfa6`, GitHub run `27745616062`, EAS build `455d8658-422e-4298-a023-37070d220622`, build `1.0.0 (5)`.
- `2026-06-19`: PR `#68`, main SHA `24d2845`, GitHub run `27804770845`, build `1.0.0 (6)`. 하단 탭 아이콘, 타임라인 reload 이벤트, 로고 탭 이동 반영.
- `2026-06-19`: PR `#69`, main SHA `667aafeb4546eb015a9ef7894f6cba9183db043e`, GitHub run `27805741470`, EAS build `7796ef11-75c1-4acb-95d7-96018e10bdbc`, EAS submission `2f02d6c8-2200-4078-b40b-b4ee0591bc54`, build `1.0.0 (7)`. 큰 탭 제목/설명 복원, 작은 중복 kicker 제거, 페어링 직후 `lastSyncAt` 초기화로 전체 pull 반영.
