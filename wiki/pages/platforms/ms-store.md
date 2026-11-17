# Microsoft Store (Windows Native v2 전환 & 초기 PWA 이력)

> `2026-11-17`(`v2.0.0.0`)부터 기존 PWABuilder Edge PWA를 대체해 [[windows-native]] 순수 Windows Native(`.NET 8 WPF + SQLite + Windows 11 위젯`)로 전환 제출한 Microsoft Store `ottline` 채널 정리

## 관련 페이지
- [[windows-native]]
- [[ottline-v2]]
- [[pwa]]
- [[twa]]

---

## 현재 상태 (`2026-11-17`)

- **제품 전환**: PWABuilder Edge PWA(`1.0.1.0`) → **[[windows-native]] v2.0.0.0 (`apps/windows-native`) 인플레이스 업그레이드 심사 중 (`Status = Certification`)**
- **브랜드 / 제목**:
  - KO: `ottline - 영화·드라마·책·독서 기록` (`ShortTitle`: `ottline`)
  - EN: `ottline: Movie, TV & Book Log` (`ShortTitle`: `ottline`)
- **식별자 유지**:
  - Store URL: https://apps.microsoft.com/detail/9nsvnzgdmgf5?hl=ko-KR&gl=KR
  - App ID (`ProductId`): `9NSVNZGDMGF5`
  - Package Identity / Family Name: `ChawonLee.ottline` / `ChawonLee.ottline_ry7416pek43sa`
- **최신 제출 (`2026-11-17`)**:
  - `Submission Id`: `1152921505702424456` (`Errors = 0`, `Status = Certification`)
  - 패키지: `ottline-2.0.0.0.msixbundle` (`x64` + `arm64`, `158.90 MB`, `Uploaded`) — 구 1.0.x 패키지 제거 및 `Desktop` 전용 장치 패밀리(`Holographic: false`) 적용
  - 스토어 이미지 12종: `apps/windows-native/packaging/StoreListing/` (`store-icon-300x300.png`, `store-logo-square-1080x1080.png`, `store-poster-{ko|en}-720x1080.png`, `screenshot-{ko|en}-1..4-*.png`) 모두 `Uploaded`
  - 자동화 스크립트: `apps/windows-native/scripts/publish-msstore.ps1` (`msstore-cli`) 및 `.github/workflows/native-windows-release.yml`
- 상세 전환·마이그레이션 아키텍처는 [[windows-native]] 및 `docs/windows-native-v2-transition.md`를 따른다.

---

## 초기 PWABuilder PWA (`v1.0.x`) 참고 기록

> 아래 표와 문구·절차는 `2026-03` 초기 `On the Timeline` Edge PWA(`1.0.x`) 출시 당시의 역사적 기록이며, 현재 `v2.0.0.0` 이후 운영 기준은 위 **현재 상태** 및 [[windows-native]]에 따른다.

| 항목 | 상태 |
|---|---|
| Web App Manifest (`id`, `orientation`, `categories`) | 완료 |
| 앱 아이콘 (192, 512px) | 완료 |
| 스크린샷 자산 (`pwa/`, `store/`) | 기본 준비 |
| 오프라인 페이지/서비스워커 | 완료 |
| 설치 유도 UI | 완료 |
| 스토어 설명 초안 (ko/en) | 완료 |
| 앱 이름 예약 | 완료 |
| Age Ratings 설문 재작성 (User Content Sharing: Yes) | 완료 |
| 인증 심사 신청 | 완료 |

**Store 자산 위치:**
- `apps/web/public/store/store-poster-720x1080.png`
- `apps/web/public/store/store-poster-1440x2160.png`
- `apps/web/public/store/store-box-1080x1080.png`

---

## 심사 거부 이력

### 0.1.1.3 — Inaccurate Representation (스크린샷)
> "Screenshots must be direct captures of the Windows product"

모바일 스크린샷이나 일반 이미지 사용 불가. Windows 데스크탑에서 ottline.app을 실행한 화면을 직접 캡처해야 함 (Windows chrome 포함). 언어별 스크린샷 각각 필요.

### 11.11.1 — Age Ratings
> "Chat products, even those with AI, should answer yes to User Content Sharing"

공개 기록/감상 공유 등 UGC 기능이 있으므로 **"User Content Sharing" = Yes** 로 답해야 함 (재작성 완료).

---

## 스토어 등록정보 (한국어)

- **앱 이름:** On the Timeline
- **짧은 설명:** 로그인 없이 영상과 책 기록을 빠르게 남기고 내 타임라인으로 모아보세요.
- **카테고리:** Lifestyle (1순위), Entertainment (후보)
- **주요 기능:** 영화/시리즈/책 기록, 타임라인, 메모/날짜/상태 저장, 페어링 코드 기기 연결, 문의함

---

## 스토어 등록정보 (English)

- **App name:** On the Timeline
- **Short description:** Quickly log movies, series, and books without sign-up, then revisit them in your personal timeline.
- **Key features:** Fast logging, personal timeline, notes/dates/status, pairing codes, feedback inbox

---

## 제출 절차

1. Microsoft Partner Center 개발자 계정
2. 앱 이름 예약 → Package ID, Publisher ID 확보
3. PWABuilder에서 `ottline.app` 입력 → Windows 패키지 생성
4. `.msixbundle` 패키지 Store submission 업로드
5. 스토어 메타데이터 입력 후 제출

---

## 운영 메모

- manifest 내용 변경 시 재패키징/재제출 필요
- `runFullTrust` 선언은 PWABuilder/Edge 기반 데스크탑 PWA 패키징 모델 때문 (앱 자체 네이티브 권한 사용 아님)
- 현재 `On the Timeline` 브랜드 기준으로 진행 중 (ottline 통일 전)
