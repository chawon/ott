# iOS TestFlight Review Notes

기준일: 2026-06-29

이 문서는 App Store Connect의 TestFlight beta review information, 내부 QA, App Store 출시 이력을 정리한다. `2026-06-29` App Store 심사를 통과해 App Store에 공개됐으며, 출시 후 확인은 `docs/ios-app-store-launch-checklist.md`에서 이어간다.

## 1.0.2 English TestFlight submission copy

아래 내용은 현재 iOS `1.0.2` TestFlight 후보에 대해 App Store Connect의 English (U.S.) localization과 TestFlight Beta App Review Information에 붙여 넣을 초안이다. 앱 코드나 번역 구현을 변경하지 않고 심사 입력 내용만 준비한다.

### App Store Connect — English (U.S.) metadata

- App name: `ottline`
- Subtitle: `Log what you watch and read`
- Promotional text: `Keep movies, series, and books in one personal timeline. Add notes, revisit your history, and share what stayed with you.`
- Keywords: `movie,series,book,watchlist,reading,diary,timeline,notes,history,tracking`
- Support URL: `https://ottline.app/feedback`
- Marketing URL: `https://ottline.app/about`
- Privacy Policy URL: `https://ottline.app/privacy`

#### Description

ottline is a personal timeline for movies, series, and books.

Search for a title, choose a status, and save it to your timeline. Add a date, rating, note, platform, place, occasion, or season and episode when you want to remember more.

Your records are saved on the device first. A pairing code lets you continue the same timeline on another device without an email or password account.

Use Timeline to search, filter, edit, export CSV, and revisit your history. In Together, browse public records, comments, and reactions. Create share cards for a saved record or recap, choose a feed or story format, and share the image with other apps.

You can also manage your profile, connected devices, feedback, local data, and synced server data from Settings. Recap reminders are optional local notifications that are enabled only after your explicit permission.

ottline focuses on remembering what you watched and read, not on recommendations. Keep a personal timeline that is easy to return to.

### TestFlight — What to Test

`1.0.2` adds English review coverage and configurable share cards.

- On a Korean-language device, tap `EN` in the app header to switch the native UI to English. English-language devices select English automatically.
- Search for a movie, series, or book in `Log`, select a status, and save a record.
- From the save flow, Timeline, or title detail, open `Create share card`. Try the `Feed` and `Story` formats, toggle the note, rating, and profile signature, then use `Share` or `Save image`.
- Open `Timeline` to search, filter, edit, export CSV, and create another share card.
- Open `Together` to view a public record, add a comment or reaction, and use the report action.
- Open `Settings` to review the pairing code, profile, connected devices, feedback inbox, recap reminders, local reset, and `Delete All Server Data`.

### TestFlight Beta App Review Information — Review Notes

No email address, password, or subscription is required.

The app is a native iOS app; it is not a WebView wrapper. If the reviewer is using a Korean-language device, tap `EN` in the header after launch. On an English-language device, English is selected automatically.

1. Launch ottline and open the `Log` tab.
2. Search for any movie, series, or book and select a result.
3. Choose a status and tap the save action. The first save creates an anonymous pairing-code account and stores the record locally first.
4. Optionally add a date, rating, note, platform, place, occasion, or season/episode.
5. Use `Create share card` to test feed/story formats, optional fields, sharing, and saving the image.
6. Open `Timeline` to search, filter, edit, export CSV, and share a saved record.
7. Open `Together` to view public user-generated content, add a comment or reaction, and report a post or comment.
8. Open `Settings` to issue a pairing code, manage connected devices, send feedback, enable optional recap reminders, reset local data, or delete all synced server data.

No pre-seeded review account is needed. If Apple requests a preloaded account, provide a temporary pairing code generated from a dedicated review account in App Store Connect only; never use a production user's pairing or recovery code.

### UGC, moderation, and data deletion explanation

Together contains user-generated public records, comments, and reactions. Each public record and comment has a report action that opens the Feedback flow with the target details prefilled. Reports are reviewed by the ottline operator. The Settings screen also provides a general feedback inbox.

