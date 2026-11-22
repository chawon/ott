# Web 추천 복구 PR 검증 인계

[제품 기획 운영](../product-planning.md)과 [기능 기준표](../feature-matrix.md)에 따라 코드·모의 API·실제 공개판 근거를 구분한다. 기존 공통 정책은 [미래의 타임라인 계정 정책](../future-timeline-account-policy.md), API의 실제 배포는 [선행 API 배포 카드 #143](https://github.com/chawon/ott/issues/143)을 따른다.

## 변경과 통합

- [공통 이슈 #142](https://github.com/chawon/ott/issues/142), [Web 카드](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312248032), [Draft PR #145](https://github.com/chawon/ott/pull/145), 브랜치 `fix/web-recommendation-recovery`.
- 기존 `dbf6a2e17670968ccd6cc2475414daf5f1bb2b6b`와 [당시 Verify Web 성공](https://github.com/chawon/ott/actions/runs/44724325673)을 보존했다. 이 변경의 계정·언어별 requestId, 상태 조회 후 재시도, 제외 동기화 실패 후 생성 의도와 기한 제어를 다시 작성하지 않았다.
- 2026-11-22 main `8a4a0cf`를 충돌 없이 병합한 통합 커밋은 `b0f1e9a96f9763f3198bd84fb81b04bff28264c3`이다. 통합 직후 main 대비 변경은 원래 세 파일(`recommendationApi.ts`, `useRecommendations.ts`, `test-future-timeline-state.mjs`)뿐이었다. 네이티브 코드가 통합으로 들어온 사실을 이 Web PR의 변경이나 스토어 출시로 표시하지 않는다.
- 추가 작업은 기존 브라우저 스크립트의 실제 서비스워커 제어 검증 옵션과 본 검증 문서다. `FUTURE_QA_SERVICE_WORKER=1`은 실제 `/sw.js` 등록/활성/제어를 기다리고 제어 스크립트·display mode를 결과에 남긴다. 독립된 새 테스트나 추천 구현을 만들지 않는다.
- 서비스워커 조건에서 모의 서버의 완료 값이 React의 오류 표시 해제보다 먼저 바뀌는 테스트 경합을 발견했다. 서버 완료를 기다린 뒤 실제 오류 UI가 사라지는 것까지 기다리도록 해당 단언을 보완했다. 정상 실패 UI를 무시하거나 앱 로직을 바꾸지 않는다.

## 다시 확인한 근거

- 최신 main 통합 production 빌드에서 기존 Chromium **15개** 시나리오 모두 통과: quota, generation, retry, empty, pending, cross-device, scope, legacy, catalog, concurrent, locale-pending, locale-existing-batch, pending-exclusion, poll-recovery, reconnect. `/tmp/ott-recommendation-current-main-20261122`에 로그와 모의 요청/상태 결과가 있다.
- 타임라인/추천/동기화 **25개**, 클라이언트 복구/서비스워커 **13개**, TypeScript를 포함하는 Next production build 통과. 기존 38개 검증을 유지했다.
- 실제 서비스워커가 제어하는 브라우저의 추가 후보 확인 **5개**: KO 응답 유실 후 재연결, KO 같은 요청 재시도, KO 폴링 기한 후 복구, KO 기존 결과와 다른 언어의 공통 횟수 변경, EN 카탈로그/판본·오프라인 대기 기록. 제어 URL은 로컬 `/sw.js`, 실제 display mode는 **browser**다. `/tmp/ott-recommendation-sw-20261122`의 결과는 설치된 독립 창 검증으로 해석하지 않는다.
- 모의 API의 생성 전후 `quota.used`, requestId 유지·복구, 생성 시도 수, 계정·언어와 로컬 outbox를 각 시나리오에서 단언했다. 실제 OpenAI/API 생성이나 운영 계정·기록 쓰기는 하지 않았다. 모의 횟수 1회 단언을 운영 실측으로 표시하지 않는다.

실행 예:

```bash
WEB_RUNTIME_URL=http://localhost:3263 \
FUTURE_QA_CASE=poll-recovery FUTURE_QA_SERVICE_WORKER=1 \
node apps/web/scripts/test-future-timeline-state.mjs
```

전용 worktree에서 `npm ci`, `npm run build --workspace ott`를 마친 뒤 로컬 `next start`를 먼저 실행한다. 격리 스크립트는 로컬 URL만 허용하고 API 응답을 모의 처리한다. 위 URL은 실행 예이며 고정 운영 주소가 아니다.

## 남은 설치·운영 확인

WSL headless Chromium의 임시 프로필에서 실제 PWA 설치 명령을 시도했지만 `PWA.install`이 로컬 페이지의 설치 정보를 가져오지 못했다. 설치 성공·독립 창 실행은 확인하지 않았다. 서비스워커 제어 브라우저 5건은 준비 근거이며 설치형 PWA 완료 조건을 대체하지 않는다.

병합·배포 승인 후 실제 설치형 PWA의 신규/기존 설치·업데이트·앱 종료/재실행, 응답 유실·재연결·같은 requestId 복구와 생성 1회 차감을 테스트 계정에서 확인해야 한다. 이미 배포된 API와 Web의 명시적 SHA·실제 서버 상태를 함께 남긴다. 한국어 기존 결과가 있는 동안 영어 요청만 끝난 경우와 429/실패의 이전 결과 보존도 실제 후보에서 확인한다.

이 PR은 Web/PWA 담당 범위이며 Android·Apple·Windows 네이티브의 추천 복구 검증은 각 플랫폼 카드에서 진행한다. API 계약·DB·네이티브 코드·production 배포는 이 검증 작업에서 바꾸지 않았다.
