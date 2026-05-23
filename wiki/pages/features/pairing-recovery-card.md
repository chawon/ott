# 페어링 코드 복구 카드

> 페어링 코드를 개인 보관용 PNG 카드로 저장해 새 기기 연결 불안을 줄이는 설정 UX

## 관련 페이지
- [[timeline-export]]
- [[delete-sync]]
- [[ux-copy]]

---

## 구현 상태

- 2026-05-23 기준 PR #36으로 production 반영 완료.
- 배포 SHA: `b5b30af29731aae89ddc3bd336ad3752feddc666`
- production workflow: `Deploy Web to Production` run `26329158127`
- production manifest: `ott-web:b5b30af29731aae89ddc3bd336ad3752feddc666`

## 제품 원칙

- 복구 카드는 공개 공유 카드가 아니라 개인 보관용이다.
- 페어링 코드는 계정 접근 키에 가까우므로 다른 사람에게 공유하지 말라는 경고를 카드와 설정 UI에 표시한다.
- 서버 이메일 발송, 서버 이미지 렌더링, 원격 저장을 하지 않는다.
- 이미지는 브라우저 Canvas에서 로컬 생성하고 바로 다운로드한다.

## 구현

- `apps/web/lib/recoveryCard.ts`
  - `1080x1440` PNG 카드 렌더링
  - 페어링 코드, 새 기기 입력 안내, 공유 금지 경고, 서버 미전송 문구 포함
- `apps/web/app/[locale]/account/page.tsx`
  - 설정 > 기기 연결에서 페어링 코드가 있을 때만 `복구 카드 저장` 노출
  - 저장 성공/실패 상태 표시
- `apps/web/messages/ko.json`, `apps/web/messages/en.json`
  - 한국어/영어 UI 및 카드 문구

## 제외 범위

- 이메일 발송
- QR 스캔 연결
- 코드 재발급
- 코드 만료 정책 변경
- 기존 기기 승인/알림 정책

## 남은 후속

- 페어링 코드 길이와 만료 정책
- 재발급 시 기존 기기 유지/해제 규칙
- 신규 기기 연결 시 기존 기기 승인 또는 알림 필요 여부
