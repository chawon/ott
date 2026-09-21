# 이용 리포트 주간 공유 카드 포스터 복구

기준일: 2026-09-21

## 증상과 원인

이용 리포트에서 주간 공유 카드를 만들면 기록 수와 지표는 표시되지만, 상단 포스터 영역에는 작품이 하나도 나타나지 않았다.

- 개인 리포트 계약은 `previousWeekLogs`만 제공하고 지난주 작품 후보를 제공하지 않았다.
- 웹의 서버 응답 경로와 로컬 fallback 모두 주간 공유 payload에 `posterItems`를 넣지 않았다.
- 공유 카드 렌더러는 포스터가 없는 payload에도 고정 높이의 상단 영역을 남겼다.

## 변경 내용

### API

- `GET /api/nalytic/me/report` 응답에 `previousWeekPosters`를 추가했다.
- KST 기준 직전 주 `[이전 월요일, 이번 주 월요일)` 기록을 작품 ID로 중복 제거한다.
- 시즌 포스터를 기본 작품 포스터보다 우선한다.
- 포스터 유무, 평점 유무·점수, 기록 수, 최근 기록 순으로 최대 6개를 반환한다.

### 웹

- IndexedDB 기록으로 만드는 로컬 리포트도 API와 같은 후보 계산 규칙을 사용한다.
- 주간 공유 payload가 `previousWeekPosters`를 `posterItems`로 전달한다.
- `/[locale]/og/share-card`는 후보 수에 따라 1~6칸 모자이크를 만들고 상단 영역을 채운다.
- 원격 이미지를 불러올 수 없는 작품은 빈칸 대신 제목을 표시한다.

## 회귀 검증

- API: `AnalyticsWeeklyPostersTest`에서 직전 주 필터, 작품 중복 제거, 시즌 포스터 우선과 payload를 검증한다.
- 웹: `report-weekly-posters.test.mjs`에서 로컬 리포트와 주간 공유 payload의 포스터 전달을 검증한다.
- `npm run test:report-share --workspace ott`와 웹 production build를 통과했다.
- API 전체 테스트를 통과했다.

## 운영 배포

- PR: `#108`
- main SHA: `01ef6b9b5b018970006ab6f42118b46824fb3430`
- API production run: `35569268524`
- Web production run: `35569520338`
- API manifest commit: `4cb3d731616df253ee5d60b9199e64e8bf506e94`
- Web manifest commit: `ef40081a1a188315f3b8a15027a5a5f4f1e4531f`
- ArgoCD: `Synced Healthy`
- API/Web `APP_VERSION`: `01ef6b9`
- API/Web Pod: 각각 `1/1` ready, restart 0

운영 클러스터 내부 스모크 테스트에서 개인 리포트 응답의 `previousWeekPosters` 배열을 확인했다. 같은 테스트에서 운영 TMDB 포스터 후보로 `/ko/og/share-card`를 호출해 `200 image/png`, 1080×1920, 2,706,818 bytes를 확인했다. 동일 후보의 포스터 URL을 제거한 카드와 SHA-256이 달라 실제 원격 포스터가 렌더됐음을 확인했다. 검증용 임시 계정은 테스트 직후 `DELETE /api/auth/account` 200으로 삭제했다.

iOS 네이티브 소스와 App Store 바이너리는 이 배포에서 변경하지 않았다.
