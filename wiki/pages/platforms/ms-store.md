# Microsoft Store (Windows Native v2 전환 & 초기 PWA 이력)

> `2026-11-17` 제출 및 `2026-11-18` 정식 출시(`v2.0.0.0`)로 기존 PWABuilder Edge PWA를 대체해 [[windows-native]] 순수 Windows Native(`.NET 8 WPF + SQLite + Windows 11 위젯`)로 전환 완료한 Microsoft Store `ottline` 채널 정리

## 관련 페이지
- [[windows-native]]
- [[ottline-v2]]
- [[pwa]]
- [[twa]]

---

## 현재 상태 (`2026-11-18`)

- **제품 전환**: PWABuilder Edge PWA(`1.0.1.0`) → **[[windows-native]] v2.0.0.0 (`apps/windows-native`) 인플레이스 업그레이드 정식 출시 완료 (`Status = Published`)** — Microsoft Store PWA 패키징 배포 종료
- **브랜드 / 제목**:
  - KO: `ottline - 영화·드라마·책·독서 기록` (`ShortTitle`: `ottline`)
  - EN: `ottline: Movie, TV & Book Log` (`ShortTitle`: `ottline`)
- **식별자 유지**:
  - Store URL: https://apps.microsoft.com/detail/9nsvnzgdmgf5?hl=ko-KR&gl=KR
  - `winget`: `winget install 9NSVNZGDMGF5` (`winget show --id 9NSVNZGDMGF5 --source msstore` 조회 확인)
  - App ID (`ProductId`): `9NSVNZGDMGF5`
  - Package Identity / Family Name: `ChawonLee.ottline` / `ChawonLee.ottline_ry7416pek43sa`
- **최신 게시 (`2026-11-18`)**:
  - `Submission Id`: `1152921505702424456` (`Errors = 0`, `Status = Published`, DisplayCatalog 반영 `2026-11-18 14:53 KST`)
  - 패키지: `ottline-2.0.0.0.msixbundle` (`x64` + `arm64`, `158.90 MB`, DisplayCatalog `ChawonLee.ottline_2.0.0.0_neutral_~_ry7416pek43sa`) — 구 1.0.x 패키지 제거 및 `Desktop` 전용 장치 패밀리(`Holographic: false`) 적용
  - 스토어 이미지 12종: `apps/windows-native/packaging/StoreListing/` (`store-icon-300x300.png`, `store-logo-square-1080x1080.png`, `store-poster-{ko|en}-720x1080.png`, `screenshot-{ko|en}-1..4-*.png`) 모두 Store 카탈로그 게시 확인
  - 실기기 검증(`2026-11-18`): 로컬 개발 빌드 제거 후 `winget` 스토어 정식 설치(`SignatureKind: Store`) 실행 확인, 및 별도 PC에서 기존 `1.0.x` Store PWA → `2.0.0.0` 업데이트 후 첫 실행 시 웹 브라우저 연결(`?native_handoff=1` → `ottline://open?handoff=1`) 자동 핸드오프 확인 완료
  - 자동화 스크립트: `apps/windows-native/scripts/publish-msstore.ps1` (`msstore-cli`) 및 `.github/workflows/native-windows-release.yml`
- 상세 전환·마이그레이션 아키텍처는 [[windows-native]] 및 `docs/windows-native-v2-transition.md`를 따른다.
- Partner Center 획득 지표(`488` 조회 / `24` 설치 / `?cid=` 캠페인 유입 `0건`)의 2026-11-17 진단과 후속 계획은 [웹→스토어 전환 퍼널 정비 및 검색 유입 확장 계획](../../../docs/web-acquisition-funnel-plan-2026-11-17.md)을 따른다.
- `2026-11-18` PR #133·#135, API/Web SHA `2f262ec`로 Windows 웹 전역 배너·QuickLog 저장 CTA·한영 소개 카드와 `cid=web_global_banner|web_quicklog_saved|about_platform_card`를 배포했다. 웹 클릭 이벤트는 설치 완료와 구분한다. 전환 퍼널 21개 운영 브라우저 시나리오와 SEO 경계 검사가 통과했다. [운영 배포·검증 기록](../../../docs/desktop-acquisition-rollout-2026-11-18.md)을 따른다. (후속 메모: PR #133 웹 카피의 `Ctrl+Alt+O`는 실제 등록 단축키 `Ctrl+Shift+O`로 다음 웹 PR에서 정정 필요)

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
