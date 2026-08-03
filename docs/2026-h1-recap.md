# 2026년 상반기 리캡

## 문서 상태

- 상태: 종료
- 집계 기간: KST `2026-01-01`~`2026-06-30`
- 노출 기간: KST `2026-07-01 00:00`~`2026-07-31 23:59:59`
- 종료 시각: KST `2026-08-01 00:00`
- 리캡 키: `2026-H1`
- 사용자 경로: `/me/report#seasonal-recap`
- API: `GET /api/nalytic/me/report`

## 목적

2026년 상반기 리캡은 사용자가 이미 남긴 영상·책 기록을 포스터와 요약 지표로 다시 보고 공유하도록 만든 기간 한정 기능이다. 새로운 콘텐츠를 추천하거나 이용 성과를 평가하지 않고, 기록의 회상·공유·재방문 가치를 높이는 데 집중했다.

## 사용자 경험

1. 7월에는 웹 상단 바 아래의 `2026년 상반기를 돌아볼까요?` 노티로 개인 이용 리포트에 진입시켰다.
2. 리포트는 상반기 기록 수, 대표 콘텐츠 유형·장소·상황, 완료율, 메모 작성률과 최대 6개의 대표 포스터를 보여줬다.
3. 웹과 네이티브 리포트에서 포스터 중심의 SNS 공유 카드를 만들 수 있도록 했다.
4. 서버 리포트를 불러오지 못한 웹 사용자는 IndexedDB의 로컬 기록으로 같은 리캡을 계산했다.
5. 종료 시각 이후에는 상단 노티와 리캡 섹션을 모두 숨기고 기존 개인 이용 리포트를 첫 화면으로 유지한다.

리캡 종료는 기록 삭제가 아니다. 사용자의 원본 기록과 일반 리포트 지표는 그대로 유지한다.

## API 계약

개인 리포트 응답의 `seasonalRecap`은 선택 필드이며, 노출 기간이 아니거나 집계할 상반기 기록이 없으면 `null`이다. 종료 이후에도 필드를 제거하지 않아 기존 클라이언트와의 응답 호환성을 유지한다.

| 필드 | 의미 |
|---|---|
| `key` | 리캡 식별자 `2026-H1` |
| `startDate`, `endDate` | 집계 기간 `2026-01-01`~`2026-06-30` |
| `totalLogs` | 기간 내 전체 기록 수 |
| `topType` | 가장 많이 기록한 콘텐츠 유형 |
| `topPlace`, `topOccasion` | 가장 많이 기록한 장소와 상황 |
| `doneRatePct` | 완료 상태 기록 비율 |
| `noteFillPct` | 메모가 있는 기록 비율 |
| `posters` | 대표 작품 최대 6개의 제목·포스터·기록 수·최근 기록 시각 |

노출 판단은 KST를 기준으로 서버와 웹 양쪽에서 동일하게 적용한다.

| 기준 시각 | `seasonalRecap` / 웹 노출 |
|---|---|
| `2026-06-30` | 숨김 |
| `2026-07-01` | 노출 |
| `2026-07-31` | 노출 |
| `2026-08-01` | 숨김 |

## 종료 구현

- API `AnalyticsService`는 KST 날짜가 `[2026-07-01, 2026-08-01)` 범위일 때만 `seasonalRecap`을 만든다.
- 웹 `isH1RecapVisible()`은 같은 기간을 절대 시각으로 판정한다.
- 웹 리포트는 서버가 오래된 리캡 값을 반환하더라도 기간 밖이면 `seasonalRecap: null`로 정규화한다.
- IndexedDB 로컬 fallback도 기간 밖이면 리캡을 만들지 않는다.
- 헤더 노티는 리캡 기간, 리포트 페이지 여부, 관리자 페이지 여부, 사용자 dismiss 상태를 함께 확인한다.
- 리캡 DTO, 렌더러와 이벤트 타입은 호환성과 향후 시즌 리캡 재사용을 위해 남겼다.

주요 코드 위치:

- API 집계와 기간 게이트: `apps/api/src/main/java/com/watchlog/api/service/AnalyticsService.java`
- API 응답 계약: `apps/api/src/main/java/com/watchlog/api/dto/PersonalAnalyticsReportDto.java`
- API 경계 테스트: `apps/api/src/test/java/com/watchlog/api/service/AnalyticsSeasonalRecapWindowTest.java`
- 웹 집계와 기간 게이트: `apps/web/lib/report.ts`
- 웹 리포트: `apps/web/app/[locale]/me/report/page.tsx`
- 웹 상단 노티: `apps/web/components/SeasonalRecapNotice.tsx`

