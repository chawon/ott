# About 서비스 소개 확장 문구 반영 (2026-04-21)

## 목적
- `apps/web/app/[locale]/about/page.tsx`의 서비스 소개에 ottline이 기본 웹 서비스를 중심으로 여러 진입점으로 확장되어 있다는 점을 반영한다.

## 범위
- 소개 페이지 UI 카피와 레이아웃만 수정한다.
- API, DB, Sync, 인증 플로우는 변경하지 않는다.
- 공유 카드 예시 이미지를 `next/image`로 렌더링하므로 이미지 설정에서 일반 로컬 정적 자산과 `/og/share-card` 동적 경로를 함께 허용한다.

## 반영할 메시지
1. ottline의 중심은 웹 타임라인이다.
2. 같은 기록 흐름을 기반으로 설치형 PWA, 토스 인앱, PC 브라우저 확장, Windows 앱, Android 앱, ChatGPT 연결까지 열려 있다.
3. 공개 중인 채널은 실제 진입 링크를 노출한다.
4. 브라우저 확장은 기록 저장의 주체가 아니라 웹 QuickLog로 이어주는 보조 진입점으로 표현한다.
5. 토스 인앱은 공개 링크(`https://minion.toss.im/XYvjpUB2`)를 노출한다.
6. 상단 강조 문구는 토스 전용이 아니라 서비스 전반의 연속성 메시지로 유지하고, 페어링 코드는 어디서 열어도 같은 타임라인을 잇는 수단으로 표현한다.
7. 토스 카드는 토스 진입점 자체만 설명하고, 페어링 코드 강조를 중복하지 않는다.
8. Android 앱과 ChatGPT 연결은 아직 공개 전이므로 `준비 중` 상태로 표현한다.

## 검증 시나리오
1. `ko`, `en` `/about` 페이지에서 신규 소개 섹션이 자연스럽게 렌더링된다.
2. 모바일 폭에서 카드형 섹션 줄바꿈이 깨지지 않는다.
3. 기존 사용법/팁/공유 카드 예시 섹션이 그대로 유지된다.

## 완료 상태 (2026-04-22)
- `/about` 서비스 소개에 웹/PWA, 토스 인앱, Chrome Web Store 브라우저 확장, Microsoft Store Windows 앱 링크를 반영했다.
- Android 앱과 ChatGPT 연결은 `준비 중` 상태로 유지했다.
- 페어링 코드 메시지는 토스 전용 문구가 아니라 서비스 전반의 연속성 메시지로 정리했다.

## 배포 기록
- PR: `#19` (`Update about page platform rollout copy`)
- main merge commit: `005481c20587222e86e9e610e999ff611797d32a`
- Staging Web deploy success: GitHub Actions run `24726936985`
- Production Web deploy success: GitHub Actions run `24727095919`
