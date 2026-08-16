# 문의함 (Feedback)

> 앱 내부 문의 스레드 + 관리자 답변 화면을 포함한 자체 API 기반 문의 채널

## 관련 페이지
- [[analytics]]
- [[ux-reviews]]

---

## 목적

사용자가 질문, 버그 제보, 기능 제안을 보낼 수 있는 단일 진입점을 앱 내에서 제공. 리브랜딩 전환 전에 사용자 질문 수집 경로를 확보.

**분류:** P1

---

## 목표 / 비목표

### 목표
- 앱 내 2탭 이내로 문의함 접근
- 한글/영문 사용자 모두 이해 가능한 안내
- 사용자는 자기 문의만 보고, 관리자는 전체 문의에서 답변 가능

### 비목표
- 실시간 채팅 시스템
- 실시간 푸시 알림 (이번 단계)
- 리브랜딩 설문, NPS

---

## 사용자 진입점

**우선:**
1. 설정 화면 (`apps/web/app/[locale]/account/page.tsx`) — "내 문의함 열기" 섹션
2. 푸터 (`apps/web/components/AppFooter.tsx`)
3. Android 비공개 테스트 섹션 — "Android 테스트 의견 보내기" (`/feedback?source=android-alpha`)
4. QuickLog 공유 진입 실패/개선 링크 — `/feedback?source=android-alpha-share`

**후순위:**
- FAQ 페이지 ("찾는 답이 없나요?" 다음 액션)
- 빈 상태 화면

---

## 구현 상태

### 사용자 화면
- `apps/web/app/[locale]/feedback/page.tsx` — 문의 작성 / 내 목록 / 관리자 답변 확인
- 카테고리: `QUESTION`, `BUG`, `IDEA`, `OTHER`
- URL preset:
  - `/feedback?source=android-alpha` — Android 비공개 테스트 의견 템플릿
  - `/feedback?source=android-alpha-share` — OTT 앱 공유 기록 테스트 의견 템플릿

### 관리자 화면
- `/admin/feedback` — Cloudflare Access로 보호되는 locale 없는 관리자 화면
- 전체 문의 목록, 스레드 상세, 관리자 답변 등록
- 미답변/전체/답변 완료/종료 필터와 상태별 카운트 표시
- 미답변 문의는 `updatedAt` 기준 경과 시간을 SLA 배지로 표시

### 접근 제어
- 사용자 API: `X-User-Id` 기준 본인 문의만 반환
- 관리자 브라우저 요청: same-origin BFF인 `/admin/api/feedback/**`만 호출하며 URL·HTML·브라우저 요청에 관리자 토큰을 포함하지 않음
- 관리자 인증: Cloudflare Access의 `Cf-Access-Jwt-Assertion`을 Next.js `proxy`와 BFF route에서 다시 검증
- 관리자 API: web 서버가 내부 `/internal/admin/feedback/**`에만 `X-Admin-Token`을 붙여 호출
- 관리자 답변 POST: `X-Forwarded-Host`·`X-Forwarded-Proto`로 공개 origin을 복원해 브라우저 `Origin`과 비교하며, 누락·외부·변조 origin은 `403`으로 차단
- unlink된 기기: `X-User-Id` + `X-Device-Id` 검증 실패 → 차단 + 로컬 상태 초기화

---

## 데이터/API 범위

**백엔드 (Spring Boot):**
- `feedback_threads`, `feedback_messages` 테이블
- `FeedbackController`, `AdminFeedbackController`, `FeedbackService`

---

## Telegram 운영 알림

- 신규 문의 등록 시 Telegram 알림 전송
- 환경변수 설정 시에만 활성화 (`TELEGRAM_NOTIFY_ENABLED=true`)
- Telegram 전송 실패해도 문의 저장 자체는 실패하지 않음

**설정값:**
```
TELEGRAM_NOTIFY_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_SERVICE_NAME=...  (선택)
```

---

## 현재 한계

- 관리자 목록 검색 없음
- 사용자 후속 메시지(댓글) 기능 없음
- 관리자 답변 시 사용자 알림 없음

---

## 운영 배포 기록

### 2026-08-16 — 관리자 답변 `Invalid origin` 복구
- 원인: Cloudflare/Ingress 뒤에서 공개 브라우저 origin과 Next.js 내부 요청 URL을 직접 비교해 정상 답변 POST를 거부
- 수정: 프록시가 전달한 공개 host/proto 기준으로 same-origin을 검증하고 기존 CSRF·JSON 경계를 유지
- PR `#89`, main SHA `f0db4a150b90b08dc877cf9c913e171de4150209`
- PR/main Web CI `31685044955`/`31685212556`, Web production `31920437846`
- manifest `ca01cdb8f04d1ceb64d5bff6a0ce821a4c56c3aa`
- ArgoCD `ott-app` `Synced Healthy`, `ott-web` `1/1` ready·restart 0, image SHA와 `APP_VERSION=f0db4a1` 확인
- API, DB, iOS 네이티브, Android TWA 변경 없음

---

## 향후 확장

- 자주 들어오는 질문 → FAQ 역수입
- Slack/Discord 웹훅 알림
- 로그인 사용자 앱 버전/로케일/디바이스 정보 자동 첨부
