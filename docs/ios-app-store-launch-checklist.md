# iOS App Store 출시 체크리스트

기준일: 2026-06-29

## 목적

- ottline iOS 네이티브 앱 App Store 정식 출시 상태와 출시 후 확인 항목을 기록한다.
- Expo 기본 아이콘이 들어간 build `1.0.0 (16)`은 출시 후보에서 제외했고, 브랜드 아이콘을 반영한 build `1.0.0 (18)`을 출시 후보로 제출했다.
- `2026-06-29` App Store 심사를 통과해 App Store에 공개됐다.

## 기준 정보

- App name: `ottline`
- Bundle ID: `app.ottline`
- Apple ID / ASC App ID: `6780318110`
- Version: `1.0.0`
- Candidate build: `18`
- EAS project id: `efe8f7e5-75d8-45a9-9a4e-88bfeba07b98`
- Previous EAS submission: `5cddc021-ab3e-412c-99cb-f687f67dde30` (build `16`, Expo 기본 아이콘 포함으로 출시 후보 제외)
- Candidate EAS submission: `a58c8aab-df08-4364-8259-64a375fcea1d`
- Candidate IPA: `apps/native/builds/direct/ottline-18.ipa`
- App Store URL: `https://apps.apple.com/app/ottline/id6780318110`
- Support URL: `https://ottline.app/feedback`
- Marketing URL: `https://ottline.app/about`
- Privacy URL: `https://ottline.app/privacy`
- SKU: `ottline-ios`
- Primary language: Korean
- Category: Lifestyle 권장, Entertainment 대안

## 1. 코드/빌드 준비

- [x] iOS QA 수정은 `native-ios-qa-parity` 브랜치에서 진행한다.
- [x] native 앱 아이콘을 Expo 기본 아이콘에서 ottline 브랜드 아이콘으로 교체한다.
- [x] build `1.0.0 (18)` IPA를 로컬 Mac EAS build로 생성한다.
- [x] build `1.0.0 (18)` IPA를 App Store Connect에 업로드한다.
- [x] IPA 내부 `CFBundleVersion = 18`을 확인한다.
- [x] `npm run native:testflight:check` 통과.
- [x] `git diff --check` 통과.
- [x] `npm run native:typecheck` 재확인.
- [x] `npm run native:test` 재확인.
- [x] `apps/native`에서 `npx expo-doctor` 재확인.
- [x] PR `#73`으로 `main`에 반영한다. (`2026-06-29`, main SHA `2ddb3bb`)

## 2. TestFlight 최종 확인

- [x] App Store Connect에서 build `1.0.0 (18)` processing 완료를 확인한다.
- [x] 내부 테스트 그룹에 build `1.0.0 (18)`이 연결됐는지 확인한다.
- [x] 실기기에서 아래 흐름을 최종 확인한다. (`2026-06-28` 사용자 확인)
- [x] 기록하기: 검색어 입력, 작품 선택, 상태 먼저 저장, 날짜 선택, 평점 칩, 메모/OTT/장소/상황.
- [x] 타임라인: 검색 입력 다크 모드 색상, 필터, 카드 공유, 함께 공개.
- [x] 제목 상세: 기록 수정 폼, 날짜 선택, 평점 칩, 히스토리.
- [x] 설정: 페어링 코드, 복구 카드, CSV 내보내기, 서버 데이터 전체 삭제 진입.
- [x] 함께: 공개 글/댓글/신고 진입.
- [x] 알림: 회고 알림 opt-in, 예약, 알림 탭 시 내 리포트 이동.

## 3. App Store Connect 입력

- [x] 앱 정보에서 SKU `ottline-ios` 입력.
- [x] 카테고리는 Lifestyle로 설정한다.
- [x] 가격은 무료로 설정한다.
- [x] 개인정보처리방침 URL `https://ottline.app/privacy` 입력.
- [x] 지원 URL `https://ottline.app/feedback` 입력.
- [x] 마케팅 URL `https://ottline.app/about` 입력.
- [x] App Privacy 라벨을 실제 동작과 맞춘다.
- [x] 콘텐츠 권리/연령 등급 설문을 실제 UGC와 외부 메타데이터 검색 범위에 맞게 작성한다.
- [x] 앱 내 계정 삭제/데이터 삭제 설명은 설정의 서버 데이터 전체 삭제 흐름과 일치시킨다.

