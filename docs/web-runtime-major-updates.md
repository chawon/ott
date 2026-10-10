# 웹 아이콘과 공유 카드 라이브러리 업데이트

웹의 `lucide-react`를 0.561.0에서 1.54.0으로, `fast-average-color-node`를 3.3.0에서 4.0.0으로 갱신한다. 기존 웹 라이브러리 PR #112를 기준으로 별도 브랜치에서 진행한다. 기준일은 2026-10-10이다.

## 범위와 호환 조건

Lucide 1은 브랜드 아이콘을 제거하고 기본 SVG에 `aria-hidden`을 적용한다. 웹에서 실제로 가져오는 아이콘의 export와 렌더링을 확인하고, 모바일 내비게이션과 아이콘만 있는 버튼의 접근 가능한 이름을 검사한다. 기존 크기, 색상, 레이아웃과 문구는 유지한다. [Lucide React 마이그레이션](https://lucide.dev/guide/react/migration), [Lucide 1 변경사항](https://lucide.dev/guide/version-1)

색상 추출 4.0.0은 Node 20.9 이상과 sharp 0.35.4 이상을 사용하며 ESM import를 제공한다. 웹의 Node 24와 sharp 0.35.5에 맞는 조합이다. 버전 검사도 `require.resolve` 대신 ESM 해석을 사용한다. 공유 카드에 포스터를 넣어 배경색 추출이 실제로 동작하는지 검사한다. 기존 검증의 포스터 없는 카드와 주간 모자이크만으로는 색상 추출 실패 후 fallback을 구분할 수 없다. [배포 패키지 정보](https://registry.npmjs.org/fast-average-color-node/4.0.0)

API와 DB 스키마, Dexie 버전, 기록 및 동기화 계약은 변경하지 않는다. native의 manifest와 실제 해석되는 의존성 버전을 변경 전후 비교한다.

## 다음 단계

MCP Apps 2.0.3은 MCP SDK 2의 분리된 client/server 패키지를 요구하므로 서버 전환과 OAuth·읽기 전용 도구·위젯 응답을 별도 PR에서 검증한다. [MCP Apps 2 릴리스](https://github.com/modelcontextprotocol/ext-apps/releases/tag/v2.0.0)

TypeScript 7.0.2는 기존 JavaScript 컴파일러 API를 제공하지 않는다. 현재 Next.js 16.3.8 설정은 `typescript/lib/typescript.js`와 `createProgram`을 사용한다. `experimental.useTypeScriptCli`로 전환하는 방법과 플러그인 호환성을 별도 검증하며, 이번에는 TypeScript 5.9.3을 유지한다. [TypeScript 7 릴리스](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)

## 검증 계획

1. 기존 lockfile로 테스트와 production build를 실행해 기준을 기록한다.
2. 변경 후 웹 단위 테스트, production build와 타입 검사를 실행한다.
3. production 서버에서 한국어·영어 화면의 아이콘, 모바일 내비게이션과 버튼 접근성, 언어 전환, 타임라인 이어보기와 오프라인 캐시를 확인한다.
4. 실제 공유 카드 PNG를 디코딩해 크기와 포스터 기반 배경색을 확인하고, 이미지 조회 실패 시 fallback도 검사한다.
5. Linux ARM64 Docker CI에서 실제 설치 버전과 같은 기능을 확인한다.
6. native 타입 검사와 Jest를 실행하고 Expo doctor 결과를 기존 실패 기준과 비교한다.

## 로컬 검증 결과

Node 24.12.0에서 기존 버전과 갱신 버전을 비교했다.

| 검증 | 결과 |
| --- | --- |
| 웹 단위 테스트 | 변경 전후 71개 통과 |
| 웹 production build와 타입 검사 | 변경 전후 통과 |
| 공유 카드 | 스토리·피드, 아바타, 주간 포스터, 제목 fallback과 이미지 404를 포함한 PNG 7개 통과. 변경 전후 파일이 모두 동일 |
| 포스터 색상 | 단색 포스터의 실제 배경 픽셀과 이미지 404의 기본 배경 픽셀 확인 |
| 아이콘과 언어 | 한국어·영어, 390·1280px에서 내비게이션 4개, 아이콘과 라벨 간격, 접근 가능한 이름, 테마 버튼 동작 및 언어 왕복 3회 통과 |
| 기록과 동기화 | 타임라인 50·51·125개 커서, 오프라인 검색, IndexedDB 재실행, 수동 필드와 outbox 보존 통과. 서버 응답은 mock |
| MCP | 실제 production 서버의 초기화, 읽기 전용 도구, 리소스, 인증 거부, 입력 검증 통과 |
| native | 타입 검사 통과, Jest 9 suites·27개 통과. Expo doctor는 이전 PR #112와 동일한 패치 버전 차이 9개로 19/20 |
| 변경 파일 검사 | manifest와 검증 스크립트 2개의 Biome 검사, `git diff --check` 통과 |

lockfile에서 웹 manifest와 두 패키지 항목만 변경됐다. native manifest와 나머지 설치 패키지 항목은 변경 전과 일치한다. Linux ARM64 이미지 결과는 PR CI에서 확인한다.

## 브라우저 검증의 외부 스크립트 격리

첫 ARM64 CI는 이미지·PNG·MCP·아이콘 검사를 통과한 뒤 `Cannot read properties of null (reading 'sequence')` 브라우저 오류로 실패했다. 오류 스택을 추가한 다음 CI는 전체 검사를 통과했고, 로컬의 동일 검사 6회도 통과했다.

별도 로컬 재현에서 페이지가 실제로 불러오는 Clarity 0.8.72-beta의 압축 완료를 늦추고 종료를 겹치게 하면 같은 오류가 발생했다. 스택은 `scripts.clarity.ms/0.8.72-beta/clarity.js`를 가리켰다. 최초 CI는 오류 메시지만 수집했으므로 두 오류가 같은 원인인지는 단정하지 않는다.

언어·아이콘 회귀 검사는 로컬 앱 요청만 허용해 외부 분석 스크립트와 수집 요청을 격리한다. 앱의 hydration·실행 오류 검사는 유지하며, 실패 시 스택도 남긴다. 운영 페이지의 분석 설정은 이번 변경에 포함하지 않는다.

## 반영 순서

웹 기반 PR #110, 일반 라이브러리 PR #112 다음에 병합할 수 있도록 PR을 연결한다. CI 결과와 제한은 PR에 기록한다. 운영 배포는 확정 main SHA를 사용하는 별도 단계다.
