# ChatGPT 연결의 MCP Apps 2 업데이트

ChatGPT App은 심사 탈락 후 서비스하지 않는 상태다. 2026-10-10 사용자 확인을 기준으로 상태를 정정하며, 연결 코드의 의존성은 별도 브랜치에서 유지보수한다. 이번 변경은 서비스 재개나 재심사 제출을 포함하지 않는다.

## 범위와 계약

`@modelcontextprotocol/ext-apps`를 1.7.5에서 2.0.3으로 올리고, MCP SDK 1.32.1 패키지를 SDK 2.3.1의 `client`·`server` 패키지로 교체한다. `core` 2.3.1은 이 패키지들을 통해 설치된다. Next.js는 Web Request/Response를 사용하므로 `server` 패키지의 `WebStandardStreamableHTTPServerTransport`를 사용한다.

읽기 전용 `timeline.list_recent_logs` 도구를 유지한다. SDK 2의 HTTP 컨텍스트인 `context.http.authInfo`와 `context.http.req.headers`에서 인증 정보와 언어 헤더를 읽고, 입력 스키마를 `z.object`로 선언한다.

기존 OAuth 토큰, `timeline.read` 권한, 사용자·기기 식별자, 도구 이름, 필터, 기록 응답 필드와 HTML 리소스 URI를 유지한다. API 서버·DB 스키마·로컬 저장소·동기화 계약과 native 의존성은 이번 변경의 범위에 포함하지 않는다.

MCP Apps 1과 2는 UI 통신 규격을 공유한다. SDK 2에서 알 수 없는 도구 호출의 오류 형식이 바뀌는 점은 회귀 검증에 명시한다.

## 검증 시나리오

1. MCP `2025-06-18`과 `2025-11-25` 클라이언트의 초기화, 단일 읽기 전용 도구 목록, HTML 리소스 조회와 Zod 입력 제한을 확인한다.
2. 미인증·잘못된 토큰·만료·권한 부족 요청이 기록 API에 접근하지 않는지 확인한다.
3. 테스트용 서명 토큰과 로컬 API fixture로 사용자·기기 헤더, 필터, 영화·시리즈·책 기록 응답, 한국어·영어 결과와 API 장애 처리를 확인한다.
4. 웹 단위 테스트, production build, Linux ARM64 이미지와 실제 컨테이너의 MCP 요청을 검증한다.
5. 공용 lockfile 변경에서 native 패키지의 버전과 선택 경로를 비교하고 native 타입·테스트·Expo 검사 결과를 기존 기준과 비교한다.

## 참고 자료

- [MCP Apps 2 이전 안내](https://apps.extensions.modelcontextprotocol.io/api/documents/migrate-to-v2.html)
- [MCP SDK 2 이전 안내](https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2)

## 로컬 검증 결과

2026-10-10, Node 24.12.0에서 확인했다. 변경 전 SDK 1 서버에서도 확장한 인증·기록 조회 검사를 통과했다. 변경 후에는 두 MCP 프로토콜 버전으로 모든 시나리오를 통과했고, 알 수 없는 도구의 SDK 2 오류 코드 `-32602`도 확인했다.

| 검증 | 결과 |
| --- | --- |
| 웹 단위 테스트 | 71개 통과 |
| 웹 production build와 타입 검사 | 통과 |
| MCP 실제 HTTP | 도구·리소스, 7종 인증 거부, 사용자·기기 헤더, 영화·시리즈·책 필터, 한영 응답, 빈 기록과 API 503 처리 통과 |
| 공유 카드와 설치 버전 | 실제 설치 버전 일치, PNG 7종과 포스터 색 픽셀 검증 통과 |
| native 타입 검사와 Jest | 타입 통과, 9 suites·27개 통과 |
| native 전체 의존성 트리 | 변경 전후 `npm ls --workspace native --all --json` 결과 동일 |
| 변경한 코드의 Biome와 diff 검사 | 통과 |

공용 lockfile은 MCP SDK·ext-apps와 SDK가 요구하는 `eventsource-parser` 3.1.1을 갱신하고, SDK 1만 사용하던 HTTP·스키마 의존성을 제거한다. native manifest와 모든 native 전용 설치 경로는 변경 전과 같다.

CI 컨테이너는 테스트용 서명 키와 loopback API 주소를 사용한다. MCP 검사 스크립트가 컨테이너 내부에서 API fixture를 열고 닫아 빌드한 운영용 이미지의 인증된 도구 호출까지 검증한다. 실제 사용자나 운영 서버에는 접근하지 않는다.

## PR 검증

전용 브랜치 `fix/web-mcp-apps-2-20261010`의 변경을 선행 웹 업데이트 PR #114 위에 쌓는다. Linux ARM64 컨테이너와 브라우저 회귀 검사, 기존 Expo 검사 결과는 PR CI에서 확인한다. 운영 배포는 별도다.
