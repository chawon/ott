# ottline for Windows (Pure .NET 8 WPF Native)

기존 Microsoft Store PWA 배포(`https://apps.microsoft.com/detail/9nsvnzgdmgf5`, `v1.0.2.0`)를 **인플레이스(In-Place) 업그레이드**하기 위한 순수 Windows 네이티브 데스크톱 애플리케이션(`v2.0.0.0`)입니다.

---

## 1. 핵심 아키텍처 & 특징

- **기술 스택**: C# / .NET 8 WPF (`net8.0-windows10.0.19041.0`) + SQLite WAL (`Microsoft.Data.Sqlite`) + Windows App SDK Widgets (`Microsoft.WindowsAppSDK.Widgets`) + Win32 Desktop Integration (`user32.dll`)
- **웹뷰(WebView2/Edge PWA) 제로**: 100% 순수 Windows 네이티브 UI 및 로컬 SQLite(`%LOCALAPPDATA%\ottline\ottline_v2.db`) 기반 Local-First 아키텍처
- **MS Store 인플레이스 업그레이드 Identity 호환**:
  - `Identity Name`: `ChawonLee.ottline`
  - `Publisher`: `CN=A486532B-583B-4088-AFDE-FC4377E51968`
  - `DisplayName`: `ottline`
  - `PublisherDisplayName`: `Chawon Lee`
  - `Version`: `2.0.0.0` (`x64` + `arm64` 2벌 `.msix` 및 통합 `.msixbundle`, `MinVersion 10.0.19041.0`)
- **기존 PWA → 네이티브 자동 세션 이어받기 & 동기화**:
  - 커스텀 URI 프로토콜 `ottline://` (`ottline://open?handoff=1&token=...&code=...`)
  - 8자리 연결 코드(`RecoveryCode`) 병합 및 `/api/auth/profile` 양방향 동기화
- **Windows 데스크톱 전용 UX**:
  - **에디토리얼 인트로 스플래시**: 선이 그려지는 책·플레이 애니메이션 & 프로필 문구 연동
  - **Windows 11 공식 위젯 (`Win + W`, `com.microsoft.windows.widgets`)**: 소형(`small`) · 중형(`medium`) · 대형(`large`) 지원, 이어보는 작품·월간 카운트·오프라인 포스터 캐시 표시 및 `+ 빠른 기록`/`영상`/`책`/`타임라인` 딥링크 실행
  - **커스텀 WPF 시스템 트레이 플라이아웃 (`TrayPopupWindow`)**: 좌·우클릭 시 따뜻한 에디토리얼 톤의 빠른 기록 / 현재 시청 상태 / 동기화 / 종료 팝업 표시
  - **데스크톱 OTT 시청 감지 & 알림 (`WatchReminderEngine`)**: 백그라운드에서 활성 창(`GetForegroundWindow`)을 점검해 Netflix, TVING, Wavve, Watcha, Coupang Play, Disney+, Prime Video, Apple TV를 **5분 이상** 시청 후 종료하면 즉시 기록 알림 발송 (개인정보 보호: 작품명·화면은 수집/전송하지 않고 플랫폼명만 판별)
  - **고해상도 공유 카드 PNG 내보내기 (`1080×1920` / `1080×1350`)**: 영화·시리즈 및 Kakao/Naver 도서 표지 자동 캐싱·고품질 렌더링
  - **전역 및 앱 내 단축키**: 앱 내 `Ctrl+K` / `Ctrl+N`, Windows 전역 `Ctrl+Shift+O` (`RegisterHotKey`)

---

## 2. 로컬 멀티 아키텍처(`x64` + `arm64`) 빌드 및 검증

Windows 11 ARM64(또는 x64) 환경에서 아래 명령으로 유닛 테스트, `MakePri`(`resources.pri`) 생성, 심볼(`.pdb`) 제거가 적용된 `win-x64`, `win-arm64` 2벌 `.msix` 및 통합 `.msixbundle`을 빌드·검증할 수 있습니다.

```powershell
# 1. 유닛 테스트 + MakePri + x64/arm64 MSIX 및 통합 MSIXBundle 빌드
./scripts/build-msix.ps1

# 2. 생성된 패키지 무결성·매니페스트·위젯 에셋·PDB 미포함 검증 및 SHA-256 체크섬 출력
./scripts/verify-msix.ps1

# 3. (선택) Windows 개발자 모드 환경에서 Win + W 위젯 로컬 테스트 등록
./scripts/register-widget-dev.ps1
```

- 개발용 서버 URL 변경 옵션(`WatchPrefServerLabel`)은 일반 배포 빌드에서는 숨겨져 있으며, `OTTLINE_DEV=1` 환경변수로 활성화할 수 있습니다.

### 산출물 위치 (`output/msix/`, `output/store-upload/`)
- `output/msix/ottline-2.0.0.0-x64.msix` (Intel/AMD 64비트 전용)
- `output/msix/ottline-2.0.0.0-arm64.msix` (Windows on ARM64 전용)
- `output/msix/ottline-2.0.0.0.msixbundle` (**Microsoft Partner Center 제출용 통합 번들**)
- `output/store-upload/ottline-2.0.0.0.msixbundle` (`msstore publish` 전용 단일 번들 격리 폴더)

---

## 3. Microsoft Store CLI (`msstore`) 및 GitHub Actions 자동 배포

로컬에 `msstore`가 인증되어 있거나 GitHub Actions에서 Partner Center 시크릿을 등록하면 **초안(Draft) 업로드**부터 **심사 제출(Commit)**까지 한 줄로 실행할 수 있습니다.

```powershell
# 1. 업로드 직전 리허설(네트워크 변경 없음)
./scripts/publish-msstore.ps1 -SkipBuild -ApplyDefaultNotes -Mode Draft -DryRun

# 2. Partner Center에 v2.0.0.0 초안(Draft) + 한·영 릴리즈 노트·심사 메모 업로드
./scripts/publish-msstore.ps1 -SkipBuild -ApplyDefaultNotes -Mode Draft

# 3. 즉시 인증 심사 제출까지 완료하려면 -Mode Commit 사용
# ./scripts/publish-msstore.ps1 -SkipBuild -ApplyDefaultNotes -Mode Commit
```

### 모노레포 GitHub Actions (`chawon/ott`, `apps/windows-native/`)
- **CI 검증**: `.github/workflows/native-windows-ci.yml` (`windows-latest`에서 단위 테스트 + x64/arm64 MSIX/MSIXBundle 빌드 및 검증)
- **수동 릴리즈 / Store 제출**: `.github/workflows/native-windows-release.yml` (`artifact_only` | `store_draft` | `store_commit`)
- Store 자동 업로드(`store_draft` / `store_commit`)에 필요한 Repository Secrets 4종:
  - `MSSTORE_TENANT_ID`, `MSSTORE_SELLER_ID`, `MSSTORE_CLIENT_ID`, `MSSTORE_CLIENT_SECRET`
