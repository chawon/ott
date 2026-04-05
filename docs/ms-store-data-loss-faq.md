# MS Store 앱 데이터 소실 이슈 FAQ

## 증상

Microsoft Store에서 설치한 ottline 앱에서 기록을 저장하고 앱을 종료한 뒤 다시 열면
타임라인 목록이 비어있거나 로그인이 풀리는 현상.

---

## 원인

### 근본 원인: Edge 브라우저 "닫을 때 사이트 데이터 지우기" 설정

ottline MS Store 앱은 PWABuilder로 패키징된 MSIX이며, 내부적으로 Edge WebView2를 사용한다.
현재 패키지의 `AppxManifest.xml`에 `profile-directory?Default` 파라미터가 설정되어 있어
**Edge 브라우저의 기본 프로파일(Default)을 공유**한다.

Edge 설정에서 **"브라우저를 닫을 때 쿠키 및 사이트 데이터 지우기"** 가 켜져 있으면,
Edge를 닫을 때 ottline 앱 데이터(IndexedDB + localStorage)도 함께 삭제된다.

- `localStorage` → 인증 토큰(userId, deviceId, pairingCode) 삭제 → 로그인 풀림
- `IndexedDB` → Dexie 데이터베이스 삭제 → 타임라인 목록 전체 소실

웹 브라우저 탭에서는 Edge 전체를 완전히 닫는 일이 드물어 영향을 덜 받는다.
MS Store 앱은 종료 시 Edge 프로세스와 함께 닫히므로 매번 영향을 받는다.

---

## 즉시 해결 방법 (사용자)

Edge 설정에서 해당 옵션을 끄면 된다.

1. Edge 브라우저 열기 → 주소창에 `edge://settings/clearBrowsingDataOnClose` 입력
2. **"쿠키 및 기타 사이트 데이터"** 토글 → **끔**
3. 또는: 설정 → 개인 정보, 검색 및 서비스 → 브라우저를 닫을 때 지울 항목 선택

---

## 장기 해결 계획 (개발)

### 1. MSIX 전용 프로파일 분리

`AppxManifest.xml`의 `profile-directory` 파라미터를 변경하여
ottline 앱이 Edge 기본 프로파일 대신 전용 프로파일을 사용하도록 한다.

```xml
<!-- 현재 (Edge Default 프로파일 공유) -->
<uap3:Protocol Name="web-browser" DesiredView="default"
  Parameters="-profile-directory?Default --app=%1" />

<!-- 변경 목표 (전용 프로파일) -->
<uap3:Protocol Name="web-browser" DesiredView="default"
  Parameters="-profile-directory?ottline-app --app=%1" />
```

변경 후 makeappx.exe + signtool로 서명하여 MS Partner Center에 재제출 필요.

### 2. 코드 레벨 방어 (완료)

서버에서 401/403 응답 시 과거에는 `resetLocalState()`로 IndexedDB 전체를 삭제했으나,
`clearAuthLocal()`로 변경하여 인증 토큰만 삭제하고 로컬 데이터는 보존하도록 수정함.

- `apps/web/lib/api.ts`: 401/403 핸들러에서 `clearAuthLocal()` 호출
- `apps/web/components/SyncWorker.tsx`: 앱 열릴 때 `ensureAuth()` 먼저 실행하여 자동 재등록

---

## 관련 파일

- `apps/web/lib/api.ts` — API 요청/인증 에러 처리
- `apps/web/lib/localStore.ts` — `clearAuthLocal()`, `resetLocalState()`
- `apps/web/components/SyncWorker.tsx` — 앱 시작 시 sync 흐름
- `docs/ms-store-pwa-plan.md` — MS Store 출시 계획 전반
