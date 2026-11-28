# 스토어별 검색 노출 점검 및 한글 브랜드 ‘오티티라인’ ASO 보강안 (2026-11-28)

- **기준일**: `2026-11-28` (`main` [`43e2964`](https://github.com/chawon/ott/commit/43e2964), Web·API 운영 `33942ae`, Apple `2.0.1`, Android `2.0.5`, Windows `2.0.3.0`, 브라우저 확장 공개 `0.1.0` / 소스 `0.1.1`)
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
| **Edge Add-ons** | `0.1.0` *(활성 사용자 2명)* | 구 제목 노출 | 미확인 | 미확인 | 미확인 | `0.1.1` 한국어 메타데이터 미게시 상태 |
| **Whale 스토어** | `0.1.0` | 구글 색인 미노출 | 미확인 | 미확인 | 미확인 | 외부 웹 색인 미확인 (`312000267` 연계 점검 대상) |
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
| **2. Apple KR 스토어 등록정보** | App Store Connect (`id6780318110`, iOS·iPadOS·macOS `2.0.1`) | `오티티라인` 미포함 + 공개 한국어 설명에 v1 구 용어(`평점`, `페어링 코드`, 상태 선택 즉시 저장처럼 읽히는 문장) 잔존, Mac 위젯 미언급 | KR 키워드에 `오티티라인,오티티` 추가 + 한국어 상세 설명을 `DESIGN.md` v2 용어(`기록 남기기`, `세 가지 느낌`, `기록 연결 코드`, Mac 위젯 3종)로 정비 |
| **3. Google Play 등록정보** | Google Play Console (`app.ottline`, `ko-KR`) | v2 용어 대부분 반영됐으나 `오티티라인` 미포함, `기록 남기기` 저장 단계 및 `기록 연결 코드` 표현 일부 보강 필요 | 짧은 설명·상세 설명 첫 문장에 `ottline(오티티라인)` 병기 + `기록 남기기`·`기록 연결 코드` 정렬 |
| **4. Microsoft Store 스크립트** | [`publish-msstore.ps1`](../../apps/windows-native/scripts/publish-msstore.ps1#L314-L369) | `$descriptionKo`·`$keywordsKo`에 `오티티라인` 미포함, 저장 버튼 명시 약함 | `$descriptionKo` 첫 문장 `ottline(오티티라인)`·`기록 남기기` 보강, `$keywordsKo`(7개 제한) 내 `"감상 수첩"` → `"오티티라인"` 교체 |
| **5. 브라우저 확장 등록자료** | [`chrome-web-store-listing-2026-07-25.md`](../chrome-web-store-listing-2026-07-25.md#L58-L69) · [`messages.json`](../../apps/browser-extension/_locales/ko/messages.json#L1-L7) | Chrome·Edge 공개판 `0.1.0` 구 제목 유지, `0.1.1` 초안 설명에 `오티티라인` 미포함 및 구 용어 `평점` 잔존 | `0.1.1` 게시 시 한국어 설명에 `ottline(오티티라인)` 병기 및 `평점` → `세 가지 느낌` 정정 (`312000267` 연계) |
| **6. Web SEO · AI 색인** | [`seo.ts`](../../apps/web/lib/seo.ts#L74-L81) · [`llms.txt`](../../apps/web/public/llms.txt#L1-L7) | `SoftwareApplication` JSON-LD에 `alternateName` 미지정, `llms.txt`에 `ottline` 단독 표기 | `alternateName: ["오티티라인", "오티티 라인"]` 추가([`seo.test.mjs`](../../apps/web/lib/seo.test.mjs) 포함) 및 `llms.txt` 한국어 소개에 `ottline(오티티라인)` 병기 |

---

## 3. 채널별 ASO 문구·키워드 보강 초안 (`DESIGN.md` v2 정합성 준수)

> 아래 초안은 모두 [DESIGN.md](../../DESIGN.md)의 용어 기준(`기록 남기기`, `그날의 순간`, `그날의 온기`, `아직 못다 한 이야기`, `세 가지 느낌`, `함께 나누기`, `공유 카드`, `내 공간`, `기록 연결 코드`)과 실제 저장 동작([`QuickRecordSheet.swift`](../../apps/apple-core/Sources/OttlineCore/UI/Components/QuickRecordSheet.swift#L993-L994))을 기준으로 작성했습니다.

### 3-1. Apple App Store / Mac App Store (`id6780318110`, `2.0.1` 기준)

- **표시명 유지**:
  - 한국어: `ottline: 영화·드라마·책·독서 기록` *(이미 `ottline`, `영화`, `드라마`, `책`, `독서`, `기록` 색인 중)*
  - 영어: `ottline: Movie, TV & Book Log` *(이미 `ottline`, `movie`, `tv`, `book`, `log` 색인 중)*
- **한국어 키워드 필드 초안** *(App Store Connect 100자 이내, 쉼표 구분·공백 없음 — 60자)*:
  ```text
  오티티라인,오티티,시청기록,감상기록,독서노트,북로그,영화노트,시리즈,타임라인,위젯,기록장,다이어리,서가,메모
  ```
- **영문(US) 키워드 필드 초안** *(100자 이내, 손목시계 중의성이 큰 단독 `watch` 회피 — 97자)*:
  ```text
  diary,tracker,reading,journal,series,episode,watchlist,film,bookshelf,timeline,widget,notes,media
  ```
- **한국어 상세 설명 정비 초안** *(v1 구 용어 `평점`·`페어링 코드` 제거, `ottline(오티티라인)`·`기록 남기기`·`세 가지 느낌`·Mac 위젯 3종 반영)*:
  ```text
  ottline(오티티라인)은 영화, 시리즈, 책을 가입 없이 차분히 남겨두는 개인 타임라인 기록장입니다.

  작품을 검색하고 상태(봤어요·보는 중·보고 싶어요 / 읽었어요·읽는 중·읽고 싶어요)를 고른 뒤 ‘기록 남기기’를 누르면 내 기기에 먼저 보관돼요. 원할 때만 그날의 순간(날짜, 세 가지 느낌, 한 줄 메모, 플랫폼, 장소, 함께한 상황, 시리즈 시즌·회차)을 덧붙이면 되고, 메모를 비워도 온전한 기록으로 남아요.

  타임라인에서는 지난 기록을 날짜와 필터로 다시 펼쳐보고, 그날의 온기를 떠올릴 수 있어요. ‘내 공간’의 기록 연결 코드로 iPhone, iPad, Mac과 웹에서 같은 타임라인을 이어가고, 원할 때만 공유 카드를 만들거나 ‘함께 나누기’로 다른 사람의 이야기를 둘러볼 수 있어요.

  주요 기능:
  - 회원가입·로그인 없이 바로 시작하는 영화·시리즈·책 기록
  - 별점 부담 없는 세 가지 느낌(선택)과 날짜·플랫폼·장소·상황·메모 기록
  - 시리즈 시즌·회차와 이어가는 작품(‘아직 못다 한 이야기’) 관리
  - Mac 데스크톱·알림 센터 위젯 3종(소형·중형·대형) 지원
  - 타임라인 검색·필터, 내 서가 분류, CSV 내보내기
  - ‘내 공간’의 기록 연결 코드 기반 기기 연결 및 로컬 우선 저장
  - 기본 비공개 보관, 선택적 ‘함께 나누기’와 공유 카드 저장
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
    - 별점 부담 대신 ‘아쉬워요 / 볼만해요 / 최고예요’ 세 가지 느낌(선택)으로 편하게 감상을 남겨요.
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
  - *(참고: 하단 Windows 전용 기능의 연결 코드 문구는 `'내 공간'의 기록 연결 코드`로 용어를 맞추며, 교차 기기 동기화 범위는 `#161` 실기기 확인 완료 내용에 맞춥니다.)*

### 3-4. 브라우저 확장 (`Chrome · Edge · Whale`, [`chrome-web-store-listing-2026-07-25.md`](../chrome-web-store-listing-2026-07-25.md#L58-L69))

- **이름·요약 (`_locales/ko/messages.json`, 132자 제한)**: 기존 `0.1.1` 패키지 이름(`ottline - OTT 기록 도우미`)과 요약을 유지하고, 아직 미게시 상태인 `0.1.1`을 Chrome·Edge·Whale 스토어에 반영합니다([카드 `312000267`](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312000267)).
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

### 3-5. Web SEO · `llms.txt` · Apple Spotlight 코드 반영 명세

1. **Web JSON-LD ([`apps/web/lib/seo.ts`](../../apps/web/lib/seo.ts#L74-L81))**:
   - `buildSoftwareApplicationSchema` 반환 객체에 `alternateName: ["오티티라인", "오티티 라인"]` 추가 (`buildBrowserExtensionSchema`에도 한국어일 때 동일 적용 검토) 및 [`apps/web/lib/seo.test.mjs`](../../apps/web/lib/seo.test.mjs) 단언 추가.
2. **AI 색인 안내 ([`apps/web/public/llms.txt`](../../apps/web/public/llms.txt#L1-L7))**:
   - 3행 한국어 소개 문장 보강 초안:
     `> ottline(오티티라인)은 가입 없이 영상과 책 기록을 시작하고, 개인 타임라인으로 다시 돌아보는 무료 기록 서비스입니다.`
3. **Apple Spotlight 색인 ([`SpotlightIndexManager.swift`](../../apps/apple-core/Sources/OttlineCore/Notifications/SpotlightIndexManager.swift#L62-L71))**:
   - `candidates` 배열의 `"오트라인"`을 `"오티티라인"`, `"오티티 라인"`으로 교체(기존 사용자 습관 하위 호환이 필요하면 `"오티티라인"`, `"오티티 라인"`을 앞순위로 추가)하고 관련 Swift 테스트로 확인.

---

## 4. 검증 계획 및 역할별 후속 연결 ([이슈 #187](https://github.com/chawon/ott/issues/187))

| 담당 역할 | 반영 대상 | 권장 반영 시점 | 완료 근거 |
| --- | --- | --- | --- |
| **Apple 공통 담당** | App Store Connect KR/US 키워드·KR 설명 정비 + `SpotlightIndexManager.swift` | 다음 iOS/macOS 심사 제출 시(메타데이터 선반영 가능 여부 확인) | App Store 공개 설명·키워드 확인 + Apple CI 테스트 통과 |
| **Android 담당** | Google Play Console `ko-KR` 짧은 설명·상세 설명 | `2.0.6` 제출 또는 등록정보 단독 갱신 | Play 공개 페이지(`hl=ko&gl=KR`) 반영 확인 |
| **Windows 담당** | `publish-msstore.ps1` 설명·키워드(`오티티라인`) | 다음 Microsoft Store 제출 주기 | PR 병합 + 스토어 공개 반영 확인 |
| **Web/PWA 담당** | `seo.ts` `alternateName` + `seo.test.mjs` + `llms.txt` | 일반 Web 배포 주기 | PR·CI 통과 + 운영 배포 후 JSON-LD·`llms.txt` 응답 확인 |
| **브라우저 확장 담당** | `chrome-web-store-listing-2026-07-25.md` 및 `0.1.1` 스토어 게시(`312000267`) | `0.1.1` 스토어 갱신 시 | Chrome·Edge·Whale `0.1.1` 공개 확인 |
| **마케팅 담당** | 반영 3~7일 후 전 스토어 `오티티라인`·`오티티 라인`·카테고리 키워드 재점검 | 각 스토어 공개 반영 후 | 공개 검색 재측정 기록 + 각 스토어 콘솔 노출·설치 지표 분리 대조 |
