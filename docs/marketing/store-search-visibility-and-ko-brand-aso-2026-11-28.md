# 스토어별 검색 노출 점검 및 한글 브랜드 ‘오티티라인’ ASO 보강안 (2026-11-28)

- **기준일**: `2026-11-28` (`main` [`43e2964`](https://github.com/chawon/ott/commit/43e2964), Web·API 운영 `33942ae`, Apple `2.0.1`, Android `2.0.5`, Windows `2.0.3.0`, Chrome·Edge 공개 `0.1.0` / 확장 소스 `0.1.1`)
- **담당 역할**: 마케팅 담당 (`플랫폼=공통`)
- **연결 카드·이슈**: [채널별 기준선 카드 `313863452`](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313863452) · [출시 안내·실험 카드 `313863479`](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313863479) · [브라우저 확장 카드 `312000267`](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312000267) · [실행 조율 이슈 #187](https://github.com/chawon/ott/issues/187)
- **기준 문서**: [채널별 기준선 (2026-11-24)](acquisition-baseline-2026-11-24.md) · [Apple·네이티브 v2 출시 안내 및 첫 유입 실험안](apple-v2-launch-and-first-experiment-2026-11-24.md) · [플랫폼 현황](../platforms.md) · [기능 기준표](../feature-matrix.md) · [마케팅 운영](../marketing-operations.md) · [DESIGN.md](../../DESIGN.md) · [UX 문구 가이드](../../wiki/pages/processes/ux-copy.md)

> **측정·공개 경계**: 이 문서의 검색 순위는 `2026-11-28` 시점에 공개 스토어 검색 API와 웹 검색 결과에서 관찰한 **노출 위치 스냅샷**입니다. 스토어 콘솔의 실제 노출 수(Impressions)·페이지 조회·설치 건수가 아니며, 검색 순위를 설치 성과로 환산하지 않습니다. 개인화·지역·시점에 따라 변동할 수 있으며 비공개 운영 DB 수치는 포함하지 않습니다.

---

## 1. 채널별 공개 현황 및 검색 노출 실측 (`2026-11-28`)

### 1-1. 브랜드 검색어 노출 비교 (`ottline` vs `오티티라인` / `오티티 라인` vs `오트라인`)

| 채널 | 공개 버전 (`2026-11-28`) | `ottline` | `오티티라인` | `오티티 라인` | `오트라인` | 관찰 메모 |
| --- | --- | --- | --- | --- | --- | --- |
| **Google 웹 검색** | Web `33942ae` | **노출** (`ottline.app`) | **노출** (`ottline.app` 연관) | **노출** (`ottline.app` 연관) | 일부 연관 | 웹 검색엔진은 이미 `오티티라인(ottline)`으로 연관 인식 |
| **App Store (iPhone·iPad, KR/US)** | `2.0.1` (`id6780318110`) | **#1** (KR/US) | **미노출** (KR) | **미노출** (KR) | **미노출** (KR) | `오티티라인`·`오티티 라인` 검색 시 무관한 인기 앱만 반환 |
| **Mac App Store (KR/US)** | `2.0.1` (`id6780318110`) | **#1** (KR/US) | **미노출** (KR) | 확인 제한 *(API 403)* | **미노출** (KR) | `오티티라인` 검색 시 무관 앱 1건만 반환 |
| **Google Play (`ko-KR`/`en-US`)** | `2.0.5` (`app.ottline`, `50+`) | **#1** (KR/US) | **미노출** (KR) | **미노출** (KR) | **미노출** (KR) | `오티티라인` 검색 시 타사 앱(`kr.mooin.ottlounge`, `kr.mooin.ottflix`)이 대신 노출 |
| **Microsoft Store (`KR`/`US`)** | `2.0.3.0` (`9NSVNZGDMGF5`) | **#1** (KR/US) | **미노출** (KR) | **미노출** (KR) | **미노출** (KR) | 무관한 유틸리티·생산성 앱만 반환 |
| **Chrome 웹 스토어 (`ko`/`en`)** | `0.1.0` *(소스 `0.1.1`)* | **#1** | **0건** | **0건** | **0건** | 구 영문 제목(`ottline Helper`) 유지로 한글 검색 전면 미노출 |
| **Edge Add-ons** | [`0.1.0`](https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/egghbkekjopgknhggoeiekgdooofihbo?hl=ko-KR&gl=KR) | 구 제목 노출 | 미확인 | 미확인 | 미확인 | `0.1.1` 한국어 메타데이터 미게시 상태 |
| **Whale 스토어** | 공개 버전 확인 대기 | 구글 색인 미노출 | 미확인 | 미확인 | 미확인 | 외부 웹 색인 미확인 (`312000267` 연계 점검 대상) |
| **토스 인앱** | `내 OTT 타임라인` | 앱 내부 진입 | — | — | — | 독립 공개 앱스토어가 아닌 토스 앱 내부 검색·링크 경로 |

### 1-2. 비브랜드 카테고리 검색어 순위 스냅샷 (`2026-11-28`, 상위 50위 기준)

| 채널 | 언어·지역 | 상위 노출 키워드 (관찰 순위) | 50위 밖 / 미노출 키워드 | 정성 진단 |
| --- | --- | --- | --- | --- |
| **Mac App Store** | `KR` | `영화 기록` **#1** · `드라마 기록` **#1** · `OTT 기록` **#1** · `OTT 시청 기록` **#1** · `영화 드라마 기록` **#1** · `영화 책 기록` **#1** · `감상 기록` **#1** · `시청 기록` **#2** · `독서 기록` **#3** · `책 기록` **#3** | — | 현재 가장 강한 유기적 스토어 채널. 한국어 제목(`영화·드라마·책·독서 기록`)과 macOS 내 경쟁 밀도가 맞물려 핵심 의도어 1~3위 선점 |
| **Mac App Store** | `US` | `movie book log` **#1** · `ott watch log` **#12** · `movie and book tracker` **#14** · `tv tracker` **#33** | 일부 일반어는 iTunes Search API 호출 제한(`403`/`429`)으로 미집계 | 복합 의도어(`movie book log`)에서 즉시 1위 확보 |
| **App Store (iPhone·iPad)** | `KR` | `OTT 기록` **#2** · `OTT 시청 기록` **#5** · `영화 책 기록` **#10** · `영화 드라마 기록` **#11** · `시청 기록` **#13** · `감상 기록` **#18** · `영화 기록` **#19** · `드라마 기록` **#27** | `독서 기록` · `책 기록` *(50위 밖)* | OTT·영상 복합어에서는 이미 중상위권 진입. 독서 단독어 경쟁이 강해 `독서노트`·`북로그` 등 보조 키워드 보강 여지 존재 |
| **App Store (iPhone·iPad)** | `US` | `movie book log` **#18** | `movie log` · `book tracker` · `watch log` 등 *(50위 밖)* | `watch log`는 손목시계 기록 앱(`WristLog`, `Bezelio`)과 중의성 경합이 심해 `movie diary`·`tv tracker`·`reading journal` 축이 유리 |
| **Google Play** | `ko-KR` / `en-US` | 브랜드어 `ottline` **#1** | 테스트한 일반 카테고리 키워드 전반 미노출 | `50+` 다운로드 초기 단계로 설치 속도·리뷰 축적 전이며, 한글 브랜드어(`오티티라인`) 미등록으로 타사 OTT 앱에 브랜드 검색까지 내주는 상태 |
| **Microsoft Store** | `KR` / `US` | 브랜드어 `ottline` **#1** | 테스트한 일반 카테고리 키워드 전반 미노출 | 대형 앱 위주 반환 구조. `2.0.3.0` 공개 반영은 확인됐으나 키워드·설명에 `오티티라인` 부재 |
| **Chrome 웹 스토어** | `ko` / `en` | 브랜드어 `ottline` **#1** | 일반 카테고리 키워드 전반 미노출 | 공개판이 구 `0.1.0`(`ottline Helper`)에 머물러 한국어 제목·설명(`0.1.1`) 미반영 |

---

## 2. 한글 브랜드 표기 기준(`오티티라인`) 및 저장소·스토어 원인 진단

### 표기 원칙
- **공식 브랜드·로고·앱 표시명**: [DESIGN.md](../../DESIGN.md) 기준 영문 **`ottline`**을 그대로 유지합니다. UI 헤더, 워드마크, 앱 표시명을 한글로 바꾸지 않습니다.
- **표준 한글 발음·검색 표기**: 한국어에서는 `OTT`를 ‘오티티’로 읽으므로 한글 검색·색인·소개 병기 기준을 **`오티티라인`**(띄어쓰기 변형 **`오티티 라인`** 보조 색인)으로 통일합니다. 기존 일부 코드에 남아 있던 `"오트라인"`은 한글 검색 기준으로 쓰지 않습니다.
- **공개 안내 경계**: 실제 공개된 버전(Apple `2.0.1` Mac 위젯 포함, Android `2.0.5`, Windows `2.0.3.0`, Web `33942ae`) 기능만 안내하며, 미검증 항목(Mac 브라우저 자동 이어받기 `313827720`, Android 첫 설치 웹 기록 자동 가져오기 `#149`/`2.0.6` 출시 전)과 미운영 ChatGPT 앱은 포함하지 않습니다.

### 저장소·공개 스토어 6개 공백 실사 결과

| 구분 | 대상 위치 | 현재 상태 (`2026-11-28`) | 개선 필요 내용 |
| --- | --- | --- | --- |
| **1. Apple 기기 내 Spotlight** | [`SpotlightIndexManager.swift`](../../apps/apple-core/Sources/OttlineCore/Notifications/SpotlightIndexManager.swift#L69-L71) | `candidates`에 `"ottline"`, `"오트라인"`만 존재 (`"오티티라인"` 0건) | `"오티티라인"`, `"오티티 라인"` 반영(교체 또는 하위 호환 병기) 및 테스트 검증 |
| **2. Apple KR 스토어 등록정보** | App Store Connect (`id6780318110`, iOS·iPadOS·macOS `2.0.1`) | `오티티라인` 미포함 + 공개 한국어 설명에 v1 구 용어(`평점`, `페어링 코드`, 상태 선택 즉시 저장처럼 읽히는 문장) 잔존, iOS/iPadOS·macOS 위젯 범위 미구분 | KR 키워드에 `오티티라인,오티티` 포함(UTF-8 100바이트 한도) + iOS/iPadOS 설명(홈 소형·중형·잠금 화면 위젯 3종·공유 시트)과 macOS 설명(데스크톱·알림 센터 위젯 3종)을 구분해 `DESIGN.md` v2 용어(`기록 남기기`, `세 가지 느낌`, `기록 연결 코드`, `함께 나누기`/`함께`)로 정비 |
| **3. Google Play 등록정보** | Google Play Console (`app.ottline`, `ko-KR`) | v2 용어 대부분 반영됐으나 `오티티라인` 미포함, `기록 남기기` 저장 단계 및 `기록 연결 코드` 표현 일부 보강 필요 | 짧은 설명·상세 설명 첫 문장에 `ottline(오티티라인)` 병기 + `기록 남기기`·`기록 연결 코드` 정렬 |
| **4. Microsoft Store 스크립트** | [`publish-msstore.ps1`](../../apps/windows-native/scripts/publish-msstore.ps1#L314-L369) | `$descriptionKo`·`$keywordsKo`에 `오티티라인` 미포함, 저장 버튼 명시 약함 + 하단 `$featuresKo`/`$featuresEn` 및 설명에 `"3단계 느낌"`·`"8자리 연결 코드"` 잔존 | `$descriptionKo` 첫 문장 `ottline(오티티라인)`·`기록 남기기` 보강, `$keywordsKo`(7개 제한) `"감상 수첩"` → `"오티티라인"` 교체, `$featuresKo`/`$featuresEn` 용어(`세 가지 느낌`·`기록 연결 코드`) 동반 정비(`2.0.4.0` 후보 `#185`/`PR #186` 주기 연계) |
| **5. 브라우저 확장 등록자료** | [`chrome-web-store-listing-2026-07-25.md`](../chrome-web-store-listing-2026-07-25.md#L50-L84) · [`ko/messages.json`](../../apps/browser-extension/_locales/ko/messages.json#L1-L16) · [`en/messages.json`](../../apps/browser-extension/_locales/en/messages.json#L1-L16) | Chrome·Edge 공개판 `0.1.0` 구 제목 유지, `0.1.1` 초안의 KO 설명(`오티티라인` 부재·`평점` 잔존) 및 EN 요약·설명·팝업 문구(`QuickLog`, `rating`)에 v1 용어 잔존 | `0.1.1` 게시 시 KO 설명 `ottline(오티티라인)`·`세 가지 느낌` 정렬과 함께 EN 요약·설명·`_locales`의 `QuickLog`·`rating`도 동시 정비 (`312000267` 연계) |
| **6. Web SEO · AI 색인** | [`seo.ts`](../../apps/web/lib/seo.ts#L74-L168) · [`llms.txt`](../../apps/web/public/llms.txt#L1-L7) | `SoftwareApplication` JSON-LD에 `alternateName` 미지정 + `featureList`에 `"페어링 코드 동기화"`/`"Pairing-code sync"` 잔존, `buildBrowserExtensionSchema`에 `softwareVersion: "0.1.1"`·`"QuickLog"` 잔존, `llms.txt` `ottline` 단독 표기 | `alternateName: ["오티티라인", "오티티 라인"]` 추가 + `featureList` `기록 연결 코드 동기화`/`Record connection code sync`·확장 스키마 버전/`QuickLog` 정합성 동반 정비([`seo.test.mjs`](../../apps/web/lib/seo.test.mjs) 포함) 및 `llms.txt` 한국어 소개에 `ottline(오티티라인)` 병기 |

---

## 3. 채널별 ASO 문구·키워드 보강 초안 (`DESIGN.md` v2 정합성 준수)

> 아래 초안은 모두 [DESIGN.md](../../DESIGN.md)의 용어 기준(`기록 남기기`, `그날의 순간`, `그날의 온기`, `아직 못다 한 이야기`, `세 가지 느낌`, `함께 나누기`, `공유 카드`, `내 공간`, `기록 연결 코드`)과 실제 저장 동작([`QuickRecordSheet.swift`](../../apps/apple-core/Sources/OttlineCore/UI/Components/QuickRecordSheet.swift#L993-L994))을 기준으로 작성했습니다.

### 3-1. Apple App Store / Mac App Store (`id6780318110`, `2.0.1` 기준)

- **표시명 유지**:
  - 한국어: `ottline: 영화·드라마·책·독서 기록` *(이미 `ottline`, `영화`, `드라마`, `책`, `독서`, `기록` 색인 중)*
  - 영어: `ottline: Movie, TV & Book Log` *(이미 `ottline`, `movie`, `tv`, `book`, `log` 색인 중)*
- **한국어 키워드 초안**은 쉼표를 포함해 UTF-8 97바이트다. App Store Connect의 언어별 한도는 100바이트다. [Apple 등록정보 규격](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)
  ```text
  오티티라인,오티티,시청기록,감상기록,독서노트,북로그,시리즈,타임라인
  ```
- **영문(US) 키워드 초안**은 쉼표를 포함해 97바이트다. `watch`는 손목시계와 뜻이 겹쳐 단독 키워드에서 뺐다.
  ```text
  diary,tracker,reading,journal,series,episode,watchlist,film,bookshelf,timeline,widget,notes,media
  ```
- **한국어 상세 설명 정비 초안** *(App Store Connect는 iOS/iPadOS와 macOS 상세 설명이 별도 필드이므로 플랫폼별 위젯·확장 지원 범위를 구분해 반영. 실제 구현 근거: iPhone·iPad 홈 소형·중형 및 잠금 화면 위젯 3종 [`QuickLogWidget.swift`](../../apps/ios-native/Sources/OttlineWidget/QuickLogWidget.swift#L381)·공유 시트 [`ShareViewController.swift`](../../apps/ios-native/Sources/OttlineShare/ShareViewController.swift), Mac 데스크톱·알림 센터 소형·중형·대형 위젯 3종 [`QuickLogMacWidget.swift`](../../apps/macos-native/Sources/OttlineMacWidget/QuickLogMacWidget.swift#L311), 공개 동작 `‘함께 나누기’` vs 둘러보기 공간 `‘함께’` [`DESIGN.md`](../../DESIGN.md#10-voice--tone)·[`MacSecondaryPages.swift`](../../apps/macos-native/Sources/OttlineMacApp/UI/MacSecondaryPages.swift#L1767))*:
  - **iPhone · iPad (`iOS·iPadOS`) 등록정보 초안** *(대형 홈 위젯 미지원)*:
  ```text
  ottline(오티티라인)은 영화, 시리즈, 책을 가입 없이 차분히 남겨두는 개인 타임라인 기록장입니다.

  작품을 검색하고 상태(봤어요·보는 중·보고 싶어요 / 읽었어요·읽는 중·읽고 싶어요)를 고른 뒤 ‘기록 남기기’를 누르면 내 기기에 먼저 보관돼요. 원할 때만 그날의 순간(날짜, 세 가지 느낌, 한 줄 메모, 플랫폼, 장소, 함께한 상황, 시리즈 시즌·회차)을 덧붙이면 되고, 메모를 비워도 온전한 기록으로 남아요.

  타임라인에서는 지난 기록을 날짜와 필터로 다시 펼쳐보고, 그날의 온기를 떠올릴 수 있어요. ‘내 공간’의 기록 연결 코드로 iPhone, iPad, Mac과 웹에서 같은 타임라인을 이어가고, 원할 때만 공유 카드를 만들거나 ‘함께 나누기’로 내 메모를 나누고 ‘함께’에서 다른 사람의 이야기를 둘러볼 수 있어요.

  주요 기능:
  - 회원가입·로그인 없이 바로 시작하는 영화·시리즈·책 기록
  - 별점 부담 없는 세 가지 느낌(선택)과 날짜·플랫폼·장소·상황·메모 기록
  - 시리즈 시즌·회차와 이어가는 작품(‘아직 못다 한 이야기’) 관리
  - iPhone·iPad 홈 화면 위젯(소형·중형), 잠금 화면 위젯 3종 및 공유 시트 빠른 기록 지원
  - 타임라인 검색·필터, 내 서가 분류, CSV 내보내기
  - ‘내 공간’의 기록 연결 코드 기반 기기 연결 및 로컬 우선 저장
  - 기본 비공개 보관, 선택적 ‘함께 나누기’·‘함께’ 이야기 둘러보기·공유 카드 저장
  - 기기 초기화와 서버 계정 전체 삭제 분리 지원

  ottline(오티티라인)은 추천 피드보다 나의 기록과 회상을 먼저 생각합니다. 방금 본 작품이나 지금 읽고 있는 책 한 권부터 편하게 쌓아두세요.
  ```
  - **Mac (`macOS`) 등록정보 초안** *(공통 문단 동일, 위젯·단축키 불릿만 macOS 지원 범위로 교체)*:
  ```text
  ottline(오티티라인)은 영화, 시리즈, 책을 가입 없이 차분히 남겨두는 개인 타임라인 기록장입니다.

  작품을 검색하고 상태(봤어요·보는 중·보고 싶어요 / 읽었어요·읽는 중·읽고 싶어요)를 고른 뒤 ‘기록 남기기’를 누르면 내 기기에 먼저 보관돼요. 원할 때만 그날의 순간(날짜, 세 가지 느낌, 한 줄 메모, 플랫폼, 장소, 함께한 상황, 시리즈 시즌·회차)을 덧붙이면 되고, 메모를 비워도 온전한 기록으로 남아요.

  타임라인에서는 지난 기록을 날짜와 필터로 다시 펼쳐보고, 그날의 온기를 떠올릴 수 있어요. ‘내 공간’의 기록 연결 코드로 iPhone, iPad, Mac과 웹에서 같은 타임라인을 이어가고, 원할 때만 공유 카드를 만들거나 ‘함께 나누기’로 내 메모를 나누고 ‘함께’에서 다른 사람의 이야기를 둘러볼 수 있어요.

  주요 기능:
  - 회원가입·로그인 없이 바로 시작하는 영화·시리즈·책 기록
  - 별점 부담 없는 세 가지 느낌(선택)과 날짜·플랫폼·장소·상황·메모 기록
  - 시리즈 시즌·회차와 이어가는 작품(‘아직 못다 한 이야기’) 관리
  - Mac 데스크톱·알림 센터 위젯 3종(소형·중형·대형) 및 단축키(⌘N) 빠른 기록 지원
  - 타임라인 검색·필터, 내 서가 분류, CSV 내보내기
  - ‘내 공간’의 기록 연결 코드 기반 기기 연결 및 로컬 우선 저장
  - 기본 비공개 보관, 선택적 ‘함께 나누기’·‘함께’ 이야기 둘러보기·공유 카드 저장
  - 기기 초기화와 서버 계정 전체 삭제 분리 지원

  ottline(오티티라인)은 추천 피드보다 나의 기록과 회상을 먼저 생각합니다. 방금 본 작품이나 지금 읽고 있는 책 한 권부터 편하게 쌓아두세요.
  ```

### 3-2. Google Play (`app.ottline`, `ko-KR`)

- **표시명 유지**: `ottline - 영화·드라마·책·독서 기록`
- **짧은 설명 초안** *(80자 이내 — 65자)*:
  ```text
  영화·드라마·OTT 시청 기록과 책·독서 기록을 가입 없이 타임라인으로 남기는 개인 기록장 ottline(오티티라인)
  ```
- **상세 설명 보강안** *(기존 `ko-KR` 등록정보 구조를 유지하면서 `오티티라인`·`기록 남기기`·`기록 연결 코드` 정렬)*:
  ```text
  ottline(오티티라인)은 영화 기록, 드라마·시리즈 시청 기록, 책·독서 기록(독서노트)을 한 손 수첩처럼 가볍게 적어두고, 시간이 지나도 그날의 순간과 온기를 다시 꺼내볼 수 있는 개인 감상 타임라인 앱입니다.

  복잡한 회원가입이나 로그인 없이 첫 기록을 바로 시작할 수 있으며, 순수 안드로이드 네이티브 앱으로 오프라인에서도 끊김 없이 먼저 기기에 보관돼요. 여러 기기(스마트폰·태블릿·PC·웹)에서 이어 쓰고 싶을 때는 ‘내 공간’의 기록 연결 코드로 언제든 같은 타임라인을 이어볼 수 있어요.

  [주요 기능]
  • 빠른 기록 (+ 버튼 & 홈 화면 위젯)
    - 영화, 드라마, 시리즈, 책을 검색해 상태(‘봤어요 / 보는 중 / 보고 싶어요’, ‘읽었어요 / 읽는 중 / 읽고 싶어요’)를 고른 뒤 ‘기록 남기기’를 눌러 바로 보관해요.
    - 영상은 ‘아쉬워요 / 볼만해요 / 최고예요’, 책은 ‘아쉬워요 / 무난해요 / 인생책’ 중에서 느낌을 골라 남길 수 있어요.
    - 감상한 날짜, 플랫폼(OTT·극장·종이책·전자책 등), 장소, 함께한 상황, 한 줄 메모까지 그날의 순간을 원할 때만 덧붙여요.
  ```
  - *(주의: Android 첫 설치 웹 기록 자동 가져오기는 `#149` 수정본 `2.0.6`의 Play 공개 및 실기기 확인 전까지 과장하지 않습니다.)*

### 3-3. Microsoft Store (`9NSVNZGDMGF5`, [`publish-msstore.ps1`](../../apps/windows-native/scripts/publish-msstore.ps1#L314-L369))

- **표시명 유지**: KO `ottline - 영화·드라마·책·독서 기록` / EN `ottline: Movie, TV & Book Log`
- **`$keywordsKo` 보강안** *(Partner Center 최대 7개 한도 — `"감상 수첩"` → `"오티티라인"` 교체)*:
  ```powershell
  $keywordsKo = @("오티티라인", "영화 기록", "드라마 기록", "독서 기록", "시청 기록", "책 기록", "타임라인")
  ```
- **`$descriptionKo` 앞 두 문단 보강안**:
  ```text
  ottline(오티티라인)은 영화, 시리즈(드라마), 책을 조용히 기록하고 나만의 타임라인으로 모아보는 순수 Windows 데스크톱 감상 기록장입니다.

  작품을 검색해 상태(봤어요·보는 중·보고 싶어요 / 읽었어요·읽는 중·읽고 싶어요)를 고르고, 원할 때 날짜·세 가지 느낌·메모·플랫폼·장소·함께한 상황을 덧붙인 뒤 ‘기록 남기기’를 누르면 시간순 타임라인에 차곡차곡 쌓입니다. 로그인이나 회원가입 없이 설치 즉시 시작할 수 있고, 오프라인에서도 로컬 SQLite DB에 먼저 안전하게 보관됩니다.
  ```
- **하단 본문·`$featuresKo`/`$featuresEn` 잔여 구 용어 동반 정리 (`publish-msstore.ps1` L331, L337, L345, L352, L355, L365)**:
  - `$descriptionKo`(L331)·`$featuresKo`(L352, L355): `"3단계 느낌"` → **`"세 가지 느낌"`**, `"8자리 연결 코드"` → **`"‘내 공간’의 기록 연결 코드"` / `"기록 연결 코드"`**로 통일
  - `$descriptionEn`(L337, L345)·`$featuresEn`(L365): `"8-character connection code"` → **`"record connection code"`**로 통일하고 저장 안내 문구도 최종 저장 버튼 동작에 맞춤
  - 교차 기기 동기화 범위는 `#161` 실기기 확인 완료 내용에 맞추며, 현재 진행 중인 **Windows `2.0.4.0` 후보([`#185`](https://github.com/chawon/ott/issues/185) / [`PR #186`](https://github.com/chawon/ott/pull/186)) 제출 주기**와 연계해 반영을 권장합니다.

### 3-4. 브라우저 확장 (`Chrome · Edge · Whale`, [`chrome-web-store-listing-2026-07-25.md`](../chrome-web-store-listing-2026-07-25.md#L50-L84))

- **패키지 `_locales` 이름·요약 (132자 제한)**:
  - 한국어 ([`ko/messages.json`](../../apps/browser-extension/_locales/ko/messages.json#L1-L16)): 기존 `0.1.1` 이름(`ottline - OTT 기록 도우미`)과 요약(`47자`)을 유지하되, 팝업 안내(`popupDescription` L15)의 `QuickLog`를 `ottline 기록 화면`으로 함께 정비합니다.
  - 영어 ([`en/messages.json`](../../apps/browser-extension/_locales/en/messages.json#L1-L16)): 이름(`ottline - Streaming Log Helper`)은 유지하고, `extensionDescription`(L6)의 `ottline QuickLog`를 제거한 아래 요약(**102자**, 132자 제한 이내)으로 정비합니다(`popupDescription` L15의 `ottline QuickLog`도 `ottline`으로 통일).
  ```text
  Send a title from a supported streaming page to ottline, ready for you to review and keep your record.
  ```
  - 아직 미게시 상태인 `0.1.1`을 Chrome·Edge·Whale 스토어에 반영할 때 한·영 설명을 동시에 적용합니다([카드 `312000267`](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312000267)).
- **한국어 상세 설명 보강안** *(`ottline(오티티라인)` 병기 + 구 용어 `평점` → `세 가지 느낌` 정정, 개별 OTT 서비스명 미나열 규칙 유지)*:
  ```text
  웹에서 보고 있던 작품을 ottline(오티티라인) 기록 화면으로 가볍게 이어보세요.

  작품 상세 페이지에서 확장을 열면 제목과 플랫폼을 읽어 ottline 기록 화면에 미리 채웁니다. 상태와 세 가지 느낌, 메모를 확인한 뒤 ‘기록 남기기’를 눌러 직접 저장할 수 있어요.

  - 제목을 다시 입력하는 수고를 줄여요.
  - 기록은 ottline에서 확인한 뒤 직접 저장해요.
  - 자동 시청 추적이나 백그라운드 기록을 하지 않아요.
  - 현재 탭에서 필요한 정보만 읽어요.

  ottline(오티티라인)은 영화·시리즈·책 기록을 나만의 타임라인으로 모으는 기록 서비스입니다.
  ```
- **English 상세 설명 정비 초안** *(v1 구 용어 `QuickLog`·`rating` 제거, `DESIGN.md` 기준 sentence case·`record`·`feeling`·`‘Keep this record’` 정렬, 개별 OTT 서비스명 미나열 규칙 유지)*:
  ```text
  Move smoothly from the title you are watching to a new record in ottline.

  Open the extension on a supported title detail page to prefill the title and streaming service in ottline. Choose a status, add an optional feeling or note if you want, and select ‘Keep this record’ yourself.

  - Skip typing the title again.
  - Review every record in ottline before saving.
  - No automatic watch tracking or background recording.
  - Reads only the information needed from the current tab.

  ottline brings your movie, series, and book records together in a personal timeline.
  ```

### 3-5. Web SEO · `llms.txt` · Apple Spotlight 코드 반영 명세

1. **Web JSON-LD ([`apps/web/lib/seo.ts`](../../apps/web/lib/seo.ts#L74-L168))**:
   - `buildSoftwareApplicationSchema` (L74-L120):
     - `alternateName: ["오티티라인", "오티티 라인"]` 추가
     - `featureList` (L109, L116)의 `"Pairing-code sync"` / `"페어링 코드 동기화"` → **`"Record connection code sync"` / `"기록 연결 코드 동기화"`** 동반 정정
   - `buildBrowserExtensionSchema` (L122-L168):
     - 한국어 로케일에서 `alternateName` 적용 여부 검토
     - `featureList` (L157, L163)의 `"Prefill ottline QuickLog"` / `"ottline QuickLog 미리 채우기"` → **`"Prefill the ottline record form"` / `"ottline 기록 화면 미리 채우기"`** 정정
     - `softwareVersion` (L148 `"0.1.1"` vs 현재 Chrome·Edge 공개 `0.1.0`): 실제 공개 버전과 어긋나지 않도록 `0.1.1` 스토어 게시 시점과 맞추거나 현재 공개 버전 정합성 확인
   - 위 변경에 맞춰 [`apps/web/lib/seo.test.mjs`](../../apps/web/lib/seo.test.mjs) 단언을 함께 갱신.
2. **AI 색인 안내 ([`apps/web/public/llms.txt`](../../apps/web/public/llms.txt#L1-L7))**:
   - 3행 한국어 소개 문장 보강 초안:
     `> ottline(오티티라인)은 가입 없이 영상과 책 기록을 시작하고, 개인 타임라인으로 다시 돌아보는 무료 기록 서비스입니다.`
3. **Apple Spotlight 색인 ([`SpotlightIndexManager.swift`](../../apps/apple-core/Sources/OttlineCore/Notifications/SpotlightIndexManager.swift#L62-L71))**:
   - `candidates` 배열의 `"오트라인"`을 `"오티티라인"`, `"오티티 라인"`으로 교체(기존 사용자 습관 하위 호환이 필요하면 `"오티티라인"`, `"오티티 라인"`을 앞순위로 추가)하고 관련 Swift 테스트로 확인.

---

## 4. 검증 계획 및 역할별 후속 연결 ([이슈 #187](https://github.com/chawon/ott/issues/187))

[제품 기획 검토 PR #188](https://github.com/chawon/ott/pull/188)에서 문구와 공개 기능을 대조한 뒤 아래 담당이 각 채널의 일정에 반영한다.

| 담당 역할 | 반영 대상 | 권장 반영 시점 | 완료 근거 |
| --- | --- | --- | --- |
| [Apple 공통 담당](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=321363868) | App Store Connect KR/US 키워드(각 100바이트 이내)·iOS/iPadOS와 macOS 분리 KR 설명(`함께 나누기`/`함께`·플랫폼별 위젯 구분), Spotlight 별칭 | 다음 iOS/macOS 제출 준비 | App Store Connect에 저장한 키워드, iOS/macOS 공개 페이지 설명, Spotlight 테스트와 기기 내 검색 결과 확인 |
| [Android 담당](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=321363874) | Google Play Console `ko-KR` 짧은 설명·상세 설명 | `2.0.6` 제출 또는 등록정보 단독 갱신 | Play 공개 페이지(`hl=ko&gl=KR`) 반영 확인 |
| [Windows 담당](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=321363878) | `publish-msstore.ps1` 설명·`$featuresKo`/`$featuresEn` 용어 정비·키워드(`오티티라인`) | Windows `2.0.4.0` 후보([`#185`](https://github.com/chawon/ott/issues/185) / [`PR #186`](https://github.com/chawon/ott/pull/186)) 제출 주기 | PR 병합 + 스토어 공개 반영 확인 |
| [Web/PWA 담당](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=321363881) | `seo.ts` `alternateName`·`featureList`·`buildBrowserExtensionSchema` 정합성 + `seo.test.mjs` + `llms.txt` | 일반 Web 배포 주기 | PR·CI 통과 + 운영 배포 후 JSON-LD·`llms.txt` 응답 확인 |
| [브라우저 확장 담당](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312000267) | `chrome-web-store-listing-2026-07-25.md`·`_locales/{ko,en}/messages.json` 한·영 구 용어(`평점`·`QuickLog`·`rating`) 정비 및 `0.1.1` 스토어 게시 | `0.1.1` 스토어 갱신 시 | Chrome·Edge·Whale `0.1.1` 한·영 등록정보 공개 확인 |
| **마케팅 담당** | 반영 3~7일 후 조사 대상 스토어 `오티티라인`·`오티티 라인`·카테고리 키워드 재점검 | 각 스토어 공개 반영 후 | 공개 검색 재측정 기록 + 각 스토어 콘솔 노출·설치 지표 분리 대조 |
