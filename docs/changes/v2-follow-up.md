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

[PR #137](https://github.com/chawon/ott/pull/137)(`feature/ios-native-v2`)에서 iOS·iPadOS와 macOS SwiftUI v2를 단계적으로 검증·출시한다.

### iOS / iPadOS 진행 현황 (`2026-11-21`)

- **브랜치 / 제출 기준 커밋**: `feature/ios-native-v2` `f8fa77d` (`bfcfd30`~`f8fa77d`: 최소 지원 `iOS 16.0` 하향, 미래의 타임라인 복구 `#142`, 2단계 포스터 캐시, 온디바이스 즉시 공유 카드, 도킹 하단 바, iPad `서가` 중복·iPhone 영어 `Together` 탭 수정 포함)
- **완료한 검증 및 App Store 제출**:
  - **단위 테스트**: `OttlineCoreTests` 18/18 통과, `OttlineMacTests` 5/5 통과
  - **실기기 검증**: 실기기 **iPhone X (`iOS 16.7.16`)** 및 **iPad 10세대**에 서명 빌드 설치·실행하여 홈·타임라인·도킹 하단 바·포스터 캐시·공유 카드 즉시 생성·앱 아이콘을 확인
  - **App Store 제출 (`2.0.0`, build `26`)**: Release 아카이브(`CFBundleIdentifier=app.ottline`, `MinimumOSVersion=16.0`, `OttlineWidgetExtension.appex` + `OttlineShareExtension.appex` 포함)를 App Store Connect에 업로드(`EXPORT SUCCEEDED`)하고, 한국어·영어(미국) 스크린샷(iPhone 6.3" `1206×2622`, iPad 13" `2048×2732`)·릴리즈 노트·심사 메모를 입력해 **App Store 심사 제출 완료**
- **남은 확인 (iOS)**:
  - App Store `2.0.0 (26)` 심사 승인·공개 게시 확인 및 공개 스토어판의 기존 Expo `1.0.4` 인플레이스 업데이트 실사용 최종 확인
  - [PR #137](https://github.com/chawon/ott/pull/137) CI 통과 확인 및 `main` 병합

### macOS 남은 작업

- 서명된 설치 앱에서 실기기 UI·기능 검수, App Sandbox(`com.apple.security.app-sandbox`) 활성화 검증, 공유 카드 로컬 생성 전환 점검
- Safari·Chrome의 계정과 기록 이어받기(`?native_handoff=1` → `ottline://open?handoff=1`), 기존 세션이 없는 경우, 빠른 기록(`ottline://quick`) 제목·플랫폼 미리 채우기 확인
- App Store Connect 신규 macOS 플랫폼 등록·제출 및 게시 URL 확인 후 웹·브라우저 확장 macOS 분기 활성화. [macOS 플랫폼 상태](../../wiki/pages/platforms/macos-native.md)

## 3. 브라우저 확장·토스·ChatGPT 앱

Windows PC를 사용하는 검증에서 스토어 설치 확장 → Web → Windows 앱 빠른 기록도 확인한다. Chrome·Edge·Whale은 기존 등록 항목의 갱신으로 진행한다. ChatGPT 앱의 읽기 전용 재제출 준비와 토스 공개판 확인은 별도로 진행할 수 있다. [채널별 작업과 출시 기준](v2-channel-strategy.md)
