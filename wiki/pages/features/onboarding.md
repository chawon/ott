# 첫 기록 온보딩

> 첫 방문자가 작품 검색 → 기록 저장 → 타임라인 확인까지 1회에 완료하도록 돕는 오버레이 가이드 (현재 비활성화됨)

## 관련 페이지
- [[ux-reviews]]
- [[analytics]]

---

## 목표 지표

- `first_log_completion_rate` 상승
- `time_to_first_log` 단축
- 온보딩 `skip_rate` 모니터링

---

## 노출 정책

- 최초 1회 자동 노출
- 저장/스킵 시 종료 후 재노출 안 함
- localStorage 키: `watchlog.onboarding.firstLog.completed`, `watchlog.onboarding.firstLog.skipped`

---

## 오버레이 플로우 (3-Step)

| 단계 | 타겟 | 안내 제목 | CTA |
|---|---|---|---|
| Step 1 | TitleSearchBox 입력 필드 | 먼저 작품을 검색해요 | 다음 |
| Step 2 | 상태 셀렉트 + 저장 버튼 | 상태를 고르고 저장해요 | 다음 |
| Step 3 | 저장 완료 배너의 타임라인 보기 링크 | 타임라인에서 바로 확인해요 | 완료 |

---

## 접근성/모션

- 오버레이: `role="dialog"`, `aria-modal="true"`
- 단계 텍스트: `aria-live="polite"`
- `Esc`로 종료 가능
- 키보드 탭 포커스 트랩
- `prefers-reduced-motion`에서 페이드/슬라이드 애니메이션 비활성화

---

## 계측 이벤트

- `onboarding_first_log_view`
- `onboarding_first_log_step_next`
- `onboarding_first_log_skip`
- `onboarding_first_log_complete`

---

## 현황 (2026-02-14 기준)

**비활성화 결정:** 첫 경험 방해 요소 해소를 위해 오버레이/트리거/연관 이벤트 호출을 모두 제거함.
`FirstLogOnboardingOverlay.tsx` 파일 삭제.

대신 작품 검색 영역을 시작 행동으로 인지되도록 라벨/강조 박스 적용.

---

## 릴리즈 계획 (기획 당시)

1. 1차: 내부 실험(10%) — 첫 기록 완료율/스킵률 점검
2. 2차: 전체 배포 — 문구/타겟 포인트 미세 조정
3. 3차: 설정 페이지에 `가이드 다시 보기` 추가
