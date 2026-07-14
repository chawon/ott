# 현실적인 제품 통계 집계

## 배경

관리자 통계의 기존 `DAU`/`WAU`/`MAU`는 `app_open` 이벤트의 고유 식별자를 사용자로 간주한다. 웹에서는 경로가 바뀔 때마다 `app_open`을 다시 보내고, 일부 세션에서는 `clientId`가 짧은 시간 안에 반복 생성된다. 이 때문에 실제 방문이나 기록 활동보다 수치가 크게 부풀 수 있다.

또한 검색, 제목 선택, 기기 연결, 첫 기록, 기록 생성은 모두 선택 가능한 서로 다른 행동이다. 검색 없이 제목을 선택하는 경로도 있으므로 이 값을 순차 퍼널로 놓고 앞 단계 대비 전환율을 계산하면 100%를 넘거나 실제 사용 흐름을 왜곡할 수 있다.

## 목표

1. 앱 실행량과 실제 제품 행동을 분리한다.
2. 반복 실행과 식별자 재생성의 영향을 관리자 화면에서 확인할 수 있게 한다.
3. 익명 행동과 로그인 후 행동을 안전하게 연결하되 여러 계정이 공유한 클라이언트를 임의로 합치지 않는다.
4. 검색·선택·기기 연결·첫 기록·기록 생성은 순차 전환율이 아닌 독립 행동 도달로 표시한다.
5. 기존 응답 필드는 한 릴리스 동안 유지하고 새 계약을 추가해 하위 호환성을 지킨다.

## 비목표

- 추천이나 사용자 점수 모델을 만들지 않는다.
- Google Analytics 또는 Cloudflare 수치를 내부 DB에 복제하지 않는다.
- App Store 설치와 TestFlight 설치를 추정해서 나누지 않는다.
- 과거 이벤트 원본을 수정하거나 삭제하지 않는다.
- 이번 변경에서 임의의 봇 필터 규칙을 도입하지 않는다.

## 지표 정의

모든 기간은 KST 달력일을 기준으로 하고 `[from, to)` 범위를 사용한다. 선택 기간 `N일`은 오늘과 직전 `N-1`일을 포함하며 `to`는 조회 시각이므로 미래 이벤트는 제외한다.

### 활동 지표

| 필드 | 정의 |
|---|---|
| `rawAppOpenEvents` | 기간 내 `app_open` 원본 이벤트 행 수 |
| `appOpenSessions` | 기간 내 `app_open`의 고유한 비어 있지 않은 `session_id` 수. 세션이 없는 레거시 이벤트는 해석 가능한 actor key를 보조 키로 사용 |
| `activeClients` | 기간 내 `app_open`을 보낸 고유한 비어 있지 않은 `client_id` 수 |
| `qualifiedActors` | `title_search`, `title_select`, `login_success`, `first_log_create`, `log_create` 중 하나 이상을 수행한 고유 resolved actor 수 |

`rawAppOpenEvents`는 수집 이상을 진단하는 원본량이고 `appOpenSessions`는 실행 세션, `activeClients`는 브라우저/앱 설치에 가까운 식별자, `qualifiedActors`는 실제 제품 행동을 한 도달 규모다. 네 지표를 사용자 수라는 한 이름으로 합치지 않는다.

### 독립 행동 도달

아래 값은 모두 기간 내 해당 행동을 한 고유 resolved actor 수다.

- `titleSearchActors`
- `titleSelectActors`
- `loginActors`
- `firstLogCreateActors`
- `logCreateActors`

행동 사이 순서나 포함 관계를 가정하지 않으며 단계별 전환율을 계산하지 않는다.

### actor 해석 규칙

actor key는 서로 다른 UUID 영역이 충돌하지 않도록 `u:`, `c:`, `s:` 접두어를 붙인다.

1. 이벤트에 `user_id`가 있으면 `u:{user_id}`를 사용한다.
2. 이벤트의 `client_id`가 조회 종료 시각 이전에 정확히 한 계정과만 연결되었다면 익명 이벤트도 `u:{user_id}`로 연결한다.
3. 같은 `client_id`가 둘 이상의 계정과 연결된 적이 있으면 익명 이벤트를 특정 계정에 붙이지 않고 `c:{client_id}`로 유지한다. 계정이 기록된 이벤트 자체는 각각의 `u:{user_id}`를 사용한다.
4. 연결 가능한 계정이 없으면 `c:{client_id}`, 그마저 없으면 `s:{session_id}`를 사용한다.
5. 어떤 식별자도 없으면 고유 actor 집계에서 제외한다.
6. 관리자 계정은 actor 해석 후 집계에서 제외한다.

이 규칙은 익명 검색에서 로그인 후 기록으로 이어진 한 사용자를 중복 집계하지 않으면서, 공유 브라우저를 여러 계정 중 하나로 잘못 합치는 것을 막는다.

## 코드 구조

PostgreSQL 집계와 actor 해석은 `AnalyticsMetricsQuery` 한 모듈에 둔다. 이 모듈의 작은 공개 인터페이스는 기간 요약과 일별 요약이며, SQL CTE·식별자 연결·행동 집합·플랫폼 집계는 내부에 숨긴다.

