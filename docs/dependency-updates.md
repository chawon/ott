# 웹과 API 의존성 업데이트

웹 서버 렌더링과 이미지 처리의 보안 패치를 먼저 적용하고, API와 일반 라이브러리는 별도 PR로 갱신한다. 각 단계의 검증을 통과한 버전을 lockfile과 배포 이미지에 함께 고정한다.

기준일은 2026-10-07이다. 업데이트는 최신 main에서 만든 전용 작업트리에서 진행한다. 현재 Netflix 가져오기 개발 브랜치의 변경사항은 해당 브랜치에서 계속 관리한다.

## 단계별 범위

| 단계 | 목표 | 상태 |
| --- | --- | --- |
| 웹 기반과 보안 | Next.js 16.3.8, React와 React DOM 19.3.0, sharp 0.35.5, next-intl 4.14.9, 운영 Docker의 루트 lockfile 적용 | PR #110 웹 ARM64 CI 통과, 기존 Expo 검사 실패 |
| API 기반 | Spring Boot 4.0.8, Hibernate 빌드 플러그인 7.2.24.Final, Testcontainers 2.0.5 정렬, Google Auth 1.54.0 | PR #111 CI 통과, 검토 대기 |
| 웹 일반 라이브러리 | 같은 메이저의 안정 릴리스 17개, Biome와 Playwright, Node 24 타입 | PR #112 웹 ARM64 CI 통과, 기존 Expo 검사 실패, [범위와 검증](web-library-updates.md) |
| API 4.1 전환 | Spring Boot 4.1.1, Hibernate 7.4.5.Final, Flyway 12.4.0 | PR #113 CI 통과, 87개 테스트와 기존 DB 전환 검증 완료 |
| 웹 런타임 메이저 | lucide-react 1.54.0, fast-average-color-node 4.0.0 | PR #114 웹 ARM64 CI 통과, 기존 Expo 검사 실패, [범위와 검증](web-runtime-major-updates.md) |
| MCP Apps 2 전환 | ext-apps 2.0.3과 MCP SDK 2.3.1 서버 전환 | PR #115 웹 ARM64 CI 통과, 기존 Expo 검사 실패, [범위와 검증](mcp-apps-2-update.md) |
| 웹 TypeScript 7 | TypeScript 7.0.2의 Next.js 빌드·설정·편집기 호환성 검증 | 로컬 검증 완료, ARM64 결과는 PR CI에서 확인, [범위와 검증](typescript-7-update.md) |
| API 빌드 도구 | Gradle과 GraalVM 플러그인을 각각 검증 | 예정 |

목표 버전은 2026-10-06 레지스트리 점검을 바탕으로 정했다. 각 단계 착수 시 릴리스와 호환 조건을 다시 확인한다. API가 관리하는 라이브러리는 Spring Boot BOM 조합을 기준으로 갱신하고 남은 보안 패치를 확인한다.

## 웹 기반 업데이트

현재 Node.js `ImageResponse`로 공유 카드 PNG를 렌더링한다. Next.js의 9월 보안 릴리스를 적용하고 React, React DOM, sharp의 실제 동작을 함께 검증한다.

