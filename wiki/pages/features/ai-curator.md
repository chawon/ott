# AI 큐레이터와 Telegram 승인

기존 TMDB 인기 작품을 재료로 기록 유도 질문을 자동 생성하고, 운영자가 Telegram에서 승인한다. `AI 운영 계정` 표시와 별도 큐레이션 analytics를 유지한다.

- 하루 최대 2건, 승인 대기 최대 4건. 답하지 않은 초안은 공개하지 않는다.
- 게시·다시 생성·건너뛰기 버튼을 제공한다. 현재 생성기는 ko/en 질문 템플릿이다.
- 승인자 user ID, chat ID, message ID, 문구 버전을 검증한다. 중복 처리를 차단하며 DB commit 뒤 처리 결과를 안내한다.
- Telegram 전송 실패는 재시도한다. 서버 재시작 뒤에도 DB의 수신 offset과 처리 상태를 유지한다.

2026-09-06 PR #105, API `6e89a1256188ae170d068540561b0008495df602`, production run `34017827519`로 운영 활성화했다. ArgoCD `Synced Healthy`, Flyway v31, KST 16:00 첫 초안 2건 생성 및 Telegram 전송을 확인했다. 실제 승인자의 `들쥐` 게시 클릭, 감사 기록, Telegram 메시지 갱신과 공개 Web 프록시의 HTTP 200·게시 항목 노출을 확인했다. 미승인 `군체`는 공개되지 않았다.

설정, 제약, 복구와 배포 증거: [운영 문서](../../../docs/curator-telegram-approval.md).
