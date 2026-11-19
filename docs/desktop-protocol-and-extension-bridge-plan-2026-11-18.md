# 데스크톱(`Windows`·`macOS`) 공통 `ottline://` 프로토콜·핸드오프 및 브라우저 확장 브릿지 계획 (2026-11-18)

> **목적**: `ottline helper`(브라우저 확장)와 `ottline.app` 웹 진입 사용자가 **Windows Native**뿐 아니라 출시 준비 중인 **macOS Native**로도 동일한 방식으로 자연스럽게 전환될 수 있도록, **공통 `ottline://` 딥링크·세션 핸드오프 규격과 트랙별(Apple·Web·Extension) 작업 순서**를 정의한다.

- **대상 범위**: `apps/windows-native`(기준 참조, 재빌드 불필요), `origin/feature/ios-native-v2`의 `apps/macos-native`·`apps/ios-native`·`apps/apple-core`, `apps/web`, `apps/browser-extension`
- **연관 문서**:
  - [windows-native-v2-transition.md](./windows-native-v2-transition.md) (`2026-11-18` Microsoft Store 정식 출시 및 Windows 핸드오프 구현 기준)
  - [native-desktop-device-info.md](./native-desktop-device-info.md) (`windows_native` · `macos_native` 연결 기기 식별 헤더 기준)
  - [web-acquisition-funnel-plan-2026-11-17.md](./web-acquisition-funnel-plan-2026-11-17.md) (웹→스토어 전환 퍼널 1단계 및 후속 계획)

---

## 1. 배경 및 전략 결정

1. **브라우저 확장의 포지션 전환 (`독립 앱 → 데스크톱 네이티브 브릿지`)**
   - `ottline helper`([`apps/browser-extension`](../apps/browser-extension), Chrome Web Store `achangjgnpbideilpolbohbkmmkmojpo` · Edge Add-ons `egghbkekjopgknhggoeiekgdooofihbo` · Whale Store)는 OTT 상세 페이지 DOM 변화에 민감하고 Windows Native v2 자체가 시청 종료 알림과 전역 단축키(`Ctrl+Shift+O`)를 내장하면서 단독 효용이 줄었다.
   - 다만 Chrome·Edge·Whale 스토어 등록정보는 무료 검색 노출 자산이므로 내리지 않고 **기능 동결(Freeze)** 상태로 유지하되, 클릭 시 웹 새 탭(`ottline.app`)으로만 보내던 흐름을 **설치된 데스크톱 네이티브 앱(Windows / macOS) 연결 또는 스토어 설치 유도**로 전환한다.
2. **Windows와 macOS를 동시에 묶어야 하는 이유**
   - 확장을 쓰는 사용자는 Windows와 macOS 모두 존재한다. 이미 출시된 Windows(`v2.0.0.0`)와 출시 준비 중인 macOS(`origin/feature/ios-native-v2`의 `apps/macos-native`)가 **서로 다른 딥링크 파라미터**를 쓰면 `ottline.app` 웹 브릿지나 확장이 OS마다 분기해야 한다.
   - macOS 앱 출시 전에 공통 `ottline://` 빠른 기록 파라미터와 브라우저 세션 핸드오프(`?native_handoff=1` → `ottline://open?handoff=1`)를 맞춰 두면, Mac App Store 출시 직후 웹·확장 브릿지 스위치만 켜서 Windows와 macOS가 동시에 전환된다.

---

## 2. 실측 코드 대조: Windows vs Apple (`feature/ios-native-v2:7038ce0`) 현황

