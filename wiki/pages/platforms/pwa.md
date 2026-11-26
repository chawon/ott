# PWA (Progressive Web App)

> 설치형 웹앱, 로컬 기록·Outbox와 한·영 오프라인 재진입 안내

## 관련 페이지
- [Android TWA 운영 이력](../../archive/twa.md)
- [[ms-store]]
- [[browser-extension]]

---

## 현재 상태

웹 PWA는 브라우저에서 설치한 데스크톱 앱과 기존 모바일 홈 화면 설치 사용자를 위한 채널이다. Google Play는 [Android Native](android-native.md)를, Microsoft Store는 [Windows Native](windows-native.md)를 배포한다. Android TWA와 Microsoft Store PWA에서 남은 데이터 이전은 전환 기록을 따른다. [Android 전환](../../../docs/android-native-v2-transition.md), [Windows 전환](../../../docs/windows-native-v2-transition.md)

PWA 기본 요건(manifest, icons, screenshots, 설치 배너, service worker)을 갖추고 있다.

11월 26일 `33942ae`를 배포했다. 기존 설치판은 업데이트 후 연결 계정을 한 번 전체 동기화해 예전 목록에 남은 삭제 기록을 바로잡는다. 미전송 메모와 수정 이력은 보존되며 다음 동기화부터 변경분을 받는다. [기존 설치 PWA 검증](../../../docs/changes/api-active-log-lists-182-2026-11-26.md)

11월 25일 운영 버전 `8c8b064`에서 서버가 오래된 수정으로 거절한 항목은 최신 상태를 확인한 뒤 대기열에서 정리하고 다음 기록을 전송한다. Apple 방문자에게는 웹의 서비스 소개와 첫 기록 저장 후에 기기에 맞는 스토어를 안내한다. [배포](https://github.com/chawon/ott/actions/runs/45615659458) · [기존 설치 PWA의 운영 인수](https://github.com/chawon/ott/issues/162#issuecomment-7162996402) · [스토어 이동과 집계](https://github.com/chawon/ott/issues/175#issuecomment-7163045122)

11월 22일 `c693fd8`에서 함께 상세, 큰 화면 2단, 큐레이터 종료, Apple 안내와 추천 재시도 복구를 배포했다. [11월 22일 통합 배포](../../../docs/web-api-rollout-2026-11-22.md)

`2026-11-12` PR `#130`, Web SHA `4cabcd5`에서 서비스워커 v7과 외부 자원이 필요 없는 한·영 오프라인 안내를 운영 반영했다. 실행 중인 화면의 로컬 기록 처리와, 오프라인에서 새로 진입했을 때의 안내를 구분한다. 전체 기록 화면을 네트워크 없이 처음 여는 기능은 별도 범위다. [배포·검증 기록](../../../docs/web-offline-accessibility-2026-11-12.md)을 따른다.

기존 설치판은 서비스워커 캐시에서 이전 버전 문자열을 읽을 수 있다. 설치 업데이트 확인에는 `/.well-known/ottline-version`에 새 쿼리를 붙여 읽은 버전과 실제 동기화 동작을 함께 사용한다. [설치판 검증](https://github.com/chawon/ott/issues/162#issuecomment-7162996402)

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
