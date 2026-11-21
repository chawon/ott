# Windows Native (`apps/windows-native`)

> `2026-11-17` 제출 및 **`2026-11-18` 정식 출시(`v2.0.0.0`, `Published`)**로 기존 PWABuilder Edge PWA(`1.0.1.0`)를 대체해 Microsoft Store `9NSVNZGDMGF5`(`ChawonLee.ottline`)에 인플레이스 전환된 순수 Windows Native(`.NET 8 WPF + SQLite + Windows 11 공식 위젯`) 앱

## 관련 페이지

- [Microsoft Store](ms-store.md)
- [브라우저 확장](browser-extension.md)
- [macOS 네이티브 v2](macos-native.md)
- [ottline v2](../features/ottline-v2.md)

---

## 소스와 출시

- **Store Product ID / Identity**: `9NSVNZGDMGF5` / `ChawonLee.ottline` (`PackageFamilyName`: `ChawonLee.ottline_ry7416pek43sa`, `Publisher`: `CN=A486532B-583B-4088-AFDE-FC4377E51968`)
- **현재 게시 버전**: `2.0.0.0` (`ottline-2.0.0.0.msixbundle`, `x64` + `arm64`, `158.90 MB`, `Submission Id = 1152921505702424456`, **`Status = Published`**, `2026-11-18` Microsoft Store 카탈로그 및 `winget` 반영 완료)
- **심사 중인 업데이트 (`2026-11-20`)**: `2.0.1.0` (`main` `1fb24ee`, [PR #140](https://github.com/chawon/ott/pull/140), `ottline-2.0.1.0.msixbundle` `158.90 MB`, `Submission Id = 1152921505702457337`, **`Status = Certification`**, `Errors = 0`) — 서버 계정 삭제 `DELETE /api/auth/account` 경로 정정, 실패·네트워크 오류 시 로컬 기록·`outbox`·연결 상태 보존, 미연결 가드 및 한·영 안내 반영 (`Published` 전환 후 스토어 설치판 실기기 검증 예정). [삭제 정책](../features/delete-sync.md#windows-확인-사항)
- **스토어 등록 제목**: KO `ottline - 영화·드라마·책·독서 기록` / EN `ottline: Movie, TV & Book Log`
- **지원 장치 패밀리**: `Desktop` 전용 (`Holographic: false`)
- **실기기 검증 (`2026-11-18`)**: `winget install --id 9NSVNZGDMGF5 --source msstore`(`SignatureKind: Store`) 정식 설치 및 별도 PC `1.0.x` Edge PWA → `2.0.0.0` 업데이트 후 첫 실행 웹 브라우저 연결(`?native_handoff=1` → `ottline://open?handoff=1`) 자동 핸드오프 확인 완료
- **소스 경로**: [`apps/windows-native`](../../../apps/windows-native) (`OttlineWindows.sln`, `Ottline.App`, `Ottline.Core`, `Ottline.Tests`)
- **GitHub Actions**:
  - `.github/workflows/native-windows-ci.yml` (PR/main `x64` + `arm64` MSIX/MSIXBundle 빌드 및 계약 검증 — PR `#132` Run `44030185194` 통과, main SHA `7bc5a46`)
  - `.github/workflows/native-windows-release.yml` (`msstore-cli` 기반 `artifact_only` / `store_draft` / `store_commit` 배포)

---

## Web/API 연계 배포 (2026-11-18)

- PR #133·#135, 공통 API/Web SHA `2f262ec`로 Windows 웹 Store 배너·QuickLog 저장 CTA·소개 카드의 `cid` 계측과 네이티브 기기 표시를 운영에 반영했다.
- 기존 `X-Client-Platform: windows_native` 요청은 `Windows App · Windows`로 표시한다. 앱에서 연결 기기 목록을 조회하면 기존 ID·계정·등록 시각을 유지하며 갱신되므로 Windows 재빌드·재페어링은 필요 없다.
- `macos_native`도 `macOS App · macOS`로 처리하며 해당 헤더를 보내는 Mac 빌드가 필요하다. Store 바이너리·심사 상태는 이번 Web/API 배포에서 변경하지 않았다.
- [운영 배포·검증 기록](../../../docs/desktop-acquisition-rollout-2026-11-18.md)
- 2026-11-19 Web SHA `4472ad3`으로 [브라우저 확장](browser-extension.md)에서 들어온 빠른 기록을 Windows 앱으로 넘기는 연결을 배포했다. Chromium에서 앱 링크와 웹 저장 경로를 확인했다. 정식 설치 앱 실행 및 제목·플랫폼 미리 채움은 실기기 확인 항목이다. 출시된 Windows `2.0.0.0`은 이미 `ottline://quick`을 처리한다. [공통 프로토콜·핸드오프](../../../docs/desktop-protocol-and-extension-bridge-plan-2026-11-18.md)

## 핵심 아키텍처 및 UX v2 구성

1. **데스크톱 에디토리얼 UX v2 & 테마**
   - 따뜻한 종이 톤 라이트(`#F8F6F2`) / 다크(`#15120F`), 브랜드 네이비(`#1E4D8C`), 포인트 오렌지(`#FF9933`), `Pretendard`, 6종 스토리북 아바타 내장.
   - 홈·타임라인(5단 필터)·함께·내 공간·빠른 기록 모달(`WrapPanel` + `910px` 데스크톱 폭으로 KO/EN 버튼 잘림 방지)·Story/Feed 공유 카드 PNG(`CardImageExporter`)·리캡 리포트·복구 카드 PNG·KDC `000~900` 내 서가·CSV 내보내기/넷플릭스 기록 가져오기를 지원.
2. **로컬 우선 SQLite + Outbox 증분 동기화**
   - `OttlineDatabase`(WAL) + `OttlineRepository` + `OttlineApiClient`(36자 UUID `X-Device-Id`, `X-Client-Platform: windows_native`).
3. **Windows 11 공식 위젯 (`Win + W`), 트레이 플라이아웃, OTT 시청 알림**
   - `OttlineWidgetProvider`(`IWidgetProvider`, CLSID `7E642A91-3C4D-4F18-9B52-84E2C6D1039A`, `-RegisterProcessAsComServer`)로 소·중·대 위젯 Adaptive Card 제공.
   - `TrayPopupWindow` 시스템 트레이 플라이아웃, `WatchReminderEngine`(Netflix, TVING, Wavve, Coupang Play, Disney+, Apple TV 등 종료 감지 알림), `Ctrl+Shift+O` 전역 단축키 제공.

---

## 기존 Store Edge PWA(`1.0.x`) → 네이티브 자동 이어받기

1. **자동/원클릭 브라우저 핸드오프 (`DesktopIntegrationService.HasStorePwaUpgradeFootprint`)**
   - 첫 실행 시 로컬 기록이 없고 Edge Store PWA 흔적이 감지되면 `microsoft-edge:https://ottline.app/{ko|en}?native_handoff=1`을 자동 호출하며, 홈 배너·내 공간 버튼으로도 실행 가능.
2. **`<uap3:Protocol Parameters="%1">` & Named Pipe IPC**
   - 패키징 앱에서 `ottline://open?handoff=1&status=ok&user_id=...&device_id=...&pairing_code=...` 전체 URI를 수신하고 실행 중인 단일 인스턴스로 전달.
3. **세션 복원 및 임시 기록 병합 (`OttlineRepository.ImportBrowserHandoffAsync`)**
   - 업데이트 직후 로컬 임시 계정에 이미 기록을 작성한 경우 `CommitPairAsync`로 기존 PWA 계정의 연결 코드를 자동 병합해 기록 손실을 방지.

---

## 스토어 에셋 및 심사 제출 이력 (`2026-11-17`)

- **헤드리스 에셋 자동 생성**: `Ottline.App.exe --export-store-assets packaging/StoreListing` (`StoreListingAssetExporter.cs`)으로 아이콘(`300×300`), 정방형 로고(`1080×1080`), KO/EN 2:3 포스터(`720×1080`), KO/EN 데스크톱 스크린샷 각 4장(`1920×1080`) 총 **12종 PNG** 생성·검수 완료.
- **Partner Center 제출 (`1152921505702424456`)**: `publish-msstore.ps1`로 구버전 `1.0.1.0`/`1.0.0.0` 패키지 및 3월 스크린샷 제거, `Desktop` 전용 장치 패밀리(`Holographic: false`) 고정, KO/EN 부제 포함 제목·메타데이터·12종 이미지를 업로드해 `Certification` 진입 확인.
