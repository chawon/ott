# ottline Android 출시 브랜딩 + Play Console 등록정보

## 목적

`ott.preview.pe.kr` 기준으로 출시했던 Android/TWA 흐름을 `ottline` 브랜드 기준으로 다시 정렬한다.

이 문서는 두 가지를 한 번에 고정한다.

1. Google Play에 등록할 때 써야 하는 고정 식별값
2. 스토어 리스팅, 그래픽, 정책 입력에서 지켜야 할 브랜드 규칙

## 1. 출시 고정값

| 항목 | 값 | 진실 원천 |
|---|---|---|
| 패키지명 | `app.ottline` | `apps/twa/twa-manifest.json`, `apps/twa/app/build.gradle` |
| 앱명 | `ottline` | `apps/twa/twa-manifest.json`, `apps/web/app/manifest.ts` |
| 보조 표기 | `On The Timeline` | `wiki/pages/processes/ottline-branding.md` |
| 대상 도메인 | `https://ottline.app` | `apps/twa/twa-manifest.json`, `apps/web/app/manifest.ts` |
| 시작 경로 | `/` | `apps/twa/app/build.gradle` |
| 기본 언어 | `ko-KR` | 이번 출시 운영 기준 |
| 앱 유형 | `App` | Play Console 입력값 |
| 과금 모델 | `Free` | Play Console 입력값 |
| 기본 카테고리 | `Lifestyle` | 현재 스토어 메타 기준 |
| 연락처 이메일 | `contact@ottline.app` | `apps/web/components/AppFooter.tsx` |
| 개인정보처리방침 | `https://ottline.app/privacy` | `apps/web/app/[locale]/privacy/page.tsx` |
| 자산 링크 검증 | `https://ottline.app/.well-known/assetlinks.json` | `apps/web/public/.well-known/assetlinks.json` |

## 2. 브랜드 규칙

### 이름

- Play Console의 기본 앱 이름은 항상 `ottline`으로 쓴다.
- `On The Timeline`은 보조 설명이나 내부 문서의 풀네임으로만 쓴다.
- `OTT`, `On the Timeline`, `ott.preview.pe.kr`는 앱 제목, 스크린샷, 피처 그래픽, 설명 문구의 주 표기로 다시 쓰지 않는다.

### 시각 규칙

- Primary: `#1E4D8C`
- Accent: `#38BDF8`
- Light Background: `#F0F6FF`
- Dark Background: `#0F1E3D`
- 한글 슬로건: `보고, 읽고, 남기다. 나만의 타임라인`
- 영문 슬로건: `Stream. Read. Remember.`
- 태그라인: `Your personal content timeline`

### 에셋 운영 규칙

- 스크린샷과 그래픽에는 `ottline.app` 또는 앱 내 실제 UI만 노출한다.
- `ott.preview.pe.kr` 주소, 구 브랜드 워터마크, 예전 파비콘, `On the Timeline` 단독 로고는 제외한다.
- 스크린샷의 헤더, 앱 아이콘, 스플래시, 런처 이름이 모두 `ottline`으로 맞아야 한다.

## 3. Play Console 앱 생성 시 입력값

- 기본 언어: `Korean (South Korea) / ko-KR`
- 앱 이름: `ottline`
- 앱/게임: `App`
- 무료/유료: `Free`
- 연락처 이메일: `contact@ottline.app`
- 선언:
  - Developer Program Policies 동의
  - US export laws 동의
  - Play App Signing 사용

## 4. 메인 스토어 리스팅 초안 (KO)

### 앱 이름

`ottline`

### 짧은 설명

`영화·시리즈·책 기록을 남기고 나만의 타임라인으로 모아보세요.`

### 상세 설명

```text
ottline은 영화, 시리즈, 책 기록을 빠르게 남기고 시간이 지나도 다시 꺼내볼 수 있는 개인 타임라인 앱입니다.

작품을 검색해 감상 상태, 평점, 메모, 날짜를 남기면 내 기록이 타임라인으로 쌓입니다. 로그인 없이 첫 기록을 바로 시작할 수 있고, 여러 기기에서 이어 쓰고 싶다면 페어링 코드로 연결할 수 있습니다.

주요 기능
- 영화·시리즈·책 검색 후 기록 작성
- 타임라인에서 감상/독서 이력 다시 보기
- 평점, 메모, 날짜, 장소, 함께한 상황 기록
- 페어링 코드 기반 기기 연결
- 질문·버그 제보·아이디어 전달용 문의함

이런 분께 추천해요
- 보고 읽은 콘텐츠를 한곳에 정리하고 싶은 분
- 간단한 입력으로 기록을 오래 남기고 싶은 분
- 영상과 독서 이력을 함께 관리하고 싶은 분
```

### 영어 로컬라이징 방향

