# iOS TestFlight Review Notes

기준일: 2026-06-21

이 문서는 App Store Connect의 TestFlight beta review information과 내부 QA에 옮길 내용을 정리한다. App Store 정식 심사 제출 준비는 `docs/ios-app-store-submission-prep.md`를 기준으로 한다.

## App 정보 초안

- App name: ottline
- Bundle ID: `app.ottline`
- Apple ID / ascAppId: `6780318110`
- EAS project id: `efe8f7e5-75d8-45a9-9a4e-88bfeba07b98`
- Current committed build baseline: `1.0.0 (14)`
- Next intended App Store Connect build: `1.0.0 (15)`
- Current source SHA: `76d82da9526d8ce97b7c09dda65286eef1479f26`
- SKU draft: `ottline-ios-2026`
- Primary language: Korean 우선, English 지원
- Category draft: Lifestyle primary, Entertainment secondary
- Support URL: `https://ottline.app/feedback`
- Marketing URL: `https://ottline.app/about`
- Privacy URL: `https://ottline.app/privacy`

## 현재 TestFlight 상태

- build `1.0.0 (14)`는 TestFlight QA 기준 빌드로 사용 중이다.
- 다음 제출 목표는 build `1.0.0 (15)`다.
- `apps/native/eas.json`의 TestFlight build profile은 `autoIncrement: true`이므로 현재 workflow에서는 committed `ios.buildNumber`를 실제 목표보다 하나 낮게 둔다.
- 현재 `apps/native/app.json`의 `ios.buildNumber`는 `14`이며, 이 상태로 재시도하면 EAS가 실제 build `15`를 만든다.
- `2026-06-21` run `27902317186`은 EAS Free plan iOS build quota exhausted로 build/upload 전 실패했다. typecheck/test 단계는 통과했지만 build `15`는 App Store Connect에 업로드되지 않았다.
- EAS Free plan reset 시점은 `2026-07-01`로 확인됐으므로, 그 전에는 workflow를 반복 실행하지 않는다.

## Beta App Description 초안

ottline is a private timeline for movies, series, and books. Testers can search titles, save local-first logs, sync them with a pairing-code account, revisit their timeline and reports, join public discussions, and manage data from native iOS screens without using a WebView wrapper.

## Beta Review Information 초안

### Sign-in and Review Access

No email or password account is required.

1. Launch the app.
2. Save a first log from the Log tab, or open Account and issue a pairing code.
3. The app creates an anonymous pairing-code account and stores credentials locally.
4. To test cross-device continuity, issue a pairing code in Account and enter it on another device.

If Apple requires preloaded data, create a review pairing code from a test account before submission and paste it into App Store Connect review notes. Do not commit the review pairing code to the repository.

### Core Flows To Review

- Search a movie, series, or book.
- Save a log by choosing a status first, then optionally add rating, date, note, place, occasion, season/episode, platform, public sharing, and a share card.
- Open Timeline, search/filter logs, export CSV, create a log share card, and post a log to Together.
- Open a title detail, edit a log, view history, and open the title's Together discussion.
- Open Together, view a public post, add a comment, and react.
- Open Account, edit profile, issue a pairing code, create a recovery card, export CSV by type, and manage local/server data.
- Open My Report and share a recap card.
- Enable recap reminders and confirm permission UI.

### UGC / Moderation

Public discussions and comments are user-generated content. The native iOS app currently has Account/Feedback and a support URL, but the current public detail screen does not expose public post/comment report actions and does not provide an abusive-user block/mute UX.

Before App Store review submission, resolve this as a P0 item:

1. Restore report entry points for public posts and comments, with discussion/comment id and title details prefilled into Feedback.
2. Define a minimum block/mute policy or limit UGC exposure for the first iOS release.
3. Only describe moderation flows in App Review Notes after the corresponding in-app UX is present.

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
- Native iOS TestFlight workflow succeeds. (최근 성공 기준: build `1.0.0 (14)`, 2026-06-21 사용자 확인)
- Next retry SHA is `76d82da9526d8ce97b7c09dda65286eef1479f26`.
- Before retrying build `15`, keep committed `ios.buildNumber` at `14` because EAS `autoIncrement: true` produces the next build number during the workflow.
- App Store Connect build processing completes. (Apple processing 완료 후 TestFlight 탭에서 확인)
- Internal tester can install the build from TestFlight. (진행 중)
- iPhone checklist in `docs/ios-native-full-parity-testflight-plan.md` passes. (진행 중)

## 최근 TestFlight 제출 이력

- `2026-06-18`: PR `#67`, main SHA `d18cfa6`, GitHub run `27745616062`, EAS build `455d8658-422e-4298-a023-37070d220622`, build `1.0.0 (5)`.
- `2026-06-19`: PR `#68`, main SHA `24d2845`, GitHub run `27804770845`, build `1.0.0 (6)`. 하단 탭 아이콘, 타임라인 reload 이벤트, 로고 탭 이동 반영.
- `2026-06-19`: PR `#69`, main SHA `667aafeb4546eb015a9ef7894f6cba9183db043e`, GitHub run `27805741470`, EAS build `7796ef11-75c1-4acb-95d7-96018e10bdbc`, EAS submission `2f02d6c8-2200-4078-b40b-b4ee0591bc54`, build `1.0.0 (7)`.
- `2026-06-21`: SHA `7b4c68a4587b607e67c2b348a00e1e9d64a427ad`, build `1.0.0 (14)`. 하단 네비/상단 제목 아이콘/공유 카드 UI QA 반영 후 TestFlight QA 기준으로 사용.
- `2026-06-21`: SHA `253c98c81bb113ecc2dec8f7dc43c49efc8e015e`, GitHub run `27902317186`, intended build `1.0.0 (15)`. EAS Free plan iOS build quota exhausted로 build/upload 전 실패.
- `2026-06-21`: SHA `76d82da9526d8ce97b7c09dda65286eef1479f26`, committed build baseline `14`로 복구. `2026-07-01` 이후 build `15` 재시도 기준.