| 항목 | Windows Native (`main` `2.0.0.0` 출시됨) | macOS / iOS Native (`origin/feature/ios-native-v2`) | 격차 및 조치 방향 |
|---|---|---|---|
| **URL 스킴 등록** | `<uap3:Protocol Name="ottline" Parameters="&quot;%1&quot;" />` (`AppxManifest.template.xml`) | `CFBundleURLSchemes = ["ottline"]` (`Info.plist`) + SwiftUI `.onOpenURL` (`OttlineMacApp.swift`, `OttlineApp.swift`) | **완료 (동일)** |
| **빠른 기록 진입 조건** | `host == "quick"` 또는 `quick=1` ([`DomainHelpers.cs`](../apps/windows-native/src/Ottline.Core/Domain/DomainHelpers.cs#L629-L631)) | `host == "quick-record"` 또는 `quick=1` (`OttlineMacApp.swift:32`, `OttlineApp.swift:377`) | 호스트를 `"quick"` 또는 `"quick-record"` 모두 허용하고 호출 시 `ottline://quick?quick=1&...` 사용 |
| **작품 제목 키** | `query` 또는 `title` ([`DomainHelpers.cs:620-621`](../apps/windows-native/src/Ottline.Core/Domain/DomainHelpers.cs#L620-L621)) | **`q` 만 읽음** (`qVal("q")`, `OttlineMacApp.swift:45`, `OttlineApp.swift:388`) | 호출 측은 `title` + `q` 동시 전달, Apple 측은 `q`/`title`/`query`/`capture_title` 모두 수용 |
| **플랫폼·타입·ID 키** | `platform`, `type` (`video`/`book`/`all`), `title_id`/`id` | `platform`, `type` (`video`/`book`/`all`), `title_id` | Apple 측에 `capture_platform`·`id` 별칭만 추가 권장 |
| **브라우저 세션 핸드오프 (`handoff=1`)** | `ottline://open?handoff=1&status=ok&user_id=...` 수신·자동 병합 완료 ([`ImportBrowserHandoffAsync`](../apps/windows-native/src/Ottline.Core/Data/OttlineRepository.cs#L362-L485)) | **미구현** (`OttlineMacAppState.handleIncomingUrl` / `OttlineApp.swift`에 `handoff` 분기 없음) | **macOS 출시 전 구현 필수** (`apps/web` 송신부는 이미 운영 중) |
| **네이티브 기기 식별 헤더** | `X-Client-Platform: windows_native` 전송 중 (`Windows App · Windows`) | `X-Client-Platform: macos_native` (`macOS App · macOS`, 커밋 `7038ce0` 기준) | 운영 API PR `#135` 이미 지원 완료 |

---

## 3. 공통 `ottline://` 프로토콜 표준 규격

### 3-1. 빠른 기록 호출 표준 URI (`Quick Record Deep Link`)

웹 브릿지·브라우저 확장·위젯·외부 런처가 데스크톱/모바일 네이티브 앱의 빠른 기록 화면을 열 때 사용하는 표준 형식은 다음과 같다.

```text
ottline://quick?quick=1&title={encodedTitle}&q={encodedTitle}&platform={encodedPlatform}&type={video|book|all}
```

- **Windows `v2.0.0.0` 무재빌드 호환성**:
  - Windows `ShareIntentParser`는 `host == "quick"`과 `quick=1`, `title`, `platform`, `type`을 이미 읽으므로 **스토어에 출시된 Windows `2.0.0.0` 재빌드 없이 바로 동작**한다 ([`MainViewModel.cs:2049-2056`](../apps/windows-native/src/Ottline.App/ViewModels/MainViewModel.cs#L2049-L2056)).
  - 현재 Apple(`feature/ios-native-v2`) 코드에서도 `qVal("quick") == "1"`과 `q`, `platform`, `type`이 읽히지만, 추후 단일 키 호출과의 일관성을 위해 **Apple 측(`OttlineMacApp.swift`, `OttlineApp.swift`)도 아래 별칭을 모두 허용**한다.
- **권장 파서 규격 (Apple 측 보강)**:
  - 빠른 기록 진입 조건: `host == "quick" || host == "quick-record" || qVal("quick") == "1"`
  - 초기 검색어: `qVal("q") ?? qVal("title") ?? qVal("query") ?? qVal("capture_title") ?? ""`
  - 플랫폼 프리필: `qVal("platform") ?? qVal("capture_platform")` (트림 후 비어 있지 않을 때 적용)
  - 콘텐츠 탭: `qVal("type") ?? qVal("capture_type") ?? "all"` (`video` | `book` | `all`)
  - 작품 ID 직접 지정: `qVal("title_id") ?? qVal("id")`
- **보안·프라이버시 원칙**: 빠른 기록 딥링크에는 공개 작품 메타데이터(`title`, `platform`, `type`, `title_id`)만 담고 계정·기기 식별자는 넣지 않는다. `source_url` 등 불필요한 URL 추적 파라미터도 네이티브 앱에 전달하지 않는다.

### 3-2. 웹 브라우저 세션·기록 자동 이어받기 (`?native_handoff=1` → `ottline://open?handoff=1`)

> 지금까지 macOS 네이티브 앱이 없었기 때문에 기존 Mac 사용자 전원의 기록과 연결 코드(`pairingCode`)는 Safari/Chrome 브라우저나 설치형 PWA(`ottline.app`)에 저장되어 있다. macOS 앱 출시 시 이 핸드오프가 없으면 사용자가 직접 코드를 찾아 입력해야 하므로 이탈이 크다.

1. **웹 측 동작 (이미 `ottline.app` 운영 반영됨)**
   - [`apps/web/app/[locale]/layout.tsx:129-152`](../apps/web/app/[locale]/layout.tsx#L129-L152) 및 [`apps/web/components/AndroidAppContextRecorder.tsx:22-181`](../apps/web/components/AndroidAppContextRecorder.tsx#L22-L181)가 OS 구분 없이 `?native_handoff=1` 진입을 처리한다.
   - 브라우저의 미동기화 Outbox를 서버로 먼저 전송한 뒤 아래 URI로 복귀한다 (자동 리디렉션이 막히는 브라우저에서는 *"이전 기록 연결하고 앱으로 돌아가기"* 수동 버튼 UI까지 이미 제공됨).
     - 기록/세션 존재:
       `ottline://open?handoff=1&status=ok&user_id={uuid}&device_id={uuid}&pairing_code={code}&nickname={nick}&persona_key={persona}`
     - 기록/세션 없음:
       `ottline://open?handoff=1&status=empty`
2. **macOS / iOS (`OttlineCore` · `OttlineMacAppState`) 구현 규격**
   - **트리거 UI**:
     - 미연동(`pairingCode` 없음) 또는 로컬 기록 0개인 Mac 첫 사용자에게 홈 상단 또는 `내 공간 > 기기 연결`에 *"웹(Safari/Chrome)에서 쓰던 기록 가져오기"* 버튼 제공 → 시스템 기본 브라우저로 `https://ottline.app/{ko|en}?native_handoff=1&ts={epochMs}` 실행.
   - **수신 분기 (`host == "open" || host == "handoff" || qVal("handoff") == "1"`)**:
     - `status == "empty"`: *"열린 브라우저에 이전 기록이 없어요. 다른 브라우저로 시도하거나 8자리 연결 코드를 입력해 보세요."* 안내(Windows `OttlineRepository.cs:376-378`와 동일 톤).
     - `status == "ok"`:
       1. **연결 코드(`pairing_code`)가 있는 경우 (권장 기본 경로)**:
          - Mac 앱이 자신의 로컬 Outbox를 먼저 sync한 뒤, Mac 고유의 `deviceId`(`X-Client-Platform: macos_native`)로 `POST /api/auth/pair`에 `pairing_code`를 제출해 계정을 합치고 전체 타임라인을 pull 동기화한다.
          - 장점: Mac 앱에 이미 새 기록을 1~2개 남긴 뒤 브라우저 기록을 가져와도 무손실 병합되며, 기존 브라우저 기기 row(`Safari · macOS` / `Chrome · macOS`)와 Mac 앱 row(`macOS App · macOS`)가 서버에서 분리 유지된다.
       2. **`pairing_code` 없이 익명 `user_id` + `device_id`만 있는 경우**:
          - Mac 로컬 기록이 `0`개일 때 해당 `user_id`/`device_id`를 채택하고 즉시 전체 pull 동기화 + 서버 연결 코드 확보(`POST /api/auth/pair` 또는 프로필/동기화 흐름 확인).
          - 만약 Mac 로컬에 이미 별도 임시 기록이 있다면 기존 기록이 유실되지 않도록 사용자 확인 또는 병합 우선 규칙을 따른다.
       3. `nickname`, `persona_key`가 전달되고 로컬 프로필이 비어 있으면 함께 복원한다.

---

## 4. 단계별 전환 실행 계획 (Windows · macOS · Web · Extension)

### Phase A — `apps/web` 확장→네이티브 브릿지 연결 (`Windows` 즉시 가능, `macOS` 스위치 대기)

- **대상 파일**: [`apps/web/app/[locale]/page.tsx:224-230`](../apps/web/app/[locale]/page.tsx#L224-L230), QuickLog/홈 배너 컴포넌트, [`apps/web/lib/store-acquisition.mjs`](../apps/web/lib/store-acquisition.mjs), [`apps/web/app/[locale]/about/page.tsx`](../apps/web/app/[locale]/about/page.tsx)
- **구현 내용**:
  1. 브라우저 확장이 열어주는 `?quick=1&capture_title=...&capture_platform=...&capture_type=...` 파라미터로 진입했고 현재 OS가 **Windows(`Windows NT`)**인 경우:
     - 기존 웹 QuickLog 검색 단계 안에 **"Windows 앱에서 바로 기록하기"**와 **"Microsoft Store에서 설치"**(`cid=extension_handoff`)를 함께 표시한다. Windows 일반 브라우저에서만 제공하며 제목 검색과 저장은 기존 흐름을 사용한다.
     - 앱으로 전달하는 URI는 `ottline://quick?quick=1&title=...&q=...&platform=...&type=...`이다. 제목과 플랫폼 값은 쿼리로 인코딩하고 타입은 `video`·`book`·`all`만 사용한다. 플랫폼 값이 없으면 생략한다.
     - `"항상 Windows 앱으로 열기"`를 선택하면 이 브라우저에 설정을 저장한다. 다음 확장 진입에서 앱 링크를 강조하고 우선 포커스한다. 링크를 클릭하거나 Enter를 눌러 설치된 앱을 열 수 있다. 설정을 해제한 뒤 다음 진입부터는 제목 검색에 포커스한다.
  2. `/about`의 앱 목록 아래에 브라우저 확장 **‘보조 도구’** 섹션을 둔다. Windows 앱으로 작품을 넘겨 기록하는 방법과 Mac App Store 출시 후 macOS 앱 연결을 지원한다는 점을 안내한다.
  3. **후속 정리 포함**: [PR `#133` 후속 메모](./web-acquisition-funnel-plan-2026-11-17.md#후속-phase-1-작업-시-실행할-검사)에 기록된 `Ctrl+Alt+O` → **`Ctrl+Shift+O`** 문구 정정도 이 Web PR에서 함께 처리한다.

#### Phase A 운영 배포 (2026-11-19)

- [PR #138](https://github.com/chawon/ott/pull/138)을 병합하고 `4472ad39a88395959187897a51f891cd13bf3e23`을 [웹 운영 배포](https://github.com/chawon/ott/actions/runs/44441612541)에 입력했다. [PR CI](https://github.com/chawon/ott/actions/runs/44321330160)와 [main CI](https://github.com/chawon/ott/actions/runs/44441545662)가 통과했다.
- 운영 manifest는 `7e6735e8de00d1a9ffcd4b99a59731576464caa4`다. ArgoCD `Synced Healthy`, Web 이미지와 `APP_VERSION=4472ad3`, Web/API Pod `1/1` Ready와 재시작 0을 확인했다.
- 공개 버전 응답과 한·영 `/about`의 보조 도구 섹션·`Ctrl+Shift+O`·Windows Store 링크를 확인했다. 운영 SEO 검사는 공개 URL 19개·개인 경로 14개에서 통과했고 IndexNow는 19개 URL을 접수했다.
- 운영 Web Pod의 자산을 사용한 Chromium 검사 29개가 통과했다. 한·영 확장 진입, 앱 링크 활성화, 앱 우선 설정의 유지·해제, `cid=extension_handoff`와 웹 저장을 확인했다. 저장과 이벤트는 브라우저에서 모의 처리했으며 Windows 앱 실행과 프리필은 실기기 확인 항목이다.
- macOS 앱 연결은 Mac App Store 출시 후 Phase C에서 활성화한다.

### Phase B — Apple (`origin/feature/ios-native-v2`) macOS 출시 전 규격 정렬

- **대상 파일**: `apps/macos-native/Sources/OttlineMacApp/OttlineMacApp.swift`, `apps/ios-native/Sources/OttlineApp/OttlineApp.swift`, `apps/apple-core/Sources/OttlineCore/`
- **구현 내용**:
  1. `handleIncomingUrl`에서 빠른 기록 호스트 `"quick"` 지원 및 `title` / `query` / `capture_title` / `capture_platform` / `id` 별칭 허용 (3-1절 규격).
  2. `ottline://open?handoff=1` 브라우저 세션 자동 이어받기 구현 및 `https://ottline.app/{ko|en}?native_handoff=1` 호출 UI 추가 (3-2절 규격).
  3. macOS 빌드에서 `X-Client-Platform: macos_native` 헤더 전송 및 `내 공간 > 연결된 기기`에서 `macOS App · macOS` 표시 확인.

### Phase C — macOS 정식 출시 직후 웹·브릿지 동시 활성화 (`apps/web`)

- **조건**: macOS 네이티브 앱의 Mac App Store 게시 URL 확정 이후
- **구현 내용**:
  1. [`apps/web/lib/store-acquisition.mjs`](../apps/web/lib/store-acquisition.mjs)에 `macos-appstore` 플랫폼 추가(`Windows`와 동일하게 14일 쿨다운·작성 중 숨김·캠페인 `?ct=` 추적 적용).
     - `Macintosh` UA 중 `maxTouchPoints <= 1`인 macOS 데스크톱(iPadOS 제외)을 `browser-pwa` 대신 **`macos-appstore`**로 전환하고, `browser-pwa`는 Linux·ChromeOS 등 네이티브 앱 미제공 데스크톱 전용으로 축소한다.
  2. QuickLog 저장 직후 `SavedNativeStoreCta.tsx`에 `macos-appstore` 추가.
  3. Phase A의 `?quick=1&capture_title=...` 웹 브릿지 조건에 `macos`를 추가해 Windows·macOS 양쪽 모두 `ottline://quick?quick=1&title=...&q=...` 딥링크로 네이티브 앱을 열 수 있게 한다.

### 확장 프로그램 (`apps/browser-extension`) 운영 원칙

- `popup-core.js`가 이미 `https://ottline.app/?quick=1&capture_title=...`로 이동하므로, **Phase A·C가 배포되면 3개 확장 스토어(Chrome·Edge·Whale) 재심사 없이도 확장 → 웹 브릿지 → Windows/macOS 네이티브 앱 전환이 즉시 동작**한다.
- 확장은 별도 기능 추가 없이 현행 동결 상태를 유지한다. 추후 v2 아이콘·설명 정비로 1회 스토어 재제출할 일이 생길 때만 팝업 내 *"데스크톱 앱으로 직접 열기"* 보조 옵션 추가 여부를 검토한다.

---

## 5. 트랙별 검증 체크리스트

### Apple (`feature/ios-native-v2`) 담당
- [ ] `ottline://quick?quick=1&title=...&q=...&platform=Netflix&type=video` 수신 시 `OttlineMacApp` / `OttlineApp` 빠른 기록 시트에 제목·플랫폼·타입이 프리필되는지 단위 테스트 및 수동 실행 확인.
- [ ] `https://ottline.app/ko?native_handoff=1` 호출 후 브라우저에서 `ottline://open?handoff=1&status=ok&...` 복귀 시 기존 웹 기록과 연결 코드가 병합·복원되고 `status=empty` 안내가 정상 동작하는지 확인.
- [ ] macOS 연결 기기 목록에서 `macOS App · macOS`로 표시되는지 확인.

### Web (`apps/web`) 담당
- [x] 확장 진입에서 QuickLog 제목 입력·저장, 앱 링크의 제목·플랫폼·타입 인코딩과 계정·기기·원본 URL 제외 확인.
- [x] Windows `Ctrl+Shift+O`를 한·영 전역 배너·저장 후 CTA·소개 카드에서 확인. `test:seo-runtime` 공개 19개·개인 14개 경로, `test:store-acquisition-runtime` 29개 시나리오 통과.
- [x] 로컬 프로덕션 빌드와 타입 검사, 스토어 정책 18건·분석 10건·SEO 단위 20건, 키보드 접근성과 저장 회귀 검사 통과.
- [ ] 실제 Windows 앱이 설치된 기기에서 프로토콜 활성화와 새 기록 창의 프리필 확인. 로컬 Chromium에서는 링크 활성화와 브라우저의 웹 기록 계속 사용을 확인했다.
- [ ] macOS 출시 후 Phase C 적용 시 iPadOS(`Macintosh` + `maxTouchPoints > 1`)가 `macos-appstore`로 오분류되지 않는지 `lib/store-acquisition.test.mjs` 단위 테스트로 고정.
