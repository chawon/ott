# 코드 리뷰 (2026-02-06)

> apps/web, apps/api, deploy/oke, docs 전반 코드 품질 검토

## 관련 페이지
- [[security]]
- [[gitops]]

---

## 검토 범위

- `apps/web`, `apps/api`, `deploy/oke`, `docs` 전반
- 최근 기능: 책 기록(NAVER), 공유 카드, PWA/TWA, 타임라인 CSV, 로컬 동기화

---

## 실행 검증 결과

- `npm run build --workspace ott`: **성공**
- `npm run lint --workspace ott`: **실패** (Biome 진단 100+건)
- `apps/api` `./gradlew test`: **성공** (실제 테스트는 `contextLoads` 1건만)

---

## 보안 이슈 (→ [[security]])

Critical/High 보안 이슈는 [[security]] 페이지 참조.

---

## 코드 품질 이슈

### Medium: 품질 게이트(린트) 붕괴
- `npm run lint` 실패, Biome 진단 100+건 (`globals.css`, `layout.tsx` 등)
- **해결:** biome 규칙 기준 정리 후 CI 필수 게이트 복구
- 레트로 스타일용 `!important` 예외는 제한된 스코프에만 허용 규칙 분리

### Medium: 백엔드 자동 테스트 사실상 부재
- `contextLoads` 1건만 존재
- **최소 우선순위 테스트:**
  - sync pull/push 권한 검증
  - 로그 PATCH null-clear 동작
  - 책 저장/검색(NAVER) 경로

---

## 우선순위 대응 제안

1. 비밀정보 회전 + 저장소 정리 (Critical) → [[security]]
2. 로그/동기화 API 인증 강제 (Critical/High)
3. PATCH null-clear 계약 확정 및 서버 반영 (High)
4. CSV 수식 주입 방어 + 린트/테스트 게이트 복구 (Medium)
