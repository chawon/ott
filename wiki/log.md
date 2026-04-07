# Wiki Log

## [2026-04-07] ingest: ui-ux-pro-max 디자인 점검
- 대상: apps/web (main 브랜치 기준)
- 생성/수정: processes/design-review.md (신규), index.md
- 노트:
  - --primary가 브랜드 네이비 미연결 → shadcn 밋밋한 주요 원인
  - cursor-pointer 전체 누락
  - 수정은 feature/shadcn-migration 브랜치에서 진행 예정

## [2026-04-07] ingest: 토스 인앱 2차 검수 재제출
- 대상: 검수 피드백 대응 완료
- 생성/수정: platforms/toss-inapp.md
- 노트:
  - icon-600.png 투명 모서리 → #F0F6FF 채움, thumbnail-1932x828.png 레터박스 바 제거
  - granite.config.ts icon CDN URL 갱신, ait 재빌드 (deploymentId: 019d6065-ee4e-707a-b250-f43807c77f59)
  - 2026-04-07 2차 검수 재제출 완료

## [2026-04-06] ingest: feat/native-mobile-app 브랜치 작업 내용
- 대상: `feat/native-mobile-app` 브랜치 (12 커밋, main 미머지)
- 생성/수정:
  - platforms/native.md (신규) — React Native + Expo 앱 구조, 실행법, 구현 현황
  - features/dna-aura.md (신규) — 26종 특질 계산, Aura 글로우 시각화
  - index.md 갱신 (native, dna-aura 추가)
- 노트:
  - `apps/native/` 디렉토리 전체 신규 (브랜치에만 존재)
  - DEVELOPMENT.md에 구현 완료 기능 문서화 잘 되어 있음
  - kmp.md와 twa.md 크로스링크 업데이트 별도 필요

## [2026-04-06] ingest: feature/apps-in-toss-miniapp 브랜치 문서 및 피드백
- 대상: docs/apps-in-toss-miniapp-plan.md, apps/web/public/icon-600.png, apps/web/public/thumbnail-1932x828.png, apps/web/ottline.ait
- 생성/수정: platforms/toss-inapp.md (전면 재작성), index.md
- 노트:
  - Phase 0·1 완료, Phase 2 미완료, 검수 결과 대기 중 (요청일 2026-04-05)
  - icon-600.png: 라운드 코너 pre-apply → full-bleed 사각형으로 재제작 필요
  - thumbnail-1932x828.png: 가로형 배너, 양쪽 레터박스 바 → full-bleed 재제작 필요
  - .ait 설정 icon 참조는 icon-192.png (icon-600.png와 별개)

## [2026-04-05] ingest: docs/ 전체 문서 위키 페이지화
- 대상: docs/ 내 34개 문서 (assetlinks.template.json 제외)
- 생성/수정:
  - architecture/geo-seo.md (GEO-AUDIT-REPORT.md)
  - architecture/i18n.md (i18n-globalization-plan.md, admin-analytics-i18n-preview-fix.md, together-menu-locale-filtering.md)
  - architecture/navigation-auth-migration.md (navigation-auth-migration.md, plan-migration-status-tracking.md)
  - features/analytics.md (analytics-report-pages-mvp.md, analytics-web-pwa-twa.md)
  - features/book-log.md (book-log-mvp.md)
  - features/daily-report.md (plan-daily-report.md)
  - features/dark-mode.md (dark-mode.md)
  - features/delete-sync.md (delete-sync-mvp.md)
  - features/feedback.md (basic-feedback-channel-plan.md)
  - features/onboarding.md (first-log-overlay-onboarding-guide-2026-02-10.md)
  - features/share-card.md (share-card-mvp.md)
  - features/timeline-export.md (timeline-export.md)
  - platforms/browser-extension.md (browser-extension-mvp.md)
  - platforms/ms-store.md (ms-store-listing-copy.md, ms-store-pwa-plan.md)
  - platforms/pwa.md (pwa-plan.md)
  - platforms/twa.md (twa.md, twa-play-launch-checklist.md, twa-play-store-listing-ko.md)
  - processes/code-review.md (code-review-2026-02-06.md)
  - processes/gitops.md (GitOps_Guide.md)
  - processes/ottline-branding.md (ottline-transition-task.md, plan-ottline-branding-phase2.md)
  - processes/security.md (security-incident-checklist.md)
  - processes/staging.md (staging-environment-plan.md)
  - processes/ux-copy.md (ux-copy-consistency-playbook-2026-02-10.md, ui-copy-updates.md)
  - processes/ux-reviews.md (ux-review-2026-02-06.md, ux-review-2026-02-10.md)
  - index.md 갱신
- 노트:
  - 관련 문서 병합: i18n 관련 3개 → i18n.md, UX 리뷰 2개 → ux-reviews.md, TWA 3개 → twa.md, MS Store 2개 → ms-store.md, 브랜딩/전환 2개 → ottline-branding.md
  - retro-mode-usage-decision-2026-02-13.md 내용은 ux-copy.md 및 ux-reviews.md 내 레트로 관련 섹션으로 흡수

## [2026-04-05] init: 위키 초기 구조 생성
- 대상: 프로젝트 루트
- 생성/수정: CLAUDE.md, index.md, log.md
- 노트: docs/ 기존 문서들을 sources로 활용 예정

## [2026-04-05] update: security.md — OCI Vault 전환 완료 반영
- 대상: 사용자 확인
- 생성/수정: processes/security.md
- 노트: 보안 사고 대응 체크리스트 미완료 항목들 → OCI Vault + ESO 전환 완료(2026-03-29)로 해소됨
