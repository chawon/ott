# 문서 아카이브

폐기한 계획, 종료한 운영 절차, 당시 심사·릴리스·검토 근거를 보존합니다. 오늘의 기능 계약과 플랫폼 상태는 [개발 문서](../README.md)에서 확인합니다.

## Android TWA

`app.ottline`의 Google Play `1.0.19` (`versionCode=23`)까지를 다룹니다. 현재 Android 동작과 기존 설치 복구는 [Android Native v2 전환](../android-native-v2-transition.md)을 따릅니다.

- [TWA 운영·내부 테스트 가이드](android-twa/twa.md)
- [Play 출시 체크리스트](android-twa/twa-play-launch-checklist.md)와 [등록 문구](android-twa/twa-play-store-listing-ko.md)
- [진입점 개편](android-twa/twa-android-entrypoints-2026-04-29.md)과 [QuickLog 위젯 디자인](android-twa/twa-widget-design-refresh-2026-04-20.md)
- [알파 피드백](android-twa/twa-android-alpha-feedback-loop-2026-05-11.md)과 [알파 진단](android-twa/twa-android-alpha-feedback-diagnostics-2026-05-28.md)
- [시청 기록 알림 테스트 APK](android-twa/twa-android-watch-reminder-test-apk-2026-05-29.md), [시청 알림 신뢰성 복구](android-twa/android-watch-reminder-reliability.md), [회고 알림](android-twa/android-revisit-reminders-2026-06-07.md)

## iOS 최초 출시와 1.x 심사

- [초기 Web 동등성과 TestFlight 계획](ios/ios-native-full-parity-testflight-plan.md)
- [App Store 출시 체크리스트](ios/ios-app-store-launch-checklist.md)
- [TestFlight 제출 문구와 이력](ios/ios-testflight-review-notes.md)

현재 소스와 출시 절차는 [iOS 개발 가이드](../../apps/native/DEVELOPMENT.md)를 참고합니다.

## 데스크톱과 확장

- [Microsoft Store PWA 패키징과 출시 계획](desktop/ms-store-pwa-plan.md)
- [Microsoft Store PWA 등록 문구](desktop/ms-store-listing-copy.md)
- [브라우저 확장 최초 MVP 계획](desktop/browser-extension-mvp.md)

현재 Windows 앱은 [Windows Native v2 전환](../windows-native-v2-transition.md)을 따릅니다.

## Web 전환 이력

- [도메인 전환 작업 지시서](web/ottline-transition-task.md), [인증 정보 이식 결과](web/navigation-auth-migration.md), [이전율 추적](web/plan-migration-status-tracking.md), [구 도메인 유입 집계](web/plan-old-domain-analytics-cutover.md)
- [브랜딩 Phase 2 계획](web/plan-ottline-branding-phase2.md), [서비스 소개 채널 확장](web/about-service-platform-expansion-2026-04-21.md), [레트로 모드 결정 기준](web/retro-mode-usage-decision-2026-02-13.md)
- [PWA 전환 초안](web/pwa-plan.md), [다국어 도입 계획](web/i18n-globalization-plan.md), [초기 GEO 감사 결과](web/GEO-AUDIT-REPORT.md)

## 종료된 캠페인·제출·검토

- [2026년 상반기 리캡](campaigns/2026-h1-recap.md)
- [OCI Always Free 자원 축소 검토](infra/oci-always-free-rightsizing.md)와 취소 결정
- [ChatGPT 앱 초기 출시 가이드](chatgpt/chatgpt-app-launch.md), [제출 초안](chatgpt/chatgpt-app-submission.md), [디렉터리 스크린샷 계획](chatgpt/chatgpt-directory-screenshots-2026-04-22.md)
- [코드 리뷰](reviews/code-review-2026-02-06.md), [UX 리뷰 2026-02-06](reviews/ux-review-2026-02-06.md), [UX·PWA 리뷰 2026-02-10](reviews/ux-review-2026-02-10.md), [첫 기록 가이드 오버레이](reviews/first-log-overlay-onboarding-guide-2026-02-10.md)

## 초기 제품 설계

- [분석 지표 초안](features/analytics-web-pwa-twa.md)과 [리포트 페이지 MVP](features/analytics-report-pages-mvp.md). 현재 집계는 [제품 통계 기준](../realistic-analytics-metrics.md)을 참고합니다.
- [네이버 책 검색 기반 기록 MVP](features/book-log-mvp.md). 현재 도서 검색은 [Wiki의 책 기록](../../wiki/pages/features/book-log.md)에 정리합니다.
- [삭제 동기화 초안](features/delete-sync-mvp.md). 현재 [삭제·초기화 정책](../../wiki/pages/features/delete-sync.md)을 적용합니다.
- [미래의 타임라인 최초 개발·운영 키 설정 기록](features/future-timeline-llm-recommendation.md)과 [OpenAI 전환 검토](features/future-timeline-openai-review.md). 현재 [계정별 추천 정책](../future-timeline-account-policy.md)을 적용합니다.
- [상태 선택과 동시에 저장하는 기록 계획](web/frictionless-logging-plan.md), [초기 모바일 개선](web/mobile-ux-improvements.md), [레트로 모드 시기의 다크 테마](web/dark-mode.md), [1월 카피 작업](web/ui-copy-updates.md), [6월 검색어 조사](web/seo-keyword-audit-2026-06-04.md)

## 초기 기능 도입 및 문구 검토

- [큐레이터 v0 설계](features/ai-curator-v0.md)와 [문의함 도입](features/basic-feedback-channel-plan.md). 현재 운영은 [Telegram 승인](../curator-telegram-approval.md)과 [문의함](../../wiki/pages/features/feedback.md)을 참고합니다.
- [공개 리액션 v1 설계](features/public-reactions-v1-2026-05-17.md)와 [공유 카드 MVP](features/share-card-mvp.md). 현재 동작은 [리액션](../../wiki/pages/features/public-reactions.md)과 [공유 카드](../../wiki/pages/features/share-card.md)에 정리합니다.
- [관리자 통계 언어와 미리보기 개선](web/admin-analytics-i18n-preview-fix.md), [함께 메뉴 언어 필터 도입](web/together-menu-locale-filtering.md), [초기 문구 검토](reviews/ux-copy-consistency-playbook-2026-02-10.md). 현재 문구 기준은 [UX 문구](../../wiki/pages/processes/ux-copy.md)를 참고합니다.

## 2026년 10월 Web/API 의존성 갱신

- [통합 릴리스 검증 및 복구 근거](dependencies-2026-10/dependency-updates-release-2026-10-10.md)와 [단계별 업데이트 목록](dependencies-2026-10/dependency-updates.md)
- [Web 라이브러리](dependencies-2026-10/web-library-updates.md), [Web 런타임 메이저](dependencies-2026-10/web-runtime-major-updates.md), [TypeScript 7](dependencies-2026-10/typescript-7-update.md), [MCP Apps 2](dependencies-2026-10/mcp-apps-2-update.md)
- [API 기반](dependencies-2026-10/api-dependency-updates.md), [Spring Boot 4.1](dependencies-2026-10/api-spring-boot-41.md), [API 빌드 도구](dependencies-2026-10/api-build-tool-updates.md)
