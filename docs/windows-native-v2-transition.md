# Windows Native v2 전환, Store PWA 자동 핸드오프 및 정식 출시 기록

기준일: `2026-11-18`
대상 경로: `apps/windows-native`, `.github/workflows/native-windows-ci.yml`, `.github/workflows/native-windows-release.yml`

---

## 1. 배경 및 전환 목표

기존 Microsoft Store `ottline`(`ProductId = 9NSVNZGDMGF5`, `https://apps.microsoft.com/detail/9nsvnzgdmgf5`)은 PWABuilder 기반 Edge 데스크톱 PWA(`v1.0.1.0`)로 운영되었으나, `ottline v2` 개편과 Windows 데스크톱 네이티브 기능(Windows 11 공식 위젯·시청 종료 알림·트레이 상주·오프라인 우선 저장)을 제공하기 위해 **순수 Windows Native(`.NET 8 WPF + SQLite + Windows App SDK 1.8 Widgets`)** 앱(`apps/windows-native`, `v2.0.0.0`)으로 전면 전환했다.

1. **기존 Microsoft Store ID 인플레이스 업그레이드**: `Identity Name="ChawonLee.ottline"`, `PackageFamilyName="ChawonLee.ottline_ry7416pek43sa"`, `Publisher="CN=A486532B-583B-4088-AFDE-FC4377E51968"`, 프로토콜 스킴 `ottline://` 및 `runFullTrust` 계약을 유지해 기존 Store 사용자가 별도 앱 설치 없이 `v2.0.0.0`으로 자동 업데이트되도록 구성했다.
2. **WebView 없는 경량 데스크톱 네이티브 및 로컬 우선 SQLite 저장**: `OttlineDatabase`(WAL 모드)와 `OttlineRepository` outbox·증분 동기화로 오프라인에서도 즉시 검색·기록·조회가 동작하며, 서버 요청에는 36자 UUID `X-Device-Id` 및 `X-Client-Platform: windows_native` 헤더를 전송한다.
3. **기존 Store Edge PWA(`1.0.x`) / 웹 사용자 무손실 자동 이어받기**: 기존 PWA에서 업데이트한 사용자가 첫 실행 시 별도의 수동 코드 입력 없이도 기존 타임라인 기록, 연결 코드(`pairingCode`), 프로필(`nickname`, `personaKey`)을 자동으로 복원·병합한다.

---

## 2. 주요 아키텍처 및 UX v2 반영 사항 (`apps/windows-native`)

### 2.1 데스크톱 기록장 UX v2
- **테마 및 브랜드 자산 (`OttlineThemeManager`, `DESIGN.md` 기준)**: 따뜻한 종이 톤 라이트(`#F8F6F2`) / 다크(`#15120F`), 브랜드 네이비(`#1E4D8C`), 포인트 오렌지(`#FF9933`), `Pretendard` 타이포그래피, 열린 책+재생 심볼(`brand_mark.png`, `ottline.ico`)과 6종 동화풍 스토리북 아바타(`Resources/Avatars/`)를 내장했다.
- **전체 화면 구성 (`MainWindow.xaml`, `MainViewModel.cs`)**:
  - **홈**: 월별 타임라인 선택기, `그날의 온기` 대표 추억 카드, `아직 못다 한 이야기`, `함께` 미리보기, 미연동 기존 사용자를 위한 안내 배너.
  - **타임라인**: 전체/영상/책 탭, 5단 데스크톱 필터(상태·플랫폼·장소·누구와·구분), 제목·메모 검색, `내 미래는?` 추천, CSV 내보내기.
  - **빠른 기록 모달**: 검색과 기록 입력(`상태` + 날짜·플랫폼·장소·상황·느낌·메모·스포일러·함께 나누기)을 분리하고, KO/EN 버튼 잘림이 없도록 반응형 `WrapPanel`과 `910px` 데스크톱 모달 폭을 적용했다.
  - **함께 & 내 공간**: 공개 대화방 탐색·반응·댓글, 프로필 편집, 연결 코드 복사·복구 카드 PNG 저장(`CardImageExporter`)·기기 병합, 내 이용 리포트(리캡 카드 PNG), 내 서가(KDC `000~900`), 내 문의함, 넷플릭스 시청 기록 CSV 가져오기, 로컬 캐시 초기화·서버 계정 전체 삭제.

### 2.2 Windows 11 공식 위젯 (`Win + W`), 트레이, 시청 알림
- **Windows 11 공식 위젯 (`OttlineWidgetProvider.cs`, `OttlineWidgetComServer`)**:
  - `AppxManifest.template.xml`에 `windows.comServer`(CLSID `7E642A91-3C4D-4F18-9B52-84E2C6D1039A`, `-RegisterProcessAsComServer`) 및 `com.microsoft.windows.widgets`(`OttlineTimelineWidget`) 확장을 등록했다.
  - 소형(`small`)·중형(`medium`)·대형(`large`) 3가지 크기의 Adaptive Card를 제공하며, 위젯에서 `+ 빠른 기록`, `영상`, `책`, `타임라인`, 이어보는 작품 클릭 시 `ottline://` 프로토콜 또는 단일 인스턴스 Named Pipe IPC로 즉시 앱 해당 화면을 연다.