The app provides both device-only reset and account-level server deletion. `Settings > Delete All Server Data` removes the current pairing account's synced logs, comments, feedback, analytics events, recommendation cache, and linked devices. `Settings > Reset Local` clears only the current device's local data.

The app does not read video playback content from other apps. Recap reminders are local notifications and are scheduled only after the reviewer explicitly enables them. Analytics uses native platform context for product operation and does not require an email address, contacts, location, or advertising tracking.

### Submission values to verify after upload

- App version: `1.0.2`
- Bundle ID: `app.ottline`
- ASC App ID: `6780318110`
- Build number: copy the actual processed build number shown in App Store Connect after the EAS TestFlight workflow completes. The current local iOS build baseline is `21` in `apps/native/app.json` and the EAS TestFlight profile has `autoIncrement: true`.
- Review contact: enter the operator's current App Store Connect contact details; do not put credentials or pairing codes in the repository.

## 1.0.2 한국어 TestFlight 제출 문구

아래 내용은 App Store Connect의 Korean localization과 TestFlight 심사 정보에 붙여 넣을 한국어 초안이에요. 현재 iOS `1.0.2` 후보와 공유 카드 옵션을 기준으로 작성했고, 앱 코드는 변경하지 않아요.

### App Store Connect — 한국어 메타데이터

- 앱 이름: `ottline`
- 부제: `보고 읽은 걸 가볍게 남겨요`
- 프로모션 문구: `방금 본 영화와 이어 보는 시리즈, 오래 기억하고 싶은 책을 한 곳에 남겨보세요.`
- 키워드: `영화,시리즈,책,독서,시청기록,타임라인,메모,회고,감상,기록`
- 고객 지원 URL: `https://ottline.app/feedback`
- 마케팅 URL: `https://ottline.app/about`
- 개인정보처리방침 URL: `https://ottline.app/privacy`

#### 설명

ottline은 영화, 시리즈, 책을 내 타임라인에 가볍게 남기는 기록 앱이에요.

작품을 검색하고 상태를 고른 뒤 타임라인에 저장해보세요. 날짜, 평점, 메모, 플랫폼, 장소, 상황, 시즌과 에피소드도 필요할 때 덧붙일 수 있어요.

기록은 기기에 먼저 저장돼요. 이메일이나 비밀번호 없이 시작하고, 페어링 코드로 다른 기기에서도 같은 타임라인을 이어볼 수 있어요.

타임라인에서는 기록을 검색하고, 필터링하고, 수정하고, CSV로 내려받을 수 있어요. 함께에서는 공개 기록과 댓글, 반응을 둘러볼 수 있어요. 기록이나 리포트를 피드·스토리 형식의 공유 카드로 만들어 다른 앱에 공유하거나 이미지로 저장할 수도 있어요.

설정에서는 프로필, 연결된 기기, 문의함, 로컬 데이터와 서버 데이터를 관리할 수 있어요. 회고 알림은 명시적으로 허용한 경우에만 켜지는 선택형 로컬 알림이에요.

ottline은 추천보다 기록과 회상을 먼저 생각해요. 무엇을 봤는지, 무엇을 읽었는지 편하게 쌓아두고 다시 돌아와보세요.

### TestFlight — 이번 버전에서 확인할 내용

`1.0.2`에서는 공유 카드 옵션을 세밀하게 고르고, 한국어·영어 화면을 각각 확인할 수 있어요.

