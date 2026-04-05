# PWA (Progressive Web App)

> 로컬 우선 아키텍처 기반의 설치형 웹앱, Service Worker 및 오프라인 지원 포함

## 관련 페이지
- [[twa]]
- [[ms-store]]
- [[browser-extension]]

---

## 현재 상태

PWA 기본 요건(manifest, icons, screenshots, 설치 배너, service worker)을 갖추고 있다.

### 주요 파일
- `apps/web/app/manifest.ts` — Web App Manifest (`id`, `orientation`, `categories` 반영)
- `apps/web/public/sw.js` — 서비스워커 (캐시 키: `ottline-cache-v1`)
- `apps/web/app/[locale]/offline/page.tsx` — 오프라인 fallback 페이지
- `apps/web/components/PwaInstallBanner.tsx` — 설치 유도 UI

### 아이콘 세트
- `apps/web/public/icon-192.png` (192×192)
- `apps/web/public/icon.png` (512×512)
- `apps/web/public/apple-touch-icon.png` (180×180)

### 스크린샷 자산
- `apps/web/public/pwa/screenshot-desktop-wide.png`
- `apps/web/public/pwa/screenshot-mobile-narrow.png`

---

## PWA Manifest 브랜드 기준 (ottline)

```
name: "ottline"
short_name: "ottline"
background_color: "#F0F6FF"
theme_color: "#1E4D8C"
```

`start_url`, `scope`는 현재 상대경로(`"/"`) 유지. 도메인 고정 필요 시 변경.

---

## 설치 구현 단계

### 1단계: 기본 설치형 (완료)
- Web App Manifest
- iOS/Android 설치 프롬프트 UI
- 아이콘 세트

### 2단계: 오프라인 캐시 (완료)
- Service Worker 등록
- 정적 자산 + 핵심 페이지(`/`, `/timeline`) 캐싱

### 3단계: 품질/운영
- 설치율/활성화 추적 이벤트 (`app_open` with `installState: 'pwa_installed'`)

---

## 분석 연동

`app_open` 이벤트에 디바이스 세그먼트 포함:
- `deviceType`: `mobile | tablet | desktop`
- `osFamily`: `ios | android | windows | macos | linux | chromeos | unknown`
- `browserFamily`: `chrome | safari | edge | firefox | samsung_internet | in_app | unknown`
- `installState`: `browser | pwa_installed | twa`

---

## 서비스워커 주의사항

- 스테이징 환경에서는 서비스워커 비활성화 (Cloudflare Access CORS 문제 방지)
- 캐시 키 변경 시 → Windows PWA 패키지 재생성 필요
- ChunkLoadError 발생 시 자동 reload 처리 추가됨 (배포 후 stale chunk 대응)

---

## 로컬 우선 (Local-first) 아키텍처

- 데이터는 브라우저 IndexedDB에 로컬 저장
- 온라인 복구 시 Outbox 큐를 통해 서버 동기화
- 서버 전송 없이도 기록 저장/조회 가능
