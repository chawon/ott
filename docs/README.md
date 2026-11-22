# 개발 문서 지도

기능을 바꿀 때는 [플랫폼 현황](platforms.md)에서 적용 대상을 찾고, [변경안 양식](changes/README.md)으로 공통 동작과 플랫폼별 검증을 정한다. 요청·응답, 저장과 동기화는 [공통 API와 데이터 계약](product-contracts.md)에서 시작한다.

지속 개선의 역할과 흐름은 [제품 기획 운영](product-planning.md)을 따른다. 공통으로 유지할 기능, 허용할 플랫폼 차이와 추가 반영이 필요한 항목은 [기능 기준표](feature-matrix.md)에서 확인한다.

## 에이전트로 작업하기

ottline 저장소 루트에서 새 세션을 연다. Codex와 Antigravity(`agy`)는 [AGENTS.md](../AGENTS.md)를 직접 읽고, Claude Code는 [CLAUDE.md](../CLAUDE.md)를 통해 같은 지침을 읽는다. 진행할 항목과 확인 기준은 [v2 후속 작업](changes/v2-follow-up.md)에서 찾는다.

## 설계와 운영

| 주제 | 기준 문서 |
| --- | --- |
| 제품 기획·지속 개선 | [담당과 개선 흐름](product-planning.md) · [공통 기능과 플랫폼 차이](feature-matrix.md) · [프로젝트판](https://github.com/users/chawon/projects/1) |
| 마케팅·유입 개선 | [담당과 성과 기준](marketing-operations.md) · [기존 유입 계측](seo-acquisition-foundation-2026-07-19.md) · [웹→스토어 검토 자료](web-acquisition-funnel-plan-2026-11-17.md) |
| 앱별 개발·출시 | [플랫폼 현황](platforms.md) · [채널별 Wiki](../wiki/index.md#플랫폼) |
| v2 후속 채널 | [브라우저 확장·토스 인앱·ChatGPT 앱 개편 방향](changes/v2-channel-strategy.md) |
| 시각·문구 | [DESIGN.md](../DESIGN.md) · [v2 브랜드 자산](ottline-ci-v2-integration.md) · [포인트 색상](accent-color-hierarchy.md) · [문구 가이드](../wiki/pages/processes/ux-copy.md) |
| 기록과 데이터 보존 | [타임라인](timeline-infinite-scroll.md) · [수정·삭제 정책](../wiki/pages/features/delete-sync.md) · [내보내기](timeline-export.md) · [기기 연결 복구 카드](pairing-recovery-card.md) |
| 도서 | [한국어 Kakao](kakao-book-search.md) · [영어 Google Books](google-books-en-search.md) · [KDC 내 서가](kdc-bookshelf-v1.md) |
| 공개 이야기와 추천 | [공개 리액션](../wiki/pages/features/public-reactions.md) · [저장 뒤 이야기 연결](saved-discussion-connection.md) · [Telegram 큐레이션](curator-telegram-approval.md) · [미래의 타임라인 정책](future-timeline-account-policy.md) |
| 관리자·유입 | [문의함](../wiki/pages/features/feedback.md) · [분석](../wiki/pages/features/analytics.md) · [SEO v2](seo-v2-refresh-2026-11-11.md) · [웹→스토어 유입 계획](web-acquisition-funnel-plan-2026-11-17.md) |
| Web/PWA | [v2 구현 기록](ottline-ux-v2-web.md) · [오프라인 안내·접근성](web-offline-accessibility-2026-11-12.md) |
| 이전 설치에서 업그레이드 | [Android 전환 및 TWA 복구](android-native-v2-transition.md) · [Windows 전환 및 PWA 복구](windows-native-v2-transition.md) · [데스크톱 프로토콜과 확장](desktop-protocol-and-extension-bridge-plan-2026-11-18.md) |
| 서버 배포·보안 | [Web/API 배포 운영](staging-environment-plan.md) · [GitOps](GitOps_Guide.md) · [보안 사고 대응](security-incident-checklist.md) |

## 변경 이력

- [v2 전환 기록](ottline-v2-release-readiness.md)에서 Web/API·Android·Windows의 기준 배포를 확인한다.
- [Wiki 로그](../wiki/log.md)는 변경 당시의 검증과 관련 문서를 연결한다.
- [문서 아카이브](archive/README.md)와 [Wiki 아카이브](../wiki/archive/README.md)에 종료된 계획과 캠페인, 전환 이전 운영 절차를 보관한다. 과거 문서에 남아 있는 버전과 명령은 해당 시점의 기록으로 읽는다.
