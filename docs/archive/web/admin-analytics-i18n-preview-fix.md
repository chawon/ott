## 목적

i18n 적용 이후 `/[locale]/admin/analytics` 접근이 preview 환경에서 실패하는 원인을 정리하고 수정 방향을 고정한다.

## 현재 문제

관리자 분석 페이지는 서버 컴포넌트에서 아래 순서로 접근을 막고 있다.

1. 쿼리스트링 `token` 읽기
2. 프론트 서버의 `ADMIN_ANALYTICS_TOKEN` 환경변수 읽기
3. 환경변수가 없거나 쿼리 토큰과 다르면 즉시 `notFound()`

이 구조는 백엔드의 실제 관리자 토큰 검증과 별개로 프론트 preview 환경에도 동일한 비밀값이 반드시 주입되어야 한다. i18n 적용 후 관리자 페이지가 locale 경로 아래 서버 컴포넌트로 이동하면서 이 프론트 선검증에 더 직접적으로 의존하게 되었고, preview에 env가 없으면 올바른 URL 토큰으로도 접근할 수 없다.

## 변경 방향

범위:
- UI 라우트: `apps/web/app/[locale]/admin/analytics/page.tsx`

원칙:
- URL에 `token`이 없으면 기존처럼 접근 불가 처리
- 프론트 env가 설정된 경우에는 기존처럼 토큰 불일치 시 `notFound()`
- 프론트 env가 비어 있으면 URL 토큰을 그대로 백엔드 `X-Admin-Token` 헤더로 전달
- 최종 권한 판단은 백엔드 `/api/admin/analytics/*`가 수행

## 검증 시나리오

1. preview에서 `/ko/admin/analytics?token=<정상토큰>` 접근 시 페이지가 로드된다.
2. 잘못된 토큰으로 접근 시 백엔드가 404를 반환하고 페이지는 에러 상태를 표시한다.
3. 프론트 env가 설정된 로컬/배포 환경에서는 기존처럼 토큰 불일치가 즉시 차단된다.
