# iOS TestFlight Review Notes

기준일: 2026-06-13

이 문서는 App Store Connect의 TestFlight beta review information과 내부 QA에 옮길 내용을 정리한다. 실제 App Store Connect 앱 생성, EAS project 연결, signing credentials 구성 후 최신 값으로 다시 확인한다.

## App 정보 초안

- App name: ottline
- Bundle ID: `app.ottline`
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
- Save a log with status, rating, date, note, place, occasion, and platform.
- Open Timeline, search/filter logs, and export CSV.
- Open a title detail, edit a log, and view history.
- Open Together, view a public post, add a comment, react, and use the report action.
- Open Account, edit profile, issue a pairing code, create a recovery card, and manage local/server data.
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
- EAS project id is set in `apps/native/app.json`.
- EAS iOS signing credentials are configured.
- EAS App Store Connect API key is configured.
- GitHub secret `EXPO_TOKEN` is present.
- Native iOS TestFlight workflow succeeds.
- App Store Connect build processing completes.
- Internal tester can install the build from TestFlight.
- iPhone checklist in `docs/ios-native-full-parity-testflight-plan.md` passes.
