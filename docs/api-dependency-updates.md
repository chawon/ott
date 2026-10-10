# API 의존성 기반 업데이트

Spring Boot 4.0 계열의 패치와 Google Auth를 갱신하고, Testcontainers의 모듈 버전을 Spring Boot BOM에 맞춘다. 웹 기반 업데이트는 별도 [PR #110](https://github.com/chawon/ott/pull/110)에서 관리한다.

## 범위와 목표

| 항목 | 변경 전 | 목표 |
| --- | --- | --- |
| Spring Boot | 4.0.0 | 4.0.8 |
| Hibernate 빌드 플러그인 | 7.1.8.Final | 7.2.24.Final |
| Testcontainers | core/JDBC 2.0.2, JUnit/PostgreSQL 2.0.5 | 모든 모듈 2.0.5, Boot BOM 관리 |
| Google Auth | 1.23.0 | 1.54.0 |

[Spring Boot 4.0.8 릴리스](https://spring.io/blog/2026/08/20/spring-boot-4-0-8-available-now/)와 [공식 지원 조건](https://docs.spring.io/spring-boot/4.0/system-requirements.html)을 기준으로 Java 25와 Gradle 9.2.1을 사용한다. Hibernate enhancement 플러그인은 Boot가 선택하는 `hibernate-core`와 같은 버전으로 맞춘다. Google Auth는 [Maven Central 배포 POM](https://repo.maven.apache.org/maven2/com/google/auth/google-auth-library-oauth2-http/1.54.0/google-auth-library-oauth2-http-1.54.0.pom)을 확인한다.

API 계약, DTO, 엔티티와 migration 파일은 이번 변경 범위에 포함하지 않는다. Spring Boot 4.1 전환, Gradle wrapper와 GraalVM 플러그인 업데이트는 후속 단계에서 각각 검증한다.

후속 단계의 범위와 결과는 [Spring Boot 4.1 전환](api-spring-boot-41.md)과 [API 빌드 도구 업데이트](api-build-tool-updates.md)에서 관리한다.

## 검증 방향

1. Java 25에서 변경 전후 `test`와 `bootJar`를 실행하고 실제 runtime/test classpath의 버전을 기록한다.
2. PostgreSQL 통합 테스트 7개 클래스가 CI에서 누락되거나 건너뛰어지면 실패하도록 검사한다. 로컬 환경에 Docker가 없으면 단위 테스트 결과와 통합 테스트 skip 수를 구분한다.
3. ARM64 API 이미지를 빌드한 뒤 격리된 PostgreSQL 16 컨테이너에 연결한다. 새 DB에 Flyway migration을 적용하고 JPA의 `ddl-auto=validate`로 기동되는지 확인한다.
4. `/actuator/health`의 `UP`과 `/actuator/info`의 정확한 `APP_VERSION`을 확인한다. 같은 DB를 유지한 채 API를 다시 시작하고 Flyway version/checksum/success 이력이 바뀌지 않는지 검사한다.

컨테이너 검증에는 테스트 전용 DB와 자격증명만 사용한다. 외부 서비스 키를 전달하지 않으며 Telegram 알림과 큐레이션 자동화는 기본 비활성 설정으로 실행한다. GA4 실제 인증은 운영 자격증명 없이 검증할 수 없어 별도 운영 확인 항목으로 남긴다.

## 검증 결과

2026-10-08, Java 25에서 변경 전후 `test`와 `bootJar`가 모두 성공했다. 로컬 XML 결과는 각각 87개 중 48개 통과, 39개 skip, 실패 0개다. Docker가 없는 로컬 환경에서 PostgreSQL 테스트는 skip되므로 통합 테스트 성공으로 계산하지 않는다. 추가한 CI 검사기는 이 skip 결과를 실제로 거부한다.

Gradle이 선택한 주요 버전은 다음과 같다.

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| Spring Framework | 7.0.1 | 7.0.9 |
| Hibernate core | 7.1.8.Final | 7.2.24.Final |
| Jackson 3 | 3.0.2 | 3.1.5 |
| Jackson 2 | 2.20.1 | 2.21.5 |
| Tomcat | 11.0.14 | 11.0.24 |
| PostgreSQL JDBC | 42.7.8 | 42.7.13 |
| Apache HttpClient | 5.5.1 | 5.5.2 |
| JUnit Jupiter | 6.0.1 | 6.0.3 |
| Micrometer | 1.16.0 | 1.16.7 |
| Logback | 1.5.21 | 1.5.38 |
| Flyway | 11.14.1 | 11.14.1 |

Testcontainers의 core, database-commons, JDBC, JUnit Jupiter와 PostgreSQL 모듈은 모두 2.0.5다. Google Auth의 OAuth2 HTTP와 credentials 모듈은 모두 1.54.0이다.

검증 스크립트의 Python·Bash 문법 검사와 `git diff --check`를 통과했다. 실제 PostgreSQL 통합 테스트와 ARM64 컨테이너 검증은 PR CI에서 실행하며, 최종 결과는 PR 설명에 기록한다.