- **커스텀 시스템 트레이 플라이아웃 (`TrayPopupWindow.xaml`) & 전역 단축키 (`Ctrl+Shift+O`)**:
  - 창 닫기(`X`) 시 시스템 트레이에 가볍게 대기하며(`MinimizeToTray`), 트레이 아이콘 클릭 시 전용 플라이아웃 팝업으로 현재 시청 상태 확인·빠른 기록·동기화를 처리한다.
- **OTT 시청 종료 알림 (`WatchReminderEngine.cs`, `DesktopIntegrationService.cs`)**:
  - Netflix, TVING, Wavve, Coupang Play, Disney+, Apple TV 등 데스크톱/웹 시청 앱 종료 후 잔잔한 알림으로 바로 감상 기록 화면을 열어준다.

---

## 3. 기존 Store Edge PWA(`1.0.x`) → 네이티브 자동 세션·기록 이어받기

기존 PWABuilder Edge PWA는 사용자 세션(`watchlog.userId`, `watchlog.deviceId`, `watchlog.pairingCode`, `watchlog.profile.v1`)과 미동기화 기록을 Microsoft Edge 프로필 내부 `https://ottline.app`의 `localStorage`/`IndexedDB`에 저장해 두었기 때문에, 네이티브 앱 전환 시 아래 흐름으로 자동 복원한다.

1. **PWA 업그레이드 흔적 감지 및 자동 핸드오프 (`DesktopIntegrationService.HasStorePwaUpgradeFootprint`)**:
   - 첫 실행(`HasAutoAttemptedUpgradeHandoff == false`) 시 로컬 기록이 비어 있고 기존 Edge PWA 설치/캐시 흔적이 감지되면 `MainWindow` 로드 직후 `microsoft-edge:https://ottline.app/{ko|en}?native_handoff=1`을 자동으로 실행한다.
   - 홈 상단 안내 배너와 `내 공간 > 기기 연결`의 원클릭 버튼으로도 언제든 다시 실행할 수 있다.
2. **패키징 프로토콜 CLI 인자 전달 (`<uap3:Protocol Parameters="&quot;%1&quot;">`)**:
   - `AppxManifest.template.xml`의 `<uap:Protocol Name="ottline">`는 `Windows.FullTrustApplication`으로 URI 전체를 전달하지 못하는 제약이 있어 `<uap3:Protocol Name="ottline" Parameters="&quot;%1&quot;">`로 전환했다.
   - 웹 `?native_handoff=1` 흐름이 브라우저의 미동기화 기록을 동기화한 뒤 `ottline://open?handoff=1&status=ok&user_id=...&device_id=...&pairing_code=...&nickname=...&persona_key=...`로 호출하면, `Program`/`App.xaml.cs`가 기존 실행 인스턴스에 Named Pipe IPC로 전체 쿼리 파라미터를 전달한다.
3. **세션 복원 및 임시 기록 안전 병합 (`OttlineRepository.ImportBrowserHandoffAsync`)**:
   - `DomainHelpers`의 핸드오프 파서가 `+` 공백 디코딩 및 `user_id`/`device_id` UUID 정규화를 수행한 뒤 세션을 복원한다.
   - 만약 사용자가 `v2.0.0.0` 업데이트 직후 임시 계정에 이미 새 기록을 남긴 상태에서 기존 세션이 복구되면, `CommitPairAsync`로 기존 PWA 계정의 연결 코드를 병합해 새 기록과 기존 기록을 손실 없이 하나로 합친다.

---

## 4. 스토어 에셋, CI/CD 및 Microsoft Partner Center 제출 이력 (`2026-11-17`)

### 4.1 헤드리스 스토어 아트워크·스크린샷 생성 및 GitHub Actions
- **에셋 자동 생성 (`StoreListingAssetExporter.cs`, `--export-store-assets`)**:
  - `Ottline.App.exe --export-store-assets packaging/StoreListing`으로 실 UI 기반 **PNG 12종**을 생성했다(`App.IsHeadlessAssetExport` 및 `AncestorType=ScrollViewer` 바인딩 적용, `DESIGN.md` 기준).
  - 생성 자산: `store-icon-300x300.png` (`300×300`), `store-logo-square-1080x1080.png` (`1080×1080`), `store-poster-ko-720x1080.png` / `store-poster-en-720x1080.png` (`720×1080`), `screenshot-{ko|en}-1-home.png` · `2-quicklog.png` · `3-timeline.png` · `4-widget.png` (각 `1920×1080`).
