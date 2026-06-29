# iOS TestFlight Review Notes

기준일: 2026-06-29

이 문서는 App Store Connect의 TestFlight beta review information, 내부 QA, App Store 출시 이력을 정리한다. `2026-06-29` App Store 심사를 통과해 App Store에 공개됐으며, 출시 후 확인은 `docs/ios-app-store-launch-checklist.md`에서 이어간다.

## App 정보 초안

- App name: ottline
- Bundle ID: `app.ottline`
- Apple ID / ascAppId: `6780318110`
- EAS project id: `efe8f7e5-75d8-45a9-9a4e-88bfeba07b98`
- Current launch candidate: `1.0.0 (18)`
- Current source branch: `native-ios-qa-parity`
- Current uploaded artifact: `apps/native/builds/direct/ottline-18.ipa`
- Current EAS submission: `a58c8aab-df08-4364-8259-64a375fcea1d`
- Previous uploaded artifact: `apps/native/builds/direct/ottline-16.ipa`
- Previous EAS submission: `5cddc021-ab3e-412c-99cb-f687f67dde30` (build `16`, Expo 기본 아이콘 포함으로 출시 후보 제외)
- SKU: `ottline-ios`
- Primary language: Korean 우선, English 지원
- Category: Lifestyle 권장, Entertainment 대안
- Support URL: `https://ottline.app/feedback`
- Marketing URL: `https://ottline.app/about`
- Privacy URL: `https://ottline.app/privacy`
- App Store URL: `https://apps.apple.com/app/ottline/id6780318110`

## Beta App Description 초안

ottline is a warm personal timeline for movies, series, and books. Testers can search titles, save local-first logs, sync them with a pairing-code account, revisit their timeline and reports, join public discussions, and manage data from native iOS screens without using a WebView wrapper.

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
- Local Mac EAS build succeeds. (`2026-06-28`, build `1.0.0 (16)`)
- EAS Submit uploads build `1.0.0 (16)` to App Store Connect. (`5cddc021-ab3e-412c-99cb-f687f67dde30`)
- Native app icon is replaced from Expo default icon to ottline brand icon. (`2026-06-28`, build `1.0.0 (18)`)
- Local Mac EAS build succeeds for icon-fixed build `1.0.0 (18)`. (`apps/native/builds/direct/ottline-18.ipa`)
- EAS Submit uploads build `1.0.0 (18)` to App Store Connect. (`a58c8aab-df08-4364-8259-64a375fcea1d`)
- App Store Connect build processing completes. (`2026-06-29` 출시 완료로 확인)
- Internal tester can install build `1.0.0 (18)` from TestFlight. (`2026-06-28` 사용자 확인)
- iPhone checklist in `docs/ios-native-full-parity-testflight-plan.md` passes. (`2026-06-28` 사용자 확인 완료)

## 최근 TestFlight 제출 이력

- `2026-06-18`: PR `#67`, main SHA `d18cfa6`, GitHub run `27745616062`, EAS build `455d8658-422e-4298-a023-37070d220622`, build `1.0.0 (5)`.
- `2026-06-19`: PR `#68`, main SHA `24d2845`, GitHub run `27804770845`, build `1.0.0 (6)`. 하단 탭 아이콘, 타임라인 reload 이벤트, 로고 탭 이동 반영.
- `2026-06-19`: PR `#69`, main SHA `667aafeb4546eb015a9ef7894f6cba9183db043e`, GitHub run `27805741470`, EAS build `7796ef11-75c1-4acb-95d7-96018e10bdbc`, EAS submission `2f02d6c8-2200-4078-b40b-b4ee0591bc54`, build `1.0.0 (7)`. 큰 탭 제목/설명 복원, 작은 중복 kicker 제거, 페어링 직후 `lastSyncAt` 초기화로 전체 pull 반영.
- `2026-06-28`: branch `native-ios-qa-parity`, local Mac EAS build artifact `apps/native/builds/direct/ottline-16.ipa`, EAS submission `5cddc021-ab3e-412c-99cb-f687f67dde30`, App Store Connect build `1.0.0 (16)`. Web/TWA parity에 맞춰 기록하기 입력 순서, 날짜 선택, 평점 입력 방식, 타임라인 수정 폼, 다크 모드 입력 색상, web preview guard와 SQLite wasm bundling을 보강했다.
- `2026-06-28`: build `1.0.0 (16)`에서 Expo 기본 아이콘이 확인되어 출시 후보에서 제외했다. `apps/native/assets/icon.png`를 ottline 브랜드 아이콘으로 교체했고, EAS autoIncrement로 build `1.0.0 (18)`을 생성했다. Local artifact `apps/native/builds/direct/ottline-18.ipa`, EAS submission `a58c8aab-df08-4364-8259-64a375fcea1d`로 App Store Connect 업로드를 완료했다.
- `2026-06-29`: PR `#73` main SHA `2ddb3bb` 기준 iOS launch prep이 main에 반영됐다. App Store 심사를 통과해 `https://apps.apple.com/app/ottline/id6780318110`로 공개됐다.
