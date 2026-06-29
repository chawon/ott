# About 서비스 소개 확장 문구 반영 (2026-04-21)

## 목적
- `apps/web/app/[locale]/about/page.tsx`의 서비스 소개에 ottline이 기본 웹 서비스를 중심으로 여러 진입점으로 확장되어 있다는 점을 반영한다.

## 범위
- 소개 페이지 UI 카피와 레이아웃만 수정한다.
- API, DB, Sync, 인증 플로우는 변경하지 않는다.
- 공유 카드 예시 이미지를 `next/image`로 렌더링하므로 이미지 설정에서 일반 로컬 정적 자산과 `/og/share-card` 동적 경로를 함께 허용한다.

## 반영할 메시지
1. ottline의 중심은 웹 타임라인이다.
2. 같은 기록 흐름을 기반으로 설치형 PWA, Android 앱, iOS 앱, Windows 앱, PC 브라우저 확장, 토스 인앱, ChatGPT 연결까지 열려 있다.
3. 공개 중인 채널은 실제 진입 링크를 노출한다.
4. 브라우저 확장은 기록 저장의 주체가 아니라 웹 QuickLog로 이어주는 보조 진입점으로 표현한다.
5. 토스 인앱은 공개 링크(`https://minion.toss.im/XYvjpUB2`)를 노출한다.
6. 상단 강조 문구는 토스 전용이 아니라 서비스 전반의 연속성 메시지로 유지하고, 페어링 코드는 어디서 열어도 같은 타임라인을 잇는 수단으로 표현한다.
7. 토스 카드는 토스 진입점 자체만 설명하고, 페어링 코드 강조를 중복하지 않는다.
8. Android 앱은 Google Play 출시 상태, iOS 앱은 App Store 출시 상태로 표현하고, ChatGPT 연결만 아직 공개 전이므로 `준비 중` 상태로 표현한다.

## 검증 시나리오
1. `ko`, `en` `/about` 페이지에서 신규 소개 섹션이 자연스럽게 렌더링된다.
2. 모바일 폭에서 카드형 섹션 줄바꿈이 깨지지 않는다.
3. 기존 사용법/팁/공유 카드 예시 섹션이 그대로 유지된다.

## 완료 상태 (2026-04-22)
- `/about` 서비스 소개에 웹/PWA, 토스 인앱, Chrome Web Store 브라우저 확장, Microsoft Store Windows 앱 링크를 반영했다.
- Android 앱은 Google Play 출시 상태로 갱신했고, ChatGPT 연결은 `준비 중` 상태로 유지했다.
- 페어링 코드 메시지는 토스 전용 문구가 아니라 서비스 전반의 연속성 메시지로 정리했다.

## 배포 기록
- PR: `#19` (`Update about page platform rollout copy`)
- main merge commit: `005481c20587222e86e9e610e999ff611797d32a`
- Staging Web deploy success: GitHub Actions run `24726936985`
- Production Web deploy success: GitHub Actions run `24727095919`

### Google Play 링크 반영 (2026-06-07)
- PR: `#51` (`feat: add Google Play link to about page`)
- main merge commit: `536774478497cae3f5ae230d46b69b6d0f236892`
- Staging Web deploy success: GitHub Actions run `27079271629`
- Production Web deploy success: GitHub Actions run `27079312890`
- Production 확인: ArgoCD `ott-app` `Synced Healthy`, `ott-web` 이미지 태그 `536774478497cae3f5ae230d46b69b6d0f236892`, `1/1 ready`

### 스토어 버튼 및 영상·책 카피 정리 (2026-06-07)
- PR: `#55` (`feat: simplify settings and about navigation`)
- main merge commit: `4fcfd6dd07243a6ad0bf112b00982b2dc4113122`
- Production manifest commit: `d79453e5e13972719176ef7764cd3df61a7b1deb`
- Staging Web deploy success: GitHub Actions run `27089185975`
- Production Web deploy success: GitHub Actions run `27089241013`
- `/about` 플랫폼 순서: 웹/PWA, Android, Windows, 브라우저 확장, 토스 인앱, ChatGPT
- 브라우저 확장 링크를 Chrome Web Store, Edge Add-ons, Whale Store 3개 아이콘 버튼으로 분리했다.
- Google Play, Microsoft Store, Chrome, Edge, Whale, Toss 링크 버튼에 아이콘을 붙였다.
- 메타 타이틀과 서비스 소개 제목을 `OTT 시청 기록` 한정에서 `영상·책 기록` 기준으로 정리했다.
- Production 확인: ArgoCD `ott-app` `Synced Healthy`, `ott-web` 이미지 태그 `4fcfd6dd07243a6ad0bf112b00982b2dc4113122`, `APP_VERSION=4fcfd6d`, production Pod 내부 `/about` HTML에서 `영상·책`, `Edge Add-ons`, `Whale Store` 반영 확인

### iOS App Store 링크 반영 (2026-06-29)
- App Store 심사 통과 및 공개 링크: `https://apps.apple.com/app/ottline/id6780318110`
- `/about` 플랫폼 순서: 웹/PWA, Android, iOS, Windows, 브라우저 확장, 토스 인앱, ChatGPT
- 서비스 소개 설명과 구조화 데이터의 지원 플랫폼 표현에 iOS 앱을 반영한다.
- PR: `#74` (`Add iOS App Store link to about page`)
- main merge commit: `ec08179a229bc0e8b23df31d31e639651338d7f0`
- Production Web deploy success: GitHub Actions run `28379967425`
- Production manifest commit: `650a93a162e2537f4d2998f46c819edf7504a51f`
- Production 확인: ArgoCD `ott-app` `Synced Healthy`, `ott-web` 이미지 태그 `ec08179a229bc0e8b23df31d31e639651338d7f0`, `APP_VERSION=ec08179`, rollout `1/1 ready`
