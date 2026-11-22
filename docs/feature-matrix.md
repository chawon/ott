# 공통 기능 기준과 플랫폼별 차이

- **1차 감사 기준일**: `2026-11-22`
- **기준 소스 / 운영 반영**: `main` [`8f6b751`](https://github.com/chawon/ott/commit/8f6b751), Web·API 통합 운영 반영 [`c693fd8`](web-api-rollout-2026-11-22.md)
- **연결 업무**: [기획 이슈 #157 (1차 감사)](https://github.com/chawon/ott/issues/157) · [기획 이슈 #158 (다음 사이클 제안)](https://github.com/chawon/ott/issues/158) · [기획 이슈 #159 (경쟁 리서치)](https://github.com/chawon/ott/issues/159)

이 문서는 목표 지원 범위와 확인된 차이를 관리한다. 앱 버전·공개 상태는 [플랫폼 현황](platforms.md), 세부 데이터 의미는 [공통 계약](product-contracts.md)을 따른다.

## 기록 방식

정책과 반영 상태를 두 축으로 기록한다.

| 축 | 값과 의미 |
| --- | --- |
| 목표 지원 범위 | **공통 필수**: 해당 기능을 지원하는 앱의 결과·데이터 의미를 맞춘다. **플랫폼 특화**: OS·입력·화면에 맞춘 확장이다. **명시적 미지원**: 해당 채널의 역할 밖이며 사유가 있다. **종료**: 제거와 이전 앱 호환을 추적한다. |
| 실제 반영 상태 | **미확인**, **대기**, **구현 중**, **PR 검증**, **병합**, **배포/심사**, **공개 확인**, **실사용 확인**. 각 값에 기준 SHA·버전·날짜 또는 근거 링크를 붙인다. |
| 차이 판정 | **허용된 차이**: 제품/플랫폼 사유가 합의됐다. **추가 반영 필요**: 공통 목표를 아직 충족하지 못했다. **확인 필요**: 근거가 부족하다. **종료 이행 중**: 이전 설치판과 호환하며 제거한다. |

`미확인`을 미지원으로 처리하지 않는다. PR 병합을 공개 출시로 처리하지 않는다. 프로젝트 카드의 네 가지 상태는 업무의 진행을 나타내며 위 반영 근거를 함께 남긴다.

## 채널별 지원 범위 기준

| 대상 | 함께 유지할 경험 | 플랫폼에 맞춰 확인할 부분 |
| --- | --- | --- |
| Web/PWA | 기록·수정 이력·계정 연결·동기화·공개 대화의 공통 의미 | 창 폭·키보드/터치, 브라우저 저장소, 설치형 PWA 캐시·재진입·오프라인 범위 |
| Android 폰·태블릿 | 같은 계정·기록·동기화·함께 동작 | 폰/태블릿·폴더블의 화면 전환, OS 권한·알림·기존 TWA 복구 |
| iPhone | 같은 계정·기록·동기화·함께 동작 | 작은 화면·OS 공유/확장과 이전 Expo 설치판 업데이트 |
| iPad | iPhone과 같은 데이터·행동 결과 | 가로/세로·Split View·2단 탐색과 선택 상태 |
| macOS | 같은 기록·연결·함께의 의미 | 큰 창·키보드·메뉴 막대·Spotlight·브라우저 이어받기 |
| Windows | 같은 기록·연결·함께의 의미 | 큰 창·키보드·스토어 패키지·브라우저/PWA 이어받기 |
| Chrome·Edge·Whale 확장 | Web/앱 빠른 기록으로 제목·플랫폼을 전달하는 보조 진입 | 브라우저 권한·패키지·기존 세 스토어 게시·설치 결과. 전체 기록 앱의 화면 집합을 요구하지 않는다. |
| 토스 인앱 | 채널 전략에 정한 검색·기록·타임라인과 연결의 핵심 흐름 | 별도 공개 번들·인앱 환경. 추가 기능은 해당 채널의 채택 범위를 먼저 정한다. |
| ChatGPT 앱 | 재개 시 기존 ottline 기록의 읽기 전용 연결 계약 | 현재 미운영 채널이다. 쓰기·전체 앱 UI는 지원 범위에 포함하지 않는다. |

상세 채널 범위는 [확장·토스·ChatGPT 전략](changes/v2-channel-strategy.md)을 따른다. Web과 PWA, Android 폰과 태블릿처럼 소스를 공유하는 대상도 설치·화면·캐시·OS 조건이 다르면 검증 근거를 나눈다.

## 기능별 공통 기준

| 기능 | 목표 범위 | 함께 유지할 의미·완료 결과 | 차이와 검증에서 확인할 것 |
| --- | --- | --- | --- |
| 1. 검색과 작품 선택 | 공통 필수 | 기존 작품·시즌·책 판본 ID를 보존하고 언어/출처 계약을 따른다. | `X-Book-Search-Capability`, TMDB/Google Books 출처 표기와 KO/EN, 이전 앱 호환 |
| 2. 기록 저장·수정·이력 | 공통 필수 | 상태·감상 시점·TPO·느낌·시즌/에피소드와 수정 이력의 의미를 맞춘다. | 폼 배치·입력 방식은 플랫폼에 맞추고 서버 이력(`GET /api/logs/{id}/history`) 포함 대조 |
| 3. 계정·기기 연결 | 공통 필수 | 같은 계정의 기록을 이어 쓰며 기존 데이터와 미동기화 변경을 보존한다. | 코드 입력·복구 카드·브라우저 이어받기(`?native_handoff=1`)·확장 브리지와 실패 후 재시도 |
| 4. 동기화·오프라인 | 공통 필수 | 로컬 우선 저장, outbox, `POST /api/sync/push`·`GET /api/sync/pull`, 중복 방지·충돌 복구 계약을 유지한다. | outbox 페이로드 일치, `stale` 거절 해소, 오프라인 사용 범위와 재접속 검증 |
| 5. 함께 목록·상세·댓글·반응 | 공통 필수(2단은 플랫폼 특화) | 선택한 이야기와 댓글·반응(`PUT /reactions`) 대상이 일치하고 저장 뒤 대화 연결(`/discussions/connection`)을 이어간다. | 작은 창은 목록→상세, 큰 창은 목록/상세 2단. 검색·필터·정렬·선택 경합·오류 상태 |
| 6. 함께 큐레이터 종료 | 종료 | 신규 질문 생성·게시를 종료하고 개인 기록·대화·댓글·보관 자료는 보존한다. | 구형 앱의 `200 []` 응답, 플랫폼별 fallback·질문 UI·죽은 API 호출 제거 |
| 7. 리포트·서가·공유·추천 | 공통 필수(OS 공유는 플랫폼 특화) | 같은 기록을 기준으로 해석하며 KDC 서가·공유 카드·내보내기·미래의 타임라인 복구 계약을 맞춘다. | 서버 리포트/KDC/추천 복구(`requestId` 유지·타임아웃), OS별 이미지 저장/공유 |
| 8. 삭제·초기화 | 공통 필수 | 사용자용 개별 기록 삭제를 제공하지 않고, 로컬 초기화와 서버 계정 전체 삭제(`DELETE /api/auth/account`)를 구분한다. | 실패 시 로컬 데이터 보존과 오류 안내(성공 토스트 오노출 금지), 설치판 검증 |
| 9. 기기 표기·계측 | 공통 필수 | 폰/태블릿/데스크톱을 구분해 표시하면서 기존 플랫폼·계정 집계 계약을 보존한다. | `X-Client-Platform`·UA 판별, `osFamily`/`deviceType` 정합성, `X-Client-Id`·`sessionId` |
| 10. 언어·접근성·상태 안내 | 공통 필수 | KO/EN, 조회 중·진짜 부재·오류·저장/전송 상태의 의미를 맞춘다. | 런타임 하드코딩 문구 부재, 접근성 속성, 키보드/터치 조작 |

---

## 플랫폼별 1차 감사 현황 (`main` `8f6b751`, `2026-11-22`)

> 정책 표기: **공통 필수**, **플랫폼 특화**, **명시적 미지원**, **종료**.
> 실제 반영 상태는 소스·PR·공개 버전·실사용 근거를 구분하며, 실기기·스토어 미검증 항목은 **미확인**으로 남긴다.

| 기능 | API (`c693fd8`) | Web / PWA (`c693fd8`) | Android 폰·태블릿 (`2.0.5` 심사 대기) | iPhone · iPad (`2.0.0` 공개) | macOS (`2.0.0` 공개) | Windows (`2.0.0.0` 공개 / `2.0.1.0` 심사 중) | 보조 채널 (확장 · 토스 · ChatGPT) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **1. 검색·선택** | **공개 확인** (TMDB·Kakao/Google Books·ISBN 보존) | **공개 확인** (Pod 검증; 출처 표기·부분 실패 안내; 설치 PWA **미확인**) | **병합/심사 대기** (`2.0.5` 소스 확인; 출처·`sourceUrl` 구현; 실기기 **미확인**) | **공개 확인** (`2.0.0` 소스·CI 확인; TMDB/Google Books 출처 포함) | **공개 확인** (`2.0.0` `apple-core` 공유) | **추가 반영 필요** (검색 동작하나 `sourceUrl` 미파싱, TMDB·Google Books 출처 표기 누락) | 확장: **플랫폼 특화**(OTT 6종 캡처) / 토스: 공개 번들 **미확인** / ChatGPT: **명시적 미지원** |
| **2. 저장·수정·이력** | **공개 확인** (**확인 필요**: `GET /logs/{id}/history` `requireActiveDevice` 미호출) | **공개 확인** (전 필드·TPO·시즌/에피소드·이력·FirstLogActivation) | **병합/심사 대기** (전 필드·TPO·시즌/에피소드·서버 이력·FirstLogActivation) | **공개 확인** (전 필드·TPO·시즌/에피소드·서버 이력·FirstLogActivation) | **공개 확인** (`apple-core` 공유·FirstLogActivation) | **추가 반영 필요** (기본/TPO·로컬 이력 지원; **시즌/에피소드 UI 미바인딩**, **서버 `GET /logs/{id}/history` 미호출**) | 확장: **플랫폼 특화**(웹 프리필) / 토스: 실번들 **미확인** / ChatGPT: **명시적 미지원**(읽기 전용) |
| **3. 계정·기기 연결** | **공개 확인** (**추가 반영 필요**: 고아 기록 귀속 `#155`, `X-User-Id` 누락 시 `200` 경계) | **공개 확인** (페어링·복구 카드·`?native_handoff=1`·Windows 확장 브리지; macOS 브리지·배너는 설치판 검증 대기) | **병합/심사 대기** (페어링·복구 카드·TWA 복구·위젯·공유; `#149` 522 별도 PR `#154`) | **공개 확인** (페어링·복구 카드·Expo 이전·위젯·공유·Siri; **Expo→2.0.0 실기기 미확인**) | **공개 확인** (페어링·복구 카드·`ottline://`·메뉴 막대·Spotlight; **Mac 스토어 이어받기 실기기 미확인**) | **실사용 확인** (`2.0.0.0` PWA→네이티브 핸드오프 확인; 위젯·트레이·단축키; 확장→앱 프리필 실기기 **미확인**) | 확장: Chrome `0.1.0` 공개(소스 `0.1.1`; Edge/Whale **미확인**; `capture_source_url`/`tabs` 미정리) / 토스: **미확인** / ChatGPT: OAuth 유지(**미운영**) |
| **4. 동기화·오프라인** | **공개 확인** (`/sync/push`·`/sync/pull`·`stale` 판정) | **추가 반영 필요** (로컬/outbox·SW `v7`·정적 오프라인 안내; **`stale` 거절 시 outbox 미제거 결함**; 설치 PWA **미확인**) | **병합/심사 대기** (Room·outbox·WorkManager·중복 병합 `#134`) | **공개 확인** (SQLite·outbox·LWW pull·충돌 처리) | **공개 확인** (`apple-core` 공유) | **추가 반영 필요 (긴급)** (`pull` 정상이나 **`POST /api/sync/push`가 API `changes` 대신 `mutations` 전송 → 서버 무음 미반영 + outbox 삭제 결함**) | 확장·ChatGPT: **명시적 미지원** / 토스: 실번들 **미확인** |
| **5. 함께·댓글·반응** | **공개 확인** (목록·상세·댓글·`PUT /reactions`·`/discussions/connection`) | **공개 확인** (`c693fd8` 2단·4상태·`/discussions/connection`; 설치 PWA·태블릿 터치 **미확인**) | **병합/심사 대기** (`2.0.5` `>=700dp` 2단·경합 안전·반응; 저장 후 `/discussions?titleId=` 호출로 `/discussions/connection` 미전환) | **공개 확인** (iPad `>=700pt` 2단·`/discussions/connection`·반응; **오류 UI 부재(`try?`) 점검 필요**) | **추가 반영 필요** (2단·`/discussions/connection`; **종류 필터·정렬 누락**, **반응 전환 레이스 가드 부재**, 오류 UI 부재) | **추가 반영 필요 (높음)** (**`POST /reactions` 계약 불일치**, **2단 미구현(그리드+모달)**, 종류 필터·`/discussions/connection` 누락) | 확장·ChatGPT: **명시적 미지원** / 토스: 실번들 **미확인** |
| **6. 함께 큐레이터 종료** | **공개 확인** (`c693fd8` `200 []`·쓰기 `410`·자동화 제거·보관 보존) | **공개 확인** (`c693fd8` UI/조회/이벤트 제거·BFF `410`; 설치 PWA **미확인**) | **병합/심사 대기** (`2.0.5` `#148` 완전 제거·회귀 테스트; Play 공개·실기기 **미확인**) | **종료 이행 중** (`2.0.0`에 UI·`GET /curated-contents` 잔존, `200 []`로 숨김; `2.0.1` 제거 대기) | **종료 이행 중** (`2.0.0`에 UI·`GET /curated-contents` 잔존, `200 []`로 숨김; `2.0.1` 제거 대기) | **추가 반영 필요 (높음)** (`[]` 수신 시 **하드코딩 큐레이터 질문 fallback 상시 노출** 회귀) | 확장·ChatGPT: **명시적 미지원** / 토스: 출시 브랜치 부재 기록, 실번들 **미확인** |
| **7. 리포트·서가·공유·추천** | **공개 확인** (리포트·KDC·추천 `requestId`/일 3회) | **공개 확인** (리포트·KDC·공유 카드·CSV·추천 복구 `#145`; 설치 PWA·운영 횟수 실측 **미확인**) | **병합/심사 대기** (리포트·KDC·공유 카드·CSV·추천 `125s` 복구) | **공개 확인** (리포트·KDC·공유 카드·CSV·추천 `90s` 복구; **실측 검증 대기**) | **공개 확인** (`apple-core` 공유·온디바이스 공유 카드) | **추가 반영 필요** (로컬 리포트·로컬 KDC·공유 카드·CSV/Netflix Import; **서버 리포트·KDC API 미연동**, **추천 `15s` 타임아웃·매번 새 `requestId`·제외 복원/카탈로그 누락**) | 확장: **명시적 미지원** / 토스: 이미지 저장·텍스트 공유(실번들 **미확인**) / ChatGPT: 읽기 전용 조회(**미운영**) |
| **8. 삭제·초기화** | **공개 확인** (개별 삭제 없음·`DELETE /api/auth/account`) | **공개 확인** (개별 삭제 없음·로컬 초기화 vs 서버 삭제 실패 보존) | **병합/심사 대기** (개별 삭제 없음·로컬 초기화 vs 서버 삭제 실패 보존; `401`/`404` 로컬 정리) | **추가 반영 필요 (높음)** (저장소는 실패 보존하나 **UI가 `try?`로 오류를 삼키고 성공 토스트·초기화 UI 노출**) | **추가 반영 필요 (높음)** (iOS와 동일 — **UI가 `try?`로 오류를 삼키고 성공 토스트 노출**) | **배포/심사** (`main` `#140` 수정 완료·`2.0.1.0` 심사 중; **공개 `2.0.0.0`은 구 경로 결함 잔존**, 실기기 **미확인**) | 확장·ChatGPT: **명시적 미지원** / 토스: **미확인** |
| **9. 기기 표기·계측** | **공개 확인** (`c693fd8` iPad/Android Tablet 판별·QA 13종 검증) | **공개 확인** (새 라벨 문자열 호환; **추가 반영 필요**: iPadOS 데스크톱 Safari `osFamily="macos"` 불일치) | **병합/심사 대기** (`2.0.5` `android_native` + Tablet UA + 계측; Play 공개·실기기 `#147` **미확인**) | **공개 확인** (`2.0.0` `(iPad; iPadOS)` UA + 계측; 실기기 `#147` **미확인**) | **공개 확인** (`2.0.0` `macos_native` + 계측; 실기기 **미확인**) | **추가 반영 필요** (`windows_native`·라벨 표시 호환; **`UA`/`windowsAppVersion` `2.0.0.0` 하드코딩**, 계측 `X-Client-Id`/`sessionId`/`locale` 누락) | 확장·토스·ChatGPT: 별도 채널 집계(토스 실측 **미확인**) |
| **10. 언어·접근성·상태** | **공개 확인** (`Accept-Language` KO/EN) | **공개 확인** (KO/EN·접근성·오류/부재 상태; 인라인 번역 혼용은 유지보수 참고) | **병합/심사 대기** (KO/EN·상태 안내·Compose semantics) | **공개 확인** (KO/EN·접근성; 함께/삭제 오류 안내 보강 필요) | **공개 확인** (KO/EN·접근성; 함께/삭제 오류 안내 보강 필요) | **추가 반영 필요** (영어 모드에서 **다수 토스트/리캡 라벨 한국어 하드코딩**, `AutomationProperties` 접근성 속성 부재) | 확장: `_locales` KO/EN / 토스: **미확인** / ChatGPT: KO/EN(**미운영**) |

---

## 차이 대장 (1차 감사 반영 · `2026-11-22`)

차이마다 **영향 사용자·기능, 목표 지원 범위, 현재 버전/근거, 허용 사유 또는 누락, 담당·관련 카드, 재검토 조건**을 기록한다.

### A. 최우선 조치 필요 (데이터 안전·계약 불일치·정책 회귀)

| 항목 | 영향 사용자·기능 | 목표 지원 범위 | 현재 버전·근거 (`main` `8f6b751`) | 차이 판정 및 사유/누락 | 담당·관련 카드 | 재검토 시점·조건 |
| --- | --- | --- | --- | --- | --- | --- |
| **Windows 동기화 Push 계약 불일치** | Windows 앱에서 기록을 작성하고 다른 기기와 동기화하는 사용자 | 공통 필수 | `apps/windows-native/.../OttlineApiClient.cs:274-327`, `OttlineRepository.cs:342-352` (`2.0.0.0` 공개·`2.0.1.0` 심사 중 모두 해당) | **추가 반영 필요 (긴급)**. `POST /api/sync/push`에 `changes: { titles, logs }` 대신 `mutations`를 전송해 서버가 무음 무시(`accepted: []`)하고 클라이언트가 outbox를 삭제하며 `synced`로 오표기함. | Windows 담당 · [#158](https://github.com/chawon/ott/issues/158) 1순위 변경안 초안 연결 | API 계약 일치 수정·통합 테스트·MS Store 후속 버전 실기기 push→타 기기 pull 확인 시 |
| **Windows 큐레이터 fallback 상시 노출** | Windows 앱 `함께` 화면 사용자 | 종료 | `MainViewModel.cs:2228-2237`, `MainWindow.xaml:2070-2129` | **추가 반영 필요 (높음)**. API `c693fd8`가 `200 []`를 반환하면 하드코딩된 `DailyPromptPayload`로 fallback해 종료된 큐레이터 질문 배너가 상시 노출됨. | Windows 담당 · [공통 종료 카드](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313278873) | fallback·배너·API 호출 제거 후 MS Store 후속판 실기기 확인 시 |
| **Windows 함께 반응 API 계약 불일치** | Windows 앱 `함께` 반응 사용자 | 공통 필수 | `OttlineApiClient.cs:604-613` vs `DiscussionController.java:141` | **추가 반영 필요 (높음)**. API는 `PUT /api/discussions/{id}/reactions` `{ type }`이나 Windows는 `POST` `{ reactionType }` 전송 및 `/reactions/me` 미조회. | Windows 담당 · [#158](https://github.com/chawon/ott/issues/158) 1순위 변경안 | `PUT`·`/reactions/me` 계약 일치 및 테스트 통과 시 |
| **Apple(iOS/iPadOS/macOS) 서버 계정 삭제 실패 UI 오류** | Apple 앱에서 서버 계정 전체 삭제 시도 중 네트워크/HTTP 오류를 겪는 사용자 | 공통 필수 | `apps/ios-native/.../MySpaceScreen.swift:1389-1397`, `apps/macos-native/.../MacMySpaceAndDialogs.swift:631-636` (`2.0.0`) | **추가 반영 필요 (높음)**. Repository는 실패 시 DB를 보존하나, UI가 `try?`로 예외를 삼켜 실패해도 UI를 비우고 `"서버 데이터를 모두 삭제했어요"` 성공 토스트를 표시함. | Apple 공통 담당 · `2.0.1` 후속 | `do/catch` 오류·재시도 안내 수정 및 모의 실패 테스트·`2.0.1` 검증 시 |
| **Web Sync `stale` 거절 시 outbox 잔류** | 여러 기기에서 같은 기록을 수정해 충돌(`stale`)이 발생한 Web/PWA 사용자 | 공통 필수 | `apps/web/lib/sync.ts:117-121,249-270`, `sync.test.mjs:236-240` (`c693fd8`) | **추가 반영 필요 (높음)**. `rejected(stale)` 수신 시 `pullChanges()`는 실행하나 해당 outbox 항목을 제거·해소하지 않아 이후 동기화마다 큐 선두에서 반복 거절 가능. | Web/PWA 담당 · [#158](https://github.com/chawon/ott/issues/158) 1순위 변경안 | `stale` 거절 항목 해소 규칙·회귀 테스트·운영 배포 확인 시 |
| **API 신규 계정 등록 고아 기록 귀속 & 이력 조회 인증 경계** | 신규 계정 등록 및 로그 이력 조회 경로 | 공통 필수 | `AuthService.java:92`([#155](https://github.com/chawon/ott/issues/155)), `LogController.java:106-114`, `AuthController.java:51,84,94,104` | **추가 반영 필요 / 확인 필요**. `#155`(고아 기록 전역 귀속 방지)는 독립 추적 중. `GET /api/logs/{id}/history`의 `requireActiveDevice` 미호출 및 `X-User-Id` 누락 시 `200` 조기 반환은 구형 앱 호환성 영향 확인 필요. | API 담당 · [#155](https://github.com/chawon/ott/issues/155) | `#155` PR/배포 완료 및 `history` 인증 경계 호환 검토 완료 시 |

### B. 1차 핵심 대조 사례 3건 및 플랫폼 정합성 공백

| 항목 | 영향 사용자·기능 | 목표 지원 범위 | 현재 버전·근거 (`main` `8f6b751`) | 차이 판정 및 사유/누락 | 담당·관련 카드 | 재검토 시점·조건 |
| --- | --- | --- | --- | --- | --- | --- |
| **함께 큐레이터 종료 (공통)** | 전 플랫폼 `함께` 사용자 | 종료 | API·Web `c693fd8` 운영 완료. Android `#148` 병합(`2.0.5` Play 심사 대기). Apple `2.0.0`은 API 호출·UI 잔존(`200 []`로 숨김). Windows는 fallback 회귀(위 A항). 토스 출시 브랜치는 부재 기록(실번들 미확인). | **종료 이행 중**. Apple `2.0.1` 정리, Windows fallback 제거, Android Play 공개·설치판 및 설치형 PWA/토스 실확인 잔여. | 관리 본부 · [공통 종료 카드](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313278873) · [Apple 제거](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313279211) | 모든 활성 바이너리에서 큐레이터 조회·UI 0건 및 실기기 확인 시 |
| **큰 화면 함께 2단 (공통)** | 태블릿·데스크톱 `함께` 사용자 | 플랫폼 특화(배치) / 공통 필수(탐색 결과) | Web `c693fd8` 운영 완료. Android `2.0.5`(`>=700dp`, 심사 대기). iPad `2.0.0` 참조 구현(오류 UI 부재). macOS `2.0.0` 2단 구현(**필터·정렬 누락, 반응 레이스 가드 부재**). Windows **2단 미구현**(2컬럼 그리드+모달, 필터 누락). | **허용된 차이(화면 폭 분기) + 추가 반영 필요(Windows 2단, macOS 필터·정렬·레이스, Apple 오류 상태)**. | 관리 본부 · [공통 2단 카드](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313284669) · [iPad 점검](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313285015) | Windows 2단·macOS/iPad 보강·Android `2.0.5` 공개·설치형 PWA 확인 시 |
| **iPad·Android 태블릿 기기 표기** | 멀티 기기 연결 기기 목록·계측 | 공통 필수 | API `c693fd8` 운영 반영(QA 13종 통과). Apple `2.0.0`·Android `2.0.5` UA 코드 일치. Web 표시 호환. **Web `analytics.ts:107,119`**: iPadOS 데스크톱 Safari가 `deviceType="tablet"` vs `osFamily="macos"`로 불일치. | **확인 필요(실앱 `#147`) + 추가 반영 필요(Web iPadOS `osFamily`, Windows UA/버전 `2.0.0.0` 하드코딩·계측 필드 누락)**. | API·각 플랫폼 담당 · [#147](https://github.com/chawon/ott/issues/147) | iPad `2.0.0`·Android `2.0.5` 실기기 `/api/auth/devices` 및 Web 계측 정합 확인 시 |
| **Windows 후속 기능 정합성 묶음** | Windows 네이티브 기록·서가·추천·영어 사용자 | 공통 필수 | `OttlineApiClient.cs`·`MainWindow.xaml`·`MainViewModel.cs`: 추천 `15s` 타임아웃/새 `requestId`/제외 복원·카탈로그 누락, 서버 리포트·KDC API·서버 이력 미연동, 시즌/에피소드 UI 미바인딩, `sourceUrl`/출처 표기 누락, 영어 모드 한국어 토스트 하드코딩, `AutomationProperties` 부재. | **추가 반영 필요**. 1순위(동기화·반응·큐레이터) 복구 직후 후속 릴리스로 단계 정렬 필요. | Windows 담당 · [#142](https://github.com/chawon/ott/issues/142) · [#158](https://github.com/chawon/ott/issues/158) | Windows `2.0.1.0` 게시 및 1순위 계약 복구 후 단계별 PR 검증 시 |
| **저장 뒤 같은 작품 이야기 연결 (`/discussions/connection`)** | 기록 저장 직후 공개 대화로 이어지는 사용자 | 공통 필수 | Web(`c693fd8`)·iOS/iPadOS/macOS(`2.0.0`) 구현 완료. Android는 `/discussions?titleId=` 조회(`QuickRecordDialog.kt:1844`, 다른 사람 댓글 존재 여부 미판별). Windows 미구현. | **추가 반영 필요**. 큐레이터 종료 후 `함께` 자생 연결의 핵심 경로. | Android·Windows 담당 · [#158](https://github.com/chawon/ott/issues/158) 3순위 후보 | Android·Windows `/discussions/connection` 전환 후 실기기 확인 시 |
| **macOS 서비스 안내 및 웹→앱 브리지** | macOS 웹/확장 방문자 | 플랫폼 특화 | Web `/about`·`/guide`의 macOS·iPhone·iPad 안내 및 ChatGPT 제외는 `c693fd8` 반영 완료. Web 글로벌 배너(`browser-pwa`)와 확장 빠른 기록 브리지(Windows 전용)는 Mac 설치판 검증 대기. | **확인 필요(실기기 검증 대기)**. Mac 스토어 설치판 이어받기 확인 후 활성화 합의됨. | macOS·Web 담당 · [Web 안내](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827749) · [Mac 설치판](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827720) | Mac App Store 설치판 Safari/Chrome 이어받기·`ottline://quick` 검증 완료 시 |
| **확장·토스·ChatGPT 채널 범위** | 보조 채널 사용자 | 플랫폼 특화 / 명시적 미지원 | 확장: 소스 `0.1.1`에 `capture_source_url`·`tabs` 권한 미정리, Chrome 공개 `0.1.0`, Edge·Whale 버전 미확인. 토스: `chore/toss-inapp-current-release-20260517` 별도 번들(실번들·사용량 미확인). ChatGPT: 미운영(응답 축소·재제출 자료 미착수). | **허용된 차이(채널 역할 분화) + 확인 필요(스토어/라이브 번들 실측)**. | 확장·토스·ChatGPT 담당 · [채널 전략](changes/v2-channel-strategy.md) | 각 채널 실기기·콘솔 확인 완료 시 |

---

## 1차 감사 미확인 목록 (본부·플랫폼 담당 검증 인계)

소스·PR·CI 확인만으로 완료 처리하지 않는 실사용·배포 확인 항목이다.

1. **Web / 설치형 PWA (`c693fd8`)**: 공개 Cloudflare 경유 브라우저 화면, 설치형 PWA 독립 창 설치·업데이트·종료/재실행·오프라인 재진입, 큰 화면 2단 창 크기 전환·태블릿 터치/확대, 추천 응답 유실 복구 및 실제 운영 OpenAI 생성 횟수 실측.
2. **Android (`2.0.5 (29)`)**: Google Play 심사 승인·공개 게시, 공개 설치판에서 태블릿 `Android Tablet App · Android` 표기(`#147`)·2단 함께·큐레이터 부재·기존 `2.0.4`/TWA 업그레이드 확인, `#149`(첫 설치 가져오기 522, PR `#154`) 검증.
3. **iOS / iPadOS (`2.0.0 (27)`)**: 기존 Expo `1.0.4 (24)` → 공개 App Store `2.0.0` 인플레이스 업데이트 데이터 보존(`312000240`), iPad/iPhone 공개판 `/api/auth/devices` 표기 및 기존 기기 ID 유지(`#147`), 미래의 타임라인 복구·`quota.used` 실측(`312248018`).
4. **macOS (`2.0.0 (27)`)**: Mac App Store 공개 설치판 Safari·Chrome `?native_handoff=1` 이어받기, 빈 세션/미동기화 로컬 기록 처리, `ottline://quick` 제목·플랫폼 전달(`313827720`), 연결 기기 표기 확인.
5. **Windows (`2.0.1.0` 심사 중)**: Microsoft Store `2.0.1.0`(`1152921505702457337`) 공개 게시 및 스토어 설치판 서버 계정 삭제(성공/실패 보존) 실기기 확인, 스토어 설치 확장 → Web → `ottline://quick` 프리필 실기기 확인.
6. **보조 채널**: Edge Add-ons·Whale Store 최신 게시 버전 및 설치판 동작, 토스 콘솔 현재 라이브 번들·iOS/Android 토스 앱 검색→저장→재진입·사용량, ChatGPT Plugins 콘솔 기존 제출 건 상태.

---

기획 담당은 차이 대장을 관리하고 본부가 담당별 반영과 공통 완료를 판정한다. 이후 감사·실기기 확인과 PR·출시 결과가 쌓이면 위 기준표와 대장의 근거를 갱신한다.