- 기본 출시 언어는 `ko-KR`로 두되, 이후 `en-US` 로컬라이징은 `ottline` 표기를 그대로 유지한다.
- 영어 카피에서도 `On The Timeline`을 앱 이름으로 승격하지 않는다.
- 짧은 설명과 상세 설명에는 `#1`, `Best`, `New`, `Free`, `지금 설치` 같은 순위/홍보/CTA 표현을 넣지 않는다.

## 5. 그래픽 에셋 등록 기준

### 공식 최소 규격

- 앱 아이콘: `512x512`, `32-bit PNG`, alpha 가능, 최대 `1024 KB`
- 피처 그래픽: `1024x500`, `JPEG` 또는 `24-bit PNG`, alpha 없음
- 휴대폰 스크린샷: 최소 2장, `JPEG` 또는 `24-bit PNG`, 각 변 `320~3840px`, 긴 변은 짧은 변의 2배 이내

### 이번 출시 체크리스트

- [ ] 앱 아이콘 512 정식본 업로드
- [ ] 피처 그래픽 1024x500 제작
- [ ] 휴대폰 스크린샷 최소 4장 확보
- [ ] `ottline` 헤더/아이콘/도메인이 보이는지 확인
- [ ] 홈, 검색, 기록 작성, 타임라인, 설정 화면 포함
- [ ] 피처 그래픽은 앱 아이콘을 단순 반복하지 않고 핵심 가치와 실제 UI를 중심에 배치
- [ ] 다크 테마가 대표 강점이 아니라면 라이트 테마를 우선 노출

### 현재 준비된 파일

- `apps/web/public/play/icon-512.png`
- `apps/web/public/play/feature-graphic-1024x500.png`
- `apps/web/public/play/screenshot-home-720x1280.png`
- `apps/web/public/play/screenshot-public-720x1280.png`
- `apps/web/public/play/screenshot-account-720x1280.png`

### 스크린샷 권장 시나리오

1. 홈 화면: QuickLog + 최근 기록
2. 작품 검색 화면: 영화/시리즈/책 검색
3. 기록 작성 화면: 평점, 메모, 날짜 입력
4. 타임라인 화면: 저장 결과와 누적 기록
5. 설정 화면: 페어링 코드, 문의함, 로컬 초기화

## 6. App Content / 정책 선언 정리

### 연락처와 정책

- Contact email: `contact@ottline.app`
- Website: 필요 시 `https://ottline.app/faq` 또는 `https://ottline.app`
- Privacy policy: `https://ottline.app/privacy`

### Ads

- 현재 기준 광고 SDK와 광고 노출 흐름이 없으므로 `Ads: No`로 유지

### App access

- 핵심 기록 기능은 로그인 없이 진입 가능하므로 기본 리뷰는 별도 계정 없이 가능
- 리뷰어에게 따로 제공할 계정은 기본적으로 필요 없다
- 다만 추후 심사에서 동기화/기기 연결 기능 설명이 필요하면 아래 메모를 영어로 제공한다
  - `Core logging flow is accessible without login. Pairing code is only required for multi-device sync.`

### Target audience and content

- 어린이 전용 서비스가 아니므로 Families 대상 앱으로 등록하지 않는다
- 실제 연령대 선택은 운영자가 최종 판단하되, `under 13` 중심 앱으로 제출하지 않는다

### Content rating

- IARC 설문으로 최종 확정
- 사용자 생성 텍스트(메모, 공개 글감, 댓글)가 있으므로 설문 답변 시 이 점을 반영한다

### Data safety 검증 포인트

Play Console 답변은 아래 현재 문서/코드와 모순되면 안 된다.

- 개인정보처리방침에는 다음 항목이 명시돼 있다
  - 기록 데이터
  - 서비스 운영 정보
  - 기기 식별용 정보
- 실제 제품에는 다음 흐름이 있다
  - 로컬 기록 저장 및 서버 동기화
  - 익명/로그인 사용자 analytics 이벤트 수집
  - 문의함 메시지 저장
- 따라서 Data safety 작성 시 최소 아래 범주는 재검토해야 한다
  - User IDs / device identifiers
  - App activity / diagnostics
  - User-generated content

## 7. 출시 운영 메모

- Android AAB 생성은 로컬 WSL이 아니라 GitHub Actions를 기준으로 한다
- 수동 빌드: `.github/workflows/twa-build-aab.yml`
- Play 업로드: `.github/workflows/twa-release.yml`
- 버전은 `version_code` 증가가 필수이며, `version_name`은 사용자 노출 버전으로 관리한다
- `assetlinks.json` fingerprint와 Play App Signing 관련 fingerprint는 매 배포 전 다시 확인한다

## 8. 게시 전 최종 검수

- [ ] 앱 이름이 `ottline`으로만 노출되는지 확인
- [ ] 짧은 설명과 실제 앱 용어가 일치하는지 확인
- [ ] 스크린샷과 그래픽에서 구 도메인/구 브랜드가 사라졌는지 확인
- [ ] Privacy URL, contact email, support URL 연결 상태 확인
- [ ] Data safety, Ads, App access, Content rating 답변이 현재 서비스 동작과 맞는지 확인
