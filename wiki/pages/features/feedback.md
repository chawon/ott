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

**후순위:**
- FAQ 페이지 ("찾는 답이 없나요?" 다음 액션)
- 빈 상태 화면

---

## 구현 상태

### 사용자 화면
- `apps/web/app/[locale]/feedback/page.tsx` — 문의 작성 / 내 목록 / 관리자 답변 확인
- 카테고리: `QUESTION`, `BUG`, `IDEA`, `OTHER`

### 관리자 화면
- `apps/web/app/[locale]/admin/feedback/page.tsx?token=...`
- 전체 문의 목록, 스레드 상세, 관리자 답변 등록
- 미답변/전체/답변 완료/종료 필터와 상태별 카운트 표시
- 미답변 문의는 `updatedAt` 기준 경과 시간을 SLA 배지로 표시

### 접근 제어
- 사용자 API: `X-User-Id` 기준 본인 문의만 반환
- 관리자 API: `X-Admin-Token` 기준 전체 접근
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

## 향후 확장

- 자주 들어오는 질문 → FAQ 역수입
- Slack/Discord 웹훅 알림
- 로그인 사용자 앱 버전/로케일/디바이스 정보 자동 첨부
