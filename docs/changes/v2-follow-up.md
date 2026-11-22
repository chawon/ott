# ottline v2 후속 작업

개편 이후 작업의 착수점이다. 각 항목을 진행할 때 연결된 코드와 PR의 최신 상태를 확인하고, 완료한 결과와 다음 확인을 이 문서 또는 해당 변경안에 남긴다.

## 1. Windows 서버 계정 삭제 수정

Windows의 서버 계정 삭제에서 요청 경로와 실패 처리의 불일치가 확인됐다. [삭제 정책과 증거](../../wiki/pages/features/delete-sync.md#windows-확인-사항)

- 소스는 [Windows API 클라이언트](../../apps/windows-native/src/Ottline.Core/Remote/OttlineApiClient.cs), [Windows 저장소](../../apps/windows-native/src/Ottline.Core/Data/OttlineRepository.cs), [설정 ViewModel](../../apps/windows-native/src/Ottline.App/ViewModels/MainViewModel.cs)이다. `DELETE /api/auth/account`를 호출하고 서버 성공(2xx)을 확인한 뒤에 로컬 초기화와 성공 안내를 실행한다.
- HTTP 오류와 네트워크 실패에는 로컬 기록·이력·미동기화 변경(`outbox`)·연결 상태가 보존돼야 한다. 성공 시 초기화와 안내, 실패 시 보존과 재시도를 테스트용 계정 또는 모의 API로 확인한다.
- [Windows 개발 가이드](../../apps/windows-native/README.md)의 테스트와 패키지 검증을 사용한다. 코드 병합, 스토어 업데이트와 설치 확인을 각각 기록한다.

### 진행 현황 (`2026-11-20`)

- **PR / 병합 커밋**: [PR #140](https://github.com/chawon/ott/pull/140) 병합 완료 (`main` `1fb24ee`, 코드 커밋 `e8b9f24`, 기준 `e93f3e4`)
- **구현 완료**:
  - `OttlineApiClient.DeleteServerAccountAsync()` 요청 경로를 `DELETE /api/auth/account`로 수정하고 구조화된 결과(`Deleted` / `NotConnected` / `HttpError` / `NetworkError`) 반환, 미연결(`UserId`/`DeviceId` 누락) 가드 및 예외 처리 추가 (`UnlinkDeviceAsync`도 `DELETE /api/auth/devices/{id}`로 정정)
  - `OttlineRepository.DeleteServerAccountAsync()`에서 서버 2xx 응답 확인 후에만 로컬 DB(`logs`, `log_history`, `titles`, `outbox`)와 계정·프로필·동기화 설정을 초기화하고 새 `DeviceId` 발급(언어·테마 등 기기 환경설정은 유지); HTTP 오류·네트워크 실패 시 모든 로컬 데이터와 연결 상태 보존
  - `MainViewModel`·`MainWindow`에 미연결/진행 중 버튼 비활성화(`CanDeleteServerAccount`), 중복 실행 방지, 한·영 확인 대화상자 및 성공·실패(보존 및 재시도 안내) 토스트 반영
- **완료한 검증 및 스토어 제출**:
  - **단위·모의 API 테스트 (`Ottline.Tests`)**: 모의 `HttpMessageHandler` 테스트 5건 추가 포함 **19/19 통과** (성공 `200`/`204`, HTTP 오류 `401`/`404`/`500` 보존+재시도, `HttpRequestException`/타임아웃 보존+재시도, 미연결 계정 무호출 보존, `UnlinkDevice` 경로)
  - **GitHub Actions (`Native Windows CI`)**: PR #140 Run [`44696668066`](https://github.com/chawon/ott/actions/runs/44696668066) 및 `main` (`1fb24ee`) Run [`44697026662`](https://github.com/chawon/ott/actions/runs/44697026662) 모두 성공
  - **Microsoft Store 제출 (`v2.0.1.0`)**: `main` `1fb24ee`에서 `ottline-2.0.1.0.msixbundle` (`x64` `81.42 MB` + `arm64` `77.48 MB`, 총 `158.90 MB`, SHA-256 `6F450DDC0E664EC8FF33CF1579DD0815FBFB6793013AB132C2B9A5A5C6B114B2`) 빌드·검증 후 Partner Center `9NSVNZGDMGF5`에 제출 완료 — Submission ID `1152921505702457337`, 상태 **`Certification`** (`Errors: 0`, `Desktop` 전용 유지)
- **남은 확인**:
  - Microsoft Store `v2.0.1.0` 심사 승인 및 공개 게시(`Published`) 확인
  - 스토어 설치판(`2.0.1.0`) 업데이트 후 테스트 계정으로 서버 계정 삭제 성공 및 실패 보존 실기기 확인

## 2. Apple v2 업데이트 검증

[PR #137](https://github.com/chawon/ott/pull/137) 병합 완료 (`main` `d0844fc`, 코드 HEAD `2634fdc`). `2026-11-22` 사용자가 **macOS·iOS·iPadOS 출시 완료**를 확인했다. 제출 버전은 모두 **`2.0.0 (27)`**이며, 기존 설치판 업데이트·스토어 설치판 연결 검증과 가이드 반영은 아래 담당 업무에서 이어간다.

### 출시 완료와 후속 담당 업무 (`2026-11-22`)

- [출시 완료 카드](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827691)는 완료로 기록한다. [Apple 한국 공개 조회](https://itunes.apple.com/lookup?id=6780318110&country=kr&entity=software)에서도 iOS `2.0.0`, `iosUniversal`, 공개 시각 `2026-11-22 08:11 KST`를 확인했다. 공개 조회에 없는 빌드 번호와 macOS 출시 여부는 제출 기록과 사용자 확인을 각각 근거로 삼는다.
- 설치 링크는 [iPhone·iPad App Store](https://apps.apple.com/app/id6780318110)와 [Mac App Store](https://apps.apple.com/app/id6780318110?platform=mac)다. 동일 Apple ID `6780318110`이며 최소 지원은 iOS/iPadOS `16.0`, macOS `14.0`이다.

| 담당 역할 | 남은 업무와 완료 조건 | 프로젝트 카드 |
| --- | --- | --- |
| Web/PWA 담당 | 한국어·영어 서비스 소개(`/about`)와 관련 가이드에 macOS·iPhone·iPad, 스토어 링크와 연결 코드로 기록 이어쓰기 안내를 반영한다. Web의 macOS 열기·설치 분기는 스토어 설치판 인수 검증과 맞춘다. PR·CI·공개 Web 배포 확인을 남긴다. | [서비스 소개·가이드 반영](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827749) |
| Apple 공통 담당 | 기존 Expo `1.0.4`에서 공개 SwiftUI 앱으로 업데이트할 때 계정·기록·미동기화 변경을 보존하는지 iPhone·iPad에서 확인하고 macOS 결과를 취합한다. | [출시 후 업데이트·데이터 보존 검증](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312000240) |
| macOS 담당 | Mac App Store 설치판에서 Safari·Chrome 이어받기(`?native_handoff=1` → `ottline://open?handoff=1`), `ottline://quick`과 제목·플랫폼 전달을 검증한다. 실제 설치 출처·빌드·OS·브라우저 결과를 남긴다. | [Mac 설치판 연결 검증](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827720) |
| 브라우저 확장 담당 | Chrome·Edge·Whale의 기존 스토어 설치판에서 Web → Windows 및 macOS 빠른 기록 전달과 게시 버전을 확인한다. | [확장 연결·스토어 갱신](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312000267) |
| Apple 공통 담당·iOS 담당 | 출시 선행 조건이 충족된 `2.0.1` 후속 작업을 main 기준으로 착수한다. 실제 착수 시 진행 상태로 바꾸고 iPhone·iPad·Mac 회귀 검증과 추가 제출 결과를 남긴다. | [Apple 큐레이터 제거](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313279211) · [iPad 함께 2단 점검](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313285015) |

공개 서비스 가이드 변경은 Web/PWA 담당에게 배정한 상태다. 이 문서 갱신으로 해당 UI의 배포 완료나 스토어 설치판의 데이터 보존 검증을 완료 처리하지 않는다. 미래의 타임라인 응답 유실·지연 복구와 `quota.used` 실측은 [Apple 추천 복구 카드](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312248018)에서 계속 추적한다.

### iOS / iPadOS · macOS 진행 현황 (`2026-11-21`)

- **PR / 병합 커밋**: [PR #137](https://github.com/chawon/ott/pull/137) 병합 완료 (`main` `d0844fc`, 제출 기준 커밋 `2634fdc`)
- **주요 반영 내역**:
  - 공용 `OttlineCore`: `ObservableObject` 메인 스레드 비동기 통합 발행(`AppPreferences`·`OttlineRepository` AB-BA 데드락 방지), 미래의 타임라인 90초 타임아웃·언어별 `requestId` 복구(`#142`), 2단계 포스터 캐시(`NSCache` + 디스크 LRU), 커스텀 드롭다운(`OttlineSelectDropdown`), `QuickRecordSheet` 초기 상태 즉시 반영 및 macOS 포커스 점프 방지
  - iOS / iPadOS(`apps/ios-native`): 최소 지원 OS `iOS 16.0` 하향, 온디바이스 즉시 공유 카드, 도킹 하단 바, arm64 Debug 스택 오버플로우 해결(`OttlineDeferredSection`), iPad `서가` 중복·iPhone 영어 `Together` 필터 잘림 수정
  - macOS(`apps/macos-native`): **App Sandbox**(`com.apple.security.app-sandbox`) 활성화 및 검증, 온디바이스 즉시 공유 카드(`1080×1920` / `1080×1350`), 전 메뉴 `1280px` 폭 통일 및 2컬럼 작품 상세, 인트로 스플래시, `함께` 내부 스크롤바 정리, 웹 기준 가이드·소개·FAQ·개인정보·문의함 5종 페이지 구현
- **완료한 검증 및 스토어 제출**:
  - **단위 테스트**: `OttlineTests` (iOS) **18/18 통과**, `OttlineMacTests` (macOS App Sandbox 서명 환경) **5/5 통과**
  - **GitHub Actions CI**: `Native iOS v2 CI (SwiftUI)` Run [`44897582945`](https://github.com/chawon/ott/actions/runs/44897582945) · `Native macOS v2 CI (SwiftUI)` Run [`44897582916`](https://github.com/chawon/ott/actions/runs/44897582916) 모두 통과
  - **실기기 검증**: iPhone X (`iOS 16.7.16`), iPad 10세대, macOS(App Sandbox 빌드)에서 핵심 흐름·공유 카드·UI 확인 완료
  - **App Store 제출 (`2.0.0`, build `27`)**:
    - **iOS / iPadOS**: `app.ottline` `2.0.0 (27)`(`MinimumOSVersion 16.0`, Widget·Share 익스텐션 포함) 업로드 및 한·영 스크린샷(iPhone 6.3" / iPad 13")·ASO 제목/부제 반영 후 **심사 제출 완료**
    - **macOS**: `app.ottline` (`id6780318110` macOS 플랫폼 신규 추가) `2.0.0 (27)`(`LSMinimumSystemVersion 14.0`, App Sandbox Release 권한 검증) 업로드 및 한·영 스크린샷(`2560×1600` 각 5장)·심사 메모 입력 후 **최초 심사 제출 완료**
- **당시 남은 확인의 인계**: 심사·공개 대기는 `2026-11-22` 사용자 출시 확인으로 갱신했다. 공개 스토어판 업데이트·macOS 연결·웹/확장 활성화는 위 출시 후 담당 업무에서 추적한다. [macOS 플랫폼 상태](../../wiki/pages/platforms/macos-native.md)
- *(별도 후속 검토)* macOS 데스크톱 WidgetKit 익스텐션과 전용 App Group은 기능 제안이며 현재 출시 검증의 완료 조건에 포함하지 않는다.

## 3. 브라우저 확장·토스·ChatGPT 앱

Windows PC를 사용하는 검증에서 스토어 설치 확장 → Web → Windows 앱 빠른 기록도 확인한다. Chrome·Edge·Whale은 기존 등록 항목의 갱신으로 진행한다. ChatGPT 앱의 읽기 전용 재제출 준비와 토스 공개판 확인은 별도로 진행할 수 있다. [채널별 작업과 출시 기준](v2-channel-strategy.md)
