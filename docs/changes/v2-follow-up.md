# ottline v2 후속 작업

개편 이후 작업의 착수점이다. 각 항목을 진행할 때 연결된 코드와 PR의 최신 상태를 확인하고, 완료한 결과와 다음 확인을 이 문서 또는 해당 변경안에 남긴다.

## 1. Windows 서버 계정 삭제 수정

Windows의 서버 계정 삭제에서 요청 경로와 실패 처리의 불일치가 확인됐다. [삭제 정책과 증거](../../wiki/pages/features/delete-sync.md#windows-확인-사항)

- 소스는 [Windows API 클라이언트](../../apps/windows-native/src/Ottline.Core/Remote/OttlineApiClient.cs), [Windows 저장소](../../apps/windows-native/src/Ottline.Core/Data/OttlineRepository.cs), [설정 ViewModel](../../apps/windows-native/src/Ottline.App/ViewModels/MainViewModel.cs)이다. `DELETE /api/auth/account`를 호출하고 서버 성공(2xx)을 확인한 뒤에 로컬 초기화와 성공 안내를 실행한다.
- HTTP 오류와 네트워크 실패에는 로컬 기록·이력·미동기화 변경(`outbox`)·연결 상태가 보존돼야 한다. 성공 시 초기화와 안내, 실패 시 보존과 재시도를 테스트용 계정 또는 모의 API로 확인한다.
- [Windows 개발 가이드](../../apps/windows-native/README.md)의 테스트와 패키지 검증을 사용한다. 코드 병합, 스토어 업데이트와 설치 확인을 각각 기록한다.

### 진행 현황 (`2026-11-20`)

- **브랜치 / 기준 커밋**: `fix/windows-account-deletion` (기준 `main` `e93f3e4`)
- **구현 완료**:
  - `OttlineApiClient.DeleteServerAccountAsync()` 요청 경로를 `DELETE /api/auth/account`로 수정하고 구조화된 결과(`Deleted` / `NotConnected` / `HttpError` / `NetworkError`) 반환, 미연결(`UserId`/`DeviceId` 누락) 가드 및 예외 처리 추가 (`UnlinkDeviceAsync`도 `DELETE /api/auth/devices/{id}`로 정정)
  - `OttlineRepository.DeleteServerAccountAsync()`에서 서버 2xx 응답 확인 후에만 로컬 DB(`logs`, `log_history`, `titles`, `outbox`)와 계정·프로필·동기화 설정을 초기화하고 새 `DeviceId` 발급(언어·테마 등 기기 환경설정은 유지); HTTP 오류·네트워크 실패 시 모든 로컬 데이터와 연결 상태 보존
  - `MainViewModel`·`MainWindow`에 미연결/진행 중 버튼 비활성화(`CanDeleteServerAccount`), 중복 실행 방지, 한·영 확인 대화상자 및 성공·실패(보존 및 재시도 안내) 토스트 반영
- **완료한 검증**:
  - 모의 `HttpMessageHandler` 기반 단위 테스트 5건 추가 포함 `Ottline.Tests` **19/19 통과** (성공 `200`/`204`, HTTP 오류 `401`/`404`/`500` 보존+재시도, `HttpRequestException`/타임아웃 보존+재시도, 미연결 계정 무호출 보존, `UnlinkDevice` 경로)
  - `./scripts/build-msix.ps1` 및 `./scripts/verify-msix.ps1`로 `x64`/`arm64` MSIX 및 통합 MSIXBundle(`158.90 MB`) 빌드·무결성 검증 통과
- **남은 확인**:
  - PR 리뷰·병합 및 `Native Windows CI` 통과 확인
  - Microsoft Store 업데이트(`2.0.1.0` 등) 제출·게시 후 스토어 설치판에서 테스트 계정으로 삭제 성공 및 실패 보존 실기기 확인

## 2. Apple v2 업데이트 검증

[PR #137](https://github.com/chawon/ott/pull/137)의 iOS·macOS CI는 통과했다. 다음 작업은 서명 빌드의 실기기 검증이다.

- iOS는 기존 App Store Expo `1.0.4` 설치에 v2 빌드를 덮어 업데이트한다. 계정, 기존 기록과 이력, 미동기화 수정이 보존되고 재실행·재연결 뒤 중복 없이 동기화되는지 확인한다. [iOS 플랫폼 상태](../../wiki/pages/platforms/native.md)
- macOS는 서명된 설치 앱에서 Safari·Chrome의 계정과 기록 이어받기, 기존 세션이 없는 경우, 빠른 기록 제목·플랫폼 미리 채우기를 확인한다. Mac App Store 공개 여부와 웹의 연결 활성화는 각각 확인한다. [macOS 플랫폼 상태](../../wiki/pages/platforms/macos-native.md)

## 3. 브라우저 확장·토스·ChatGPT 앱

Windows PC를 사용하는 검증에서 스토어 설치 확장 → Web → Windows 앱 빠른 기록도 확인한다. Chrome·Edge·Whale은 기존 등록 항목의 갱신으로 진행한다. ChatGPT 앱의 읽기 전용 재제출 준비와 토스 공개판 확인은 별도로 진행할 수 있다. [채널별 작업과 출시 기준](v2-channel-strategy.md)
