# Wiki Log

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
