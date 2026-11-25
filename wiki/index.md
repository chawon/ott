# ottline Wiki

[개발 문서 지도](../docs/README.md) · [플랫폼 현황](../docs/platforms.md) · [변경안 작성](../docs/changes/README.md) · [변경 기록](log.md) · [아카이브](archive/README.md)

## 플랫폼

| 페이지 | 범위 |
| --- | --- |
| [Web/PWA](pages/platforms/pwa.md) | 브라우저 설치, 서비스워커와 오프라인 안내 |
| [Android](pages/platforms/android-native.md) | Kotlin/Compose 네이티브 앱과 기존 TWA 계정·기록 복구 |
| [iOS·iPadOS](pages/platforms/native.md) | 출시된 SwiftUI v2와 이전 Expo 설치판의 업데이트 검증 |
| [Windows](pages/platforms/windows-native.md) · [Microsoft Store](pages/platforms/ms-store.md) | WPF 앱, 스토어 업데이트 및 이전 PWA 이어받기 |
| [macOS](pages/platforms/macos-native.md) | 출시된 Mac App Store 앱과 설치판·웹 연결 검증 |
| [브라우저 확장](pages/platforms/browser-extension.md) | Chrome·Edge·Whale에서 Web과 Windows 빠른 기록 연결 |
| [토스 인앱](pages/platforms/toss-inapp.md) | 별도 브랜치에서 빌드하는 앱인토스 미니앱 |
| [ChatGPT 앱](../docs/changes/v2-channel-strategy.md#chatgpt-앱) | 읽기 전용 타임라인 연결의 재제출 준비 |
| [구형 Android TWA](archive/twa.md) | Android 네이티브 전환 전의 배포 이력 |

## 기능

| 페이지 | 범위 |
| --- | --- |
| [ottline v2](pages/features/ottline-v2.md) · [페어링 기기의 기록 복구](../docs/changes/api-sync-delivery-171-2026-11-25.md) | 기록장·수첩, 명시적 저장, 동기화와 플랫폼 전환 |
| [타임라인](pages/features/timeline.md) · [타임라인 내보내기](pages/features/timeline-export.md) | 필터와 검색, 서버 커서, CSV/XLSX |
| [삭제 정책](pages/features/delete-sync.md) | 개별 기록 수정, 기기 초기화, 서버 전체 삭제 |
| [개인 프로필](pages/features/personal-profile.md) · [복구 카드](pages/features/pairing-recovery-card.md) | 페어링 계정 개인화와 복구 |
| [책 기록](pages/features/book-log.md) | Kakao·Google Books, ISBN 판본과 독서 플랫폼 |
| [함께 인기 작품](pages/features/home-popular-fallback.md) · [공개 리액션](pages/features/public-reactions.md) | 공개 이야기, 인기 작품 보충과 내 기록 연결 |
| [미래의 타임라인](pages/features/future-timeline.md) · [큐레이터](pages/features/ai-curator.md) | 개인 추천 복구와 큐레이터 종료·보관 이력 |
| [공유 카드](pages/features/share-card.md) · [DNA Aura](pages/features/dna-aura.md) | 기록 이미지 공유와 Expo iOS 특질 시각화 |
| [다크 모드](pages/features/dark-mode.md) | Web/PWA 라이트·다크·시스템 테마 |
| [문의함](pages/features/feedback.md) | 사용자 문의·관리자 답변 |
| [분석](pages/features/analytics.md) · [데일리 리포트](pages/features/daily-report.md) | 사용과 유입 지표, Telegram 운영 리포트 |

## 아키텍처와 운영

- [공통 API와 데이터 계약](../docs/product-contracts.md)
- [다국어](pages/architecture/i18n.md) · [GEO·SEO](pages/architecture/geo-seo.md)
- [GitOps](pages/processes/gitops.md) · [스테이징과 수동 배포](pages/processes/staging.md) · [보안](pages/processes/security.md)
- [UX 문구](pages/processes/ux-copy.md)
