# 웹 일반 라이브러리 업데이트

2026-10-08 npm 레지스트리를 기준으로 같은 메이저의 안정 릴리스 17개를 적용한다. 이 브랜치는 [웹 기반 PR #110](https://github.com/chawon/ott/pull/110)의 커밋 `6f03c53` 위에서 작업한다. PR #110을 먼저 병합한 뒤 이번 변경을 main 기준으로 다시 확인한다. API 기반 업데이트는 [PR #111](https://github.com/chawon/ott/pull/111)에서 CI 검증을 완료했다.

## 범위

| 패키지 | 기존 설치 버전 | 목표 |
| --- | --- | --- |
| MCP SDK | 1.29.0 | 1.32.1 |
| MCP ext-apps | 1.6.0 | 1.7.5 |
| Radix dialog | 1.1.15 | 1.2.0 |
| Radix dropdown-menu | 2.1.16 | 2.1.25 |
| Radix slot | 1.2.4 | 1.4.0 |
| Radix tabs | 1.1.13 | 1.1.22 |
| Dexie | 4.3.0 | 4.4.6 |
| fast-average-color-node | 3.2.0 | 3.3.0 |
| jose | 6.2.2 | 6.2.12 |
| Sonner | 2.0.7 | 2.0.8 |
| tailwind-merge | 3.4.0 | 3.7.0 |
| Zod | 4.3.6 | 4.6.5 |
| Tailwind / PostCSS plugin | 4.2.4 | 4.3.3 |
| Biome | 2.2.0 | 2.5.15 |
| Playwright | 1.59.1 | 1.64.0 |
| Node 타입 | 20.19.32 | 24.19.1 |
| React / React DOM 타입 | 19.2.13 / 19.2.3 | 기존 버전 고정 |

Next.js 16.3.8, React 19.3.0, next-intl 4.14.9와 sharp 0.35.5는 앞선 웹 기반 검증 조합을 유지한다. TypeScript 7, lucide 1, ext-apps 2와 fast-average-color-node 4 전환은 후속 단계로 남긴다. 네이티브 manifest와 Expo 업데이트는 이번 범위에 포함하지 않는다.

React 타입 19.3.0을 웹에만 설치하면 웹은 19.3.0, 공용 Radix는 네이티브와 공유하는 19.2.13 타입을 사용한다. `Ref`의 반환 타입이 서로 달라 `ui/button.tsx`에서 production 타입 검사가 실패했다. React·React DOM 타입은 검증된 19.2.13·19.2.3으로 고정하고, 웹 런타임 React 19.3.0은 유지한다. 타입 19.3 전환은 네이티브 타입 범위와 함께 검토한다.

API 계약과 IndexedDB 스키마는 유지한다. 런타임 검증에는 로컬 서버, 브라우저의 테스트 데이터와 mock API만 사용한다.

## 검증 방향

1. 기존 웹 단위 테스트, production build, Biome 진단과 native 타입·Jest 결과를 변경 전 기준으로 기록한다.
2. 갱신한 루트 lockfile로 새 `npm ci`를 실행한다. 실제 웹 의존성 버전과 native가 선택하는 React·타입·Expo 버전을 비교한다.
3. production 서버에서 타임라인의 50·51·125개 경계, 검색, 오프라인 복구와 기존 IndexedDB 데이터 보존을 확인한다. 모바일·데스크톱 레이아웃을 검사하고 UI primitive의 타입과 production build를 확인한다.
4. ChatGPT MCP의 initialize, tool/resource 목록, 위젯 읽기와 인증 없는 요청의 경계를 실제 HTTP로 확인한다. Zod 입력 검증도 함께 검사한다.
5. 실제 공유 카드 4종 PNG와 언어 전환·새로고침 회귀 테스트를 실행한다. Linux ARM64 운영 이미지에서도 버전과 기능을 확인한다.

참고 릴리스: [Tailwind 4.3.3](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.3), [Playwright 1.64.0](https://github.com/microsoft/playwright/releases/tag/v1.64.0), [Biome 2.5.15](https://github.com/biomejs/biome/releases/tag/@biomejs%2Fbiome@2.5.15), [MCP SDK 1.32.1](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/1.32.1), [Dexie 릴리스](https://github.com/dexie/Dexie.js/releases).

## 검증 결과

Node 24.12.0·npm 11.19.1에서 다음 로컬 검증을 완료했다.

| 검증 | 결과 |
| --- | --- |
| 웹 단위 테스트 | 변경 전후 71개 통과 |
| production build | 변경 전후 통과 |
| 실제 설치 버전 | 웹 런타임 의존성 21개가 루트 lockfile의 선택 버전과 일치 |
| 기존 브라우저 프로필 | Dexie 4.3.0에서 저장한 기록과 outbox를 4.4.6에서 다시 열어 수동 메모·평점·시청일·상태 및 DB version 30 보존 확인 |
| 타임라인 | 50·51·125개 경계, 중복 없는 추가 로딩, 검색·오프라인 캐시·반응형 검증 통과 |
| MCP | initialize, 읽기 전용 tool/resource, 위젯 HTML, 무인증·잘못된 토큰 및 잘못된 입력 검증 통과 |
| 공유 카드 | 기본·프로필·주간 제목 fallback·주간 포스터 PNG 4종, 모두 1080×1920 |
| 언어 전환 | 한국어·영어 전환과 새로고침 3회 통과, hydration 오류 없음 |
| native | 변경 전후 타입 검사 및 Jest 9 suites·27개 통과, manifest와 비교 대상 69개 의존성 선택 버전 유지 |
| 변경한 JS·JSON | Biome 검사 통과, `git diff --check` 통과 |

루트 lockfile에는 갱신한 웹 라이브러리의 전이 의존성과 sharp 중복 설치 정리가 포함된다. 이전 lockfile과 JSON 값으로 비교해 변경 범위를 확인했다. 네이티브 앱의 Expo·React 19.2.1·React DOM 19.2.1·타입 버전은 유지한다.

Biome 설정은 실제 migrate 결과인 `preset: recommended`와 디렉터리 제외 형식을 적용하고, 기존 Tailwind CSS 문법 파싱을 활성화했다. 기존 JS·TS·JSON·CSS 검사 범위를 유지한다. 전체 웹 진단은 기존 error 33·warning 61에서 error 37·warning 67로 바뀌었다. 새 도구가 기존 리포트·공유 카드의 배열 index key 2건, `globals.css` 포맷 1건, `ui/card.tsx` import 정렬 1건을 추가로 지적한다. 전체 lint는 통과 상태가 아니며, 기존 소스 정리는 별도 작업으로 남긴다.

Expo Doctor는 변경 전후 19/20 검사 통과, 같은 Expo 패치 불일치 9개로 실패한다. 이번 웹 업데이트에서는 Expo 버전을 변경하지 않는다.

ARM64 CI에는 실제 운영 이미지의 버전·공유 PNG·MCP 검사와 브라우저 언어·타임라인·IndexedDB 재시작 검사를 포함한다. CI 완료 결과는 이번 PR에 기록한다. 운영 배포는 하지 않았다.