### App Privacy 라벨 초안

App Store Connect 입력 전 실제 앱 동작과 개인정보처리방침을 다시 대조한다.

- Tracking: No.
- Contact Info: No. 문의 화면은 이메일, 이름, 전화번호를 요구하지 않는다.
- Identifiers:
  - User ID: 수집함. 앱 기능, 기기 연결, 동기화, 분석에 사용한다.
  - Device ID: 수집함. 앱 기능, 기기 연결, 동기화, 분석에 사용한다.
- User Content:
  - Other User Content: 기록, 메모, 공개 글, 댓글, 문의 제목/본문, 프로필 닉네임/아바타를 포함한다. 앱 기능 제공에 사용한다.
- Usage Data:
  - Product Interaction: `app_open`, `title_search`, `log_create`, `notification_open` 같은 앱 내 이벤트를 포함한다. 분석과 앱 기능 확인에 사용한다.
- Diagnostics: ottline 앱 코드에서 별도 수집하지 않는다. Apple/TestFlight/크래시 도구 기본 수집 항목이 있으면 ASC 입력 전에 별도 확인한다.
- Sensitive Info, Financial Info, Location, Contacts, Browsing History, Search History, Purchases: 현재 앱 코드 기준 수집하지 않는다.
- Data Deletion: 설정에서 로컬 초기화와 계정 단위 서버 데이터 전체 삭제를 분리해 제공한다.

## 4. 등록 문구 초안

### 앱 이름

ottline

### 부제

영상과 책을 가볍게 남기는 타임라인

### 프로모션 문구

방금 본 영화, 이어 보는 시리즈, 오래 기억하고 싶은 책을 한 곳에 남겨 보세요. ottline은 기록이 쌓일수록 다시 돌아보기 쉬운 개인 타임라인이 됩니다.

### 설명

ottline은 영화, 시리즈, 책을 따뜻하게 남겨두는 개인 기록장입니다.

작품을 검색하고 상태를 고른 뒤 바로 타임라인에 저장할 수 있습니다. 필요할 때 날짜, 평점, 메모, 플랫폼, 장소, 상황, 시즌과 에피소드를 덧붙이면 됩니다. 기록은 기기에 먼저 저장되고, 페어링 코드로 연결한 기기 사이에서 이어볼 수 있습니다.

타임라인에서는 내가 남긴 기록을 검색하고 다시 열어볼 수 있습니다. 함께 남긴 공개 기록과 댓글을 둘러보고, 마음에 드는 기록은 이미지 카드로 저장하거나 공유할 수 있습니다. 내 리포트에서는 최근 기록을 주간/월간으로 되돌아볼 수 있습니다.

주요 기능:
- 영화, 시리즈, 책 검색과 빠른 기록
- 상태, 날짜, 평점, 메모, 플랫폼, 장소, 상황 저장
- 시리즈 시즌/에피소드 기록
- 타임라인 검색과 CSV 내보내기
- 페어링 코드 기반 기기 연결
- 공개 기록, 댓글, 신고/문의 흐름
- 기록 및 리포트 공유 카드
- 명시적 opt-in 기반 회고 알림
- 로컬 우선 저장과 서버 데이터 전체 삭제

ottline은 추천보다 기록과 회상을 먼저 생각합니다. 무엇을 봤는지, 어디까지 봤는지, 어떤 마음이 남았는지를 편하게 쌓아두세요.

### 키워드 초안

OTT,영화,드라마,시리즈,책,독서,기록,타임라인,시청기록,리뷰,메모,회고

### 릴리스 노트

ottline iOS 첫 출시입니다. 영화, 시리즈, 책을 검색해 기록하고, 타임라인과 리포트에서 다시 돌아볼 수 있습니다. 페어링 코드로 기기를 연결하고, 공유 카드와 함께 기록도 사용할 수 있습니다.

