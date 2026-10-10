# API 빌드 도구 업데이트

Spring Boot 4.1.1 전환 [PR #113](https://github.com/chawon/ott/pull/113)의 커밋 `5b1e6b5` 위에서 API 전용 Gradle wrapper와 GraalVM Native Build Tools 플러그인을 갱신한다. 전용 브랜치는 `fix/api-build-tools-20261010`이다.

## 범위와 목표

| 항목 | 변경 전 | 목표 |
| --- | --- | --- |
| API Gradle wrapper | 9.2.1 | 9.8.1 |
| GraalVM Native Build Tools 플러그인 | 0.11.3 | 1.1.14 |

2026-10-10의 [Gradle 안정 릴리스 정보](https://services.gradle.org/versions/current)와 [Native Build Tools Maven Central 메타데이터](https://repo.maven.apache.org/maven2/org/graalvm/buildtools/native-gradle-plugin/maven-metadata.xml)를 기준으로 목표를 정했다. GraalVM 플러그인 공식 문서도 1.1.14를 안내한다.

Java 25와 Spring Boot 4.1.1, Hibernate enhancement 플러그인 7.4.5.Final을 유지한다. API는 자체 wrapper를 사용하므로 Android의 wrapper는 변경하지 않는다. API 계약·DTO·엔티티·DB migration, 웹과 Expo 의존성은 이번 범위에 포함하지 않는다.

wrapper의 배포 URL·스크립트·JAR를 같은 Gradle 릴리스로 갱신하고 공식 SHA-256으로 배포 파일을 검증한다. 운영 이미지는 기존 Java 25 `bootJar` 실행 방식을 유지한다. GraalVM 플러그인 적용과 Spring Boot의 AOT/native 작업 연결을 확인하며, 운영 실행을 네이티브 바이너리로 전환하지 않는다.

Native Build Tools 1.0부터 reachability metadata 형식이 달라진다. 이번 검증은 운영 JVM 경로와 플러그인의 작업 연결을 대상으로 하며, 실제 네이티브 바이너리의 빌드·기동은 검증 범위에 포함하지 않는다. 이후 네이티브 배포를 도입할 때 메타데이터 형식과 GraalVM 실행 호환성을 추가 검증해야 한다.

## 검증 시나리오

1. Java 25에서 변경 전후 Gradle·플러그인 해석과 runtime/test classpath를 확인한다. 빌드 도구 변경으로 애플리케이션 의존성이 바뀌지 않아야 한다.
2. 새 wrapper의 버전·배포 체크섬·wrapper JAR 체크섬을 공식 값과 비교한다. `help --warning-mode=all`로 빌드 설정과 플러그인 호환성을 확인한다.
3. 기존 단위 테스트와 `bootJar`를 실행하고, GraalVM native/AOT 작업의 연결을 확인한다. 로컬 PostgreSQL 테스트 skip은 성공과 구분한다.
4. ARM64 CI에서 PostgreSQL 통합 테스트를 포함한 87개 테스트가 skip 없이 실행되는지 확인한다.
5. 기존 컨테이너 회귀 검사로 새 DB와 기존 4.0.8 DB의 migration 이력, 수동 기록 필드, 기록 생성·수정·목록·커서·히스토리·sync HTTP 계약과 재시작을 검증한다.

컨테이너 검증은 격리된 테스트 DB와 자격증명을 사용한다. 병합·운영 배포는 별도 단계다.

## 참고 자료

- [Gradle Java 호환성](https://docs.gradle.org/current/userguide/compatibility.html)
- [Gradle 9 업데이트 안내](https://docs.gradle.org/current/userguide/upgrading_version_9.html)
- [GraalVM Gradle 플러그인](https://graalvm.github.io/native-build-tools/latest/gradle-plugin.html)
- [Native Build Tools 변경사항](https://graalvm.github.io/native-build-tools/latest/changelog.html)
- [Spring Boot 4.1.1 지원 조건](https://docs.spring.io/spring-boot/system-requirements.html)

## 로컬 검증 결과

2026-10-10, Oracle GraalVM 25의 Java 25에서 확인했다.

| 검증 | 결과 |
| --- | --- |
| Gradle 실행과 설정 | 9.8.1 실행, `help --warning-mode=all` 통과 |
| GraalVM 플러그인 해석 | 플러그인·utils·reachability metadata 도구 모두 1.1.14 |
| 애플리케이션 의존성 비교 | runtime classpath 119개, test runtime classpath 173개가 변경 전후 동일 |
| wrapper 검증 | 공식 배포 SHA-256으로 설치, wrapper JAR SHA-256도 공식 값과 일치 |
| API 테스트 | 87개 중 48개 통과·39개 skip·실패 0개 |
| `bootJar` | AOT 코드 생성·컴파일, reachability metadata 1.0.15 수집과 JAR 빌드 통과 |
| `nativeCompile --dry-run` | `processAot`·AOT 클래스·리소스 작업과 nativeCompile 연결 통과 |
| POSIX wrapper 문법과 diff 검사 | 통과 |

로컬 Docker 엔진이 없어 PostgreSQL 통합 테스트 39개는 skip됐다. CI의 기존 검사기는 이 skip을 실패로 처리한다. Hibernate `enableAssociationManagement`의 deprecation 경고는 변경 전에도 발생하던 동일한 경고다. Windows wrapper는 Gradle이 재생성한 파일을 포함하며 Windows 실행은 검증하지 않았다.

CI에 Gradle 버전 출력과 GraalVM native 작업 dry-run을 추가했다. 실제 네이티브 실행 파일은 생성하지 않는다.

## PR 검증

선행 API PR #113 위에 변경을 쌓는다. Java 25의 PostgreSQL 통합 테스트, Linux ARM64 이미지와 새 DB·기존 4.0.8 DB의 HTTP·데이터·migration 보존 결과는 PR CI에서 확인하고 PR 설명에 기록한다. 병합·운영 배포는 별도다.
