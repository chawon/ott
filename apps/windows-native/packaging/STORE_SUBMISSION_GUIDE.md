# Microsoft Partner Center Store 제출 가이드 (`ottline v2.0.0.0`)

기존 Microsoft Store PWA 앱(`9nsvnzgdmgf5`, `v1.0.x`)을 순수 Windows Native WPF 애플리케이션(`v2.0.0.0`)으로 인플레이스(In-Place) 업그레이드하기 위한 체크리스트와 제출용 문구입니다.

---

## 1. 업로드 패키지 및 Identity 확인

| 항목 | 값 |
| :--- | :--- |
| **제출 파일** | `output\msix\ottline-2.0.0.0.msixbundle` (`output\store-upload\` 동일) |
| **Partner Center Product ID** | `9NSVNZGDMGF5` |
| **포함 아키텍처** | `x64` + `arm64` (Windows 10 Build `19041.0` 이상 / Windows 11 지원) |
| **Package Name** | `ChawonLee.ottline` |
| **Publisher** | `CN=A486532B-583B-4088-AFDE-FC4377E51968` |
| **DisplayName / PublisherDisplayName** | `ottline` / `Chawon Lee` |
| **Version** | `2.0.0.0` |
| **선언 Capabilities** | `internetClient`, `rescap:runFullTrust` *(기존 Store 게시 앱 `v1.0.x`에도 동일 선언으로 이미 승인 이력 있음)* |
| **선언 Extensions** | `windows.protocol` (`ottline://`), `windows.comServer`, `com.microsoft.windows.widgets` (`Ottline_Timeline_Widget`) |

### `msstore-cli` / GitHub Actions 원클릭 업로드
로컬 `msstore-cli` 또는 모노레포 GitHub Actions(`.github/workflows/native-windows-release.yml`)로 직접 제출 초안을 만들 수 있습니다.
```powershell
# Partner Center 초안(Draft) 업로드 + 한·영 릴리즈 노트·심사 메모 반영
.\scripts\publish-msstore.ps1 -SkipBuild -ApplyDefaultNotes -Mode Draft

# 검토 없이 바로 인증 심사 제출까지 진행
.\scripts\publish-msstore.ps1 -SkipBuild -ApplyDefaultNotes -Mode Commit
```
> GitHub Actions에서 `store_draft`/`store_commit` 모드를 쓰려면 저장소 Secrets에 `MSSTORE_TENANT_ID`, `MSSTORE_SELLER_ID`, `MSSTORE_CLIENT_ID`, `MSSTORE_CLIENT_SECRET` 4개를 등록하세요.

> **참고**: Partner Center에서 `.msixbundle`을 업로드할 때 "기존 v1.0.x PWA에서 `.NET FullTrust Desktop Bridge`로 전환됨"에 따라 **`runFullTrust` 제한 기능 사용 사유(Restricted capability justification)** 입력이 필수인 경우 아래 섹션 2 문구를 복사해 입력하세요.

---

## 2. Restricted Capability (`runFullTrust`) 소명 문구

### English (Partner Center 권장 입력)
```text
ottline 2.0.0.0 transitions from an Edge PWA shell to a native .NET 8 WPF desktop application using an embedded SQLite local-first database, desktop integration features, and a Windows 11 Widgets Board COM provider. The runFullTrust capability is required for:
1. Background OTT platform foreground-window detection (read-only process name / window title classification without recording or transmitting any content titles or screen data) to trigger optional watch reminders.
2. Global quick-record shortcut registration (Ctrl+Shift+O via Win32 RegisterHotKey), system tray presence, and Single-Instance Named Pipe IPC.
3. Out-of-process COM server activation (-RegisterProcessAsComServer) implementing Microsoft.Windows.Widgets.Providers.IWidgetProvider for the official Windows 11 Widgets Board (Win + W).
4. Local file export/import dialogs (PNG Share Cards and CSV timeline export/import) via standard Windows file pickers.
```

### 한국어 (참고용)
```text
ottline 2.0.0.0은 기존 PWA 셸에서 로컬 SQLite 기반의 순수 .NET 8 WPF 네이티브 데스크톱 앱 및 Windows 11 위젯 공급자로 업그레이드되었습니다. runFullTrust 권한은 아래 용도로만 사용됩니다.
1. OTT 앱/브라우저 종료 후 빠른 기록 알림을 제공하기 위한 활성 창 플랫폼명 분류(작품 제목이나 화면 내용은 절대 수집·전송하지 않음)
2. 전역 단축키(Ctrl+Shift+O), 시스템 트레이 아이콘, Named Pipe 단일 인스턴스 통신
3. Windows 11 공식 위젯 보드(Win + W)용 Out-of-process COM 위젯 공급자(`IWidgetProvider`) 실행
4. 공유 카드 PNG 저장 및 타임라인 CSV 내보내기/가져오기 파일 대화상자
```

---

## 3. Notes for Certification (심사 위원 안내 메모)

Partner Center 제출 화면의 **Notes for certification** 입력란에 아래 내용을 붙여넣으세요.

```text
Testing & Certification Notes for ottline 2.0.0.0 (Native Desktop + Windows 11 Widget):

1. No Login Required (Local-First Instant Access):
   - Launch the app directly after installation. No sign-in or password is required to test any feature.
   - Click "+ 기록하기" (or "+ Quick Record" after switching language to EN in the header) to search movies, series, or books and save logs immediately to the local SQLite timeline.
   - Existing web/PWA or Android users can optionally pair via an 8-character connection code in "내 공간 (My Space)".

2. Windows 11 Official Widget (Win + W):
   - On Windows 11, press Win + W, click "+" in the top-right corner of the Widgets Board, and select "ottline" (small, medium, and large sizes are supported).
   - Clicking "+ Quick Record", "Video", "Book", "Timeline", or the featured item activates ottline via ottline:// protocol or Named Pipe IPC to the running window.

3. Optional Desktop Watch Reminder & Tray Behavior:
   - Clicking the window close button (X) minimizes the app to the system tray by default (configurable in My Space > Watch reminder settings).
   - Left-click or right-click the system tray icon to open the custom quick popup or completely exit the app.
   - Use "Test watch reminder" inside My Space > Watch reminder settings to preview the desktop reminder notification immediately without waiting 5 minutes.
```

---

## 4. What's New in This Release (업데이트 노트)

### 한국어 (KO-KR)
```text
ottline이 순수 Windows 네이티브 앱(v2.0.0.0)으로 새롭게 태어났어요.

• Windows 11 공식 위젯 (Win + W) 지원: 소형·중형·대형 3가지 크기로 이어보는 작품과 이번 달 기록을 확인하고, 위젯에서 바로 빠른 기록을 열 수 있어요.
• 더욱 가벼워진 순수 네이티브 속도: 웹뷰 없이 바로 열리고, 오프라인에서도 로컬에 먼저 안전하게 기록을 보관해요.
• 커스텀 시스템 트레이 플라이아웃: 트레이 아이콘 클릭 시 에디토리얼 톤의 전용 팝업에서 현재 시청 상태, 빠른 기록, 동기화를 한 번에 다룰 수 있어요.
• OTT 시청 종료 알림 & 전역 단축키(Ctrl+Shift+O): Netflix, TVING, Wavve 등 시청 후 바로 기억을 남길 수 있어요.
• 공유 카드 & 도서/영상 검색 강화: 영화·시리즈는 물론 국내 도서 표지까지 선명한 고해상도 공유 카드 PNG로 저장할 수 있어요.
• 기존 PWA/웹 사용자 원클릭 이어받기: 기존 스토어 앱(Edge) 업데이트 시 자동 핸드오프(`?native_handoff=1`)를 지원하며, 홈/내 공간의 버튼이나 8자리 연결 코드로도 기존 기록을 합칠 수 있어요.
```

### English (EN-US)
```text
ottline 2.0.0.0 arrives as a brand-new, pure Windows native desktop app.

• Official Windows 11 Widget (Win + W): Pin ottline in Small, Medium, or Large size to keep your current watch/read and monthly count right on your Widgets Board.
• Fast Local-First Native Experience: Launches cleanly with zero WebView overhead and stores your timeline offline first in SQLite.
• Custom System Tray Flyout: Left- or right-click the tray icon for quick logging, watch status, sync, and exit controls.
• Watch Reminders & Global Shortcut (Ctrl+Shift+O): Get a gentle nudge after watching OTT titles to save the memory before it fades.
• High-Resolution Share Cards: Export editorial Story and Feed PNG cards with crisp movie, series, and book covers.
• Seamless Migration: One-click Store PWA (Edge) / browser session handoff (`?native_handoff=1`) automatically brings over your existing timeline and profile, alongside 8-character connection code pairing.
```

---

## 5. 사전 검증 완료 항목 (Pre-Submission Checklist)
- [x] `dotnet test` 전체 단위 테스트 통과 (`14/14`)
- [x] `Release` 빌드에서 `.pdb` 디버그 심볼 완전 제외 및 `verify-msix.ps1` 검증 통과
- [x] `resources.pri` (`MakePri`) 생성 및 x64/arm64 Light/Dark 위젯 에셋 포함 확인
- [x] `AppxManifest` Identity (`ChawonLee.ottline`, `CN=A486532B-583B-4088-AFDE-FC4377E51968`, `v2.0.0.0`) 일치
- [x] 패키지 앱 실행, 위젯 COM 서버 등록, 개발용 서버 URL 숨김(`OTTLINE_DEV` 가드) 확인
