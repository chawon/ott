# Wiki Index

## Features

| 페이지 | 요약 |
|---|---|
| [[analytics]] | 플랫폼별(Web/PWA/TWA) 사용 지표 수집, 개인 리포트, 관리자 대시보드 |
| [[dna-aura]] | 시청 기록 26종 특질 추출 → Journey 화면 Aura 글로우 시각화 (native 앱) |
| [[book-log]] | 네이버 책 검색 API 연동으로 영상 기록 흐름에 책 기록 통합 |
| [[daily-report]] | 매일 오전 9시 Telegram으로 Cloudflare·GA4·내부 분석·K8s 통합 현황 발송 |
| [[dark-mode]] | 기본 모드에서만 적용되는 라이트/다크/시스템 테마 전환 |
| [[delete-sync]] | 개별 기록 삭제 없이 현재 기기 로컬 데이터만 초기화하는 정책 |
| [[feedback]] | 앱 내부 문의 스레드 + 관리자 답변 화면을 포함한 자체 API 기반 문의 채널 |
| [[onboarding]] | 첫 방문자 온보딩 오버레이 가이드 (현재 비활성화) |
| [[share-card]] | 기록 저장 직후 SNS 친화적 이미지 카드 생성 및 공유 |
| [[timeline-export]] | 사용자 타임라인 CSV/XLSX 내보내기, 복원 제외 |
| [[future-timeline]] | LLM(Claude/Gemini) 기반 시청 기록 분석 → 미래의 타임라인 추천 |

## Architecture

| 페이지 | 요약 |
|---|---|
| [[geo-seo]] | AI 검색(GEO)과 SEO 관점의 ottline.app 현황 및 개선 계획 (29/100 Critical) |
| [[i18n]] | next-intl 기반 한국어/영어 지원 완료, URL 기반 로케일 라우팅 |
| [[navigation-auth-migration]] | ott.preview.pe.kr → ottline.app Redirect Flow 기반 인증 정보 이식 |
| [[kmp]] | 초창기 KMP 크로스플랫폼 시도, 현재 중단 — shared/ 디렉토리 잔재 |
| [[web-performance]] | Cloudflare Web Analytics 기준 Core Web Vitals 현황과 CLS 대응 기록 |

## Platforms

| 페이지 | 요약 |
|---|---|
| [[browser-extension]] | PC OTT 페이지에서 ottline 기록 화면으로 연결하는 Chrome/Edge 확장 |
| [[ms-store]] | PWABuilder 기반 Windows PWA 패키지 생성 및 Microsoft Store 제출 |
| [[pwa]] | 로컬 우선 아키텍처 기반 설치형 웹앱, Service Worker 및 오프라인 지원 포함 |
| [[native]] | React Native + Expo 기반 네이티브 앱 (feat/native-mobile-app 브랜치, 개발 중) |
| [[toss-inapp]] | 앱인토스 WebView 미니앱 — 2026-04-14 반려 대응 완료, 핀치줌/미리보기/저장 정상, 공유는 텍스트 |
| [[twa]] | Android TWA, Play 내부 테스트 완료 — Capacitor 통합 전환 예정 |

## Processes

| 페이지 | 요약 |
|---|---|
| [[code-review]] | apps/web, apps/api, deploy/oke 전반 코드 품질 검토 (2026-02-06) |
| [[gitops]] | OKE + ArgoCD 기반 GitOps 배포 자동화 가이드 |
| [[ottline-branding]] | ott.preview.pe.kr → ottline.app 도메인 전환 및 브랜드 일괄 적용 |
| [[security]] | 코드 리뷰 발견 보안 이슈 및 사고 대응 체크리스트 |
| [[staging]] | OKE 별도 namespace + Cloudflare Access 접근 제한 스테이징 환경 |
| [[ux-copy]] | 서비스 전반 사용자 노출 문구 톤/용어/형식 표준화 가이드 |
| [[ux-reviews]] | 서비스 UX 검토 및 개선 사항 통합 (2026-02-06, 2026-02-10) |
| [[design-review]] | ui-ux-pro-max 기반 디자인 점검 — primary 컬러 미연결, cursor-pointer 누락 등 (2026-04-07) |
