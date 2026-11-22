# 함께 큐레이터 API 종료

## 사용자 문제와 완료 조건

함께의 ottline 큐레이터 질문 기능을 종료한다. 기존 설치 앱은 빈 배열을 계속 파싱할 수 있어야 하며, 과거 게시물·승인 이력과 사용자 기록은 보존한다. [공통 결정](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313278873) · [API 업무](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313279191)

개발 기준은 `main 4664791`, 브랜치는 `feat/api-curator-retirement-20261122`다. [PR #150](https://github.com/chawon/ott/pull/150)을 최종 SHA `c693fd8`에 병합했다. 본부의 운영 배포·실제 계약과 데이터 보존 확인은 [통합 운영 반영 기록](../web-api-rollout-2026-11-22.md)을 따른다. 아래 개발 단계의 테스트·미실행 기록과 구분한다.

## 계약과 데이터

응답과 인증은 [공통 API 계약](../product-contracts.md#curated-contents--종료-호환-계약)을 따른다. 환경변수로 다시 켜는 방식 대신 자동화 서비스·템플릿 생성기·큐레이터 Telegram 클라이언트·전용 스케줄러와 설정 바인딩을 제거했다. 기존 관리자 목록·검색은 보관 자료를 읽는 용도로 유지한다.

Flyway 변경이나 정리 SQL을 추가하지 않는다. `system_actors`, `curated_contents`, `curated_telegram_reviews`, `curated_telegram_actions`, `curated_telegram_state`와 기존 상태·본문·수신 offset을 그대로 보존한다. 개인 기록·공개 대화·댓글·반응에 쓰기를 수행하지 않는다.

## 플랫폼별 인계

| 대상 | 반영 범위 | 확인 조건 |
| --- | --- | --- |
| API | 공개 빈 배열, 관리자 쓰기 종료, 자동화 코드 제거 | KO/EN HTTP 계약, 이전 게시/초안·승인 이력 보존, 일반 Telegram 전송 |
| Web/PWA | [큐레이터 UI·조회·이벤트 제거](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313279198) | API 검증 후 같은 병합 SHA 배포, KO/EN 목록·상세·댓글·반응 및 설치 PWA |
| Android·iOS·iPadOS·macOS | 플랫폼별 질문 UI·조회 제거 및 기존 앱의 빈 배열 수신 | 각 담당의 바이너리·스토어·실기기 근거. API 변경만으로 바이너리 반영을 완료 처리하지 않는다 |
| Windows | 기본 질문 fallback 제거와 빈 배열 호환 | 기존/후속 스토어 설치판의 실제 화면 |
| 토스 공개판 | 별도 번들의 직접 탑재 여부 확인 | 탑재돼 있으면 해당 담당의 후속 번들 갱신 |

## 검증

- 실제 PostgreSQL 16의 격리 스키마에 KO/EN 게시 자료를 준비한 뒤 공개 응답이 비어야 하는 회귀가 수정 전 실패했다.
- 큐레이터 PostgreSQL 테스트는 Docker 또는 전용 임시 DB의 `CURATOR_TEST_JDBC_URL`로 실행한다. 각 테스트 클래스는 별도 스키마를 만들고 자기 스키마만 정리한다.
- 관리자 목록 읽기와 초안·게시·비활성화 거부 뒤 콘텐츠·승인·감사·offset 보존을 검증한다.
- HTTP 테스트에서 기존 관리자 인증, `200 []`·캐시 금지와 `410`을 확인한다. 과거 enable 속성이 있어도 전용 스케줄러가 생기지 않는지 확인한다.
- 문의 알림·데일리 리포트의 실제 HTTP 요청은 `MockRestServiceServer`로만 검증하며 Telegram으로 실제 메시지를 보내지 않는다.

JDK 25·임시 PostgreSQL 16에서 `./gradlew test bootJar --no-daemon --max-workers=2`를 실행해 **147 통과·40 생략·실패 0**, JAR 빌드를 확인했다. Docker 및 별도 opt-in DB가 필요한 기존 테스트의 생략을 통과로 계산하지 않았다. 격리 스키마 선택 확인을 보강한 뒤 종료 관련 최종 13개 테스트(공개/관리자 HTTP, PostgreSQL 보존, 설정 바인딩, 일반 Telegram 전송)를 다시 실행해 **13 통과·생략 0**을 확인했다.

WSL에는 Docker CLI가 없어 전체 PostgreSQL 필수 suite gate·컨테이너 런타임은 PR의 `Verify API` CI에서 확인해야 한다. 실제 Telegram 메시지 전송과 운영 DB 검증은 수행하지 않았다.

## 출시와 되돌리기

1. PR에는 `deploy/oke/api-deployment.yaml`의 `CURATOR_AUTOMATION_ENABLED=false`와 승인자 전용 Secret 참조 제거를 포함한다. **main 병합 시 Argo CD가 현재 API 이미지에도 이 설정을 적용해 재시작할 수 있다.** 이 false 값은 구 API 이미지가 남은 단계에서 자동화를 확실히 멈추는 호환 가드다. 일반 Telegram 설정은 유지한다.
2. 병합 SHA를 고정해 API 이미지를 배포하고 공개 KO/EN 빈 배열, 관리자 거부, 자동 작업 중지, DB 보관 자료와 일반 알림 설정을 확인한다.
3. 같은 SHA의 Web을 배포하고 플랫폼별 새 바이너리의 화면 제거를 검증한다. 기존 API 배열 경로는 유지한다.
4. DB 변경이 없어 데이터 복원은 필요하지 않다. 구 API 이미지로만 되돌리면 공개 피드와 관리자 쓰기가 다시 열릴 수 있으므로 종료 동작을 보존하는 이미지/차단을 먼저 확보해야 한다. `CURATOR_AUTOMATION_ENABLED=false`는 계속 유지한다.

공개 API·스케줄 중지의 현재 운영 근거는 [통합 운영 반영 기록](../web-api-rollout-2026-11-22.md)에 모은다. 네이티브 설치판·스토어 반영은 각 플랫폼 카드에서 별도로 확인한다.