## Analytics

캠페인 중 아래 이벤트를 수집했다.

- `h1_recap_notice_impression`
- `h1_recap_notice_click`
- `h1_recap_notice_dismiss`
- `h1_recap_impression`
- `h1_recap_share`

종료 이후 UI가 노출되지 않으므로 신규 이벤트도 자연스럽게 발생하지 않는다. 기존 이벤트는 자체 analytics의 180일 보존 정책을 따른다.

## 플랫폼 경계

- Web/PWA/Android TWA: 웹 기간 게이트를 따르므로 8월부터 상단 노티와 리캡을 표시하지 않는다.
- API: 모든 온라인 클라이언트에 `seasonalRecap=null`을 반환한다.
- iOS 네이티브: 이번 종료 배포에서 소스와 App Store 바이너리를 변경하지 않았다. 온라인 조회는 API의 `null`을 따르지만, 네트워크 실패 시 네이티브 로컬 fallback이 리캡을 다시 계산하는 경로는 이번 범위에 포함하지 않았다.

## 배포 이력

### 최초 출시

`2026-07-01` PR `#75`, main SHA `9df9cb05addf90d56a82042b5393baa29fe78349`로 API와 웹을 배포했다.

- API/Web production run: `28494192890` / `28494344708`
- API/Web manifest commit: `048431dad4fe1ba9045e3db52b82d078e86849a9` / `5bc388385839fc08fcf7a16fd01c2f690904e156`
- ArgoCD: `ott-app` `Synced Healthy`
- production `APP_VERSION=9df9cb0`

### 종료 배포

`2026-08-03` PR `#86`, main SHA `5eb5115317892d0032a8b7b6fe5377b14f2d0c2a`로 API와 웹의 기간 게이트를 배포했다.

- API/Web PR CI run: `30778219539` / `30778219549`
- API/Web main CI run: `30778332152` / `30778332125`
- API/Web production run: `30778501095` / `30778595558`
- API/Web manifest commit: `abb40162543507255e2a00cbdacd89a577009ed1` / `a68753be1dceb50cc5cf1f17cb63f733b7d86de9`
- ArgoCD: `ott-app` `Synced Healthy`
- production 이미지: `ott-api`, `ott-web` 모두 SHA `5eb5115317892d0032a8b7b6fe5377b14f2d0c2a`
- production 버전: `APP_VERSION=5eb5115`
- Pod 상태: API/Web 모두 `1/1` ready, restart 0
- 사용자 확인: 8월 화면에서 상반기 리캡이 내려가고 일반 리포트가 정상 노출됨

초기 PR 검증 과정에서 Native CI는 Expo가 요구하는 `react-native 0.83.10`과 저장소의 `0.83.6` 불일치로 실패했다. 현재 웹/API 종료와 무관한 의존성 변경을 섞지 않기 위해 네이티브 변경은 PR 범위에서 제외했다. 다음 네이티브 작업 전 Expo 호환 버전을 별도로 정리해야 한다.

## 검증

- API 경계 테스트에서 `2026-06-30`, `2026-07-01`, `2026-07-31`, `2026-08-01`의 노출 여부를 고정했다.
- API/Web main CI와 production 워크플로우 성공을 확인했다.
- ArgoCD 상태, 실행 이미지 SHA, `APP_VERSION`, Pod readiness와 restart 수를 확인했다.
- 마지막으로 사용자가 실제 8월 화면의 정상 반영을 확인했다.

## 다음 시즌 리캡 원칙

1. 기존 `2026-H1` 기간을 늘리지 말고 새 리캡 키, 집계 기간, 노출 기간과 카피를 정의한다.
2. 서버·웹·로컬 fallback이 같은 시간대와 반열린 구간 `[start, end)`을 사용하도록 한다.
3. 시작 직전, 시작일, 종료 직전, 종료일 경계 테스트를 추가한다.
4. `seasonalRecap`은 계속 nullable로 유지하고 오래된 클라이언트가 기간 밖 리캡을 강제로 노출하지 않는지 확인한다.
5. Web/PWA/TWA와 네이티브의 출시 주기가 다르므로 플랫폼별 로컬 fallback과 바이너리 배포 범위를 출시 전에 명시한다.
