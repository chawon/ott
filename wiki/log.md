# Wiki Log

## [2026-04-15] update: 데일리 리포트 지표 변경 운영 배포 반영
- 대상: PR #6, production deploy SHA `a63ae1d393d04a366dc1377699b01f7c48c80a17`, GitHub Actions production deploy runs
- 생성/수정: features/daily-report.md, index.md
- 노트:
  - `로그 생성 사용자`와 `신규 로그 수(DB)` 병기 상태가 production web/api에 반영됨
  - staging 검증 후 동일 SHA로 production 배포 완료
  - 운영 리포트 해석 시 이벤트 기준 사용자 수와 DB 기준 row 수를 구분해야 함

## [2026-04-15] update: 데일리 리포트 내부 지표 정의 분리
- 대상: docs/plan-daily-report.md, apps/api/src/main/java/com/watchlog/api/service/DailyReportService.java, apps/api/src/main/java/com/watchlog/api/dto/DailyReportDto.java, apps/web/app/[locale]/admin/report/page.tsx
- 생성/수정: features/daily-report.md
- 노트:
  - `로그 생성` 표기를 `로그 생성 사용자`로 명확화
  - `watch_logs.created_at` 기준 `신규 로그 수(DB)` 추가
  - 요청 시점 실시간 누적이 아니라 전일 KST 1일치 집계라는 해석 유지
  - 오프라인 후 지연 sync 기록은 서버 반영 날짜 기준으로 집계됨

## [2026-04-14] update: 앱인토스 심사 반려 대응 재테스트 결과 반영
- 대상: docs/apps-in-toss-review-fixes-2026-04-14.md, apps/web/lib/share.ts, apps/web/lib/shareCardCanvas.ts, apps/web/lib/url.ts, apps/web/components/ShareBottomSheet.tsx
- 생성/수정: platforms/toss-inapp.md
- 노트:
  - 핀치 줌 차단, API 통신, 공유 카드 미리보기, 이미지 저장까지 실기기 확인 완료
  - 프로덕션 `ottline.app` OG 라우트 배포 상태와 무관하게 앱인토스 내부 canvas 렌더 fallback 추가
  - 앱인토스 SDK `share`는 텍스트 메시지만 지원하므로 공유 포맷은 현재 텍스트 공유로 제한됨

## [2026-04-14] update: 앱인토스 심사 반려 사유 대응 코드 반영
- 대상: 2026-04-14 앱인토스 심사 결과, docs/apps-in-toss-review-fixes-2026-04-14.md, apps/web/app/[locale]/layout.tsx, apps/web/lib/appsInToss.ts, apps/web/lib/share.ts, apps/web/components/ShareBottomSheet.tsx
- 생성/수정: platforms/toss-inapp.md, index.md
- 노트:
  - 토스 공식 가이드에 맞춰 `tossmini.com` 환경에서 viewport를 `maximum-scale=1`, `user-scalable=no`로 강제
  - 공유 카드 저장은 앱인토스 네이티브 `saveBase64Data` 브리지 우선 사용
  - 공유 버튼은 preview 준비 여부와 무관하게 즉시 클릭 가능하도록 수정하고, Web Share(files) 불가 시 텍스트 네이티브 `share`로 fallback

## [2026-04-14] ingest: Cloudflare CLS 분석 및 footer 대응 반영
- 대상: `Account Analytics _ ottline.app _ Cloudflare.pdf`, apps/web/components/AppFooter.tsx, GitHub Actions 배포 이력
- 생성/수정: architecture/web-performance.md (신규), index.md
- 노트:
  - Cloudflare PDF에서 `/timeline`의 footer를 주요 CLS 원인으로 확인
  - `AppFooter`의 `apiVersion` 런타임 fetch 및 버전 라인 제거
  - staging/production web 배포 완료 후 재관측 필요

## [2026-04-13] update: 낙장불입 정책 및 로컬 초기화 의미 정리
- 대상: AGENTS.md, apps/web/app/[locale]/account/page.tsx, docs/delete-sync-mvp.md
- 생성/수정: features/delete-sync.md, index.md
- 노트:
  - 사용자용 개별 기록 삭제 없음으로 제품 정책 확정
  - 설정의 로컬 초기화는 현재 기기 브라우저 저장소만 삭제하는 기능으로 재정의
  - 삭제 동기화(tombstone) + 복구 UX는 현재 우선순위에서 제외

## [2026-04-13] fix: Naver 미노출 — localePrefix as-needed 수정
- 대상: apps/web/i18n/routing.ts
- 생성/수정: architecture/geo-seo.md
- 노트: 사이트맵 URL 전체가 307 반환하던 문제 수정. 배포 후 네이버 서치어드바이저 수집 재요청 필요.

## [2026-04-13] update: Whale Store 제출
- 대상: apps/browser-extension
- 생성/수정: platforms/browser-extension.md
- 노트: 2026-04-13 제출 완료, 심사 중

## [2026-04-13] update: 미래의 타임라인 추천 품질 개선
- 대상: main 브랜치
- 생성/수정: features/future-timeline.md, docs/future-timeline-llm-recommendation.md
- 노트:
  - 이력 범위 최근 3개월 최대 50개로 변경
  - LLM 결과를 시청 이력 + excluded 서버 측 dedup
  - 프롬프트에 메모/장소/누구와 포함, 외국 작품 원제 요청
  - 기본 모델 claude-opus-4-5 → claude-sonnet-4-6
  - recommendation_open/refresh/dismiss 이벤트 트래킹 추가
  - analytics 엔드포인트 /api/analytics → /api/nalytic (광고 차단기 우회)

## [2026-04-12] ingest: 미래의 타임라인 (LLM 추천) 기능 추가
- 대상: feature/future-timeline-recommendation 브랜치
- 생성/수정: features/future-timeline.md (신규), index.md
- 노트: Claude/Gemini 병렬 호출, TMDB 포스터 enrichment, 하루 1회 새로고침 제한

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
