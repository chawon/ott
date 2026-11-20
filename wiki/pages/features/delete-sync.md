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
| Windows Native | 설정에 두 액션이 있다. 현재 소스의 계정 전체 삭제 요청 경로가 서버 계약과 다르다. [Windows 확인 사항](#windows-확인-사항) |

### Windows 확인 사항

`2026-11-20` 소스 확인 기준으로 Windows 클라이언트는 `DELETE /api/account`를 호출한다. 서버는 `DELETE /api/auth/account`에 계정 삭제를 연결한다. Windows는 HTTP 성공 여부를 반환하지만 설정 화면 흐름이 그 값을 확인하지 않아, 실패 응답 뒤에도 현재 기기 DB를 초기화하고 성공 메시지를 표시할 수 있다. 수정 시 서버 경로와 결과 처리, 실패 시 로컬 데이터 보존, 성공 시 계정·기기 초기화를 함께 검증한다. [Windows API 클라이언트](../../../apps/windows-native/src/Ottline.Core/Remote/OttlineApiClient.cs), [설정 ViewModel](../../../apps/windows-native/src/Ottline.App/ViewModels/MainViewModel.cs)
