# 웹 TypeScript 7 업데이트

웹의 TypeScript를 5.9.3에서 7.0.2로 갱신하고 Next.js 16.3.8의 빌드·개발 설정 로딩·생성된 라우트 타입과 편집기 플러그인을 검증한다. 선행 MCP Apps 업데이트 PR #115 위의 전용 브랜치 `fix/web-typescript-7-20261010`에서 진행한다.

## 범위와 호환성

Next.js 16.3.8의 기본 `experimental.useTypeScriptCli` 값은 `true`다. 실제 설치된 Next.js의 CLI 경로로 TypeScript 7을 검증하고, 타입 검사를 건너뛰거나 API 모드로 바꾸지 않는다.

TypeScript 7은 네이티브 컴파일러를 사용하며 이전 JavaScript 컴파일러 API와 언어 서비스 플러그인을 그대로 제공하지 않는다. 웹 빌드와 명시적 타입 검사는 `apps/web/node_modules/typescript`의 7.0.2를 사용한다. 기존 `tsconfig.json`은 변경 없이 통과했다.

Next.js 편집기 플러그인은 기존 API를 사용하므로 `.vscode/settings.json`의 `typescript.tsdk`를 루트 `node_modules/typescript/lib`로 지정한다. 이미 native에 필요한 TypeScript 5.9.3을 재사용하며 별도 호환 패키지를 추가하지 않는다. VS Code에서 `TypeScript: Select TypeScript Version`의 `Use Workspace Version`을 선택하면 이 경로를 사용한다. 편집기와 웹 빌드의 컴파일러 버전은 다르므로 최종 타입 확인은 `npm run typecheck --workspace ott`로 실행한다.

API·DB·런타임 제품 동작·로컬 저장소·동기화 계약은 유지한다. native는 기존 TypeScript 5.9.3과 ts-jest 조합을 사용하며 버전과 실제 명령 해석 경로가 바뀌지 않도록 검증한다.

## 검증 시나리오

1. 변경 전후 workspace별 컴파일러 버전과 실제 CLI 경로, native 전체 의존성 트리를 비교한다.
2. 웹 타입 검사와 production build에서 TypeScript 7이 실제 실행되는지 확인한다. Next.js가 생성한 라우트 타입도 함께 검사한다.
3. 타입 오류를 넣은 임시 fixture가 실패하는지 확인해 검사 우회와 잘못된 컴파일러 선택을 방지한다.
4. Next.js 설정 로딩과 한국어·영어 개발 서버 응답, 편집기용 Next.js 언어 서비스 플러그인의 초기화·진단 동작을 확인한다.
5. 웹 단위 테스트, ARM64 이미지와 컨테이너·브라우저 회귀 검사를 실행하고 native 타입·Jest·기존 Expo 검사 결과를 비교한다.

## 참고 자료

- [TypeScript 7 릴리스와 이전 안내](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)

## 구현과 로컬 검증 결과

2026-10-10, Node 24.12.0에서 확인했다.

| 검증 | 결과 |
| --- | --- |
| 웹 production build | Next.js 16.3.8과 TypeScript 7.0.2 조합 통과 |
| `npm run typecheck --workspace ott` | Next.js 라우트 타입 생성과 TypeScript 7 검사 통과 |
| `npm run test:typescript-toolchain --workspace ott` | 웹 CLI 7.0.2, native CLI 5.9.3, Next.js CLI의 타입 오류 거부와 정상 fixture 통과 |
| Next.js 편집기 플러그인 | 지정한 5.9.3 API로 실제 플러그인을 실행해 잘못된 page export의 진단 71002와 정상 export의 무진단 확인 |
| 개발 서버 | `next.config.ts` 로딩과 한국어·영어 `/about` 응답 200, HTML 언어와 제목 확인 |
| 웹 단위 테스트 | 71개 통과 |
| native 타입 검사와 Jest | 타입 통과, 9 suites·27개 통과 |
| native 전체 의존성 트리 | 변경 전후 `npm ls --workspace native --all --json` 결과 동일 |
| 변경한 코드의 Biome와 diff 검사 | 통과 |

lockfile의 기존 패키지 항목은 웹 manifest의 TypeScript 범위만 바뀐다. 웹 전용 TypeScript 7.0.2와 플랫폼별 실행 파일 항목을 추가하고, 루트 TypeScript 5.9.3 및 native 의존성은 유지한다.

도구 검증 스크립트는 Next.js가 실제 선택한 CLI와 설정을 확인하며 `ignoreBuildErrors=false`를 요구한다. 별도 임시 디렉터리에 타입 오류를 만들고 Next.js 타입 검사 경로가 실패하는지 검증한다. CI에도 이 검사를 추가했다. 편집기 검증은 실제 Next.js 플러그인의 언어 서비스 진단까지 포함하며 VS Code GUI 조작은 포함하지 않는다.

## PR 검증

전용 브랜치 `fix/web-typescript-7-20261010`의 변경을 선행 MCP Apps 업데이트 PR #115 위에 쌓는다. Linux ARM64 이미지에서 네이티브 TypeScript 실행 파일과 웹 빌드를 확인하고, 컨테이너·브라우저 회귀 검사 및 기존 Expo 검사 결과는 PR CI에서 확인한다. 운영 배포는 별도다.

API Gradle·GraalVM 빌드 도구 업데이트는 다음 단계에서 별도 변경으로 진행한다.
