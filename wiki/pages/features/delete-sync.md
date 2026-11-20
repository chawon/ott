# 삭제 및 초기화 정책

> 현재 기기의 로컬 초기화와 연결 계정 전체 삭제를 구분한다.

## 관련 페이지

- [타임라인](timeline.md)
- [내보내기](timeline-export.md)
- [초기 삭제 동기화 설계](../../../docs/archive/features/delete-sync-mvp.md)

## 제품 정책

- 개별 기록은 상세의 수정 기능으로 정정하고 이력을 남긴다. API는 `PATCH /api/logs/{id}`다.
- **로컬 초기화**는 현재 기기에 저장된 기록과 캐시를 초기화한다. 서버에 동기화된 기록은 재연결과 동기화 후 내려받을 수 있다.
- **서버 데이터 전체 삭제**는 활성 기기로 인증된 계정의 서버 데이터와 연결을 함께 삭제한다. 완료 후 현재 기기의 로컬 데이터도 초기화한다. 성공 안내는 서버 결과가 확인된 뒤 표시한다. [API 진입점](../../../apps/api/src/main/java/com/watchlog/api/web/AuthController.java), [계정 삭제 서비스](../../../apps/api/src/main/java/com/watchlog/api/service/AccountDeletionService.java)

## 플랫폼 구현

| 플랫폼 | 초기화 및 계정 삭제 코드 |
| --- | --- |
| Web/PWA | 설정에서 IndexedDB·브라우저 저장소를 초기화한다. 계정 삭제는 `DELETE /api/auth/account`를 호출한다. [설정 화면](../../../apps/web/app/%5Blocale%5D/account/page.tsx) |
| Android Native | Room과 로컬 인증·동기화 상태를 초기화한다. 계정 삭제는 같은 API를 호출하며 `401` 또는 `404` 응답 시 로컬 정리를 완료한다. [저장소](../../../apps/android-native/app/src/main/java/app/ottline/data/OttlineRepository.kt) |
| iOS | 로컬 DB를 초기화한다. 계정 삭제는 같은 API를 호출하고 성공 후 로컬 DB를 초기화한다. [설정 화면](../../../apps/native/app/%28tabs%29/account/index.tsx) |
| Windows Native | 설정에 두 액션이 있다. 공개판 `2.0.0.0`에는 구 경로(`/api/account`) 이슈가 남아 있으며, `fix/windows-account-deletion` 브랜치에서 `DELETE /api/auth/account` 및 실패 보존으로 수정했다(스토어 업데이트 대기). [Windows 확인 사항](#windows-확인-사항) |

### Windows 확인 사항

- **현재 공개판 (`2.0.0.0`, Microsoft Store)**: 클라이언트가 `DELETE /api/account`를 호출하고 HTTP 성공 여부를 확인하지 않아, 실패 응답 뒤에도 로컬 DB를 초기화하고 성공 메시지를 표시할 수 있다.
- **코드 수정 및 로컬 검증 (`2026-11-20`, 브랜치 `fix/windows-account-deletion`, 기준 `main` `e93f3e4`)**:
  - `DELETE /api/auth/account` 호출, `UserId`/`DeviceId` 미연결 시 버튼 비활성화 및 요청 차단, HTTP 오류(`401`/`404`/`500` 등)와 네트워크 실패·타임아웃 시 로컬 기록·이력·`outbox`·연결 상태 보존, 서버 2xx 확인 후 로컬 DB 및 계정 설정 초기화와 한·영 안내로 수정했다. [Windows API 클라이언트](../../../apps/windows-native/src/Ottline.Core/Remote/OttlineApiClient.cs), [Windows 저장소](../../../apps/windows-native/src/Ottline.Core/Data/OttlineRepository.cs), [설정 ViewModel](../../../apps/windows-native/src/Ottline.App/ViewModels/MainViewModel.cs)
  - 모의 API 단위 테스트(`Ottline.Tests` 19/19)와 `x64`/`arm64` MSIXBundle 패키지 검증을 통과했다. PR 병합 후 Microsoft Store 업데이트 배포 및 스토어 설치판 실기기 확인이 남아 있다. [후속 작업](../../../docs/changes/v2-follow-up.md#1-windows-서버-계정-삭제-수정)
