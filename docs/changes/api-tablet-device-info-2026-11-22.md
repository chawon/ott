# 연결된 기기의 iPad·Android 태블릿 구분

## 문제와 상태

같은 계정에 연결한 iPad와 iPhone, Android 태블릿과 폰이 같은 이름으로 표시된다. 기존 연결을 유지한 채 해당 앱이 보내는 표시용 메타데이터로 구분한다. [API #147](https://github.com/chawon/ott/issues/147) · [프로젝트 업무](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313150426)

개발 기준 `main 4664791`, branch `fix/api-tablet-device-labels-20261122`의 구현 후보다. Android #146·#148이 반영된 `main 37eda7f`를 통합 기준으로 갱신했다. 운영 배포·스토어 바이너리를 변경하지 않았다. 큐레이터 종료 PR과 독립된 API 변경이며 해당 자동화·배포 설정을 포함하지 않는다.

## API와 판별 결정

[공통 인증·기기 계약](../product-contracts.md#auth)의 필드·인증과 기존 `ios_native`·`android_native` 플랫폼 값을 유지한다. 새 플랫폼 enum이나 DB 컬럼을 만들지 않는다. 이 헤더·UA는 표시용 힌트이며 계정·기기 인증의 근거로 사용하지 않는다.

| 조건 | `os` | `browser` |
| --- | --- | --- |
| `ios_native` + `iPad` 또는 `iPadOS` 토큰 | `iPadOS` | `iPad App` |
| `ios_native` + iPhone 또는 새 기기의 불명 UA | `iOS` | `iOS App` |
| Android 네이티브 + `Tablet` 토큰 | `Android` | `Android Tablet App` |
| Android 네이티브 + 확인된 Android 브라우저 UA에서 `Mobile` 없음 | `Android` | `Android Tablet App` |
| Android 네이티브 + `Mobile`, TV 신호 또는 새 기기의 불명 UA | `Android` | `Android App` |
| 기존 Windows·macOS 네이티브 | 기존 OS | 기존 `Windows App`·`macOS App` |

- 플랫폼 앞뒤 공백과 대소문자를 정규화하고, iPad·iPhone·Tablet·Mobile 토큰은 대소문자를 무시하되 단어 경계로 판별한다. `notipad`·`notatablet` 같은 문자열은 신호로 사용하지 않는다.
- Android에서는 명시적 `Tablet`을 우선한다. 그 외에는 `Mozilla/`·`AppleWebKit/`와 Android 버전이 확인되고 `Mobile`·TV 신호가 없는 UA에 한해 태블릿으로 판단한다. 단순히 Mobile이 없다는 이유로 `okhttp`·`Dalvik`·앱 버전 문자열만 있는 새 기기를 태블릿으로 분류하지 않는다.
- 헤더 없는 구 Android 네이티브는 기존 `ottline-android/` 신호의 범위 안에서 같은 판별을 한다. 일반 웹/PWA의 태블릿 UA는 기존 브라우저 분류를 사용한다.
- 같은 기기의 기존 태블릿 표기는 빈/불명 UA로 덮어쓰지 않는다. 명시적 iPhone/Mobile 신호가 오면 표기를 정정할 수 있다. 헤더 없이 metadata-free touch를 호출하는 동기화·인증 흐름도 보존한다.
- Android 태블릿의 OS는 실제 OS 계열인 `Android`를 유지하고 기기 종류를 `browser`에 표시한다. analytics 플랫폼 허용값·이벤트 바디·기존 OS 집계 계약을 변경하지 않는다.

## 데이터와 플랫폼 인계

등록·페어링 시 분류하고 `GET /api/auth/devices`에서 **해당 기기 자신의** `touchDevice` 경로로 기존 행을 갱신한다. 계정·기기 ID·생성 시각을 보존하며, 이번 표기 변경을 위한 기록/Outbox 이전이나 일괄 수정은 추가하지 않는다. 기존 페어링의 계정 병합 계약을 유지한다. 다른 기기에서 목록을 읽는 것만으로 아직 접속하지 않은 행을 덮어쓰지 않는다.

| 대상 | 필요한 반영·남은 확인 |
| --- | --- |
| API | 후보 API를 배포한 뒤 실제 `/api/auth/devices`의 기존 행 갱신·신규 등록·페어링을 확인한다 |
| iPhone·iPad | 출시 SwiftUI 앱이 보내는 `(iPhone; iOS)`·`(iPad; iPadOS)` UA로 각 기기에서 목록을 연다. 같은 기존 기기 ID가 유지되는지 확인한다 |
| Android | 새 Tablet UA는 main에 병합된 [PR #148](https://github.com/chawon/ott/pull/148)의 후속 바이너리가 필요하다. 실제 Play 공개·설치 버전은 별도 확인한다. Mobile만 보내는 기존 앱을 서버가 실제 태블릿으로 확정할 수는 없다 |
| Web/PWA·macOS·Windows | 현재 모델이 `os`·`browser`를 문자열로 받는 것을 확인했다. 실제 배포 뒤 연결 기기 화면에서 새 라벨 표시를 대조한다 |

Web `DeviceSummary`, Android `DeviceInfo`, Apple `DeviceItem`은 nullable 문자열을 받으며, Windows API 클라이언트도 두 문자열을 읽어 표시 이름을 만든다. 이 확인은 소스 호환 확인이며 모든 플랫폼 실기기 검증을 대체하지 않는다.

## 검증과 배포

- 수정 전 등록·페어링 회귀 11개 중 5개가 iPad/Android 태블릿 표기에서 실패했다.
- 수정 후 `AuthServiceProfileTest` **58개 모두 통과·생략 0**. 폰·태블릿·공백/대소문자·구 Android 앱·웹·TV/불명 UA·기존 행 보존과 명시적 폰 메타데이터 정정을 검증했다.
- JDK 25의 `./gradlew test bootJar --no-daemon --max-workers=2`: **169 통과·56 생략·실패/오류 0**, AOT와 JAR 빌드 성공. Docker/전용 DB가 필요한 생략을 통과로 계산하지 않는다.
- 전체 PostgreSQL 필수 테스트·ARM64 이미지·컨테이너 업그레이드/재시작은 `Verify API` CI에서 확인한다. 운영 DB를 변경하거나 실제 사용자 계정을 생성하지 않았다.

PR 병합 후 고정한 병합 SHA로 API를 배포하고 기기별 원래 ID·계정·기록이 보존되는지 실제 응답과 화면을 대조한다. Android 새 UA의 공개 여부는 별도 확인한다. DB 스키마 변경이 없어 별도 복원은 필요하지 않으며, 예전 이미지로 돌아가면 같은 기기의 다음 메타데이터 갱신 때 구형의 일반 앱 표기로 돌아갈 수 있다.
