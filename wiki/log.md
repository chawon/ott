# Wiki Log

## 2026-11-25 Web 동기화·Apple 스토어 안내 배포와 Windows 공개판 확인

Web `8c8b064` 배포 후 기존 Chromium 설치 PWA를 다시 열었다. 구버전에서 준비한 별도 프로필의 기록과 이력을 확인했다. 미등록 합성 계정의 대기열은 배포 전후 연속성을 판정할 수 없어 담당 이슈에 검증 한계를 남겼다. 설치 프로필의 복사본과 운영 QA 계정의 두 기기로 충돌 후 후속 기록이 한 번 전송되고, 재시작 뒤 기록 2건과 빈 대기열이 유지됨을 확인했다. API는 `1dc6825`였고 두 Pod는 각 1/1 Ready, 재시작 0회였다. iPhone 환경을 모사한 Chromium에서 한국어 웹의 첫 기록을 저장하고 Apple 스토어 안내를 눌렀다. 노출·클릭을 운영 DB에서 확인했다. 실제 Apple 기기에서 스토어 전환과 마케팅 14일 집계를 이어간다. [Web 배포](https://github.com/chawon/ott/actions/runs/45615659458) · [동기화 인수](https://github.com/chawon/ott/issues/162#issuecomment-7162996402) · [스토어 안내 검증](https://github.com/chawon/ott/issues/175#issuecomment-7163045122)

한국·미국 Microsoft Store에서 x64·arm64 `2.0.2.0` 공개를 확인해 이전 심사 상태를 갱신했다. 후속 `2.0.3.0`은 코드 병합·CI까지 완료했다. Android 공개판은 `2.0.5`이며 `2.0.6` 후보의 이어받기 완료 판정은 Android 담당이 보완한다. 달력·회상 카드 기획을 인수했고 제품 착수는 남은 안전성 검증 후 본부가 결정한다. [Windows 공개 근거](pages/platforms/ms-store.md) · [Android 검토](https://github.com/chawon/ott/pull/154#pullrequestreview-6057872444) · [달력 기획](https://github.com/chawon/ott/issues/176#issuecomment-7162885089) · [본부 착수 조건](https://github.com/chawon/ott/issues/158#issuecomment-7162888057)

## 2026-11-25 공통 API에서 페어링 기기의 과거 기록 수신 복구

API `1dc6825`와 Flyway V33을 배포했다. 공개 API에서 배포 전 증분 조회가 놓친 기록을 같은 기기가 다음 동기화로 받았고, 과거 편집과 최신 편집이 동시에 도착해도 최신 메모가 남는 것을 확인했다. [PR #183](https://github.com/chawon/ott/pull/183) · [운영 배포](https://github.com/chawon/ott/actions/runs/45613732985) · [검증 기록](../docs/changes/api-sync-delivery-171-2026-11-25.md)

## [2026-11-24] Mac·iPhone·iPad App Store `2.0.1` 공개

한국·미국의 플랫폼별 스토어에서 Mac 06:09 KST, iPhone·iPad 08:25 KST 버전 기록을 확인했다. PR #173 병합본 `5567dd5`의 Mac 테스트 6개와 iOS 테스트 20개가 통과했다. 스토어에 제출한 빌드는 `28`이다. [한국 Mac](https://apps.apple.com/kr/app/id6780318110?platform=mac) · [미국 iPad](https://apps.apple.com/us/app/id6780318110?platform=ipad) · [출시·CI 근거](https://github.com/chawon/ott/issues/163#issuecomment-7119018051)

공개 설치판의 계정 삭제 실패·재시도·성공과 Safari·Chrome에서 Mac으로 기존 기록을 이어받는 흐름은 담당 카드에서 계속 검증한다. [삭제 검증 #163](https://github.com/chawon/ott/issues/163#issuecomment-7119018051) · [Mac 설치판 검증](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827720) · [Apple 후속 작업](../docs/changes/v2-follow-up.md#2-apple-v2-업데이트-검증)

## [2026-11-23] release(apple): PR #173 병합 및 iOS·macOS `2.0.1 (28)` App Store 심사 제출

- [PR #173](https://github.com/chawon/ott/pull/173)을 `main` `5567dd5`(코드 `49e62c3`)에 병합했다.
- 주요 반영: 서버 계정 삭제 실패 시 로컬·연결·화면 상태 보존 및 KO/EN 오류/재시도 안내([#163](https://github.com/chawon/ott/issues/163)), 함께 AI 큐레이터 UI·조회 전면 제거(카드 `313279211`, 구 Expo 미탑재 확인), iPad 함께 2단↔Split View 연속성·직접 링크·오류/재시도·반응 레이스 가드 및 macOS 함께 종류 필터/정렬/레이스 가드 보강(카드 `313285015`), **macOS 데스크톱 위젯(`OttlineMacWidgetExtension`, `3Z9ULN66D4.group.app.ottline`, Small/Medium/Large)** 추가.
- 검증·CI·제출: `OttlineTests` **20/20**, `OttlineMacTests` **6/6**, PR [iOS CI `45183376281`](https://github.com/chawon/ott/actions/runs/45183376281)·[macOS CI `45183376159`](https://github.com/chawon/ott/actions/runs/45183376159) 및 `main` [macOS CI `45190943508`](https://github.com/chawon/ott/actions/runs/45190943508) 통과, `macOS 15.8.3` 실기기 데스크톱 위젯 갤러리 등록·렌더링 사용자 검수 통과, 운영 API 격리 계정 실측(`GET /api/curated-contents` `200 []`, `#147` `iPad App/iPadOS`·`macOS App/macOS`, `#142` `quota.used 0→1` 및 동일 `requestId` 멱등 재시도 `1→1`, `DELETE /api/auth/account` `200` 정리) 완료, Mac App Store `2.0.0 (27)` 설치판 `ottline://quick` 프로토콜 확인 완료. Release **`2.0.1 (28)`** iOS(`OttlineApp.ipa`)·macOS(`ottline.pkg`) 모두 App Store Connect 업로드 및 **심사 제출 완료**(`2026-11-23 23:22 KST`, `Waiting for Review`).
- 남은 확인: iOS·macOS `2.0.1 (28)` 심사 승인·공개 후 실기기 확인(`#163`·큐레이터 제거·iPad 2단·Expo 업데이트·Safari/Chrome `?native_handoff=1`). [플랫폼 현황](../docs/platforms.md) · [후속 작업](../docs/changes/v2-follow-up.md#ios--ipados--macos-201-28-후속-통합-반영-2026-11-23) · [iOS Wiki](pages/platforms/native.md) · [macOS Wiki](pages/platforms/macos-native.md)

## [2026-11-23] Windows 구버전 감상 기록 삭제 반영 검증

`2.0.2.0` 심사 제출 후 본부가 구버전 기록 ID에서 삭제 반영 누락을 재현해 Windows 담당의 #161을 진행으로 되돌렸다. [검증 결과](https://github.com/chawon/ott/issues/161#issuecomment-7092864246) · [Windows 후속 작업](../docs/changes/v2-follow-up.md#windows-후속-기능-통합-반영-2026-11-22-차기-v2020-후보)

후속 `2.0.3.0` 후보 `d23a56c`에서 기존 재현은 통과했다. 삭제 반영 직전의 최신 편집이 서버에 전송되지 않는 사례를 확인해 Windows 담당에게 보완을 요청했다. [PR #172 검토](https://github.com/chawon/ott/pull/172#pullrequestreview-6018306106)

## [2026-11-23] release(windows): PR #168 병합 및 Microsoft Store `v2.0.2.0` 심사 제출 (`Certification`)

- [PR #168](https://github.com/chawon/ott/pull/168)([#161](https://github.com/chawon/ott/issues/161))을 `main` `fa09d2e`(코드 `be854a4`)로 병합하고 `main` `Native Windows CI`([`45116276550`](https://github.com/chawon/ott/actions/runs/45116276550), `1m28s`, `Ottline.Tests` **59/59**) 통과를 확인했다.
- PR #156(추천 60초 복구·큐레이터 제거·함께 2단/`PUT /reactions`·공통 5종 풋터/안내) + PR #168(동기화 push 계약·구버전 1회 원자적 복구·`stale` 풀 확인 해소·`logs.deleted_at` 소프트 삭제·계측/버전 정합) 통합본 `ottline-2.0.2.0.msixbundle`(`x64` `81.50 MB` + `arm64` `77.56 MB`, 총 `159.06 MB`, SHA-256 `C4622C9CEE02D199B2FA835B1C5199E5BC0DEC7A36E8721568B75787626DD24A`)을 Partner Center `9NSVNZGDMGF5`에 제출했다(Submission ID **`1152921505702478292`**, 상태 **`Certification`**, `Errors: 0`, `Desktop` 전용).
- Project 카드 `#161`을 **`검증`**으로 이동했다. 남은 확인은 `v2.0.2.0` 공개 게시 확인 및 공개 Store 설치판 실기기 교차 동기화 검증이다. [Windows Wiki](pages/platforms/windows-native.md) · [스토어 근거](pages/platforms/ms-store.md) · [후속 작업](../docs/changes/v2-follow-up.md#windows-후속-기능-통합-반영-2026-11-22-차기-v2020-후보)

## [2026-11-23] verify(windows): Store 공개판 `2.0.1.0` 계정 삭제 실기기 검증 완료 및 PR #168 동기화 복구 보완(`be854a4`)

- Microsoft Store 공개 설치판 `ChawonLee.ottline_2.0.1.0_arm64__ry7416pek43sa`에서 [PR #140](https://github.com/chawon/ott/pull/140)의 온라인 `서버 데이터 전체 삭제` 성공 로컬 초기화 및 오프라인 실패 시 로컬 기록·연결 상태 보존 실기기 검증을 완료했다. Project 카드(`Windows 계정 삭제 요청과 실패 처리 수정`)를 **`완료`**로 전환했다. [삭제 정책](pages/features/delete-sync.md#windows-확인-사항) · [스토어 근거](pages/platforms/ms-store.md) · [후속 작업](../docs/changes/v2-follow-up.md#1-windows-서버-계정-삭제-수정)
- 차기 `2.0.2.0` 후보 [PR #168](https://github.com/chawon/ott/pull/168) (`fix/windows-sync-push-contract`, HEAD `be854a4`)에 본부 재검토 2건(복구 중 종료 단일 트랜잭션 원자화·고아 행 자가 복구, `logs.deleted_at` 소프트 삭제 반영 및 이력·동시 수정·재기록 보존)을 반영해 `Ottline.Tests` **59/59**, 운영 API 임시 계정 실검증 **7/7**, `Native Windows CI`([`45114305364`](https://github.com/chawon/ott/actions/runs/45114305364))를 통과하고 본부 재검토를 회신했다.

## [2026-11-23] Windows 네이티브 앱 2.0.1.0 공개

한국·미국 Microsoft Store에서 `2.0.1.0` x64·arm64 패키지를 확인했다. [PR #140](https://github.com/chawon/ott/pull/140)의 서버 계정 삭제 수정이 포함됐다. 공개 설치판에서의 계정 삭제·오류 보존 검증과 `2.0.2.0` 후보의 동기화 수정은 Windows 담당이 이어간다. [스토어 근거](pages/platforms/ms-store.md) · [후속 작업](../docs/changes/v2-follow-up.md#1-windows-서버-계정-삭제-수정)

## [2026-11-22] feat(windows): 추천 복구·큐레이터 제거·함께 2단·공통 풋터/안내 5종 PR #156 병합 (차기 v2.0.2.0 후보)

- [PR #156](https://github.com/chawon/ott/pull/156) `main` 병합 완료(`b6baa17`, 순차 커밋 `38deac2` · `2800702` · `c50b6c5` · `ce860a9`).
- 주요 변경:
  - **내 미래는? 복구 (`#142` · 카드 `312248008`)**: 공용 15초 타임아웃을 요청별 타임아웃(기본 15s / `/state` 15s / `/generate` 60s)으로 분리하고 언어별 `requestId` 영속 복구·더블탭 병합·`202`/일시 장애 폴링·기존 추천 보존·타 언어 쿼터 격리 반영.
  - **함께 큐레이터 제거 (카드 `313279209`)**: 큐레이터 배너, `/api/curated-contents` 호출, 하드코딩 기본 질문 fallback 및 미사용 모델·문구 전면 제거.
  - **함께 반응형 2단 목록·상세 (카드 `313285008`)**: `TogetherSpreadCoordinator` 신설(`>= 980px` 2단 독립 스크롤 / `< 980px` `MinWidth=800` 단일 전환 및 선택·검색·정렬 유지), 빠른 A→B 선택 취소/시퀀스 가드, `GET /api/discussions/{id}`·`GET /reactions/me`·`PUT /reactions`·`POST /comments`(`syncLog`) 서버 계약 정합성 및 딥링크 지원.
  - **공통 5종 풋터·앱 내 안내 화면**: 전 탭 공통 풋터(`OttlineFooterControl`)와 앱 내 4종 안내 화면(`기록 가이드` 3편·`서비스 소개` 6개 플랫폼·`FAQ`·`개인정보처리방침` + `내 문의함`) 구현.
- 검증·CI: `Ottline.Tests` 43/43 통과, `Native Windows CI` PR Run [`44999550244`](https://github.com/chawon/ott/actions/runs/44999550244) 및 `main` Run [`45000851496`](https://github.com/chawon/ott/actions/runs/45000851496) 통과, 로컬 `x64`+`arm64` MSIXBundle(`159.02 MB`, SHA-256 `1D3697AB30C8A83FA9128FBF7E39A2B162D479FD10DFCC7A9CD9FC52099B45B2`) 검증, 운영 API(`https://ottline.app`) 임시 계정 실측(`quota.used 0→1→2→3` 복구·멱등성, `/api/curated-contents` 0호출, `PUT /reactions` 원복 후 `HTTP 200` 계정 삭제 정리), `win-arm64` 실앱 실행 사용자 검수 통과.
- 남은 확인: 현재 `Certification` 심사 중인 `v2.0.1.0` (`1152921505702457337`) 공개 게시 후 `v2.0.2.0` 제출 및 스토어 설치판 최종 확인. [Windows Wiki](pages/platforms/windows-native.md) · [후속 작업](../docs/changes/v2-follow-up.md#windows-후속-기능-통합-반영-2026-11-22-차기-v2020-후보) · [플랫폼 현황](../docs/platforms.md)

## [2026-11-22] release(web/api): 본부 검토 후 5개 PR 통합·동일 SHA 운영 반영

- PR [#145](https://github.com/chawon/ott/pull/145)·[#150](https://github.com/chawon/ott/pull/150)·[#151](https://github.com/chawon/ott/pull/151)·[#152](https://github.com/chawon/ott/pull/152)·[#153](https://github.com/chawon/ott/pull/153)을 main `c693fd86f49d5433350ad7e61b2ec53fd9bab055`로 병합했다. 가상 통합과 실제 main tree가 일치했다.
- 최종 SHA의 [API CI 44985947298](https://github.com/chawon/ott/actions/runs/44985947298)·[Web CI 44985968381](https://github.com/chawon/ott/actions/runs/44985968381) 성공 뒤 [API production 44986440444](https://github.com/chawon/ott/actions/runs/44986440444) → 실제 API 확인 → 같은 SHA [Web production 44986943059](https://github.com/chawon/ott/actions/runs/44986943059)을 완료했다. Web 공개 버전 확인·IndexNow도 성공했다.
- 큐레이터 공개 KO/EN `200 [] / no-store`·인증 후 쓰기 `410`, 보관 GET·기기 합성 UA13개와 기존 ID 보존을 실제 API에서 확인했다. 함께 상세 초기 상태·큰 화면 2단·큐레이터 UI 제거, Apple 서비스 안내·ChatGPT 안내 제외와 추천 복구를 배포했다.
- 실제 운영 Pod의 익명 브라우저 14개를 모두 통과했다. 신고3링크의 desktop/mobile × 직접/카드/새로고침18회, 가시영역1·선택/제목/댓글대상과 소개/가이드4조건을 확인했다. 실제 공개 API GET90건 모두200, 전달 비GET0·curator0·pageerror0, 버전전후 `c693fd8`이었다.
- 기록648·수정 이력1094·큐레이터 자료6·승인5·감사1·수신상태1, Flyway32 및 보관 자료 전체 행 해시를 보존했다. 검증 fixture는 ID 한정으로 정리하고 잔여0·삭제 후401을 확인했다. 실제 메시지는 발송하지 않았다.
- ArgoCD `Synced Healthy`, API/Web 이미지·`APP_VERSION=c693fd8`·Pod Ready/restart0과 ExternalSecret4종 `Ready`를 확인했다. 공개 직접 HTTP probe의 Cloudflare403 제한과 실제 Pod 브라우저 확인을 구분한다.
- 실제 설치형 PWA·Mac 설치판 연결·공개 앱의 기기 표시와 각 네이티브 설치판은 후속 검증을 유지한다. 기존 등록의 고아 기록 귀속은 [별도 API #155](https://github.com/chawon/ott/issues/155)로 등록했다. [통합 운영 반영 기록](../docs/web-api-rollout-2026-11-22.md).

## [2026-11-22] release(android): 태블릿·디자인·네비게이션·추천 복구 PR #146·#148 병합 및 Google Play 2.0.5 (29) 배포 업로드

- [PR #146](https://github.com/chawon/ott/pull/146) (`main` `1ebfe94`) 및 [PR #148](https://github.com/chawon/ott/pull/148) (`main` `37eda7f`) 순차 병합 완료.
- 주요 변경: 미래의 타임라인 생성 요청 90초 타임아웃·언어별 `requestId` 복구(`#142`), `함께` 큐레이터 질문·조회·이벤트 제거, 태블릿·폴더블 상단 헤더(`>=700dp`)·3단 홈(`>=800dp`)·2단 함께(`>=700dp`)·2단 작품 상세(`>=860dp`)·4열 리포트·`sw600dp+` 태블릿 User-Agent, Material 3 기본 보라색 제거 및 웹 `DESIGN.md` 컬러(`#F8F6F2`/`#FEF9EE`/`#1E4D8C`/`#FF9933`)·Pretendard 폰트 정렬, 타임라인→상세 진입 시 탭 강조 유지 및 탭 전환 스택 수정, OTT 시청 후 기록 알림 최소 시청 시간 5분 → 20분 상향.
- 검증·CI·Play 업로드: [`native-android-release.yml` Run #44981269777](https://github.com/chawon/ott/actions/runs/44981269777) 성공(`:app:testDebugUnitTest` 42/42, `:app:lintDebug`, `:app:bundleRelease`, `scripts/verify-release-aab.sh` R8 계약 검증, `app-release.aab` SHA-256 `62a30ccba00eb0b65a1c200e3a6331c3f45b06bca38a267aeaae6dd34034eb5f`, 아티팩트 `ottline-native-release-2.0.5-29`). `gplay release`로 `app.ottline` **`2.0.5 (versionCode=29)`**을 `production` 트랙(`status=completed`, `rollout=1.0`)에 업로드했다.
- Play Console 조치(`2026-11-22`): 구 TWA 비공개 테스트(`13 / 1.0.9`) 중지로 API 36 경고 원인 정리, 7"·10" 태블릿 스크린샷(`2560×1600`, 한·영 각 5장) 기본 스토어 등록정보 업로드 및 검토 제출 완료.
- 남은 확인: Google Play `2.0.5 (29)` 심사 승인·공개 게시 확인 및 공개 스토어 업데이트판 실기기 확인. [Android Wiki](pages/platforms/android-native.md) · [플랫폼 현황](../docs/platforms.md)

## [2026-11-22] release(apple): macOS·iOS·iPadOS 출시 완료와 후속 업무 인계

- 사용자가 세 플랫폼의 출시 완료를 확인했다. 제출 버전은 `2.0.0 (27)`, 코드 `2634fdc`([PR #137](https://github.com/chawon/ott/pull/137)), 동일 Apple ID `6780318110`이다. 11월 21일의 심사 제출 기록을 현재 출시 상태로 갱신했다.
- [Apple 한국 공개 조회](https://itunes.apple.com/lookup?id=6780318110&country=kr&entity=software)의 iOS `2.0.0`, `iosUniversal`, 공개 시각 `2026-11-22 08:11 KST`를 대조했다. 이 조회는 macOS의 공개 상태나 빌드 번호를 독립적으로 증명하지 않으므로, 제출·공개·실기기 근거를 구분했다.
- [iOS·iPadOS](pages/platforms/native.md), [macOS](pages/platforms/macos-native.md), [플랫폼 현황](../docs/platforms.md)과 루트 README의 현재 앱 소스·개발 시작점을 SwiftUI로 정정했다. Expo `1.0.4 (24)` 소스·배포 이력은 업데이트 데이터 이전을 위해 보존한다.
- [출시 완료](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827691), [Web 서비스 소개·가이드 반영](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827749), [Mac 설치판 연결 검증](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827720)을 담당별 카드로 연결했다. 기존 설치판 데이터 보존·추천 복구 검증과 후속 큐레이터 제거·iPad 함께 점검은 [Apple 후속 작업](../docs/changes/v2-follow-up.md#2-apple-v2-업데이트-검증)에서 추적한다.

## [2026-11-21] release(apple): SwiftUI iOS·iPadOS & macOS v2.0.0 (27) App Store 심사 제출 및 PR #137 병합

- [PR #137](https://github.com/chawon/ott/pull/137) `main` 병합 완료(`d0844fc`, 코드 HEAD `2634fdc`).
- 공용 `OttlineCore`: `AppPreferences`·`OttlineRepository` 락 기반 상태 저장 + 메인 스레드 비동기 통합 발행(백그라운드 동기화 중 AB-BA 데드락 해소), 미래의 타임라인 90초 타임아웃·언어별 `requestId` 복구(`#142`), 2단계 포스터 캐시(`NSCache` + 디스크 LRU), 커스텀 드롭다운(`OttlineSelectDropdown`), `QuickRecordSheet` 초기 상태 즉시 반영 및 macOS 포커스 점프 방지.
- iOS·iPadOS: 최소 지원 `iOS 16.0` 하향, 온디바이스 즉시 공유 카드, 도킹 하단 바, iPad `서가` 중복·iPhone 영어 `Together` 탭 수정. 실기기 iPhone X(`iOS 16.7.16`)·iPad 10세대 검증.
- macOS: App Sandbox(`com.apple.security.app-sandbox`) 활성화·Release 권한 검증, 온디바이스 즉시 공유 카드(`1080×1920` / `1080×1350`), 전 메뉴 `1280px` 폭 통일·2컬럼 작품 상세, 인트로 스플래시, `함께` 내부 스크롤바 정리, 웹 기준 가이드·소개·FAQ·개인정보·문의함 5종 구현 및 실기기 검수.
- 검증·CI: `OttlineTests` 18/18·`OttlineMacTests` 5/5 통과, `Native iOS v2 CI (SwiftUI)` Run [`44897582945`](https://github.com/chawon/ott/actions/runs/44897582945) · `Native macOS v2 CI (SwiftUI)` Run [`44897582916`](https://github.com/chawon/ott/actions/runs/44897582916) 모두 성공.
- 스토어 제출: App Store Connect `app.ottline`(`id6780318110`)에 **iOS·iPadOS `2.0.0 (27)`**(iPhone 6.3"·iPad 13" 한·영 스크린샷) 및 신규 플랫폼 **macOS `2.0.0 (27)`**(`2560×1600` 한·영 스크린샷), ASO 앱 이름·부제 반영 후 두 플랫폼 모두 **App Store 심사 제출 완료**(공개 승인·실사용 최종 확인 대기). [iOS Wiki](pages/platforms/native.md) · [macOS Wiki](pages/platforms/macos-native.md) · [후속 작업](../docs/changes/v2-follow-up.md#2-apple-v2-업데이트-검증) · [플랫폼 현황](../docs/platforms.md)

## [2026-11-20] deploy(api): 미래의 타임라인 추천 생성 응답 지연 단축 및 단계별 계측 (#143, PR #144)

- [PR #144](https://github.com/chawon/ott/pull/144) (`main` `7e9913d`, manifest `15112e0`, `Deploy API to Production` run [`44708627801`](https://github.com/chawon/ott/actions/runs/44708627801)).
- OpenAI `gpt-6-luna` 기본 `OPENAI_REASONING_EFFORT`를 `low` → `none`으로 전환하고, 1차 후보 수 `12 → 9`, `RecommendationCatalogService` 배치 공유 4초 마감, `TmdbConfig` `connect 3s / read 5s` 타임아웃, `[Recommendation]` 단계별 소요시간(`llmMs`, `enrichMs`, `roundMs`, `totalMs`) 로깅을 반영했다.
- 운영 확인: ArgoCD `ott-app` `Synced / Healthy` (`15112e0`), `ott-api` Pod `1/1 Running`·재시작 0·`APP_VERSION=7e9913d`·`OPENAI_REASONING_EFFORT=none`. 운영 실요청 로그에서 `llmMs=12405`, `enrichMs=715`, `totalMs=13230` (`selected=6, returned=6`) 확인.
- 전 플랫폼 클라이언트 타임아웃(Android/Apple 20s, Windows 15s)·폴링 정합성 조사는 공통 이슈 [#142](https://github.com/chawon/ott/issues/142)로 등록해 관리 본부에서 추적한다. [미래의 타임라인](pages/features/future-timeline.md) · [플랫폼 현황](../docs/platforms.md)

## [2026-11-20] release(windows): 서버 계정 삭제 수정 PR #140 병합 및 Microsoft Store v2.0.1.0 심사 제출

- [PR #140](https://github.com/chawon/ott/pull/140) (`main` `1fb24ee`, 코드 커밋 `e8b9f24`). Windows `OttlineApiClient.DeleteServerAccountAsync()` 경로를 `DELETE /api/auth/account`로 수정(`UnlinkDeviceAsync`도 `DELETE /api/auth/devices/{id}`로 정정)하고 `OttlineRepository.DeleteServerAccountAsync()`·`MainViewModel`·`MainWindow`에 서버 2xx 확인 후 로컬 초기화, HTTP 오류·네트워크 실패 시 기록·이력·`outbox`·연결 상태 보존, 미연결 계정 가드, 한·영 안내 문구를 반영했다.
- 검증: 모의 API 단위 테스트 5건 추가 포함 `Ottline.Tests` 19/19 통과, `Native Windows CI` PR Run [`44696668066`](https://github.com/chawon/ott/actions/runs/44696668066) 및 `main` Run [`44697026662`](https://github.com/chawon/ott/actions/runs/44697026662) 통과, `ottline-2.0.1.0.msixbundle`(`x64`+`arm64`, `158.90 MB`) 로컬 빌드·무결성 검증 완료.
- 스토어 제출: Partner Center `9NSVNZGDMGF5`에 `v2.0.1.0` 제출 완료(Submission `1152921505702457337`, `Status = Certification`, `Errors = 0`, `Desktop` 전용 유지). 현재 공개판은 `2.0.0.0`이며 `2.0.1.0` 공개 게시 후 스토어 설치판 실기기 확인이 남아 있다. [후속 작업](../docs/changes/v2-follow-up.md#1-windows-서버-계정-삭제-수정) · [삭제 정책](pages/features/delete-sync.md#windows-확인-사항)

## 계획 · 브라우저 확장·토스 인앱·ChatGPT 앱

- 브라우저 확장은 Web 빠른 기록 진입을 유지하고 원본 URL과 권한을 줄이는 패키지 갱신을 준비한다. 토스 인앱은 공개판에서 핵심 동작과 반복 기록을 확인한다.
- ChatGPT 앱의 기존 반려 통지에서 스크린샷 요건 미충족을 확인했다. 읽기 전용 조회를 실제 ChatGPT에서 검증하고 현재 제출 자료를 준비한다. [후속 채널 개편 방향](../docs/changes/v2-channel-strategy.md)

## 정리 · 플랫폼 통합 개발 지휘부

- 기준 소스 `main 3920e30`. [플랫폼 현황](../docs/platforms.md), [공통 API와 데이터 계약](../docs/product-contracts.md), [기능 변경안](../docs/changes/README.md)을 현재 문서로 연결했다.
- Android·Windows 네이티브 전환 이후의 소스와 배포 경로를 확인했다. App Store의 Expo iOS와 PR #137의 SwiftUI iOS·macOS를 구분했다.
- 구형 Android TWA와 초기 Web 시안, 종료된 절차와 검토 자료를 [소스](../archive/README.md), [문서](../docs/archive/README.md), [Wiki](archive/README.md) 아카이브에 보관했다.
- 기록 정정. Android `2.0.0 (24)` 배포 run `42550886641`의 빌드 SHA는 `7ef08aa`다. 현재 Android 패키지 테스트·Lint·서명 빌드는 `native-android-release.yml`에서 실행된다. [Android 전환 기록](../docs/android-native-v2-transition.md)

## [2026-11-19] deploy: 브라우저 확장→Windows 빠른 기록 Phase A

- PR #138을 병합하고 Web SHA `4472ad3`을 production run `44441612541`로 배포했다. Windows 확장 진입의 QuickLog에 앱 링크와 설치 캠페인 `cid=extension_handoff`를 추가했다.
- 운영 브라우저 29개 시나리오, 한·영 공개 `/about`의 보조 도구·`Ctrl+Shift+O`, SEO 공개 19개·개인 14개 경로와 IndexNow 19개 접수를 확인했다. ArgoCD `Synced Healthy`, Web과 API Pod Ready·재시작 0을 확인했다.
- [배포·검증 기록](../docs/desktop-protocol-and-extension-bridge-plan-2026-11-18.md)

## [2026-11-18] plan: 데스크톱(Windows·macOS) 공통 ottline:// 프로토콜·핸드오프 및 브라우저 확장 전환 명세 작성
- 대상: `docs/desktop-protocol-and-extension-bridge-plan-2026-11-18.md` (신규), `wiki/pages/platforms/browser-extension.md`, `wiki/pages/platforms/windows-native.md`, `wiki/index.md`
- 노트:
  - `apps/browser-extension`(`ottline helper`)을 기능 동결하되 Chrome·Edge·Whale 스토어는 무료 검색 입구로 유지하고, `?quick=1&capture_title=...` 진입 시 Windows·macOS 데스크톱 네이티브 앱으로 연결하는 브릿지 전략 정리
  - Windows `main`(`DomainHelpers.cs`, `OttlineRepository.cs`)과 `origin/feature/ios-native-v2`(`OttlineMacApp.swift`, `OttlineApp.swift`) 코드 대조를 통해 `ottline://quick?quick=1&title=...&q=...` 공통 규격 및 macOS/iOS 측 `title`/`capture_title` 수용·`?native_handoff=1` → `ottline://open?handoff=1` 세션 이어받기 보강 명세 확정

## [2026-11-18] release: Microsoft Store Windows Native v2.0.0.0 정식 출시(Published) 및 실기기 PWA 핸드오프 검증 완료
- 대상: `AGENTS.md`, `docs/windows-native-v2-transition.md`, `docs/ottline-v2-release-readiness.md`, `docs/ms-store-pwa-plan.md`, `docs/web-acquisition-funnel-plan-2026-11-17.md`, `wiki/pages/platforms/ms-store.md`, `wiki/pages/platforms/windows-native.md`, `wiki/pages/platforms/pwa.md`, `wiki/index.md`
- 노트:
  - Partner Center Submission `1152921505702424456`(`v2.0.0.0`)이 `Status = Published`로 승인·게시되어 DisplayCatalog(`ChawonLee.ottline_2.0.0.0_neutral_~_ry7416pek43sa`, KO/EN 부제·포스터·스크린샷 4종)와 `winget`(`9NSVNZGDMGF5`)에 정식 반영됨을 확인
  - 개발 모드 패키지 제거 후 `winget install --id 9NSVNZGDMGF5 --source msstore`(`SignatureKind: Store`) 정식 설치 실행 및 별도 PC `1.0.x` Edge PWA → `2.0.0.0` 업데이트 후 웹 브라우저 연결(`?native_handoff=1` → `ottline://open?handoff=1`) 자동 핸드오프 동작 실기기 검증 완료
  - Android TWA(`2026-11-09`)에 이어 Microsoft Store PWABuilder PWA 배포도 순수 네이티브로 전환 종료되어 스토어 래퍼 앱은 더 이상 운영하지 않으며, 웹 `ottline.app` 설치형 PWA는 macOS/Linux 등 비-스토어 환경과 기존 홈 화면 사용자 전용으로 유지함을 명시
  - PR `#133` 웹 문구(`Ctrl+Alt+O`)는 실제 앱 단축키(`Ctrl+Shift+O`)와 다르므로 후속 웹 PR에서 정정 대상으로 기록

## [2026-11-18] fix(api,android): Android 네이티브 연결 기기 표시 (Android App · Android)

- `AuthService`에 `X-Client-Platform: android_native` 및 헤더 없는 `2.0.4` 앱의 `ottline-android/` User-Agent 하위호환 분기를 추가해 연결 기기 목록에서 `Android App · Android`로 구분 표시하도록 수정(일반 Chrome PWA는 `Chrome · Android` 유지).
- Android `OttlineApiClient`에 `X-Client-Platform: android_native` 헤더(외부 공유 링크 조회 제외)를 추가하고 `MySpaceScreen` 기기 라벨 순서를 `browser · os`로 통일(Play 스토어 재배포 없음).
- 문서: AGENTS.md, wiki/pages/platforms/android-native.md.

## [2026-11-18] deploy: Windows 웹 전환 퍼널과 Windows·macOS 연결 기기 표시

- PR #133·#135 병합, 공통 API/Web SHA `2f262ec1f854df70d7a48674b9ca612b590b2248`. API production `44217423318` → 실제 API 검사 → Web production `44218009292` 순서로 배포했다.
- Windows 전역 배너·QuickLog 저장 CTA·소개 카드의 `cid` 계측과 v2 설명을 반영했다. 네이티브 기기는 `windows_native`·`macos_native` 헤더로 표시를 갱신하며 기존 ID·계정·등록 시각을 보존한다.
- API CI 185건·운영 전환 퍼널 21개 시나리오·SEO 공개 19개/개인 14개 경로·한영 내 공간 기기 라벨을 확인했다. 공개 버전 HTTP 200, IndexNow 19개 접수, ArgoCD `Synced Healthy`, 두 Pod Ready·restart 0이다.
- 기존 기록 623개·이력 1,063개를 보존했고 검증 계정 3개와 임시 DB Pod를 정리했다. iOS Smart App Banner·`ct`와 네이티브 바이너리는 이번 배포 범위에서 제외했다.
- 문서: AGENTS.md, docs/desktop-acquisition-rollout-2026-11-18.md, docs/native-desktop-device-info.md, docs/web-acquisition-funnel-plan-2026-11-17.md, platforms/windows-native.md, platforms/ms-store.md, architecture/geo-seo.md, index.md.

## [2026-11-17] plan: Partner Center 유입 지표 진단 및 Web 스토어 전환·SEO 개선 인계 문서 작성
- 대상: `docs/web-acquisition-funnel-plan-2026-11-17.md` (신규), `wiki/pages/architecture/geo-seo.md`, `wiki/pages/platforms/ms-store.md`
- 노트:
  - Microsoft Partner Center 최근 12개월 획득 리포트(`488` 조회 → `24` 설치 [`4.92%`], 첫 실행 `16`, 한국 설치 `2`건 [`8.33%`], 자사 `?cid=` 유입 `0`건)와 `apps/web` 퍼널 대조 분석 정리
  - `PwaInstallBanner.tsx`의 Windows/iOS 브라우저 PWA 우선 유도, `layout.tsx` iOS Smart App Banner 누락, `SavedAndroidPlayCta.tsx`의 QuickLog 저장 직후 Android 단독 노출, `/about` Windows 구버전 문구 및 `?cid=`/`?ct=` 누락, `/public/[id]` `noindex` 롱테일 SEO 병목을 Phase 1~3으로 정리해 Web 담당자 인계 문서로 확정

## [2026-11-17] ingest: Windows Native v2 모노레포 통합 및 Microsoft Store 2.0.0.0 심사 제출
- 대상: `apps/windows-native/`, `.github/workflows/native-windows-ci.yml`, `.github/workflows/native-windows-release.yml`, `docs/windows-native-v2-transition.md`, `AGENTS.md`, `README.md`
- 생성/수정: `wiki/pages/platforms/windows-native.md` (신규), `wiki/pages/platforms/ms-store.md`, `wiki/pages/features/ottline-v2.md`, `wiki/index.md`
- 노트:
  - PR `#132`(main SHA `7bc5a46`, 커밋 `bfdca7b`)로 순수 Windows Native(`.NET 8 WPF + SQLite + Windows 11 공식 위젯`) `apps/windows-native` 모노레포 통합 및 `Native Windows CI`(`verify-windows`, Run `44030185194`) 통과 확인
  - Partner Center `9NSVNZGDMGF5`(`ChawonLee.ottline`)에 `Desktop` 전용 장치 패밀리(`Holographic: false`), KO/EN 부제 포함 제목(`ottline - 영화·드라마·책·독서 기록` / `ottline: Movie, TV & Book Log`), `ottline-2.0.0.0.msixbundle`(`x64`+`arm64`, `158.90 MB`), 신규 아트워크·스크린샷 12종 업로드 후 Submission `1152921505702424456` `Certification` 진입 확인
  - 기존 Store Edge PWA(`1.0.x`) 사용자 `?native_handoff=1` → `ottline://open?handoff=1`(`<uap3:Protocol Parameters="%1">`) 자동 세션·기록 이어받기 및 병합, 단위 테스트 14/14·위젯 COM 스모크 테스트 검증 완료

## [2026-11-12] fix: Web/PWA 오프라인 재진입 안내·키보드 접근성 운영 배포

- PR `#130`, Web SHA `4cabcd553a952bc27db9b39b02ad94498e225cec`, production run `43158345911`, manifest commit `753ef492dd922c13089824c3b12b675bdf9f6bae`.
- 서비스워커 v7, 외부 자원 없는 한·영 안내, 검색 선택 상태와 동일 제목 판본 출처 이름, 모션 감소·포커스 대비·본문 바로가기를 반영했다.
- PR/main CI와 운영 배포 성공, 공개 버전·서비스워커·안내 파일 일치, 한·영 통신 실패 시 HTTP 200 fallback, 이전 캐시 정리·관련 없는 캐시 유지와 재연결을 확인했다. 브라우저 probe는 격리된 서비스워커 전송에만 실패를 주입했고 서버 API·쓰기를 차단했다.
- ArgoCD `Synced Healthy`, Web `APP_VERSION=4cabcd5`, Web/API Pod Ready·restart 0, IndexNow 19개 URL HTTP 200을 확인했다. API 이미지 `916be7a`와 네이티브 바이너리는 유지했다.
- 배포 검증에서 발견한 서비스워커 활성화 대기 조건도 동기 controller 상태 확인으로 보완했다.
- 문서: AGENTS.md, docs/web-offline-accessibility-2026-11-12.md, features/ottline-v2.md, platforms/pwa.md, index.md, log.md.

## [2026-11-11] fix: v2 sitemap·공유 메타데이터·가이드 구조화 데이터 Web 운영 배포

- PR `#127`, Web SHA `aa991545f5fb3a914561f7fcd3e12c817275144c`, production run `43014772986`, manifest commit `c8a39db5e10aa644bc68cfb073e419441a003158`.
- 홈·소개·FAQ 수정일과 가이드 목록의 문서 수정일 연동, v2 OG 이미지·페이지별 Twitter 정보, 한·영 가이드 `Article`·`BreadcrumbList`를 반영했다.
- PR/main Web CI, 운영 공개 URL 19개·개인 화면 14개·구조화 데이터 6세트·이미지 7개 검사가 통과했다. ArgoCD `Synced Healthy`, Web `APP_VERSION=aa99154`와 Pod `1/1` ready·restart 0, IndexNow 19개 URL HTTP 200 접수를 확인했다.
- API는 기존 `916be7a` 이미지·Pod `1/1` ready·restart 0을 유지하며 사용자 기록을 생성·수정하거나 네이티브 바이너리를 배포하지 않았다.
- 문서: AGENTS.md, docs/seo-v2-refresh-2026-11-11.md, architecture/geo-seo.md, features/ottline-v2.md, index.md, log.md.

## [2026-11-09] ingest: Android Native v2 전환 및 TWA 자동 세션·기록 복구 프로덕션 출시
- 대상: `apps/android-native/`, `docs/android-native-v2-transition.md`, `docs/ottline-v2-release-readiness.md`, `docs/ottline-v2-production-rollout.md`, `AGENTS.md`
- 생성/수정: `pages/platforms/android-native.md` (신규), `pages/platforms/twa.md`, `pages/features/ottline-v2.md`, `index.md`
- 노트:
  - Google Play `app.ottline` 프로덕션을 기존 Bubblewrap TWA(`versionCode <= 23`)에서 순수 Android Native(`Kotlin + Jetpack Compose + Room + WorkManager`) `2.0.0`(`vc24`, SHA `45ccac3`, run `42550886641`) 및 `2.0.1`(`vc25`, SHA `916be7a`, run `42564729159`)로 전환 배포 완료
  - Play Store v2 아이콘(`512x512`)·피처 그래픽(`1024x500`)·스크린샷 5장(`1080x1920`) 및 `ko-KR`/`en-US` 스토어 문구·출시 노트 반영 완료
  - 기존 TWA 업데이트 시 2단계 자동 복구(`install_token` 기반 `POST /api/android/notification-devices/restore-session` + `TwaBrowserBridge` 외부 브라우저 `?native_handoff=1` → `ottline://open?handoff=1` 자동 핸드오프 및 임시 계정 자동 병합) API/Web/Android 동시 반영 완료

## [2026-11-08] feat: ottline v2 Web/PWA·API 운영 배포

- 기능 PR `#125`, 운영 설정·전송 안내 PR `#126`, 배포 SHA `b9f88a6d5f329ffa1bfaea4dacc3b7be8bfb3022`.
- API production `42481109076` → 실제 API 확인 → Web production `42482058132`; manifest commit `64a485b` / `182c4e9`.
- PC 기록장·모바일 수첩, 월별 감상 목록과 진행 중 영역, 상태 선택 뒤 하단 저장, 실제 포스터·TPO·느낌·기기 연결·동기화를 반영했다.
- OpenAI `gpt-6-luna`, 계정별 제외·되돌리기·성공 생성 하루 3회와 생성 전 전송 안내·정책을 연결했다. 실제 6개 → 제외 후 5개 → 재추천 6개, 기기 간 공유와 네 번째 요청 429를 확인했다.
- DB 백업·V32, SecretSynced, API/Web 이미지·APP_VERSION `b9f88a6`, 두 Pod Ready·restart 0과 ArgoCD Synced/Healthy를 확인했다. 기존 기록·이력 수를 보존했다.
- 실제 브라우저 저장 후 정식 서버 ID와 outbox 0개, 모바일·PC 저장 버튼과 전송 안내를 확인했다. 테스트 계정·추천 데이터와 임시 DB 클라이언트는 정리했다.
- 네이티브·스토어 바이너리 제출은 별도다. Android는 준비 중인 네이티브 앱을 기준으로 진행한다.
- 문서: AGENTS.md, docs/ottline-v2-production-rollout.md, docs/ottline-v2-release-readiness.md, features/ottline-v2.md, features/future-timeline.md, index.md, log.md.

## [2026-10-26] feat: 영어 Google Books 검색·독서 서비스 운영 배포

- PR `#124`, API/Web SHA `98417a9f22079e17650b6f1d2dfd2c022c5afd30`.
- API production `40252251489` → 운영 검색 검증 → Web production `40252514676`; manifest commit `f043d76f0b0d9d9872011962abd2441e0be8ae26` / `dc3b3471988c0f209dcb702cc3a35b61120285ba`.
- 영어 도서 검색은 Google Books, 한국어는 Kakao를 사용하고 같은 ISBN 판본의 기존 NAVER/KAKAO/GOOGLE_BOOKS 식별자와 기록을 보존한다.
- EN 책 구매처·독서 서비스를 Kindle, Apple Books, Kobo, Audible, Libby 등으로 제공한다. KO·영상 기본값과 기존 한국 서비스명·직접 입력값은 유지한다.
- PR/main API·Web·Native CI, 별도 Google Books ExternalSecret의 `SecretSynced`, ArgoCD `Synced Healthy`, API/Web `APP_VERSION=98417a9`, 두 Pod `1/1` ready·restart 0을 확인했다.
- 실제 API·Web 프록시 검색 14건에서 언어·iOS capability 분기와 HTTP 200을 확인하고 공식 출처 이미지, 배포 번들의 EN 서비스 목록과 공개 버전 응답을 확인했다. 운영 기록은 생성·수정하지 않았다.
- 현재 iOS 바이너리는 Kakao를 유지하며 TestFlight/App Store 바이너리 배포는 진행하지 않았다.
- 문서: AGENTS.md, docs/google-books-en-search.md, pages/features/book-log.md, index.md, log.md.

## [2026-10-25] fix: Android 시청 기록 알림 복구 production 등록

- PR `#122`·`#123`, source SHA `2bbff18256dffd7078e61fbfe44c2a23433d3031`, release run `40169071221`.
- 감지 주기 사이에 버려지던 사용시간을 누적하고 일별 통계 구간을 분리했으며, 통계 조회 공백과 알림 실패에도 재시도 상태를 유지한다.
- 첫 업로드는 Play 자동 보호의 API 24 요건으로 거부됐다. 사용자 승인 후 최소 Android 7.0(API 24)으로 올리고 자동 보호를 유지했다.
- 감지 시나리오 22건, 단위 테스트 17건, 서명 AAB·R8 분석·WorkManager 생성자/브랜드 자산 검증을 통과했다.
- 새 Play edit `09339353177853118628`에서 production `1.0.19 (23)`/`completed`/100%를 재조회했다. CI AAB와 Play versionCode 23의 SHA-256 `6bf3b47dc4a0964ef062f534e61cf9eefdb20662fe0ee312cdf1b9561d73ddcb`가 일치했다.
- 실제 기기 업데이트·알림 표시·QuickLog 진입은 후속 확인한다.
- 문서: AGENTS.md, docs/android-watch-reminder-reliability.md, docs/twa.md, pages/platforms/twa.md, index.md, log.md.

## [2026-10-14] update: iOS 1.0.4 App Store 심사 접수

- 사용자가 TestFlight에 배포한 동일 빌드 `1.0.4 (24)`의 App Store 심사를 제출했다.
- `2026-10-14T12:36Z` Apple API 조회: app version `ecf89bb4-65dc-4b70-a514-acd4320ad788`, review submission `27c9da0a-572c-45d9-b43c-742eeb9061ed` 모두 `WAITING_FOR_REVIEW`.
- 제출 시각 `2026-10-14T12:31:44.458Z` (`21:31:44` KST), 연결 build `b013a8b6-1104-4dc3-b265-541285fe0b19` / `24`, 출시 방식 `AFTER_APPROVAL` 확인. 심사 접수 시점 공개 버전은 `1.0.3`이다.
- 구현·빌드·TestFlight·심사 접수 문서를 정리했다. 승인 후 공개 버전·실제 업데이트 확인은 별도 후속 단계다.
- 문서: AGENTS.md, docs/native-kakao-books.md, docs/ios-testflight-review-notes.md, docs/ios-app-store-launch-checklist.md, docs/kakao-book-search.md, pages/platforms/native.md, index.md, log.md.

## [2026-10-14] fix: iOS 카카오 도서 호환 내부 TestFlight 배포

- PR #119~#121 병합, build SHA `fc074ceef188161940a9aec6facaef2034f2119f`, iOS `1.0.4 (24)`.
- 카카오 공급자를 최근 함께 작품·공개 글 반응에서 유지하고 검색·오프라인 재시도·push/pull과 기존 Naver 식별자 보존을 검증했다.
- 타입 검사, 11 suites / 39 tests, Expo doctor 20/20, Hermes export 및 공용 잠금파일 변경의 Web CI 통과. 최종 main Native CI `38560919194` 성공.
- 배포 러너 Node 24 / EAS CLI 24.13.0 고정 후 EAS build `057972ad-3c10-4a59-9e5b-ef051c1a160d` 성공. 다운로드한 IPA의 버전·빌드·bundle ID를 확인했다.
- 배포 run `38561075126`의 Apple 제출은 계약 오류로 실패했다. 계정 소유자의 동의 후 같은 빌드의 EAS submission `5bd70cfa-2952-4c6b-bc2e-4268c466abc8`가 성공했다.
- Apple build `b013a8b6-1104-4dc3-b265-541285fe0b19`의 `VALID`, 내부 `IN_BETA_TESTING`, `expired=false` 확인. App Store 공개 버전은 `1.0.3`; 실기기 QA와 공개 심사는 후속 단계다.
- 문서: AGENTS.md, docs/native-kakao-books.md, docs/ios-testflight-review-notes.md, docs/kakao-book-search.md, pages/platforms/native.md, index.md, log.md.

## [2026-09-21] fix: 이용 리포트 주간 공유 카드 포스터 복구 운영 배포
- PR #108, API/Web SHA `01ef6b9b5b018970006ab6f42118b46824fb3430`.
- API production `35569268524`, Web production `35569520338`; manifest `4cb3d731616df253ee5d60b9199e64e8bf506e94` / `ef40081a1a188315f3b8a15027a5a5f4f1e4531f`.
- 개인 리포트 API와 로컬 fallback에 KST 직전 주 포스터 후보를 추가하고, 주간 공유 payload와 1~6칸 모자이크 렌더러를 연결했다. 시즌 포스터를 우선하며 이미지가 없으면 작품 제목을 표시한다.
- PR·main API/Web CI, API 전체 테스트, 웹 주간 공유 회귀 테스트와 production build를 통과했다.
- ArgoCD `Synced Healthy`, API/Web `APP_VERSION=01ef6b9`, 두 Pod ready·restart 0을 확인했다.
- 운영 내부 스모크 테스트에서 `previousWeekPosters` 계약 200, TMDB 포스터를 사용한 1080×1920 PNG 200과 실제 포스터 렌더를 확인했다. 임시 검증 계정은 즉시 삭제했다.
- iOS 네이티브 소스와 App Store 바이너리는 변경하거나 배포하지 않음.
- 문서: AGENTS.md, docs/weekly-report-share-card-posters.md, pages/features/share-card.md, index.md, log.md.

## [2026-09-15] update: 타임라인 서버 커서 무한 스크롤 운영 배포
- PR #107, API/Web SHA `c0e09c4bf90f2d6de11a1f7c715dc25c3a48c27e`.
- API production `34912864768`, Web production `34913130614`; manifest `bb3101e43a0bccdc80f1a3bdc90ee680cca43404` / `4aa7e501fed9405d5386832c2e56834d709028cd`.
- `GET /api/logs/page`의 시각+UUID 키셋 커서로 50개씩 이어서 조회하고, 웹/PWA/TWA는 서버 페이지를 IndexedDB에 캐시한다. 기존 `/api/logs` 배열과 iOS 네이티브 `/api/sync/pull` 계약은 유지한다.
- PR·main API/Web CI, PostgreSQL Testcontainers, 125개 Playwright 흐름, Native 타입 검사·27개 테스트를 통과했다.
- ArgoCD `Synced Healthy`, API/Web `APP_VERSION=c0e09c4`, 두 Pod ready·restart 0, 운영 새/기존 로그 계약 200과 실행 웹 번들의 경로·ko/en 문구를 확인했다.
- 사용자가 운영 앱에서 50개 이후 기록이 정상 노출되는 것을 직접 확인했다.
- iOS 네이티브 소스와 App Store 바이너리는 변경하거나 배포하지 않음.
- 문서: AGENTS.md, docs/timeline-infinite-scroll.md, pages/features/timeline.md, index.md.

## [2026-09-12] update: 카카오 도서 검색 복구 운영 배포
- PR #106, API/Web SHA `68f772e865aecf15fe232297bb588490898aa9aa`.
- API production `34684081448`(manifest 푸시 충돌 후 2차 성공), Web production `34684083501` 성공.
- OCI 키 동기화, ArgoCD `Synced Healthy`, 두 Pod `APP_VERSION=68f772e`, ready·restart 0 확인.
- 운영 API/웹 프록시에서 한국어 제목·ISBN·C++·검색 결과 없음 및 기존 영화 검색 모두 200 확인. 공개 직접 호출은 Cloudflare 403으로 제한.
- 기존 ISBN 판본 연결과 구버전 네이티브 동기화 호환성을 보강했으며 Expo/네이티브 바이너리는 변경하지 않음.
- 문서: AGENTS.md, docs/kakao-book-search.md, pages/features/book-log.md, index.md.

## [2026-09-06] update: TMDB 인기 작품 큐레이션 Telegram 승인 운영 활성화
- PR #105, API SHA `6e89a1256188ae170d068540561b0008495df602`, production run `34017827519`.
- ArgoCD `Synced Healthy`, API 버전·health·Flyway v31 확인. 기존 개인 Telegram 채팅을 승인자로 연결.
- KST 16:00 첫 인기 작품 초안 2건 생성 및 Telegram 전송 확인. 16:00:31 실제 승인자가 게시한 `들쥐`의 감사 기록·Telegram 메시지 갱신·공개 API 노출까지 확인.
- 문서: AGENTS.md, docs/curator-telegram-approval.md, features/ai-curator.md, index.md.

## [2026-08-18] update: Android Play 유입 활성화 1차 Web production 배포
- 대상: PR `#93`, main SHA `57f98e6317dcce303fc9d32e488b546a68b9c2c6`, Web production run `32099474936`
- 생성/수정: AGENTS.md, docs/twa.md, platforms/twa.md, index.md, log.md
- 노트:
  - Android 브라우저·설치형 PWA에는 Google Play 전환 팝업을, ottline TWA의 첫 기록 사용자에게는 시청 기록 알림 설정 카드를 노출
  - 닫기·이동 뒤 14일 cooldown, ko/en 개인정보 고지, Play CTA·알림 카드 6개 analytics 이벤트 반영
  - 일반 WebView·standalone PWA·다른 패키지 TWA를 제외하고 정확한 ottline 앱 신호와 현재 session flag만 TWA 판정에 사용
  - PR/main Web CI `32099214004`/`32099337243`, manifest commit `2b4a433cf2f001dd233f459aa5e34d5499575d67`
  - ArgoCD `ott-app` `Synced Healthy`, `ott-web` image SHA와 `APP_VERSION=57f98e6`, Pod `1/1` ready·restart 0, 실행 번들의 신규 이벤트와 한국어 CTA 확인
  - API, DB, Android AAB, iOS 네이티브 바이너리는 변경하거나 배포하지 않음

## [2026-08-16] update: 관리자 문의 답변 Invalid origin 복구 production 배포
- 대상: PR `#89`, main SHA `f0db4a150b90b08dc877cf9c913e171de4150209`, Web production run `31920437846`
- 생성/수정: AGENTS.md, features/feedback.md, index.md, log.md
- 노트:
  - Cloudflare/Ingress 뒤의 공개 브라우저 origin과 Next.js 내부 요청 URL을 직접 비교해 정상 답변 POST가 `403 Invalid origin`으로 거부되던 문제 수정
  - `X-Forwarded-Host`·`X-Forwarded-Proto` 기준 same-origin 검증으로 전환하고 origin 누락·외부 origin·변조 헤더·비 JSON 요청 차단 유지
  - PR/main Web CI `31685044955`/`31685212556`, manifest commit `ca01cdb8f04d1ceb64d5bff6a0ce821a4c56c3aa`
  - ArgoCD `ott-app` `Synced Healthy`, `ott-web` image SHA와 `APP_VERSION=f0db4a1`, Pod `1/1` ready·restart 0, 실행 번들의 프록시 origin 검증 반영 확인
  - API, DB, iOS 네이티브, Android TWA는 변경하거나 배포하지 않음

## [2026-08-03] update: Cloudflare 데일리 통계 KST 경계 보정 production 배포
- 대상: PR `#87`, main SHA `12ed846350f9efed056d8c40b9ab5a10a381c0ca`, API production run `30786675495`
- 생성/수정: AGENTS.md, docs/plan-daily-report.md, features/daily-report.md, log.md
- 노트:
  - UTC 날짜 버킷을 사용하던 Cloudflare HTTP·RUM을 KST 전일의 UTC `[start, end)` 시간 범위 조회로 변경
  - API 경계·쿼리·합산 테스트와 production Cloudflare GraphQL 계약 확인
  - manifest commit `05d6ac365f271bceffedaa8ed3d59894954d9469`; ArgoCD `Synced Healthy`, `APP_VERSION=12ed846`, Pod ready·restart 0 확인
  - production `2026-08-02` 값 `1105 requests / 248 pageViews / 8 visits`, `error=null` 확인 후 Telegram 수동 발송 성공
  - `uniqueVisitors`·`방문자` 이름을 실제 `visits` 의미로 바꾸는 작업은 다음 단계로 분리

## [2026-08-03] ingest: 2026년 상반기 리캡 종료 배포 문서화
- 대상: PR `#86`, main SHA `5eb5115317892d0032a8b7b6fe5377b14f2d0c2a`, `docs/2026-h1-recap.md`, 사용자 production 확인
- 생성/수정: docs/2026-h1-recap.md, features/seasonal-recap.md, features/analytics.md, features/share-card.md, index.md, log.md
- 노트:
  - `2026-H1`은 KST `2026-01-01`~`2026-06-30` 기록을 7월에만 보여주고 `2026-08-01 00:00`부터 종료
  - API `seasonalRecap`, 웹 리포트, IndexedDB fallback과 상단 노티에 같은 기간 게이트 적용
  - API/Web production run `30778501095`/`30778595558`; ArgoCD `Synced Healthy`, 이미지 SHA와 `APP_VERSION=5eb5115` 확인
  - iOS 네이티브 소스·App Store 바이너리는 변경하지 않았으며 네이티브 오프라인 fallback은 별도 범위로 기록

## [2026-07-25] update: 검색어·앱 스토어 발견성 후속 최적화 production 배포
- 대상: PR `#83`, main SHA `524b00139e8495024dca67177c58956855ce56ed`, Web production run `30141406956`
- 생성/수정: AGENTS.md, docs/seo-acquisition-foundation-2026-07-19.md, architecture/geo-seo.md, index.md, log.md
- 노트:
  - `/about`과 영화·시리즈 가이드의 한국어·영어 검색 제목과 H1을 기록 앱 의도에 맞게 보강
  - `/about`에 한국어 Google Play/App Store 링크와 기록 가이드 3개 직접 링크 추가
  - `SoftwareApplication` 운영체제 배열, 공식 스토어 `sameAs`/`installUrl`, 콘텐츠 수정일 기반 sitemap lastmod 반영
  - manifest commit `7989d4223e51a2114e02f03909ed8cc52f7d158a`; ArgoCD `ott-app` `Synced Healthy`, `ott-web` image와 `APP_VERSION=524b001` 확인
  - production HTML·sitemap 확인과 IndexNow 전송 성공; API와 네이티브 바이너리는 변경하지 않음

## [2026-07-19] update: SEO·검색 유입 기반 및 관리자 접근 경계 production 배포
- 대상: PR `#81`, main SHA `8303f4f51ccc12c1eda4a41efe58c79afd28f378`, API/Web production run `29678500818`/`29678607528`
- 생성/수정: AGENTS.md, docs/seo-acquisition-foundation-2026-07-19.md, architecture/geo-seo.md, features/analytics.md, features/daily-report.md, architecture/i18n.md, index.md, log.md
- 노트:
  - 한국어·영어 공개 페이지 canonical/hreflang/OG, 검색 가이드 6개, 공개 URL 전용 sitemap/robots/llms.txt와 IndexNow 반영
  - web/PWA/TWA 유입 session의 channel/source/landing/locale/campaign 및 첫 기록 집계, 자체 analytics 180일 보존 정책 반영
  - `/admin/**`를 Cloudflare Access와 origin JWT 재검증으로 보호하고 내부 관리자 API를 외부 `/api` ingress에서 분리
  - manifest commit API `9c3972b648cdbdcc05e596c31543cc1de248cc04`, Web `e8a9118fcc2610876dc56aa2e27db5815a390c97`; ArgoCD `ott-app` `Synced Healthy`, Web/API image와 `APP_VERSION=8303f4f` 확인
  - PWA 일반 기록 흐름은 유지하고 Native iOS CI만 실행했으며 TestFlight/App Store 바이너리는 새로 배포하지 않음

## [2026-06-10] update: Android production 1.0.12 회고 알림 탭 수정 배포
- 대상: PR #58, GitHub Actions TWA release run `27256880845`, `gplay tracks get`
- 생성/수정: AGENTS.md, docs/twa.md, docs/twa-play-launch-checklist.md, docs/android-revisit-reminders-2026-06-07.md, platforms/twa.md, index.md, log.md
- 노트:
  - PR `#58`을 main SHA `27bb8941aa703699e32045041b5aa27705dbbdd0`로 병합
  - Google Play `production`에 `1.0.12` (`versionCode=16`, `status=completed`) 반영 확인
  - 회고 리마인드 알림 탭은 `BroadcastReceiver` trampoline 대신 `LauncherActivity`를 직접 여는 경로로 수정
  - 릴리스 노트: `Fix reminder reliability and ensure recap reminder notifications open ottline.`

## [2026-05-23] update: 페어링 코드 보안 후속 안건 정리
- 대상: AGENTS.md, docs/pairing-recovery-card.md, features/pairing-recovery-card.md
- 생성/수정: AGENTS.md, docs/pairing-recovery-card.md, features/pairing-recovery-card.md, log.md
- 노트:
  - 실제 사용자 규모가 아직 작고 복구 카드 저장 UX가 먼저 반영되어, 페어링 코드 보안 정책 변경은 즉시 구현하지 않고 P2 후속 안건으로 보류
  - 재검토 트리거는 사용자/연결 기기 증가, 코드 분실·공유·유출 문의, 외부 채널 심사 요구로 정리
  - 추후 진행안은 12자 이상 코드, 입력 정규화, pair rate limit/audit, 코드 재발급, 신규 기기 알림/승인, digest 저장 전환으로 기록

## [2026-05-23] update: 홈 함께 기록 인기 작품 fallback production 반영
- 대상: PR #37, web/api staging runs `26330960327` / `26330960490`, web/api production runs `26331154875` / `26331157652`, `docs/home-trending-fallback.md`
- 생성/수정: AGENTS.md, docs/home-trending-fallback.md, features/home-popular-fallback.md, index.md, log.md
- 노트:
  - 홈 `요즘 함께 하는 기록들`은 실제 공개 기록을 먼저 최대 6개 표시하고, 부족분만 `/api/titles/popular` 기반 fallback 카드로 채움
  - fallback 카드는 `인기 작품` / `Popular pick` 배지로 실제 함께 기록과 구분하고, 클릭 시 QuickLog 영상 검색어를 프리필
  - 한국어 fallback은 TMDB weekly trending movie/tv를 최대 5페이지 overfetch한 뒤 `original_language=ko` 또는 `origin_country=KR`인 항목만 노출
  - 비한국어 fallback은 `Accept-Language`에서 추정한 region과 TMDB watch availability 기반 discover 후보를 사용
  - 배포 SHA `9a3fcdf28ef142f2021c143da3a00598762a6053` 기준 staging/prod web/api image tag 업데이트 및 production 반영 확인

## [2026-05-23] update: 페어링 코드 복구 카드 production 반영
- 대상: PR #36, web staging run `26327104098`, web production run `26329158127`, `docs/pairing-recovery-card.md`
- 생성/수정: AGENTS.md, docs/pairing-recovery-card.md, features/pairing-recovery-card.md, index.md, log.md
- 노트:
  - 설정 > 기기 연결에서 페어링 코드가 있는 경우 개인 보관용 `복구 카드 저장` 액션을 노출
  - 복구 카드는 브라우저 Canvas에서 로컬 PNG로 생성하며 서버 이메일 발송, 서버 이미지 렌더링, 공개 공유 UX는 제외
  - 카드와 설정 UI에 다른 사람에게 공유하지 말라는 경고와 서버 미전송 문구를 표시
  - 배포 SHA `b5b30af29731aae89ddc3bd336ad3752feddc666` 기준 staging/prod web image tag 업데이트 완료

## [2026-05-21] update: Android alpha 1.0.6 closed-test refresh
- 대상: GitHub Actions TWA release run `26228374153`, `gplay tracks get`, `gplay testers get`
- 생성/수정: AGENTS.md, docs/twa.md, docs/twa-play-launch-checklist.md, platforms/twa.md, index.md
- 노트:
  - Google Play production access 재신청 전 14일 closed-test 재시작을 위해 `1.0.6` (`versionCode=10`)을 `alpha`에 version-only refresh로 업로드
  - `gplay` 확인 기준 `alpha`는 `1.0.6` (`versionCode=10`, `status=completed`), `production`은 게시 릴리즈 없음
  - `alpha` 테스터 그룹은 `ottline-beta-testers@googlegroups.com`
  - 12명 이상 실제 테스터 opt-in, 14일 연속 유지, 참여/피드백/조치 이력 확보 후 production access 재신청 필요

## [2026-05-21] update: CLS 안정화 및 프로필 아바타 배율 조정 production 반영
- 대상: PR #35, web staging run `26227067104`, web production run `26227235012`, ArgoCD `ott-staging-app` / `ott-app`
- 생성/수정: log.md
- 노트:
  - 홈/타임라인 초기 로딩 skeleton, 모바일 top/bottom navigation CSS 전환, 프로필 프롬프트 계정 화면 이동으로 초기 레이아웃 변동을 줄임
  - 프로필 아바타 및 공유카드 서명 아바타 확대 배율을 낮춰 과확대에 따른 품질 저하를 완화
  - 배포 SHA `95abe5f6e3544ded276d1d7adc39440fd300ac11` 기준 staging/prod web 이미지 교체와 ArgoCD `Synced / Healthy` 확인
  - production smoke: `https://ottline.app/`, clean-bg avatar asset, `/api/titles/search` 응답 확인

## [2026-05-18] update: 토스 인앱 승인 및 출시 완료 반영
- 대상: 토스 인앱 미니앱 출시 상태, `내 OTT 타임라인` 표시명
- 생성/수정: platforms/toss-inapp.md, index.md, AGENTS.md
- 노트:
  - 토스 인앱 미니앱이 재검토 승인 후 출시 완료된 상태를 현재 운영 문서에 반영
  - 토스 표시명을 `내 OTT 타임라인`으로 기록
  - 토스 인앱은 main에 병합하지 않고 별도 브랜치/채널 산출물로 운영하는 원칙 유지

## [2026-05-17] update: 공개 리액션 v1 구현 기록
- 대상: `feature/public-reactions`, docs/public-reactions-v1-2026-05-17.md
- 생성/수정: features/public-reactions.md, index.md
- 노트:
  - 함께 메뉴 공개 글에 댓글과 분리된 리액션 집계를 추가하는 v1 범위 기록
  - `DONE`, `CURIOUS`, `SAVE` 리액션과 local-first 내 기록 저장 규칙을 명시
  - 낙장불입 정책 재검토는 별도 태스크로 분리

## [2026-05-17] update: 무로그인 개인 프로필 v1 배포 확인
- 대상: PR #33, production deploy runs `25984577795` / `25984619366`, ArgoCD `ott-app`
- 생성/수정: features/personal-profile.md, features/share-card.md, features/timeline.md, index.md
- 노트:
  - 기존 페어링 계정에 닉네임, 성향 타이틀, clean-bg WebP 프리셋 아바타를 저장하는 개인 프로필 v1을 production 반영 완료
  - 배포 SHA `652c249ba7b09f7d9086652514436a2d5fb31c1a` 기준 `ott-api`, `ott-web` production 이미지 교체 확인
  - ArgoCD `ott-app`은 revision `240f531cb211e293c8d1d85497f8758bff2bbde6` 기준 `Synced / Healthy`
  - 공유 포토 카드에 선택형 `아바타 + 닉네임 · by ottline.app` 서명 옵션을 추가하고 production 렌더 `200 image/png` 확인
  - `/api/auth/profile` 무인증 401, `/api/titles/search`, clean-bg avatar asset 응답 확인

## [2026-05-11] update: Android alpha 1.0.5 upload
- 대상: GitHub Actions web production run `25656621482`, TWA release run `25656711609`, `gplay tracks get`
- 생성/수정: platforms/twa.md, index.md
- 노트:
  - web production에 `5039d6f38666aabc4e6bd49308113962f95c93fe` 반영 완료
  - `twa-release.yml`로 Google Play `alpha`에 `1.0.5` (`versionCode=9`) 업로드 완료
  - `gplay` 확인 기준 `alpha`는 `1.0.5` (`versionCode=9`, `status=completed`), `production`은 게시 릴리즈 없음
  - Play release notes에 Android closed-test feedback flow 추가 내용을 남김

## [2026-05-11] update: Android alpha feedback loop
- 대상: `apps/web/app/[locale]/account/page.tsx`, `apps/web/app/[locale]/feedback/page.tsx`, `apps/web/app/[locale]/page.tsx`, `apps/web/components/FeedbackInbox.tsx`, `apps/web/components/QuickLogCard.tsx`, `.github/workflows/twa-release.yml`, `docs/twa-android-alpha-feedback-loop-2026-05-11.md`
- 생성/수정: platforms/twa.md, features/feedback.md, index.md
- 노트:
  - 재진행 중인 Android 비공개 테스트에서 테스터 의견 수집과 조치 이력을 남기기 위한 `1.0.5` (`versionCode=9`) 업데이트 후보를 정리
  - Google Play TWA 세션에서만 설정 화면에 Android 테스트 체크리스트와 `Android 테스트 의견 보내기` 진입 추가
  - 문의함 preset(`/feedback?source=android-alpha`, `/feedback?source=android-alpha-share`)과 QuickLog 공유 진입 성공/실패 안내 추가
  - `twa-release.yml`에 Play release notes 입력을 추가해 alpha 릴리스 노트를 함께 남길 수 있게 함

## [2026-05-08] update: Android production access denied
- 대상: 사용자 전달 Google Play 심사 결과, `gplay tracks get`, `gplay testers get`
- 생성/수정: platforms/twa.md, index.md
- 노트:
  - Google Play 프로덕션 액세스가 부여되지 않음
  - Play 검토 사유는 비공개 테스트 중 실제 테스터 참여 없음, 사용자 의견 수집/조치/앱 업데이트 같은 테스트 권장사항 미충족
  - `gplay` 기준 production 트랙은 여전히 게시 릴리즈가 없고, `alpha`는 `1.0.4` (`versionCode=8`) `completed` 상태
  - `alpha` 테스터 그룹은 `ottline-beta-testers@googlegroups.com`
  - 재신청 전 실제 테스터 대상 14일 비공개 테스트와 참여/피드백/조치 이력 확보 필요

## [2026-05-03] update: Android production release submitted
- 대상: 사용자 확인, `gplay tracks get/list`
- 생성/수정: platforms/twa.md, index.md
- 노트:
  - Android 비공개 테스트 종료 후 Google Play 프로덕션 출시 제출 완료
  - `gplay` 기준 현재 게시된 production 트랙 릴리즈는 아직 없고, `alpha`는 `1.0.4` (`versionCode=8`) `completed` 상태
  - Play 심사 승인 후 production 트랙 노출과 실제 설치 가능 여부 재확인 필요

## [2026-05-02] update: 댓글 인증, 문의함 운영 필터, 타임라인 검색 반영
- 대상: `CommentController`, `AdminFeedbackConsole`, `FiltersBar`, `timeline/page.tsx`, `LogController`, `WatchLogRepository`, `AGENTS.md`
- 생성/수정: features/feedback.md, features/timeline.md, index.md
- 노트:
  - 공개 댓글 작성 시 body의 `userId`를 신뢰하지 않고 `X-User-Id` + `X-Device-Id` 활성 기기 검증으로 작성자를 확정
  - 관리자 문의함에 미답변/전체/답변 완료/종료 필터, 카운트, 미답변 경과 시간 SLA 배지 추가
  - 타임라인에 제목/메모/플랫폼/도서 저자·출판사 검색을 추가하고 로컬 IndexedDB와 서버 `GET /api/logs?q=` 경로를 맞춤

## [2026-04-29] update: Android 1.0.4 alpha 모바일 실기기 확인
- 대상: `app.ottline` Play `alpha` `1.0.4` (`versionCode=8`), `AGENTS.md`, `docs/twa.md`, `docs/twa-play-launch-checklist.md`, `docs/twa-android-entrypoints-2026-04-29.md`
- 생성/수정: platforms/twa.md, index.md
- 노트:
  - 모바일 Play 설치본에서 홈 위젯 `영상` / `책` / `타임라인` 진입 정상 확인
  - 앱 아이콘 롱프레스 shortcuts 4종 표시 및 진입 정상 확인
  - OTT 앱의 공유하기로 ottline을 호출했을 때 QuickLog 조회/검색 프리필 정상 확인

## [2026-04-29] update: 로컬 Android 빌드 제약 명시
- 대상: `AGENTS.md`, `docs/twa.md`, `docs/twa-play-launch-checklist.md`, `docs/twa-android-entrypoints-2026-04-29.md`, `wiki/pages/platforms/twa.md`
- 생성/수정: platforms/twa.md, index.md
- 노트:
  - 현재 로컬 작업환경(WSL on ARM Linux)에서는 `assembleDebug`/`bundleRelease`가 `aapt2` 바이너리 호환 문제로 실패하는 알려진 제약임을 운영 문서에 명시
  - Android APK/AAB 검증과 Play 배포의 source of truth를 GitHub Actions로 고정
  - 로컬 Gradle은 필요 시 `:app:generateShorcutsFile` 같은 리소스 생성 확인까지만 제한적으로 사용하도록 정리

## [2026-04-29] update: Android TWA 진입면 보강 alpha 배포 반영
- 대상: `apps/twa`, `apps/web/app/manifest.webmanifest/route.ts`, `apps/web/app/[locale]/page.tsx`, `docs/twa-android-entrypoints-2026-04-29.md`
- 생성/수정: platforms/twa.md, index.md
- 노트:
  - 런처 롱프레스 shortcuts 4종(`기록하기`, `영상 기록`, `책 기록`, `타임라인`)을 추가
  - PWA/TWA Web Share Target 계약을 명시하고 URL 공유용 `shared_url` 처리를 추가
  - Android 홈 화면 위젯 액션을 `영상`, `책`, `타임라인`으로 분리
  - GitHub Actions Run `25090236209`로 Play `alpha` 트랙에 `1.0.4` (`versionCode=8`) 배포 완료
  - `/manifest.webmanifest`를 route handler로 전환하고 web production deploy run `25090523988` 후 live `share_target` 노출 확인

## [2026-04-19] update: 설정의 서버 데이터 전체 삭제 정책 반영
- 대상: `apps/api/src/main/java/com/watchlog/api/web/AuthController.java`, `apps/api/src/main/java/com/watchlog/api/service/AccountDeletionService.java`, `apps/web/app/[locale]/account/page.tsx`, `apps/web/messages/{ko,en}.json`, AGENTS.md
- 생성/수정: features/delete-sync.md, index.md
- 노트:
  - `DELETE /api/auth/account`를 추가해 계정 단위 서버 데이터 전체 삭제를 지원
  - 설정 화면에 `서버 데이터 전체 삭제` 액션을 추가하고, `로컬 초기화`와 의미를 분리
  - 개별 기록 삭제 없음 정책은 유지하되 FAQ/개인정보 안내/운영 문서를 새 동작에 맞게 갱신

## [2026-04-19] update: 헤더 언어 전환 추가 및 web staging/production 배포 반영
- 대상: PR #10, `apps/web/components/AppHeader.tsx`, `apps/web/messages/{ko,en}.json`, GitHub Actions web deploy runs
- 생성/수정: architecture/i18n.md, processes/staging.md, index.md
- 노트:
  - 헤더에 `KO` / `EN` 글로벌 전환 버튼을 추가하고, 현재 보고 있는 경로와 query를 유지한 채 locale만 바꾸도록 반영
  - staging web deploy run `24619740878` 성공, 배포 SHA `21bba7fb2d4203eb1bf39b201ba8965641db6b6a`
  - production web deploy run `24619856079` 성공, 동일 SHA를 입력값으로 사용

## [2026-04-18] update: public repo 보안 후속 정리 항목 기록
- 대상: 공개 저장소 보안 검토 결과, `deploy/oke*/registry-secret.yaml`, `apps/api/src/main/resources/application-local.yaml`, 문서 내 자격증명 표기
- 생성/수정: processes/security.md, index.md
- 노트:
  - 즉시 수정 대신 후속 계획으로 남길 항목을 정리
  - OCIR pull secret의 ESO/Vault 전환, TMDB 개발용 토큰 env 치환, 문서 scrub, git history 정리 필요성을 명시
  - 사용자 확인 기준 ArgoCD 비밀번호는 이미 변경된 상태이고, 문서의 값은 예전 잔재로 기록

## [2026-04-18] update: old domain Cloudflare 301 컷오버 및 마이그레이션 UI 정리
- 대상: Cloudflare redirect rule, `apps/web/app/[locale]/layout.tsx`, `apps/web/app/[locale]/migration-helper/page.tsx`, `apps/web/messages/{ko,en}.json`
- 생성/수정: architecture/navigation-auth-migration.md, features/analytics.md, processes/ottline-branding.md, index.md
- 노트:
  - `https://ott.preview.pe.kr/`와 `https://ott.preview.pe.kr/ko/about?x=1`이 각각 `https://ottline.app/`, `https://ottline.app/ko/about?x=1`로 `301` 응답하는 것을 확인
  - 웹앱의 MigrationBanner 노출을 제거하고 `migration-helper`는 locale 홈으로 즉시 리다이렉트하는 잔존 경로로 축소
  - admin analytics의 구 도메인 안내 문구를 “301 판단용”에서 “컷오버 후 잔존 유입 모니터링용”으로 갱신

## [2026-04-18] update: 루트 OG 이미지 교체 및 web staging/production 배포 반영
- 대상: `apps/web/public/ottline.png`, `apps/web/public/og-image.png`, GitHub Actions web deploy runs
- 생성/수정: processes/ottline-branding.md, processes/staging.md, index.md
- 노트:
  - 루트 공유용 OG 이미지를 `ottline.png` 기준 1200×630 `og-image.png`로 교체
  - staging web deploy run `24603483718` 성공, production deploy SHA `4c885565b74ba02f9a39736cf990c436791d2748`
  - production web deploy run `24603593210` 성공

## [2026-04-18] update: Android 비공개 테스트 시작 상태 반영
- 대상: 사용자 확인, `gplay tracks/testers` 조회
- 생성/수정: platforms/twa.md, index.md
- 노트:
  - `app.ottline` 기준 `internal` / `alpha` 트랙 모두 `6 (1.0.2)`, `status=completed` 상태 확인
  - `alpha` 트랙에 `ottline-beta-testers@googlegroups.com` 테스터 그룹이 연결된 상태 확인
  - 기존 `준비 완료/테스터 모집` 표현을 `2026-04-18 비공개 테스트 시작` 기준으로 갱신

## [2026-04-17] update: Android 비공개 테스트 준비 완료 및 테스터 모집 상태 반영
- 대상: GitHub Actions TWA AAB 빌드, Google Play 트랙 상태 확인, `assetlinks.json`
- 생성/수정: platforms/twa.md, index.md
- 노트:
  - `versionName=1.0.2`, `versionCode=6` 기준 AAB를 재생성하고 Play `internal` / `alpha` 트랙 반영 완료
  - 비공개 테스트(Closed testing) 준비 완료 상태와 테스터 모집 진행 중 상태를 위키에 명시
  - production `assetlinks.json`에도 최신 Play signing fingerprint 3개가 모두 반영된 상태 확인

## [2026-04-17] update: Android 배포 기준을 TWA 현행 기준으로 정정
- 대상: 사용자 확인, `apps/twa`, `.github/workflows/twa-*.yml`, `feat/native-mobile-app` 브랜치
- 생성/수정: index.md, platforms/twa.md, platforms/native.md, processes/ottline-branding.md, docs/twa.md, docs/twa-play-launch-checklist.md, docs/twa-play-store-listing-ko.md, docs/assetlinks.template.json
- 노트:
  - Android 히스토리를 Flutter 프로토타입 → TWA internal track → Expo 후보 브랜치로 재정리
  - 저장소에는 Capacitor 코드가 없고, 기존 `TWA -> Capacitor` 표기는 문서 결정만 남아 있던 상태로 정정
  - 현재 작업환경에서 로컬 TWA 빌드는 `aapt2` 바이너리 호환 이슈로 실패해 CI가 계속 source of truth

## [2026-04-17] update: 도메인 마이그레이션 운영 상태 현재 기준으로 정정
- 대상: 사용자 확인, apps/web/app/[locale]/admin/analytics/page.tsx, apps/api/src/main/java/com/watchlog/api/service/AnalyticsService.java
- 생성/수정: index.md, architecture/navigation-auth-migration.md, processes/ottline-branding.md
- 노트:
  - 위키에 남아 있던 `2026-04-15 301 전환` 표현을 실제 운영 상태와 맞게 수정
  - 현재는 old domain을 의도적으로 열어두고 자발적 이전 유도 + 잔존 사용 추이를 관찰 중
  - 301 컷오버 판단은 `app_open` 총량이 아니라 old domain의 실사용 이벤트 위주로 본다는 해석을 명시

## [2026-04-16] update: 구 도메인 잔존 사용 지표 분리
- 대상: docs/plan-old-domain-analytics-cutover.md, apps/api/src/main/java/com/watchlog/api/service/AnalyticsService.java, apps/api/src/main/java/com/watchlog/api/dto/AdminAnalyticsOverviewDto.java, apps/api/src/main/java/com/watchlog/api/dto/AdminOldDomainUsageDto.java, apps/web/app/[locale]/admin/analytics/page.tsx
- 생성/수정: features/analytics.md
- 노트:
  - admin analytics overview에 `oldDomainUsage` 응답 추가
  - `ott.preview.pe.kr`의 `app_open` 총량과 별도로 `login_success`, `log_create`, `share_action`, `known user`를 분리 표시
  - old domain을 계속 열어두는 동안 `app_open`은 단순 방문도 누적되므로 301 컷오버 판단은 실사용 이벤트 위주로 해석

## [2026-04-15] update: 데일리 리포트 지표 변경 운영 배포 반영
- 대상: PR #6, production deploy SHA `a63ae1d393d04a366dc1377699b01f7c48c80a17`, GitHub Actions production deploy runs
- 생성/수정: features/daily-report.md, index.md
- 노트:
  - `로그 생성 사용자`와 `신규 로그 수(DB)` 병기 상태가 production web/api에 반영됨
  - staging 검증 후 동일 SHA로 production 배포 완료
  - 운영 리포트 해석 시 이벤트 기준 사용자 수와 DB 기준 row 수를 구분해야 함

## [2026-04-15] update: 데일리 리포트 내부 지표 정의 분리
- 대상: docs/plan-daily-report.md, apps/api/src/main/java/com/watchlog/api/service/DailyReportService.java, apps/api/src/main/java/com/watchlog/api/dto/DailyReportDto.java, apps/web/app/[locale]/admin/report/page.tsx
- 생성/수정: features/daily-report.md
- 노트:
  - `로그 생성` 표기를 `로그 생성 사용자`로 명확화
  - `watch_logs.created_at` 기준 `신규 로그 수(DB)` 추가
  - 요청 시점 실시간 누적이 아니라 전일 KST 1일치 집계라는 해석 유지
  - 오프라인 후 지연 sync 기록은 서버 반영 날짜 기준으로 집계됨

## [2026-04-14] update: 앱인토스 심사 반려 대응 재테스트 결과 반영
- 대상: docs/apps-in-toss-review-fixes-2026-04-14.md, apps/web/lib/share.ts, apps/web/lib/shareCardCanvas.ts, apps/web/lib/url.ts, apps/web/components/ShareBottomSheet.tsx
- 생성/수정: platforms/toss-inapp.md
- 노트:
  - 핀치 줌 차단, API 통신, 공유 카드 미리보기, 이미지 저장까지 실기기 확인 완료
  - 프로덕션 `ottline.app` OG 라우트 배포 상태와 무관하게 앱인토스 내부 canvas 렌더 fallback 추가
  - 앱인토스 SDK `share`는 텍스트 메시지만 지원하므로 공유 포맷은 현재 텍스트 공유로 제한됨

## [2026-04-14] update: 앱인토스 심사 반려 사유 대응 코드 반영
- 대상: 2026-04-14 앱인토스 심사 결과, docs/apps-in-toss-review-fixes-2026-04-14.md, apps/web/app/[locale]/layout.tsx, apps/web/lib/appsInToss.ts, apps/web/lib/share.ts, apps/web/components/ShareBottomSheet.tsx
- 생성/수정: platforms/toss-inapp.md, index.md
- 노트:
  - 토스 공식 가이드에 맞춰 `tossmini.com` 환경에서 viewport를 `maximum-scale=1`, `user-scalable=no`로 강제
  - 공유 카드 저장은 앱인토스 네이티브 `saveBase64Data` 브리지 우선 사용
  - 공유 버튼은 preview 준비 여부와 무관하게 즉시 클릭 가능하도록 수정하고, Web Share(files) 불가 시 텍스트 네이티브 `share`로 fallback

## [2026-04-14] ingest: Cloudflare CLS 분석 및 footer 대응 반영
- 대상: `Account Analytics _ ottline.app _ Cloudflare.pdf`, apps/web/components/AppFooter.tsx, GitHub Actions 배포 이력
- 생성/수정: architecture/web-performance.md (신규), index.md
- 노트:
  - Cloudflare PDF에서 `/timeline`의 footer를 주요 CLS 원인으로 확인
  - `AppFooter`의 `apiVersion` 런타임 fetch 및 버전 라인 제거
  - staging/production web 배포 완료 후 재관측 필요

## [2026-04-13] update: 낙장불입 정책 및 로컬 초기화 의미 정리
- 대상: AGENTS.md, apps/web/app/[locale]/account/page.tsx, docs/delete-sync-mvp.md
- 생성/수정: features/delete-sync.md, index.md
- 노트:
  - 사용자용 개별 기록 삭제 없음으로 제품 정책 확정
  - 설정의 로컬 초기화는 현재 기기 브라우저 저장소만 삭제하는 기능으로 재정의
  - 삭제 동기화(tombstone) + 복구 UX는 현재 우선순위에서 제외

## [2026-04-13] fix: Naver 미노출 — localePrefix as-needed 수정
- 대상: apps/web/i18n/routing.ts
- 생성/수정: architecture/geo-seo.md
- 노트: 사이트맵 URL 전체가 307 반환하던 문제 수정. 배포 후 네이버 서치어드바이저 수집 재요청 필요.

## [2026-04-13] update: Whale Store 제출
- 대상: apps/browser-extension
- 생성/수정: platforms/browser-extension.md
- 노트: 2026-04-13 제출 완료, 심사 중

## [2026-04-13] update: 미래의 타임라인 추천 품질 개선
- 대상: main 브랜치
- 생성/수정: features/future-timeline.md, docs/future-timeline-llm-recommendation.md
- 노트:
  - 이력 범위 최근 3개월 최대 50개로 변경
  - LLM 결과를 시청 이력 + excluded 서버 측 dedup
  - 프롬프트에 메모/장소/누구와 포함, 외국 작품 원제 요청
  - 기본 모델 claude-opus-4-5 → claude-sonnet-4-6
  - recommendation_open/refresh/dismiss 이벤트 트래킹 추가
  - analytics 엔드포인트 /api/analytics → /api/nalytic (광고 차단기 우회)

## [2026-04-12] ingest: 미래의 타임라인 (LLM 추천) 기능 추가
- 대상: feature/future-timeline-recommendation 브랜치
- 생성/수정: features/future-timeline.md (신규), index.md
- 노트: Claude/Gemini 병렬 호출, TMDB 포스터 enrichment, 하루 1회 새로고침 제한

## [2026-04-07] ingest: ui-ux-pro-max 디자인 점검
- 대상: apps/web (main 브랜치 기준)
- 생성/수정: processes/design-review.md (신규), index.md
- 노트:
  - --primary가 브랜드 네이비 미연결 → shadcn 밋밋한 주요 원인
  - cursor-pointer 전체 누락
  - 수정은 feature/shadcn-migration 브랜치에서 진행 예정

## [2026-04-07] ingest: 토스 인앱 2차 검수 재제출
- 대상: 검수 피드백 대응 완료
- 생성/수정: platforms/toss-inapp.md
- 노트:
  - icon-600.png 투명 모서리 → #F0F6FF 채움, thumbnail-1932x828.png 레터박스 바 제거
  - granite.config.ts icon CDN URL 갱신, ait 재빌드 (deploymentId: 019d6065-ee4e-707a-b250-f43807c77f59)
  - 2026-04-07 2차 검수 재제출 완료

## [2026-04-06] ingest: feat/native-mobile-app 브랜치 작업 내용
- 대상: `feat/native-mobile-app` 브랜치 (12 커밋, main 미머지)
- 생성/수정:
  - platforms/native.md (신규) — React Native + Expo 앱 구조, 실행법, 구현 현황
  - features/dna-aura.md (신규) — 26종 특질 계산, Aura 글로우 시각화
  - index.md 갱신 (native, dna-aura 추가)
- 노트:
  - `apps/native/` 디렉토리 전체 신규 (브랜치에만 존재)
  - DEVELOPMENT.md에 구현 완료 기능 문서화 잘 되어 있음
  - kmp.md와 twa.md 크로스링크 업데이트 별도 필요

## [2026-04-06] ingest: feature/apps-in-toss-miniapp 브랜치 문서 및 피드백
- 대상: docs/apps-in-toss-miniapp-plan.md, apps/web/public/icon-600.png, apps/web/public/thumbnail-1932x828.png, apps/web/ottline.ait
- 생성/수정: platforms/toss-inapp.md (전면 재작성), index.md
- 노트:
  - Phase 0·1 완료, Phase 2 미완료, 검수 결과 대기 중 (요청일 2026-04-05)
  - icon-600.png: 라운드 코너 pre-apply → full-bleed 사각형으로 재제작 필요
  - thumbnail-1932x828.png: 가로형 배너, 양쪽 레터박스 바 → full-bleed 재제작 필요
  - .ait 설정 icon 참조는 icon-192.png (icon-600.png와 별개)

## [2026-04-05] ingest: docs/ 전체 문서 위키 페이지화
- 대상: docs/ 내 34개 문서 (assetlinks.template.json 제외)
- 생성/수정:
  - architecture/geo-seo.md (GEO-AUDIT-REPORT.md)
  - architecture/i18n.md (i18n-globalization-plan.md, admin-analytics-i18n-preview-fix.md, together-menu-locale-filtering.md)
  - architecture/navigation-auth-migration.md (navigation-auth-migration.md, plan-migration-status-tracking.md)
  - features/analytics.md (analytics-report-pages-mvp.md, analytics-web-pwa-twa.md)
  - features/book-log.md (book-log-mvp.md)
  - features/daily-report.md (plan-daily-report.md)
  - features/dark-mode.md (dark-mode.md)
  - features/delete-sync.md (delete-sync-mvp.md)
  - features/feedback.md (basic-feedback-channel-plan.md)
  - features/onboarding.md (first-log-overlay-onboarding-guide-2026-02-10.md)
  - features/share-card.md (share-card-mvp.md)
  - features/timeline-export.md (timeline-export.md)
  - platforms/browser-extension.md (browser-extension-mvp.md)
  - platforms/ms-store.md (ms-store-listing-copy.md, ms-store-pwa-plan.md)
  - platforms/pwa.md (pwa-plan.md)
  - platforms/twa.md (twa.md, twa-play-launch-checklist.md, twa-play-store-listing-ko.md)
  - processes/code-review.md (code-review-2026-02-06.md)
  - processes/gitops.md (GitOps_Guide.md)
  - processes/ottline-branding.md (ottline-transition-task.md, plan-ottline-branding-phase2.md)
  - processes/security.md (security-incident-checklist.md)
  - processes/staging.md (staging-environment-plan.md)
  - processes/ux-copy.md (ux-copy-consistency-playbook-2026-02-10.md, ui-copy-updates.md)
  - processes/ux-reviews.md (ux-review-2026-02-06.md, ux-review-2026-02-10.md)
  - index.md 갱신
- 노트:
  - 관련 문서 병합: i18n 관련 3개 → i18n.md, UX 리뷰 2개 → ux-reviews.md, TWA 3개 → twa.md, MS Store 2개 → ms-store.md, 브랜딩/전환 2개 → ottline-branding.md
  - retro-mode-usage-decision-2026-02-13.md 내용은 ux-copy.md 및 ux-reviews.md 내 레트로 관련 섹션으로 흡수

## [2026-04-05] init: 위키 초기 구조 생성
- 대상: 프로젝트 루트
- 생성/수정: CLAUDE.md, index.md, log.md
- 노트: docs/ 기존 문서들을 sources로 활용 예정

## [2026-04-05] update: security.md — OCI Vault 전환 완료 반영
- 대상: 사용자 확인
- 생성/수정: processes/security.md
- 노트: 보안 사고 대응 체크리스트 미완료 항목들 → OCI Vault + ESO 전환 완료(2026-03-29)로 해소됨
