# AI 큐레이터와 Telegram 승인

## 종료 작업 · 2026-11-22 개발 후보

사용자 결정에 따라 기능 종료를 진행한다. [종료 API 계약](../../../docs/product-contracts.md#curated-contents--종료-호환-계약)과 [구현·검증·배포 변경안](../../../docs/changes/api-curator-retirement-2026-11-22.md)을 따른다. 공개 빈 배열 호환, 관리자 쓰기 종료, 기존 이력 보존과 일반 Telegram 알림 유지를 구현했으며 아직 운영 배포는 하지 않았다. Web·네이티브의 질문 영역 제거는 각 플랫폼 카드에서 별도로 진행한다.

## 이전 구현과 운영 근거

기존 TMDB 인기 작품을 재료로 기록 유도 질문을 자동 생성하고, 운영자가 Telegram에서 승인한다. `AI 운영 계정` 표시와 별도 큐레이션 analytics를 유지한다.

- 하루 최대 2건, 승인 대기 최대 4건. 답하지 않은 초안은 공개하지 않는다.
- 게시·다시 생성·건너뛰기 버튼을 제공한다. 현재 생성기는 ko/en 질문 템플릿이다.
- 승인자 user ID, chat ID, message ID, 문구 버전을 검증한다. 중복 처리를 차단하며 DB commit 뒤 처리 결과를 안내한다.
- Telegram 전송 실패는 재시도한다. 서버 재시작 뒤에도 DB의 수신 offset과 처리 상태를 유지한다.

2026-09-06 PR #105, API `6e89a1256188ae170d068540561b0008495df602`, production run `34017827519`로 운영 활성화했다. ArgoCD `Synced Healthy`, Flyway v31, KST 16:00 첫 초안 2건 생성 및 Telegram 전송을 확인했다. 실제 승인자의 `들쥐` 게시 클릭, 감사 기록, Telegram 메시지 갱신과 공개 Web 프록시의 HTTP 200·게시 항목 노출을 확인했다. 미승인 `군체`는 공개되지 않았다.

설정, 제약, 복구와 배포 증거: [운영 문서](../../../docs/curator-telegram-approval.md).