`AnalyticsService`와 `DailyReportService`는 같은 모듈을 사용한다. 관리자 대시보드와 일일 Telegram 리포트가 각자 집계 SQL을 복제하지 않게 해 지표 정의 변경의 영향 범위를 한곳으로 제한한다.

## API 계약

`/api/admin/analytics/overview`에는 다음 additive 필드를 추가한다.

- `activity.period`, `activity.today`, `activity.last7Days`, `activity.last30Days`
- 각 활동 구간: `rawAppOpenEvents`, `appOpenSessions`, `activeClients`, `qualifiedActors`
- `reach`: `titleSearchActors`, `titleSelectActors`, `loginActors`, `firstLogCreateActors`, `logCreateActors`

일별 행에는 활동·도달 값을, 플랫폼 행에는 실행 세션·클라이언트·행동 사용자 값을 추가한다. `app_open` 속성만 가진 디바이스/버전 차원은 행동 사용자를 억지로 귀속하지 않고 원본 실행 이벤트·실행 세션·클라이언트만 제공한다. 기존 `dau`/`wau`/`mau`, `activeUsers`, 기존 funnel 필드는 호환을 위해 한 릴리스 동안 유지하지만 새 관리자 화면과 운영 리포트는 사용하지 않는다.

`osFamily` 차원은 과거 `iOS`와 신규 `ios`가 같은 값으로 묶이도록 서버 집계 시 소문자로 정규화한다.

## 수집 변경

- 웹의 `app_open`은 관리자 경로를 제외하고 브라우저 세션당 한 번만 보낸다.
- 전송이 실패하면 같은 `eventId`와 발생 시각으로 재시도해 서버의 멱등 저장을 사용하며, 응답 유실이 원본 이벤트 중복으로 이어지지 않게 한다.
- locale prefix가 있는 `/ko/admin`, `/en/admin`도 관리자 경로로 인식한다.
- 경로 변경은 동기화를 계속 시작할 수 있지만 analytics 리스너 등록과 `app_open` 전송은 경로 효과와 분리한다.
- iOS는 `osFamily=ios`를 전송한다.
- iOS의 `installState=app_store_testflight`는 기존 계약을 유지한다. 관리자 화면에는 이 값이 App Store와 TestFlight의 합계이며 버전/빌드로만 나눠 본다는 안내를 표시한다.

## 관리자 화면

선택 기간의 최상단은 다음 네 지표로 구성한다.

1. 행동 사용자
2. 활성 클라이언트
3. 앱 실행 세션
4. 원본 앱 실행 이벤트

오늘/최근 7일/최근 30일은 같은 네 열의 비교 표로 제공한다. 기존 퍼널 영역은 독립 행동 도달 카드로 바꾸고 전환율은 제거한다. 원본 이벤트/속성 표는 수집 이상 진단용으로 유지한다.

화면은 `DESIGN.md`에 따라 크림/화이트와 네이비/중립색 위주로 구성하고, 통계 강조에 오렌지 면 채움을 쓰지 않는다. 카드 hover 이동 없이 작은 반경과 평면적인 그룹핑을 사용한다.

## 검증

PostgreSQL 전용 SQL은 Testcontainers PostgreSQL 통합 테스트로 검증한다. 로컬에 Docker가 없으면 테스트는 명시적으로 skip하며 GitHub Actions에서는 먼저 Docker 사용 가능 여부를 확인한 뒤 실행한다.

필수 시나리오:

- 같은 세션·클라이언트의 반복 실행
- 한 클라이언트의 여러 세션
- 같은 세션 안에서 발생한 client churn
- 익명 검색 후 같은 클라이언트의 로그인/기록
- 한 사용자의 여러 클라이언트
- 여러 사용자가 공유한 모호한 클라이언트
- 실행/노출만 있고 핵심 행동이 없는 사용자
- 검색 없는 제목 선택
- client가 없는 레거시 이벤트의 session fallback
- `[from, to)` 경계와 미래 이벤트 제외
- KST 자정 경계
- 관리자 제외
- `iOS`/`ios` 차원 병합

웹은 세션당 한 번 전송하는 순수 상태 함수를 단위 테스트하고, 네이티브 analytics 테스트는 새 `osFamily` 값을 고정한다. 전체 변경은 web build/Biome, API test/bootJar, native test/typecheck로 확인한다.

## 출시와 관찰

1. additive API와 새 수집부를 함께 배포한다.
2. 관리자 화면에서 원본 실행 이벤트 대비 실행 세션·클라이언트·행동 사용자의 비율을 7일간 관찰한다.
3. 기존 필드를 사용하는 외부 소비자가 없는지 확인한 뒤 별도 사이클에서 legacy DAU/WAU/MAU와 순차 funnel 필드 제거를 검토한다.
4. App Store와 TestFlight의 실제 구분이 필요해지면 네이티브 영수증/배포 채널을 신뢰성 있게 판별하는 별도 설계를 먼저 진행한다.
