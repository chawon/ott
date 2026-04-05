# Microsoft Store (Windows PWA)

> PWABuilder 기반 Windows PWA 패키지 생성 및 Microsoft Store 배포 완료

## 관련 페이지
- [[pwa]]
- [[twa]]

---

## 현재 상태

**Microsoft Store 배포 완료.** 인증 심사 통과 후 게시됨.
- 브랜드: `On the Timeline` (Microsoft Store 기준)
- Store URL: https://apps.microsoft.com/detail/9nsvnzgdmgf5?hl=ko-KR&gl=KR
- App ID: `9nsvnzgdmgf5`

---

## 이미 준비된 것

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