## 5. Review Notes 초안

No email or password sign-in is required.

1. Launch the app.
2. Open the Log tab and search a movie, series, or book.
3. Select a title and choose a status to create the first local-first log.
4. Optionally add rating, date, platform, place, occasion, memo, season, or episode.
5. Open Timeline to search, filter, edit, export CSV, create a share card, or post to Together.
6. Open Account to issue a pairing code, manage profile/devices, export data, and access data deletion.

Public posts and comments are user-generated content. Each public post and comment has a report flow that opens Feedback with target details prefilled. Reports are reviewed by the operator.

The app does not read content from other video apps. Recap reminders are local notifications enabled only after explicit user opt-in.

## 6. 스크린샷 준비

촬영은 iOS Simulator의 Release 빌드로 진행한다. TestFlight IPA는 실기기용이라 simulator에 설치할 수 없으므로, 같은 코드 기준으로 simulator 빌드를 띄우고 production API에 붙여 App Store용 화면을 만든다.

권장 흐름:

1. iPhone 16 Pro Max simulator를 선택한다. Xcode에 없으면 iPhone 15 Pro Max를 사용한다.
2. 스크린샷용 계정/기기 상태를 만든다. 실제 pairing code나 민감한 테스트 데이터가 보이지 않게 한다.
3. production API 기준 Release 빌드를 실행한다.

```bash
cd apps/native
EXPO_PUBLIC_API_BASE_URL=https://ottline.app npx expo run:ios --configuration Release --device "iPhone 16 Pro Max"
```

4. simulator 메뉴의 `File > Save Screen` 또는 `xcrun simctl io booted screenshot`으로 저장한다.

```bash
mkdir -p screenshots/app-store
xcrun simctl io booted screenshot screenshots/app-store/01-log.png
```

5. App Store Connect가 더 작은 iPhone 크기 세트를 요구하면 같은 흐름으로 iPhone 8 Plus 또는 ASC에서 요구하는 simulator를 추가 촬영한다.

- [ ] iPhone large display: 기록하기 검색/상태 저장 화면.
- [ ] iPhone large display: 타임라인 카드와 검색 화면.
- [ ] iPhone large display: 제목 상세 수정 화면.
- [ ] iPhone large display: 내 리포트 또는 공유 카드 화면.
- [ ] iPhone large display: 설정/페어링 코드 화면.
- [ ] 필요 시 iPhone 6.1"/5.5" 세트도 추가한다.
- [ ] 모든 스크린샷에서 테스트 데이터, 예전 도메인, 민감한 pairing code가 노출되지 않게 한다.

## 7. 제출 순서

1. build `1.0.0 (18)` processing 완료 확인. 완료.
2. App Store Connect의 App Store 버전 `1.0.0`에 build `18` 선택. 완료.
3. 앱 정보, 가격, 개인정보, 연령 등급, 지원/마케팅/개인정보 URL 입력. 완료.
4. 스크린샷과 등록 문구 입력. 완료.
5. Review Notes 입력. 완료.
6. `Submit for Review`. 완료.
7. 심사 결과 승인 및 App Store 공개. 완료. (`2026-06-29`)

## 8. 출시 후 확인

- [x] App Store 직접 링크 접근 확인. (`2026-06-29` 사용자 확인, `https://apps.apple.com/app/ottline/id6780318110`)
- [x] `/about` 서비스 소개에 App Store 링크 production 반영 확인. (PR `#74`, main SHA `ec08179a229bc0e8b23df31d31e639651338d7f0`, production run `28379967425`, manifest commit `650a93a162e2537f4d2998f46c819edf7504a51f`, `APP_VERSION=ec08179`)
- [ ] 실제 App Store 설치본 실행 확인.
- [ ] 신규 설치 후 첫 기록 생성 확인.
- [ ] 페어링 코드로 기존 계정 연결 확인.
- [ ] production analytics에서 `platform=ios_native`, `appVersion=1.0.0`, `buildNumber=18` 유입 확인.
- [ ] 문의함/Telegram 알림으로 iOS 출시 후 문의 수신 확인.