- 한국어 기기에서는 헤더의 `KO`를 선택해 한국어 화면을 확인해주세요. 영어 화면은 `EN`을 선택하면 돼요.
- `기록하기`에서 영화, 시리즈, 책을 검색하고 작품을 선택해 상태를 저장해주세요.
- 저장 화면, 타임라인, 제목 상세에서 `공유 카드 만들기`를 열어 `피드`와 `스토리` 형식을 각각 확인해주세요.
- `메모 표시`, `평점 표시`, `프로필 서명 표시`를 켜고 끄면서 `공유하기`와 `이미지 저장`을 확인해주세요.
- `타임라인`에서 검색, 필터, 기록 수정, CSV 내보내기와 공유 카드를 확인해주세요.
- `함께`에서 공개 기록을 열고 댓글과 반응을 남긴 뒤 신고 흐름을 확인해주세요.
- `설정`에서 페어링 코드, 프로필, 연결된 기기, 문의함, 회고 알림, `로컬 초기화`, `서버 데이터 전체 삭제`를 확인해주세요.

### TestFlight Beta App Review Information — 심사 노트

이 앱은 이메일 주소, 비밀번호, 구독 없이 사용할 수 있어요.

ottline은 WebView 래퍼가 아닌 네이티브 iOS 앱이에요. 한국어 기기에서는 실행 후 헤더의 `KO`를 선택해주세요. 영어 화면을 확인하려면 `EN`을 선택하면 돼요.

1. 앱을 실행하고 `기록하기` 탭을 열어주세요.
2. 영화, 시리즈, 책 중 하나를 검색하고 작품을 선택해주세요.
3. 상태를 고르고 저장해주세요. 첫 기록을 저장하면 익명 페어링 코드 계정이 만들어지고 기록은 현재 기기에 먼저 저장돼요.
4. 필요하면 날짜, 평점, 메모, 플랫폼, 장소, 상황, 시즌과 에피소드를 추가해주세요.
5. `공유 카드 만들기`에서 피드·스토리 형식, 선택 항목, 공유와 이미지 저장을 확인해주세요.
6. `타임라인`에서 기록 검색, 필터, 수정, CSV 내보내기와 공유를 확인해주세요.
7. `함께`에서 공개 사용자 기록을 열고 댓글·반응·신고를 확인해주세요.
8. `설정`에서 페어링 코드, 연결된 기기, 문의함, 선택형 회고 알림, 로컬 초기화와 서버 데이터 전체 삭제를 확인해주세요.

미리 준비된 리뷰 계정은 필요하지 않아요. Apple에서 미리 입력된 기록을 요청하는 경우에는 App Store Connect에만 임시 페어링 코드를 제공해주세요. 실제 사용자 계정의 페어링 코드나 복구 코드는 사용하지 않아요.

### 이용자 콘텐츠, 운영과 데이터 삭제 안내

`함께`에는 이용자가 작성한 공개 기록, 댓글과 반응이 포함돼요. 공개 기록과 댓글에는 대상 정보가 미리 채워진 신고 기능이 있고, 접수된 신고는 ottline 운영자가 확인해요. 설정의 문의함에서는 일반 문의도 보낼 수 있어요.

앱에는 기기만 비우는 기능과 계정 단위 서버 데이터 삭제 기능이 따로 있어요. `설정 > 서버 데이터 전체 삭제`는 현재 페어링 계정의 서버 기록, 댓글, 문의, analytics 이벤트, 추천 캐시와 연결된 기기를 삭제해요. `설정 > 로컬 초기화`는 현재 기기의 로컬 데이터만 비워요.

앱은 다른 영상 앱의 재생 내용이나 화면을 읽지 않아요. 회고 알림은 심사자가 직접 허용한 경우에만 예약되는 로컬 알림이에요. 이메일, 연락처, 위치 정보나 광고 추적을 요구하지 않아요.

### 업로드 후 확인할 제출 값

- 앱 버전: `1.0.2`
- Bundle ID: `app.ottline`
- ASC App ID: `6780318110`
- 빌드 번호: EAS TestFlight workflow가 끝난 뒤 App Store Connect에서 실제 처리된 빌드 번호를 복사해주세요. 현재 `apps/native/app.json`의 로컬 iOS 빌드 기준은 `21`이고, EAS TestFlight 프로필은 `autoIncrement: true`예요.
- 심사 연락처: App Store Connect에 운영자의 최신 연락처를 입력해주세요. 계정 정보나 페어링 코드는 저장소에 넣지 않아요.

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