- [Next.js 9월 22일 보안 공지](https://nextjs.org/blog/nextjs-security-update-september-22-2026)
- [Next.js 9월 30일 보안 릴리스](https://nextjs.org/blog/september-2026-security-release)
- [React 19.3 릴리스](https://react.dev/blog/2026/09/09/react-19-3)

현재 CI는 루트 `package-lock.json`으로 `npm ci`를 실행하지만, 운영 Docker는 웹의 `package.json`만 복사한 뒤 `npm install`을 실행한다. Docker의 설치를 루트 lockfile 기반으로 바꾸고, 웹 workspace가 해석하는 버전을 CI와 동일하게 만든다.

React는 웹 workspace에서 갱신한다. 공용 lockfile 변경에 따라 native가 선택하는 React와 React DOM 버전을 확인하고 기존 native CI도 실행한다.

Docker는 루트와 각 workspace의 `package.json`, 루트 lockfile로 웹 의존성만 `npm ci` 설치한다. build와 runner가 루트 `node_modules`와 웹의 별도 `node_modules`를 함께 유지한다. 웹 전용 Docker ignore로 호스트의 설치 파일, 빌드 캐시와 환경 파일을 제외한다.

PR CI는 ARM64 이미지를 로드해 실제 서버를 실행한다. 이미지에서 웹 의존성 버전을 lockfile과 비교하고 한국어·영어 HTML, CSS와 공유 카드 PNG를 검증한다. 웹 의존성을 별도로 복사하지 않으면 예전 React가 선택되는 문제도 이 검사에서 실패한다.

Next.js 16.3.8과 next-intl 4.11.0의 조합에서는 영어 화면에서 한국어로 전환한 직후 `NEXT_LOCALE` 쿠키가 영어로 되돌아가는 것을 Chromium에서 재현했다. [next-intl의 Next.js 16.3 호환 수정](https://github.com/amannn/next-intl/pull/2355)을 포함하는 4.14.9를 이번 단계로 앞당긴다. 한국어와 영어를 왕복하고 새로고침 뒤에도 언어와 주소가 유지되는지 회귀 테스트로 확인한다.

## 검증 기준

1. 변경 전 기존 웹 테스트와 production build 결과를 기록한다.
2. 변경 후 관리자 접근, analytics, SEO, PWA 복구, 리포트 공유, Android 유입, 테마, 서가 테스트를 실행한다.
3. production 서버에서 한국어와 영어 화면을 확인하고 타임라인 커서 무한 스크롤, 기록 수정과 동기화, 오프라인 복구를 검증한다.
4. 실제 공유 카드 응답의 `image/png`, 1080×1920 크기, 포스터와 제목 fallback 렌더링을 확인한다.
5. CI의 Linux ARM64 Docker 이미지를 빌드하고 이미지 안의 버전과 실행 결과를 확인한다.
6. native의 타입 검사, 테스트, Expo doctor 결과를 변경 전 기준과 비교한다.

API 단계는 Java 25에서 `test`와 `bootJar`를 실행하고 격리 PostgreSQL에서 신규 및 기존 migration 이력, JPA, JSON, 기록과 동기화 계약을 검증한다.

## 배포 기준

각 PR의 CI를 통과한 뒤 확정 main SHA로 수동 배포한다. 웹 보안 패치는 독립 릴리스하고, 이후 함께 배포하는 변경은 API 다음 웹 순서로 적용한다. ArgoCD `Synced Healthy`, 이미지 태그, `APP_VERSION`, Pod 상태와 실제 기능 요청을 확인한다. 이전 정상 이미지와 되돌리기 조건도 기록한다.

## 웹 기반 검증 결과

2026-10-07, Node 24.12.0에서 확인했다.

| 검증 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 웹 단위 테스트 | 71개 통과 | 71개 통과 |
| 웹 production build | Next.js 16.2.4 성공 | Next.js 16.3.8 성공 |
| native 타입 검사 | 통과 | 통과 |
| native Jest | 9 suites, 27개 통과 | 9 suites, 27개 통과 |
| native Expo doctor | 9개 패키지 패치 버전 차이로 1개 검사 실패 | 로그가 변경 전과 동일 |

웹에서 실제 선택한 버전은 Next.js 16.3.8, React와 React DOM 19.3.0, sharp 0.35.5, next-intl 4.14.9다. native의 React와 React DOM은 19.2.1이며 native manifest와 Expo 패키지 버전은 변경하지 않았다.

production 서버의 한국어 `/about`, 영어 `/en/about`와 실제 CSS가 200으로 응답했다. 공유 카드 4종은 모두 `image/png`, 1080×1920이다. 로컬 WebP 아바타와 주간 포스터를 넣은 이미지가 각각 없는 이미지와 다른 것을 확인했고, PNG를 열어 한글과 이미지 렌더를 확인했다. 외부 TMDB 호출 대신 저장소의 샘플 포스터를 사용했다.

Chromium에서 타임라인의 서버 커서 조회, 50·51·125개 경계, 중복 없는 이어보기, 오프라인 캐시, 검색과 반응형 더 보기 흐름을 확인했다. 이 검증은 API 응답을 mock한다.

언어 전환 회귀 테스트는 next-intl 4.11.0에서 영어→한국어 전환 뒤 쿠키가 `en`으로 돌아가 실패했다. 4.14.9로 갱신한 production build에서는 한국어↔영어 왕복 3회, 쿠키, 주소, 새로고침 뒤 언어 유지와 브라우저 오류 검사를 모두 통과했다. PR CI도 이 테스트를 실제 컨테이너에 실행한다.

검증 서버에 `--hostname 127.0.0.1`을 지정하면 한국어 기본 언어 rewrite가 리다이렉트로 반복됐다. Docker와 같은 기본 `next start` 옵션으로 실행하면 정상 응답한다. 운영 시작 옵션과 애플리케이션 라우팅 설정은 유지한다.

추가한 검증 스크립트와 변경 manifest의 Biome 검사를 통과했다. 로컬 환경에는 Docker가 없어 Linux ARM64 이미지 검증은 PR CI에서 실행한다. 기존 Expo doctor 실패와 최종 CI 상태는 이 브랜치의 PR에서 함께 기록한다.
