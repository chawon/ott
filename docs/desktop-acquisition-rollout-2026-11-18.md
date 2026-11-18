# Windows 전환 퍼널 · 데스크톱 연결 기기 운영 배포

2026-11-18 사용자 검토·배포 승인 후 PR [#133](https://github.com/chawon/ott/pull/133)과 [#135](https://github.com/chawon/ott/pull/135)를 병합하고 API → 실제 API 검사 → Web 순서로 운영에 반영했다.

## 배포 범위와 기준

- 공통 애플리케이션 SHA: `2f262ec1f854df70d7a48674b9ca612b590b2248`, `APP_VERSION=2f262ec`.
- PR #133 병합 SHA: `5276cf0b36b134022b98dc4cbb778bef6738173a`. Windows 전역 배너, QuickLog 저장 후 CTA, 한·영 `/about` v2 설명과 세 위치의 공개 `cid` 캠페인·클릭 이벤트를 포함한다. iOS Smart App Banner·`ct`는 이번 범위에 포함하지 않는다.
- PR #135 병합 SHA가 공통 배포 SHA다. API는 `windows_native`·`macos_native`를 각각 `Windows App · Windows`, `macOS App · macOS`로 표시한다. DB 스키마, analytics 플랫폼 허용값과 네이티브 바이너리는 변경하지 않았다.
- Windows 클라이언트는 필요한 헤더를 이미 보낸다. macOS는 `macos_native` 헤더를 보내는 빌드가 필요하다. 기존 기기 표시는 해당 앱에서 기기 목록을 조회할 때 같은 ID·계정·등록 시각을 유지하며 갱신된다.

## CI와 운영 배포

| 항목 | 근거 |
|---|---|
| Web main CI | [44215433988](https://github.com/chawon/ott/actions/runs/44215433988), 성공. 최종 배포 SHA와 웹·웹 CI 소스가 동일함을 확인 |
| API main CI | [44215445578](https://github.com/chawon/ott/actions/runs/44215445578), PostgreSQL 포함 185건 통과, 실패·건너뜀 0건. 컨테이너·DB 업그레이드·재시작 검증 성공 |
| API production | [44217423318](https://github.com/chawon/ott/actions/runs/44217423318), 공통 SHA 입력으로 성공 |
| Web production | [44218009292](https://github.com/chawon/ott/actions/runs/44218009292), API 실동작 확인 후 같은 SHA 입력으로 성공 |
| API manifest | `5de38db0a63e15c2870bd3a9c0f913d2d052b86b` |
| Web manifest | `0dd5ae2d55b16e5db7f2c96ca944f273cf487403` |

Web workflow의 표시용 `headSha`는 dispatch 당시 main인 API manifest 커밋이다. 실제 checkout·이미지 태그·배포 입력은 공통 애플리케이션 SHA `2f262ec`다.

## 운영 검증 결과

- API/Web 이미지 태그와 `APP_VERSION=2f262ec`, 두 Pod `Ready 1/1`, restart 0, ArgoCD `Synced Healthy`를 확인했다. manifest 반영 뒤 ArgoCD를 hard refresh했다. 기존 ExternalSecret 4개도 `SecretSynced`였으며 값은 출력하지 않았다.
- 공개 `https://ottline.app/.well-known/ottline-version`이 HTTP 200과 `2f262ec`를 반환했다. Web workflow의 공개 버전 검증과 IndexNow 19개 URL 접수(HTTP 200)가 성공했다.
- 배포 전 검증 계정의 `Unknown Browser · Windows`와 `iOS App · iOS`를 재현했다. 배포 후 각 네이티브 헤더로 조회하여 Windows·macOS 표시 교정, 기기 ID·등록 시각 보존, 다른 기기는 해당 앱의 조회 전까지 그대로 남는 동작을 확인했다.
- 두 플랫폼의 신규 등록·코드 연결, 헤더 없는 touch의 표시 보존, 기존 iOS·일반 Windows Chrome 표시를 확인했다. Web 프록시도 같은 기기 ID와 값을 반환했고 실제 `/account`·`/en/account`에서 Windows·macOS·iOS 네이티브 라벨을 확인했다.
- 운영 Web Pod의 SEO 검사: 공개 URL 19개, 개인 경로 14개, Article 6개, 이미지 7개 통과. 한·영 `/about` Windows 설명·링크, canonical/hreflang 및 noindex 경계를 확인했다.
- 운영 Web Pod의 자산을 사용한 브라우저 검사: 전환 퍼널 21개 시나리오 통과. 세 CTA 위치·고정 `cid`·이벤트·14일 쿨다운·플랫폼/임베드 예외·좁은 화면을 확인했다. API·이벤트 요청은 브라우저에서 대체하여 실제 기록·analytics를 만들지 않았다. 실제 Store 설치나 네이티브 위젯 실기기 검증은 수행하지 않았다.

## 데이터 보존과 정리

- 전용 PostgreSQL 클라이언트의 읽기 전용 세션으로 비교했다. 배포 전후 기록 **623개**, 변경 이력 **1,063개**, 사용자 **1,811개**, 기기 **1,820개**, 고아 기록 **0개**, Flyway **V32**가 같았다.
- 검증 계정 3개만 계정 삭제 API로 정리하고 이전 인증 정보의 HTTP 401을 확인했다. DB에서도 해당 사용자·기기·기록이 모두 0개임을 확인했다. 기존 사용자 데이터는 변경하지 않았다.
- 임시 DB 클라이언트 Pod를 제거했다. 별도 worktree를 사용해 기존 작업 경로와 미추적 파일을 보존했다.

## 되돌리기 기준

필요하면 배포 전 Web SHA `4cabcd553a952bc27db9b39b02ad94498e225cec`, API SHA `916be7abe9a8712d3f5a0a5e460a7bf820e23b0c`를 각 production workflow의 명시적 입력으로 사용한다. 이번 배포는 DB 마이그레이션이나 데이터 복원을 요구하지 않는다.