- **GitHub Actions CI/CD**:
  - **PR/main CI**: `.github/workflows/native-windows-ci.yml` (`build-msix.ps1`, `verify-msix.ps1`로 `x64` + `arm64` MSIX 및 `.msixbundle` 생성·검증; PR [#132](https://github.com/chawon/ott/pull/132) `verify-windows` Run [`44030185194`](https://github.com/chawon/ott/actions/runs/44030185194) 통과 `2m31s`, main SHA `7bc5a46`).
  - **수동 릴리스**: `.github/workflows/native-windows-release.yml` (`msstore-cli` 기반 `artifact_only` / `store_draft` / `store_commit` 지원).

### 4.2 Partner Center 제출, 게시 및 패키지 검증 수치 (`2026-11-17 ~ 2026-11-18`)
- **제출 및 정식 게시**: `ProductId = 9NSVNZGDMGF5`, `Submission Id = 1152921505702424456`, **`Status = Published`** (`2026-11-17` 제출 `Certification` → **`2026-11-18 14:53 KST` Store DisplayCatalog 정식 반영**, `Errors = 0`)
- **업로드 아티팩트 SHA-256**:
  - `ottline-2.0.0.0-x64.msix`: `81.42 MB`, `89EC12A49C8D38500173C507BE37D96A16AF0DD13D560C951DDA7E07ED409747`
  - `ottline-2.0.0.0-arm64.msix`: `77.48 MB`, `90EB11C3D74AC3341073BD4A355A67650E89308CD326DC38A0559E98CAC54841`
  - `ottline-2.0.0.0.msixbundle`: `158.90 MB`, `99D780F9906A6C544CB07903C91EDB5DCFAE548B5213D6FF35549BA87A467E53` (`FileStatus = Uploaded`, 기존 `1.0.1.0`/`1.0.0.0` 패키지 제거 완료)
- **장치 패밀리 및 스토어 목록**:
  - 이전 `1.0.1.0` PWA(`Windows.Universal`)에서 상속되던 `Holographic: true` 때문에 첫 커밋(`1152921505702424152`)이 `CommitFailed`(`Device families: Holographic`)로 거부된 점을 `publish-msstore.ps1`에서 **`Desktop: true`, 나머지(`Holographic`/`Mobile`/`Xbox`/`Team`) `false` 고정**으로 해결한 뒤 새 제출(`1152921505702424456`)로 `CommitStarted` → `PreProcessing` → `Certification` → **`Published`** 전환을 확인했다.
  - 한국어 제목 `ottline - 영화·드라마·책·독서 기록` / 영어 제목 `ottline: Movie, TV & Book Log`, KO/EN `ShortDescription`, `Description`, `Features`(7개), `Keywords`(7개), `ReleaseNotes`, `NotesForCertification`, 신규 아트워크·스크린샷 12종(`Uploaded`)을 반영했다.
- **빌드·패키징 검증 결과**: `Ottline.Tests` 단위 테스트 **14/14 통과**, `verify-msix.ps1` 통과, Windows 개발 환경 `Add-AppxPackage` 위젯 COM 스모크 테스트(`-RegisterProcessAsComServer --smoke-test`) **ExitCode 0** 확인.

### 4.3 Microsoft Store 정식 게시 및 실기기 핸드오프 확인 (`2026-11-18`)
- **스토어·카탈로그·`winget` 공개 검증 (`2026-11-18 15:37 KST`)**:
  - `msstore submission status 9NSVNZGDMGF5` 조회 결과 대기 중인 제출 없이 `Last Published Submission: Status = Published`를 확인했다.
  - Microsoft DisplayCatalog API(`market=KR/US`)에서 `Packages = x64+arm64:ChawonLee.ottline_2.0.0.0_neutral_~_ry7416pek43sa`, KO/EN 제목·짧은 설명·포스터(`Poster: 1`)·스크린샷 4종(`Screenshot: 4`), `apps.microsoft.com` 상세 페이지 `HTTP 200`, `winget show --id 9NSVNZGDMGF5 --source msstore` 정상 노출을 확인했다.
- **실기기 스토어 설치 및 타 PC `1.0.x → 2.0.0.0` 자동 핸드오프 검증**:
  - 개발 모드 패키지 제거 후 `winget install --id 9NSVNZGDMGF5 --source msstore`로 정식 서명 버전(`SignatureKind: Store`, `IsDevelopmentMode: False`, `C:\Program Files\WindowsApps\ChawonLee.ottline_2.0.0.0_arm64__ry7416pek43sa`) 설치·실행 및 기존 `%LOCALAPPDATA%\Ottline\ottline_v2.db` 연속 사용을 확인했다.
  - 별도 PC에서 기존 Microsoft Store `1.0.x`(Edge PWA)를 `2.0.0.0`으로 업데이트한 뒤 첫 실행 시 웹 브라우저 연결(`?native_handoff=1` → `ottline://open?handoff=1`)이 열리고 기존 기록·세션이 자동 핸드오프됨을 실기기에서 최종 확인했다.
  - 이로써 Microsoft Store에서의 PWABuilder PWA 패키징 배포는 종료되었으며, 웹(`ottline.app`)의 설치형 PWA만 macOS/Linux 등 비-스토어 데스크톱·기존 홈 화면 사용자를 위해 유지한다.
