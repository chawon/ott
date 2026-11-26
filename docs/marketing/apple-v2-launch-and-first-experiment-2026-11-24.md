# Apple·네이티브 v2 출시 안내 초안 및 첫 유입 실험안 (2026-11-24)

- **기준일**: `2026-11-24` (`main` [`81b0a0c`](https://github.com/chawon/ott/commit/81b0a0c), Web·API 운영 [`c693fd8`](../web-api-rollout-2026-11-22.md))
- **담당 역할**: 마케팅 담당 (`플랫폼=공통`)
- **연결 카드·이슈**: [Apple·네이티브 v2 출시 안내와 첫 유입 실험안](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313863479) · 선행 기준선: [채널별 유입·첫 기록·반복 이용 기준선](acquisition-baseline-2026-11-24.md) · Web 실행 원문: [#175](https://github.com/chawon/ott/issues/175)
- **기준 문서**: [플랫폼 현황](../platforms.md) · [기능 기준표](../feature-matrix.md) · [DESIGN.md](../../DESIGN.md) · [UX 문구 가이드](../../wiki/pages/processes/ux-copy.md) · [마케팅 운영](../marketing-operations.md)

> **승인·실행 경계**: 이 문서는 **출시 안내 초안과 첫 유입 실험안**이다. 본부 검토(`2026-11-24`)에서 첫 실험으로 **후보 A**를 채택하고 Web/API 실행 원문을 **[#175](https://github.com/chawon/ott/issues/175)**(`#162` 우선 처리 후 진행)로 분리했다. **외부 커뮤니티 게시·디렉토리 등록·메일 발송·광고 집행은 실기기·공개 자산 검증과 명시적 실행 지시가 있을 때만 진행**한다.

---

## 11월 25일 배포와 측정 일정

Apple 기기별 App Store 안내를 Web `8c8b064`로 배포했다. 마케팅 담당은 **11월 26일~12월 9일(KST)**의 웹 클릭, 웹 첫 기록 완료, 스토어 최초 다운로드를 각각 집계한다. 첫 집계는 12월 10일부터 가능하다. QA 활동은 제외하고 App Store Connect 값은 표시 기준과 집계 지연을 함께 기록한다. Windows는 11월 25일 한국·미국에서 `2.0.2.0` 공개를 확인했다. [Web 배포](https://github.com/chawon/ott/actions/runs/45615659458) · [측정 업무 #175](https://github.com/chawon/ott/issues/175#issuecomment-7163045122) · [Windows 공개 근거](../../wiki/pages/platforms/ms-store.md)

## 1. 실제 공개·심사·미확인 상태 대조표 (`2026-11-24`)

공개 안내 문구의 주장은 반드시 실제 설치판 상태와 일치해야 한다. `2026-11-22`는 Apple SwiftUI `2.0.0 (27)` 최초 출시일이며, `2026-11-24` 현재 한국·미국 스토어에 공개된 버전은 **Apple `2.0.1`**, **Android `2.0.5`**, **Windows `2.0.1.0`**이다.

| 플랫폼 | 실제 공개 버전 (`2026-11-24`) | 심사·진행 중 (홍보 금지) | 공개판 실기기 미확인 (과장 금지) | 공식 링크 |
| --- | --- | --- | --- | --- |
| **Web / PWA** | 운영 `c693fd8` (Apple 안내·ChatGPT 제외·큰 화면 함께 2단·큐레이터 제거 반영) | `#162` sync `stale` outbox 수정 대기, [#175](https://github.com/chawon/ott/issues/175) Apple 이동·측정 대기 | 설치형 PWA 독립 창 업데이트·오프라인 재진입 | `https://ottline.app` (`ko`) / `https://ottline.app/en` (`en`) |
| **iPhone · iPad** | **`2.0.1` 공개** (`2026-11-24` 08:25 KST 한국·미국 스토어 확인, 제출 빌드 `28`, iOS/iPadOS `16.0+`; 큐레이터 제거·iPad 함께 2단 보강·계정 삭제 실패 처리 반영, [공개·CI 기록](https://github.com/chawon/ott/issues/163#issuecomment-7119018051)). 최초 SwiftUI `2.0.0`은 `11/22` 출시 | — | 공개 `2.0.1` 계정 삭제 실패/성공 실기기 확인([#163](https://github.com/chawon/ott/issues/163#issuecomment-7119018051)), 기존 Expo `1.0.4` → 공개 앱 업데이트 데이터 보존([312000240](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312000240)) | `https://apps.apple.com/kr/app/ottline/id6780318110` (`ko`) / `https://apps.apple.com/app/ottline/id6780318110` (`en`) |
| **macOS** | **`2.0.1` 공개** (`2026-11-24` 06:09 KST 한국·미국 스토어 확인, 제출 빌드 `28`, macOS `14.0+`, App Sandbox; **데스크톱·알림 센터 위젯 3종**, 함께 필터·정렬, 큐레이터 제거, 계정 삭제 실패 처리 반영, [공개·CI 기록](https://github.com/chawon/ott/issues/163#issuecomment-7119018051)). 최초 출시 `2.0.0`은 `11/22` | — | `ottline://quick` 기동 확인 완료; 공개 설치판의 Safari·Chrome `?native_handoff=1` 실브라우저 이어받기([313827720](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827720)) 및 `2.0.1` 계정 삭제 실패/성공([#163](https://github.com/chawon/ott/issues/163#issuecomment-7119018051)) 실기기 검증 진행 중 | `https://apps.apple.com/kr/app/id6780318110?platform=mac` (`ko`) / `https://apps.apple.com/app/id6780318110?platform=mac` (`en`) |
| **Android** | **`2.0.5` 공개 확인** (`2026-11-24` 한국·미국 Google Play 제품 정보 확인: [한국 Play](https://play.google.com/store/apps/details?id=app.ottline&hl=ko&gl=KR) · [미국 Play](https://play.google.com/store/apps/details?id=app.ottline&hl=en&gl=US)) | `#149` 첫 설치 웹 기록 가져오기 522 수정 PR `#154` 진행 중 | 공개 `2.0.5` 설치판의 태블릿 2단·기기 표기(`#147`)·업그레이드 실기기 확인 | `https://play.google.com/store/apps/details?id=app.ottline&hl=ko&gl=KR` (`ko`) / `&hl=en&gl=US` (`en`) |
| **Windows** | **`2.0.1.0` 공개** (`2026-11-23`, x64·arm64, 서버 계정 삭제 실기기 검증 완료) | **`2.0.2.0` 심사 중** (`#156`+`#168` 동기화 push 수정·함께 2단·큐레이터 제거·추천 복구) · `2.0.3.0` 후보 PR `#172` 진행 중 | 공개 `2.0.1.0`에 동기화 push 누락(`#161`) 잔존 → 수정본 공개·교차 동기화 실기기 확인 대기 | `https://apps.microsoft.com/detail/9nsvnzgdmgf5?hl=ko-kr&gl=KR` (`ko`) / `?hl=en-us&gl=US` (`en`) |
| **Chrome · Edge · Whale 확장** | Chrome `0.1.0` 공개 (소스 `0.1.1`), Edge·Whale 버전 미확인 | 원본 URL 제거·권한 축소·세 스토어 갱신 대기([312000267](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312000267)) | 스토어 설치판 → Windows/macOS 앱 연결 실기기 미확인 | `/about` 보조 도구 링크 사용 |
| **토스 인앱** | `내 OTT 타임라인` 공개판 유지 | 갱신 범위 미정 | 최신 번들·iOS/Android 실기기 흐름·사용량 미확인 | `https://minion.toss.im/XYvjpUB2` |
| **ChatGPT 앱** | **미운영** | 읽기 전용 재제출 준비 대기 | — | **공개 안내 전면 제외** |

### 공개 안내 경계 (포함 vs 보류·제외)
- **출시 기능으로 안내 가능**: Web/PWA(`c693fd8`), **iPhone·iPad·macOS `2.0.1`**(**Mac 데스크톱·알림 센터 위젯 3종 포함**), **Android `2.0.5`** 공개 사실, Windows `2.0.1.0` 공개 사실.
- **아직 보류·제외해야 할 항목**:
  - **Windows 다중 기기 동기화·함께 2단·추천 복구**: 공개 `2.0.1.0`에 `#161` 동기화 push 계약 불일치와 큐레이터 fallback이 남아 있으므로 `2.0.2.0`/`2.0.3.0` 수정본 공개·교차 동기화 실기기 확인 전까지 강조하지 않는다.
  - **Mac 브라우저 자동 이어받기·확장 자동 열기**: [313827720](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827720) 실브라우저 검증 및 Web 브리지 활성화 전까지 단정하지 않는다.
  - **Android 첫 설치 웹 기록 자동 가져오기 강조**: `#149`(PR `#154`) 해결 및 `2.0.5` 실기기 확인 전까지 과장하지 않는다.
  - **Apple 계정 삭제 오류 복구·Expo 업데이트 보존 실기기 완료 표기**: 공개 `2.0.1` 실기기 확인([#163](https://github.com/chawon/ott/issues/163#issuecomment-7119018051), [312000240](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312000240)) 전까지 실기기 검증 완료로 쓰지 않는다.
  - **ChatGPT 앱**: 미운영 채널이므로 본문·메타·외부 게시 어디에도 넣지 않는다.

---

## 2. 대상 사용자, 상황, 핵심 가치와 첫 기록 행동

[DESIGN.md](../../DESIGN.md#13-personas)와 [경쟁 리서치(#159)](../research/competitor-landscape-2026-11.md)를 결합해 초기 집중 대상을 세 그룹으로 정리한다.

| 대상 | 기록을 찾는 상황 | ottline이 실제로 주는 가치 | 목표 첫 행동 |
| --- | --- | --- | --- |
| **A. OTT 분산 시청자 (KO·EN)** | 넷플릭스·티빙·디즈니+·Apple TV 등에 시청 이력이 흩어져 방금 본 작품·이어볼 에피소드가 흐려질 때 | 가입 절차 없이 10초 만에 작품을 찾고 상태(`봤어요`/`보는 중`/`보고 싶어요`)를 고른 뒤 `기록 남기기`로 저장하고, 원할 때 `그날의 순간`(날짜·플랫폼·장소·상황)과 한 줄 메모를 덧붙이는 개인 타임라인 | 웹 또는 앱에서 방금 본 작품 1건 검색 → 상태 선택 → **`기록 남기기`**(`Keep this record`) |
| **B. 영상+책 통합 기록자 (Apple 중심 + 크로스플랫폼)** | 영화는 Letterboxd, 시리즈는 별도 앱, 책은 독서 앱으로 나뉘거나 Apple 전용 유료 트래커에 묶여 불편할 때 | 영화·시리즈·책을 같은 날짜순 타임라인에 무료·광고 없이 보관하고, Mac 데스크톱 위젯과 iPhone·iPad·웹에서 `기록 연결 코드`로 이어 보기 (CSV 내보내기 포함) | Mac/iPhone/iPad 앱 설치 또는 웹에서 영화·책 1건 기록(`기록 남기기`) → `내 공간`에서 연결 코드 확인 |
| **C. 평가·SNS 피로가 있는 조용한 기록자** | 별점 압박·팔로워 경쟁·스트릭 죄책감·광고 없이 나만의 감상을 차분히 쌓고 싶을 때 | 별점 대신 세 가지 느낌(선택), 메모 없어도 완성된 기록, 기본 비공개 + 원할 때만 `함께 나누기` 또는 `공유 카드` | 첫 기록 1건 저장(메모 비워도 완료) → 내 타임라인에서 포스터·표지 확인 |

### Voice & Tone 준수 규칙 ([DESIGN.md](../../DESIGN.md#10-voice--tone) · `.omd/preferences.md`)
- **한국어**: 따뜻하고 평이한 해요체. 용어는 `기록 남기기`, `그날의 순간`(입력), `그날의 온기`(저장된 기억), `아직 못다 한 이야기`(진행 중 패널), `함께 나누기`, `공유 카드`, `내 공간`, `기록 연결 코드`, `보관 카드`로 통일한다.
- **영어**: 짧고 개인적인 문장, sentence case(`Keep this record`, `The moment`, `My space`, `record connection code`, `recovery card`).
- **저장 동작 정확성**: 상태 선택만으로 자동 저장되지 않으므로, 첫 기록 안내에는 반드시 **상태를 고른 뒤 `기록 남기기` / `Keep this record`를 누르는 마지막 동작**을 명시한다([`QuickRecordSheet.swift:993-994`](../../apps/apple-core/Sources/OttlineCore/UI/Components/QuickRecordSheet.swift#L993-L994)).
- **금지 표현**: 회원가입 유도, 별점/평점 경쟁, 연속 기록(스트릭) 압박, FOMO/과장된 홍보 CTA, "AI 추천 피드 중심" 약속.

---

## 3. KO/EN 출시 안내·웹 전환·가이드 문구 초안

> 아래 문구는 모두 **검토용 초안**이며 `2026-11-24` 현재 실제 공개된 **Apple `2.0.1`**, **Android `2.0.5`**, **Windows `2.0.1.0`** 기준 기능만 담았다.

### 3-1. Apple v2 (macOS·iPhone·iPad `2.0.1`) 출시 안내 초안

#### 한국어 (서비스 소식 · 커뮤니티 공유 초안)
- **제목**: `ottline을 이제 Mac, iPhone, iPad 앱으로도 만나보세요`
- **요약 (1~2문장)**:
  > 영화, 시리즈, 책을 가입 없이 가볍게 남기는 개인 타임라인 **ottline**이 `11월 22일` SwiftUI `2.0.0` 최초 출시에 이어, 현재 한국·미국 App Store에 **iPhone·iPad·macOS `2.0.1`**을 공개했습니다.
- **본문 초안**:
  > 보고 읽은 작품은 넷플릭스, 티빙, 서점과 전자책 앱에 흩어져 금방 흐릿해집니다. ottline은 복잡한 가입이나 별점 압박 없이, 기억하고 싶은 작품의 기록을 차분히 모아두는 개인 기록장입니다.
  >
  > 이번 출시로 웹에서 쓰던 타임라인을 **iPhone, iPad, Mac 네이티브 앱(`2.0.1`)**에서도 그대로 이어갈 수 있어요.
  > - **가입 없이 바로 첫 기록**: 첫 화면에서 영화·시리즈·책을 찾고 상태를 고른 뒤 아래의 **‘기록 남기기’**를 누르면 기록이 먼저 내 기기에 보관돼요.
  > - **그날의 순간을 원할 때만**: 날짜, 본 곳, 함께한 사람, 세 가지 느낌과 한 줄 메모는 나중에 덧붙여도 괜찮아요.
  > - **Mac 위젯으로 가까이 두기**: Mac 데스크톱·알림 센터 위젯에서 최근 타임라인을 바로 확인하고 기록 화면을 열 수 있어요.
  > - **기기가 바뀌어도 이어 쓰기**: `내 공간`의 기록 연결 코드로 Mac, iPhone, iPad와 웹의 타임라인을 같은 흐름으로 이어가요.
  > - **공유는 선택, 백업은 자유**: 기록은 기본 비공개이며, 원할 때만 `공유 카드`로 만들거나 `함께 나누기`로 다른 사람의 이야기를 둘러볼 수 있어요. CSV 내보내기도 무료로 지원해요.
  >
  > 모든 기능은 무료이고 광고는 없습니다. 방금 본 작품이나 지금 읽고 있는 책 한 권부터 천천히 남겨보세요.
  > - 웹에서 바로 시작하기: `https://ottline.app`
  > - iPhone · iPad App Store (`2.0.1`, `iOS/iPadOS 16+`): `https://apps.apple.com/kr/app/ottline/id6780318110`
  > - Mac App Store (`2.0.1`, `macOS 14+`): `https://apps.apple.com/kr/app/id6780318110?platform=mac`
  > - *(Android Google Play `2.0.5`와 Windows Microsoft Store `2.0.1.0`에서도 이용할 수 있어요.)*

#### English (Release announcement & community post draft)
- **Title**: `ottline is now on Mac, iPhone, and iPad — a quiet timeline for movies, series, and books`
- **Summary**:
  > **ottline** — a free, local-first personal timeline for what you watch and read without signing up first — launched its SwiftUI v2 apps on November 22 and is now live at **version `2.0.1` on iPhone, iPad, and macOS** (with Mac desktop widgets included).
- **Body draft**:
  > What we watch and read ends up scattered across streaming apps, theaters, and bookshelves. ottline is built as a warm, low-pressure recordbook — no mandatory sign-up, no ads, no star-rating stress, and no noisy social feed.
  >
  > With version **`2.0.1` on iPhone, iPad, and macOS**, your timeline stays close wherever you finish a film, an episode, or a chapter:
  > - **Start without an account**: Search a movie, series, or book, choose a status (`Watched`, `Watching`, `Read`, `Reading`, or `Want to watch/read`), then tap **‘Keep this record’** below to save it locally on your device first.
  > - **Add details only when you want**: Keep dates, places, occasions, three simple feelings, or a one-line note in *The moment* — or leave a record with just a title and status.
  > - **Mac desktop widgets included**: Check your recent timeline and jump straight into recording from macOS desktop and Notification Center widgets.
  > - **Carry your timeline across devices**: Use your `record connection code` in *My space* to continue the same timeline across Mac, iPhone, iPad, and the web.
  > - **Private first, export anytime**: Records stay private unless you choose to share in *Together* or make a share card. Full CSV export is free.
  >
  > Try leaving one title that stayed with you today:
  > - Start on the web: `https://ottline.app/en`
  > - iPhone & iPad (`2.0.1`, `iOS/iPadOS 16+`): `https://apps.apple.com/app/ottline/id6780318110`
  > - Mac App Store (`2.0.1`, `macOS 14+`): `https://apps.apple.com/app/id6780318110?platform=mac`
  > - *(Also available on Google Play `2.0.5` and Microsoft Store `2.0.1.0`.)*

### 3-2. 웹→Apple 스토어 전환 UI 문구 초안 (후보 A · Web 실행 [#175](https://github.com/chawon/ott/issues/175)용)

기존 [`apps/web/messages/ko.json`](../../apps/web/messages/ko.json) 및 [`en.json`](../../apps/web/messages/en.json)의 Android·Windows 배너/저장 후 CTA 톤과 정확히 맞춘 초안이다.

| 위치 | 플랫폼 키 | 한국어 초안 | English draft |
| --- | --- | --- | --- |
| **전역 배너 제목** (`PwaInstall`) | `ios-appstore` | `iPhone·iPad 앱으로 더 가볍게 남겨요` | `Keep your timeline close on iPhone & iPad` |
| **전역 배너 설명** | `ios-appstore` | `App Store 앱에서 기록을 오프라인으로도 보관하고, 같은 타임라인을 이어가요.` | `Keep records offline in the App Store app and continue the same timeline.` |
| **전역 배너 버튼** | `ios-appstore` | `App Store에서 받기` | `Get it on the App Store` |
| **전역 배너 제목** (`PwaInstall`) | `macos-appstore` | `Mac에서도 가까이 두는 나의 타임라인` | `Keep your timeline close on Mac` |
| **전역 배너 설명** | `macos-appstore` | `Mac 데스크톱 위젯과 오프라인 보관으로 영화·시리즈·책을 가까이 두고 기록해요.` | `Keep movies, series, and books close on your Mac with desktop widgets and offline storage.` |
| **전역 배너 버튼** | `macos-appstore` | `Mac App Store에서 받기` | `Get it on the Mac App Store` |
| **저장 직후 CTA 제목** (`QuickLogCard`) | `ios-appstore` | `방금 남긴 기록, iPhone·iPad 앱에서도 이어져요.` | `Keep this record going in the iPhone & iPad app.` |
| **저장 직후 CTA 버튼** | `ios-appstore` | `App Store에서 받기` | `Get it on the App Store` |
| **저장 직후 CTA 보조 문구** | `ios-appstore` | `내 공간의 기록 연결 코드로 지금 남긴 타임라인을 그대로 이어볼 수 있어요.` | `Use your record connection code in My space to continue this timeline in the app.` |
| **저장 직후 CTA 제목** (`QuickLogCard`) | `macos-appstore` | `방금 남긴 기록, Mac 앱에서도 이어져요.` | `Keep this record going in the Mac app.` |
| **저장 직후 CTA 버튼** | `macos-appstore` | `Mac App Store에서 받기` | `Get it on the Mac App Store` |
| **저장 직후 CTA 보조 문구** | `macos-appstore` | `내 공간의 기록 연결 코드로 같은 타임라인을 Mac에서도 이어볼 수 있어요.` | `Use your record connection code in My space to continue the same timeline on your Mac.` |

### 3-3. `apps/web/public/llms.txt` 6행 갱신 초안 ([#175](https://github.com/chawon/ott/issues/175) 포함)
- **현재**: `ottline은 한국어와 영어로 제공되며 Web, 설치형 PWA, Android, iOS, Windows, 브라우저 확장, 토스 인앱에서 같은 기록 흐름을 이어갑니다.`
- **갱신 초안**: `ottline은 한국어와 영어로 제공되며 Web, 설치형 PWA, Android, iPhone·iPad(iOS/iPadOS), macOS, Windows, 브라우저 확장, 토스 인앱에서 같은 기록 흐름을 이어갑니다.`

### 3-4. 스토어 메타데이터 정합성 메모
- **App Store (iOS/iPadOS/macOS `2.0.1` 공개)**: KO `ottline: 영화·드라마·책·독서 기록` / EN `ottline: Movie, TV & Book Log`로 Microsoft Store(`2.0.1.0`)와 핵심 키워드가 정렬돼 있음.
- **macOS 위젯 반영 확인**: `2.0.1`이 `2026-11-24` 공개됐으므로, 다음 스토어 리스팅 정리 시 macOS 설명·스크린샷에 데스크톱·알림 센터 위젯 3종을 일관되게 반영할 수 있음.

---

## 4. 공개 이미지·스크린샷 감사 결과 (`2026-11-24` 직접 육안 점검)

저장소 내 공개 이미지 14종을 직접 확인한 결과, **개인정보·연결 코드·계정/기기 식별자 노출은 0건**이었으나 아래 **4건의 시각·버전 결함**이 확인되어 [#175](https://github.com/chawon/ott/issues/175) 및 후속 자산 정비 목록에 연결한다.

| 자산 경로 | 사용처 | 개인정보/코드 노출 | 육안 감사 결과 | 조치 제안 |
| --- | --- | --- | --- | --- |
| `apps/web/public/brand/v2/og-image.png` | 전 공개 페이지 OG/Twitter | 없음 | **적합** (v2 크림 배경 + 네이비/오렌지 워드마크) | 유지 |
| `apps/web/public/pwa/v2-en-desktop.png` | `SoftwareApplication` JSON-LD · `manifest.webmanifest` (EN) | 없음 | **결함 (최우선 교체)**: 본문이 회색 스켈레톤 박스 2개만 찍혀 있음 | 데이터 로드 완료 상태로 재캡처 ([#175](https://github.com/chawon/ott/issues/175)) |
| `apps/web/public/pwa/v2-ko-desktop.png` · `v2-ko-mobile.png` · `v2-en-mobile.png` | `SoftwareApplication` JSON-LD · `manifest.webmanifest` | 없음 | 첫 기록 빈 화면 정상 표시(모바일 하단 바·헤더 정상). 단, 데스크톱 KO 하단 인기 작품 영역은 잘림 | `v2-en-desktop.png` 재캡처 시 로드 완료 상태로 일괄 점검 권장 |
| `apps/web/public/guides/v2-brand-ko-home.png` · `v2-brand-en-home.png` | `/guide/ott-watch-log` (KO/EN) | 없음 | **결함**: 캡션은 "인기 작품 포스터가 보이는 모습"이나 하단 카드 4칸이 회색 스켈레톤 | 샘플 포스터 로드 완료 상태로 재캡처 권장 |
| `apps/web/public/guides/v2-brand-en-recording.png` | `/en/guide/movie-series-log` | 없음 | **경미 결함**: 영문 UI(`Inception`)에 한국어 포스터(`인셉션`) 노출 | 영문 포스터로 재캡처 권장 |
| `apps/web/public/guides/v2-brand-ko-recording.png` · `v2-brand-ko-space.png` · `v2-brand-en-space.png` | `/guide/movie-series-log`, `/guide/book-log` | 없음 (빈 계정 상태) | **적합** (연결 코드·계정 ID 비노출, v2 UI 일치) | 유지 |
| `apps/windows-native/packaging/StoreListing/screenshot-{ko,en}-1-home.png` | Microsoft Store | 없음 (샘플 작품 `패스트 라이브즈`·`세브란스`) | **우수** (따뜻한 포스터·`그날의 온기`·`아직 못다 한 이야기` 완비) | Windows 안내용 유지 (Apple 안내에는 App Store 제출용 iPhone/iPad/macOS 스크린샷 별도 사용) |
| `apps/web/public/play/screenshot-*-720x1280.png` | 미참조 잔여 파일 (`git grep` 0건) | 없음 | **구 v1 디자인** (순백 배경 + 검은 버튼 + 파란 서브타이틀) | 신규 홍보 자산으로 재사용 금지; 불필요 시 별도 정리 |

---

## 5. 첫 유입 실험안 (채택된 후보 A + 조건부 2단계 후보 B)

### 5-1. 채택된 1순위 실험 (후보 A · Web 실행 [#175](https://github.com/chawon/ott/issues/175)): 웹 방문 iPhone·iPad·macOS 사용자의 App Store 이동 및 첫 기록 측정

> **가설과 선정 이유**: [기준선](acquisition-baseline-2026-11-24.md)에서 웹 방문 대비 기록 비중이 낮고, Apple `2.0.1`이 공개된 현재도 웹이 iPhone·iPad에 PWA 추가 안내, macOS에 브라우저 PWA를 노출하고 있다. **이 공백으로 인한 실제 스토어 전환 손실 규모는 현재 콘솔 자료로 확정할 수 없는 `검증할 가설`**이며, 비용 0원·내부 배포만으로 **① 기기별 App Store 이동 증가 여부**와 **② 웹 첫 기록 흐름 비저해 여부**를 14일간 검증한다.

| 항목 | 실행 명세 |
| --- | --- |
| **대상** | `ottline.app` (`/`, `/en`, `/about`, `/guide/*`) 일반 브라우저 방문자 중 iPhone·iPad(`iOS/iPadOS`, 데스크톱 모드 `Macintosh` + `maxTouchPoints > 1` 포함) 및 macOS 사용자 *(설치형 PWA `standalone`, 인앱 WebView, iframe 제외)* |
| **메시지·노출 위치** | 1) iOS Safari 공식 Smart App Banner (`itunes: { appId: "6780318110" }`) — *사이트 자체 계측과 구분*<br>2) 전역 안내 배너 (`PwaInstallBanner`: `ios-appstore` · `macos-appstore`, 14일 재노출 제한, 기록 작성 중 숨김, 중복 배너 방지)<br>3) 첫 기록 저장 직후 CTA (`SavedNativeStoreCta`: 실제 저장 성공 뒤에만 노출, 전역 배너와 14일 쿨다운 공유)<br>4) `/about` Apple 스토어 링크에 위치별 클릭 계측 추가 + `llms.txt` macOS/iPad 반영 + `v2-en-desktop.png` 스켈레톤 교체 |
| **진입 링크·캠페인 규격** | - **캠페인 링크 확보 전(즉시 진행 가능)**: 공식 기본 링크(`localizedStoreUrls`) + 웹 자체 위치별 노출/클릭 측정으로 먼저 배포·측정한다.<br>- **App Store Connect 캠페인 링크 확인 후 적용**: Apple 담당이 App Store Connect에서 생성한 캠페인 링크(`pt` 포함)를 확인하면 고정 캠페인명(`web_global_banner`, `web_quicklog_saved`, `about_platform_card`)과 `mt=8`을 적용한다(Mac `platform=mac` 호환 검증 포함).<br>- **프라이버시 가드**: URL에 고정 캠페인명만 넣고 `pairingCode`, `userId`, `deviceId`, `recordId`, 원본 페이지 URL을 절대 포함하지 않는다. |
| **실제 지원 버전 경계** | Apple `2.0.1` 공개 기능(Mac 데스크톱·알림 센터 위젯 포함) 기준으로 안내한다. Mac 브라우저 이어받기(`?native_handoff=1`) 및 확장 자동 열기(`ottline://quick`) 활성화는 [313827720](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827720) 실기기 확인과 별도 분리한다. |
| **기준선과 측정 설계 (각각 독립 보고)** | - **배포 전 14일(KST) 기준선**: 이미 수집 중인 **웹 유입 세션 · 웹 첫 기록/기록 완료 세션**을 기준선으로 삼는다. 신규 Apple 버튼 이벤트의 배포 전 값은 **`미계측`**으로 둔다.<br>- **배포 후 완료된 14일(KST) — 3개 지표를 각각 분리 보고** *(임의 합산·환산 금지)*:<br>&nbsp;&nbsp;1. **새 Apple 버튼 노출·클릭·닫기 (배포일부터 집계)**: Web 이벤트 `ios_appstore_cta_{impression,click,dismiss}` · `macos_appstore_cta_{impression,click,dismiss}`를 위치(`global_install_banner` · `quicklog_saved` · `about_platform_card`) · 언어(`ko`/`en`) · 대상 기기별로 집계한다. **클릭률(CTR)은 같은 위치의 `클릭 / 노출`**로 계산한다. *(기존 운영 API `TrackAnalyticsEventRequest`는 `web` 이벤트명 영문 소문자·숫자·밑줄 2~64자를 허용하므로 Web 담당이 이벤트를 추가하고 API 담당이 수집·위치별 집계를 대조한다. Apple이 OS에서 그리는 Smart App Banner는 사이트 자체 노출·클릭과 구분한다.)*<br>&nbsp;&nbsp;2. **웹 첫 기록·기록 완료 세션**: 배포 전 14일과 같은 정의로 대조해 스토어 안내가 웹 첫 기록을 방해하지 않는지 확인한다.<br>&nbsp;&nbsp;3. **App Store 최초 다운로드**: App Store Connect 콘솔 값(전체 조회·최초 다운로드 및 캠페인 `ct`별 최초 다운로드)으로 별도 보고한다. [Apple 캠페인 측정 기준](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links/)에 따라 최소 **5명의 최초 다운로드**가 모여야 캠페인이 표시되므로, 표본 부족 시 0으로 단정하지 않고 **`미표시`**로 기록한다. |
| **필요 자산·비용·담당** | - **비용**: **0원**<br>- **자산**: 본 문서 3-2 KO/EN 문구 + 재캡처된 공개 이미지(`v2-en-desktop.png` 등)<br>- **담당**: Web/PWA 담당([#175](https://github.com/chawon/ott/issues/175), `#162` 우선 처리 후 진행) · API 담당(수집·위치별 집계 대조) · Apple 담당(App Store Connect 캠페인 링크 `pt` 확인) · 마케팅 담당(배포 후 14일 독립 집계·해석) |
| **성공 기준 (유지)** | 1) 위치·기기별 Apple CTA 노출·클릭이 정상 수집되고, 웹 첫 기록·기록 완료 세션이 배포 전 14일 대비 악화되지 않음<br>2) App Store Connect에서 해당 기간 최초 다운로드(및 캠페인 적용 시 `>= 5`건 귀속) 추이 확인<br>3) 닫기율 과도 악화 없음(노출 대비 즉시 닫기 `<= 80%`) 및 모바일 하단 바·기록 작성 모달 간섭 0건 |
| **중단 / 롤백 기준** | 1) iPadOS↔macOS 오분류, Safari/Chrome 링크 오류, 기록 작성 중 배너 간섭, 웹 첫 기록 세션 급감 중 하나라도 확인되면 즉시 배너 비활성화 또는 Web 이전 이미지 롤백<br>2) 14일 관찰 후 전역 배너의 클릭률이 극저조하고 닫기율만 높으면 전역 배너는 내리고 `SavedNativeStoreCta` + iOS Smart App Banner + `/about` 링크만 유지 |
| **측정 한계** | 1) App Store Connect 캠페인 리포트는 **최초 다운로드 5명 미만이면 `미표시`**, 24시간 귀속 창·재다운로드 제외·최소 24시간 지연 존재<br>2) 웹 클릭과 네이티브 앱 설치 후 첫 기록은 크로스도메인으로 1:1 연결되지 않음(웹 클릭을 설치 완료로 환산 금지; 공통 지표 정합성은 [`#169`](https://github.com/chawon/ott/issues/169) 추적)<br>3) Apple OS가 직접 그리는 Smart App Banner의 노출·클릭은 사이트 자체 이벤트로 집계되지 않음 |

### 5-2. 후속 2단계 실행 후보 (후보 B — 조건부 외부 출시 안내)

외부 채널 노출은 **실기기·공개 자산 검증과 사용자 게시 승인**을 받은 뒤 일정을 확정한다.

- **선행 게이트 (모두 충족 시 일정 확정)**:
  1. 공개 설치판 실기기 검증 확인: Apple `2.0.1` 계정 삭제 실패/성공([#163](https://github.com/chawon/ott/issues/163#issuecomment-7119018051)), Expo `1.0.4` → 공개 앱 업데이트 보존([312000240](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312000240)), Mac Safari·Chrome 이어받기([313827720](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827720))
  2. 데이터 안전성 복구([`#162`](https://github.com/chawon/ott/issues/162)) 반영
  3. [#175](https://github.com/chawon/ott/issues/175)의 깨진 공개 이미지(`v2-en-desktop.png` 등) 교체 및 `llms.txt` 갱신 완료
  4. 외부 게시에 대한 **사용자의 명시적 실행 지시**
- **1차 외부 테스트 범위 (비용 0원, 1개 커뮤니티 + 1개 영구 디렉토리)**:
  - **커뮤니티 택1**: 국내 **GeekNews Show GN** (`ko` 중심, `https://ottline.app/about?utm_source=geeknews&utm_medium=community&utm_campaign=apple_v2_launch`) 또는 글로벌 **`r/macapps`** (`en` 중심, `https://ottline.app/en/about?utm_source=reddit&utm_medium=community&utm_campaign=apple_v2_launch&utm_content=r_macapps`)
  - **영구 디렉토리 (GEO·장기 검색 자산)**: **AlternativeTo** 1건 등록 (`ottline` — 영화·시리즈·책 크로스플랫폼 대안, `https://ottline.app/en/about?utm_source=alternativeto&utm_medium=directory&utm_campaign=entity_listing`)
- **관찰 기간·판정**: 게시 후 **7일·14일 KST** 기준 자체 `acquisition` (`utm_campaign=apple_v2_launch`)의 유입 세션 → 행동 세션 → 첫 기록 세션 및 다음 주 재기록(완료 주간 코호트) 확인. 소표본 시 절대 건수와 댓글 피드백을 함께 기록.

---

## 6. 역할별 후속 연결

- **Web/PWA 담당 ([#175](https://github.com/chawon/ott/issues/175))**: `#162` 완료 후 후보 A 구현(Apple 분기·배너/저장 직후 CTA·`/about` 계측·`llms.txt`·`v2-en-desktop.png` 교체) 및 배포 근거 기록
- **API 담당**: [#175](https://github.com/chawon/ott/issues/175)의 신규 웹 이벤트 수집·위치별 집계 대조 (`#169` 공통 계측 정합성과 중복 없이 연결)
- **Apple 담당**: App Store Connect에서 캠페인 링크(`pt` 포함) 확인 및 `2.0.1` 공개 설치판 실기기 검증([#163](https://github.com/chawon/ott/issues/163#issuecomment-7119018051))
- **운영·스토어 담당**: 출처·기간·단위가 명시된 콘솔·`acquisition` 집계를 비공개 [기준선 카드](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313863452)로 회신
- **제품 기획 담당**: 기능 표현·지원 범위·용어 정합성 확인
- **마케팅 담당**: `#175` 배포 후 완료된 14일(KST) 독립 집계 보고 및 후보 B 외부 게시 게이트·일정 조율
