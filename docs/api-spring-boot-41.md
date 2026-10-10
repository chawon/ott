# API Spring Boot 4.1 전환

Spring Boot 4.0.8을 4.1.1로 갱신하고 Hibernate enhancement 플러그인을 BOM의 core 버전과 맞춘다. [API 기반 PR #111](https://github.com/chawon/ott/pull/111)의 커밋 `9de3dea` 위에서 진행한다. 기존 API 계약과 데이터가 유지되는지 검증한 뒤 부모 PR 병합 후 main 기준으로 다시 확인한다.

## 변경 범위

| 항목 | 현재 | 목표 |
| --- | --- | --- |
| Spring Boot | 4.0.8 | 4.1.1 |
| Hibernate core와 enhancement | 7.2.24.Final | 7.4.5.Final |
| Hibernate Validator | 9.0.1.Final | 9.1.3.Final |
| Flyway | 11.14.1 | 12.4.0 |
| Spring Data BOM | 2025.1.7 | 2026.0.1 |
| Micrometer | 1.16.7 | 1.17.1 |
| HttpClient5 | 5.5.2 | 5.6.4 |

목표 버전은 [Boot 4.1.1 BOM](https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.1/spring-boot-dependencies-4.1.1.pom)을 따른다. Java 25와 Gradle 9.2.1은 [공식 지원 조건](https://docs.spring.io/spring-boot/system-requirements.html)에 맞는 기존 구성을 사용한다. Google Auth 1.54.0과 Testcontainers 2.0.5를 유지하며, Gradle wrapper와 GraalVM 플러그인 갱신은 별도 단계에서 검증한다.

4.1의 전이 의존성 조합에서는 기존 서비스가 직접 사용하는 Jackson 2 클래스가 classpath에서 빠진다. `jackson-databind`를 직접 의존성으로 선언하고 Boot BOM의 2.21.5를 사용한다. analytics·Android 알림·ChatGPT 토큰·기존 LLM JSON 처리의 직렬화 방식을 유지하고, Spring MVC의 Jackson 3.1.5는 기존 기본 구성을 사용한다. Jackson 2 제거는 해당 서비스의 별도 전환과 회귀 검증이 필요하다.

[4.1 릴리스의 변경사항](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.1-Release-Notes)을 기준으로 제거된 API와 JPA bootstrap 설정, Jackson 직렬화와 HTTP client 동작을 확인한다. 웹과 Expo, DTO와 DB migration 파일은 이번 전환에서 변경하지 않는다.

## 검증 시나리오

1. Java 25에서 기존 단위 테스트와 `bootJar`를 실행하고 실제 runtime·test classpath의 선택 버전을 비교한다. PostgreSQL 통합 테스트 7개 클래스는 CI에서 skip 없이 실행해야 한다.
2. ARM64 운영 이미지를 새 PostgreSQL 16 DB에 연결한다. Flyway migration과 JPA validation, health 및 정확한 APP_VERSION을 확인한다.
3. 테스트 계정을 만들고 기록 생성·수정·목록·커서 페이지·히스토리·sync push/pull의 JSON 계약을 실제 HTTP로 확인한다. 한글 메모, 평점, 수동 시청일과 JSONB 장르가 유지되어야 한다. 오래된 sync 변경은 거부해야 한다.
4. 고정한 기존 커밋의 Boot 4.0.8 이미지로 별도의 PostgreSQL 16 DB와 기록을 만든다. 같은 DB에 Boot 4.1.1 이미지를 연결해 기존 데이터와 Flyway version·checksum·success 이력이 그대로 유지되는지 확인한다.
5. 새 이미지 재시작 뒤에도 기록·동기화와 migration 이력이 유지되는지 확인한다.

컨테이너 검증에는 격리된 DB와 테스트 데이터만 사용한다. 외부 메타데이터 키와 운영 자격증명을 전달하지 않으며 Telegram 알림·큐레이션 자동화는 기본 비활성 설정으로 실행한다. 운영 배포는 별도 수동 단계다.

## 검증 결과

2026-10-08, Java 25에서 `test`와 `bootJar`가 성공했다. 로컬 테스트는 87개 중 48개 통과·39개 skip·실패 0개다. Docker가 없는 로컬 환경에서 PostgreSQL 테스트는 skip되며, 기존 CI 검사기가 이를 거부한다. 부모 PR #111에서는 동일한 기존 테스트 87개가 skip 없이 통과했다.

실제 runtime classpath에서 Boot 4.1.1, Hibernate 7.4.5.Final, Validator 9.1.3.Final, Flyway 12.4.0, Spring Data JPA 4.1.1, Micrometer 1.17.1, HttpClient5 5.6.4를 확인했다. Jackson은 MVC용 3.1.5와 기존 helper용 2.21.5다. test classpath의 Testcontainers 모듈은 모두 2.0.5다.

추가한 HTTP 검증기의 Python 문법, 컨테이너 검증기의 Bash 문법과 `git diff --check`가 통과했다. PostgreSQL 통합 테스트·ARM64 이미지·실제 4.0.8→4.1.1 데이터 보존 결과는 PR CI에서 확인하고 PR 설명에 기록한다.
