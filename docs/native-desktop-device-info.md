# Windows · macOS 네이티브 연결 기기 표시

## 범위와 확인 근거

- API 기기 메타데이터 분류만 수정한다. 기존 Windows 웹 전환 PR #133과 독립적이며, 웹·네이티브 바이너리·DB 스키마·analytics 플랫폼 계약은 변경하지 않는다.
- 기반: `origin/main` = `7b373d0`.
- macOS 가이드: [`macos-native-device-api-guide.md`](https://github.com/chawon/ott/blob/7038ce0/docs/macos-native-device-api-guide.md), 개발 브랜치 `feature/ios-native-v2`의 확인 커밋 `7038ce0`.
- Windows `OttlineApiClient.CreateRequest`는 이미 `X-Client-Platform: windows_native`와 `User-Agent: OttlineWindowsNative/2.0.0.0`를 전송한다.
- Apple 공유 클라이언트의 수정된 macOS 빌드는 `X-Client-Platform: macos_native`와 `User-Agent: ottline-mac/<version> (Macintosh; Mac OS X)`를 전송한다. iOS 빌드는 `ios_native`를 유지한다.
- 수정 전 `AuthService.applyAgentInfo`는 iOS만 별도 처리하여 Windows를 `Unknown Browser · Windows`, 수정된 macOS 클라이언트를 `Unknown Browser · macOS`로 저장했다. 수정 전 Mac 클라이언트의 행은 `iOS App · iOS`일 수 있다.

## 구현 결정

`X-Client-Platform`의 앞뒤 공백과 대소문자를 정규화하고 아래 세 값을 명시적으로 처리한다. 그 외 값은 기존 User-Agent 기반 웹 브라우저 판별을 사용한다. 이 헤더는 표시용 메타데이터이며 계정·기기 인증 근거로 사용하지 않는다.

| 헤더 | 응답 `os` | 응답 `browser` | 웹 연결 기기 표시 |
|---|---|---|---|
| `ios_native` | `iOS` | `iOS App` | `iOS App · iOS` |
| `windows_native` | `Windows` | `Windows App` | `Windows App · Windows` |
| `macos_native` | `macOS` | `macOS App` | `macOS App · macOS` |

- 신규 등록과 코드 연결 시 처음부터 올바른 값을 저장한다.
- 기존 기기는 **해당 네이티브 앱에서** `GET /api/auth/devices`를 호출할 때 본인 행을 갱신한다. 기기 ID·연결 계정·등록 시각을 유지하며 재페어링이나 일괄 DB 수정은 필요 없다. 다른 브라우저에서 목록만 확인해도 아직 접속하지 않은 네이티브 기기 행까지 바뀌지는 않는다.
- Windows 클라이언트는 이미 헤더를 보내므로 이 수정 때문에 재빌드할 필요가 없다. macOS는 수정된 헤더를 보내는 빌드가 필요하다. 구형 Mac 앱이 계속 `ios_native`를 보내는 경우 서버가 Mac으로 추정해 바꾸지 않는다.
- 웹 `/account`와 Windows 앱은 기존 `browser`·`os` 응답을 그대로 표시하므로 응답 필드를 추가하지 않는다. 단순 `touchDevice(userId, deviceId)` 호출은 기존 메타데이터를 보존한다.
- `windows_native`·`macos_native`를 analytics 최상위 플랫폼으로 추가하는 작업은 별개다. 이번 수정은 analytics DTO·DB CHECK나 클라이언트 이벤트 바디를 바꾸지 않는다.

## 검증 계획

1. 두 데스크톱 네이티브의 등록·코드 연결·기존 기기 갱신 및 `DeviceDto` 값 확인.
2. 공백·대소문자, User-Agent 누락, 다른 계정/존재하지 않는 기기의 갱신 차단 확인.
3. 기존 iOS 네이티브, Windows 웹 Chrome, macOS 웹 Safari 및 헤더 없는 touch 동작 회귀 확인.
4. `apps/api`에서 `./gradlew test --tests com.watchlog.api.service.AuthServiceProfileTest --no-daemon`, API 테스트·`bootJar`, `git diff --check` 실행.

## 로컬 검증 결과 (2026-11-18)

- `AuthServiceProfileTest`: 22건 통과, 실패·건너뜀 없음.
- `./gradlew test bootJar --no-daemon --max-workers=2`: 테스트 129건 통과, 56건 건너뜀, 실패·오류 없음. AOT 처리와 배포용 JAR 빌드 성공.
- 건너뛴 56건은 DB 통합 테스트이며 로컬 통과로 간주하지 않는다. PR/main `Verify API`에서는 PostgreSQL을 포함한 185건이 모두 실행·통과했고 컨테이너 빌드와 기존 DB 업그레이드·재시작 검증도 성공했다.
- 최초 샌드박스 실행은 Mockito의 JVM self-attach 제한으로 초기화가 실패했다. 같은 테스트를 샌드박스 밖에서 재실행해 위 결과를 확인했다.
- 실행 위치는 `apps/api`, `GRADLE_USER_HOME=/home/ergate23/workspace/ott/.gradle`을 사용했다. `git diff --check` 통과.

## 운영 반영 (2026-11-18)

PR #135 병합 SHA `2f262ec1f854df70d7a48674b9ca612b590b2248`로 API를 배포하고, PR #133을 포함한 Web도 같은 SHA로 배포했다. 실제 운영 API의 기존 기기 갱신·신규 등록·페어링과 한·영 내 공간의 Windows·macOS 표시를 확인했다. 검증 계정 3개는 정리했고 기존 기록·이력 건수를 보존했다. [배포 실행·검증 근거](desktop-acquisition-rollout-2026-11-18.md)를 따른다.

기존 사용자는 Windows 앱과 수정된 macOS 앱 각각에서 연결된 기기 목록을 열면 된다. 재페어링이나 Windows 재빌드는 필요 없다.
