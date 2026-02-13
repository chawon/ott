# 레트로 모드 사용성 판단 기준 (2026-02-13)

## 목적
- 레트로 모드의 실제 사용 여부를 4~8주 관찰한 뒤 유지/제거를 결정한다.

## 수집 지표
- `retro_app_open_users`: 레트로 상태(`app_open.properties.isRetro=true`)로 앱을 연 고유 사용자 수
- `retro_toggle_users`: 레트로 토글을 1회 이상 누른 고유 사용자 수
- `retro_toggle_on_users`: 레트로 ON으로 전환한 고유 사용자 수
- 기준 모수: `app_open_users`

## 확인 위치
- 관리자 통계 화면 `apps/web/app/admin/analytics/page.tsx`
- 섹션:
  - `레트로 모드 사용 (최근 N일)`
  - `주차별 레트로 추이`
- 예시: 최근 8주 확인은 관리자 URL에 `days=56`으로 조회

## 제거/유지 의사결정 규칙 (초안)
1. 4주 연속 `retro_app_open_users = 0` 이면 제거 후보로 지정
2. 8주 동안 `retro_app_open_users / app_open_users < 1%` 이고 개선 추세가 없으면 제거
3. 단, 실험/프로모션 기간이면 2주 추가 관찰 후 최종 결정

## 참고
- `retro_toggle_users`만 높고 `retro_app_open_users`가 낮으면 호기심 클릭 후 미사용 패턴으로 본다.
- 최종 제거 전, 설정 화면에 공지 문구를 1~2주 노출하는 것을 권장한다.
