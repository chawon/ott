# PWA (Progressive Web App)

> 설치형 웹앱, 로컬 기록·Outbox와 한·영 오프라인 재진입 안내

## 관련 페이지
- [[twa]]
- [[ms-store]]
- [[browser-extension]]

---

## 현재 상태

PWA 기본 요건(manifest, icons, screenshots, 설치 배너, service worker)을 갖추고 있다.

`2026-11-12` PR `#130`, Web SHA `4cabcd5`에서 서비스워커 v7과 외부 자원이 필요 없는 한·영 오프라인 안내를 운영 반영했다. 실행 중인 화면의 로컬 기록 처리와, 오프라인에서 새로 진입했을 때의 안내를 구분한다. 전체 기록 화면을 네트워크 없이 처음 여는 기능은 별도 범위다. [배포·검증 기록](../../../docs/web-offline-accessibility-2026-11-12.md)을 따른다.

### 주요 파일
- `apps/web/app/manifest.webmanifest/route.ts` — 언어별 Web App Manifest
- `apps/web/public/sw.js` — 서비스워커 (캐시 키: `ottline-cache-v7`)
- `apps/web/public/offline/ko.html`, `en.html` — 외부 자원·JavaScript가 필요 없는 오프라인 fallback
- `apps/web/components/PwaInstallBanner.tsx` — 설치 유도 UI

### 아이콘 세트
- `apps/web/public/brand/v2/app-icon-192.png` (192×192)
- `apps/web/public/brand/v2/app-icon-512.png` (512×512, any/maskable)
- `apps/web/public/brand/v2/app-icon-180.png` (180×180)

### 스크린샷 자산
- `apps/web/public/pwa/v2-ko-desktop.png`, `v2-en-desktop.png`
- `apps/web/public/pwa/v2-ko-mobile.png`, `v2-en-mobile.png`

---

## PWA Manifest 브랜드 기준 (ottline)

```
name: "ottline"
short_name: "ottline"
background_color: "#F8F6F2"
theme_color: "#F8F6F2"
```

`id`와 `start_url`은 `"/"`이며 `scope`는 별도로 지정하지 않는다.

---

## 설치 구현 단계

### 1단계: 기본 설치형 (완료)
- Web App Manifest
- iOS/Android 설치 프롬프트 UI
- 아이콘 세트

### 2단계: 오프라인 재진입 안내 (운영 반영)
- Service Worker 등록
- 한·영 정적 안내와 브랜드 아이콘 사전 캐시
- HTML은 네트워크 우선이며 통신 실패 시 언어별 안내를 반환
- `/api`, `/admin`, `/og`, `/_next`, RSC 요청은 서비스워커 캐시에서 제외

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
- 캐시 버전 변경 시 기존 `ottline-cache-`·`ott-pwa-` Cache Storage만 정리하고 IndexedDB 기록은 유지
- ChunkLoadError 발생 시 자동 reload 처리 추가됨 (배포 후 stale chunk 대응)

---

## 로컬 우선 (Local-first) 아키텍처

- 데이터는 브라우저 IndexedDB에 로컬 저장
- 온라인 복구 시 Outbox 큐를 통해 서버 동기화
- 실행 중인 화면은 IndexedDB의 로컬 기록을 처리하고 변경을 Outbox에 보관
- 오프라인 재진입 안내는 정적 문서이며 전체 기록 화면의 오프라인 시작을 보장하지 않음
