# ottline v2 플랫폼별 출시 준비

기준일: 2026-11-08. 작업 브랜치 `feature/ottline-ux-v2-web`의 코드, 배포 워크플로우, 플랫폼 문서와 운영 상태의 읽기 전용 조회를 기준으로 정리한다. 코드의 PR/CI 반영과 운영 배포를 나누어 준비하며, 운영 배포·스토어 제출은 별도 단계로 진행한다.

## 1. 현재 준비 범위

- 웹·PWA v2와 API는 `2026-11-08` SHA `b9f88a6`로 운영에 반영했다. 기록·수정·동기화·기기 연결, 추천의 계정별 제외/하루 3회, 저장 뒤 기존 이야기 연결, 빈 기간의 리포트 공유 제한을 포함한다. 운영 검증은 [배포 기록](ottline-v2-production-rollout.md), 구현 근거는 [웹 통합 기록](ottline-ux-v2-web.md), [추천 정책](future-timeline-account-policy.md), [이야기 연결](saved-discussion-connection.md)에 있다.
- 초기 시안 커밋 `4f5b17c`에는 실제 웹·API 통합이 포함되지 않으므로 v2 출시 SHA로 사용하지 않았다. PR #125·#126과 CI를 거친 main의 `b9f88a6d5f329ffa1bfaea4dacc3b7be8bfb3022`를 공통 배포 SHA로 확정했다.
- `apps/native`, `apps/twa`, `apps/browser-extension`에는 이번 v2의 플랫폼별 소스·패키지 변경이 아직 없다. 웹용 새 CI·PWA 아이콘·가이드 이미지는 준비했지만 앱 바이너리와 스토어 자료의 갱신은 별도 작업이다.
- **Android 네이티브(`apps/android-native`) 전환 및 Google Play 프로덕션 출시 완료 (`2026-11-09`)**: 기존 `apps/twa`(`versionCode <= 23`)를 대체하는 순수 Android Native(`Kotlin + Jetpack Compose + Room + WorkManager`) 앱을 모노레포 `apps/android-native`에 통합하고 `2.0.0`(`versionCode=24`, SHA `45ccac3`, run `42550886641`) 및 기존 TWA 세션·기록 자동 복구를 포함한 `2.0.1`(`versionCode=25`, SHA `916be7a`, API run `42564733989`, Web run `42564731554`, Android run `42564729159`)을 Google Play `production` 트랙과 스토어 등록정보(v2 아이콘·피처 그래픽·스크린샷 5장)까지 반영 완료했다. 자세한 내용은 [Android Native v2 전환 기록](android-native-v2-transition.md)에 정리했다.
- 운영 API/Web 이미지와 APP_VERSION은 모두 `b9f88a6`이며 두 Pod Ready 1/1·restart 0, ArgoCD Synced/Healthy를 확인했다.
- 운영 `ott-openai-secrets`의 Ready/SecretSynced와 API 환경변수 연결을 확인했다. 실제 OpenAI 생성·제외·재생성·기기별 공유·하루 3회 제한도 운영에서 통과했다.
- 함께 페이지의 SEO 확장은 별도 후속 범위다. 이번 출시 준비에서 공개 상세의 검색 제외 설정을 변경하지 않는다. Google Books 개발 키 연결도 앞서 보류한 범위를 유지하며 운영 검색의 회귀 확인과 구분한다.

## 2. 플랫폼 비교

| 대상 | v2가 반영되는 방식 | 출시 전 준비물 | 현재 판단 |
| --- | --- | --- | --- |
| API / OCI | 서버 이미지·설정·Flyway 배포 | V32 적용 검증, DB 백업, OpenAI 환경변수, 기존 클라이언트 호환, 확정 SHA | 운영 반영·실제 기능 검증 완료 |
| 웹 / 설치형 PWA | 운영 웹 배포와 서비스워커 갱신 | 기존 설치 앱의 업데이트·기록 보존, 모바일 실기기 확인 | 운영 반영·브라우저 저장 검증 완료, 설치 앱 실기기 확인은 별도 |
| Android / Google Play | `apps/android-native` 순수 네이티브 앱으로 전환 출시 | v2 UI·기능 연결, 기존 TWA 세션·기록 2단계 자동 복원(`install_token` + 브라우저 핸드오프), 서명 AAB(`vc24`·`vc25`), v2 스토어 그래픽·문구 | **Google Play production `2.0.1 (25)` 배포 및 스토어 에셋 반영 완료 (`2026-11-09`)** |
| iOS / App Store | Expo React Native 앱을 별도로 개편해야 함 | 모바일 v2 UI·문구·아바타·기능 동등성, 아이콘/스플래시, 새 빌드, TestFlight, 스토어 자료 | 추가 구현 단계가 필요 |
| Windows / Microsoft Store | 웹 본문은 공통이며 manifest 정보는 패키지에 복사됨 | v2 manifest로 PWABuilder 재패키징, 기존 제품 식별자 유지, 새 아이콘·PC 스크린샷, 업데이트 제출 | 패키지 갱신 필요 |
| Chrome / Edge / Whale 확장 | 기록 창으로 여는 웹은 공통, 확장 팝업·아이콘은 별도 | 새 CI·팝업 정렬, manifest 버전 증가, ZIP, 브라우저별 실동작, 세 스토어 자료·제출 | 기존 연결 계약 검증, 패키지 작업 필요 |
| 토스 인앱 | 별도 브랜치의 정적 웹 빌드·SDK·`.ait` 번들 | v2 통합, 정적 빌드/절대 API 주소 대응, 기존 공유·저장 브리지 보존, 새 아이콘·썸네일, 번들 검토·출시 | 별도 통합 단계가 필요 |
| ChatGPT 연결 | 현재 운영 대상에서 제외 | 이번 v2 출시 대상에 포함하지 않음 | 현행 AGENTS.md의 미운영 상태를 기준으로 함 |

현재 배포된 Android TWA는 웹 배포의 영향을 받으므로 네이티브 전환 전까지 호환 검증에 포함한다. 준비 중인 네이티브 앱은 별도 구현·빌드·검증 대상이다. [Chrome TWA 설명](https://developer.chrome.com/docs/android/trusted-web-activity)

Windows는 HTML/CSS/JS 변경만으로는 보통 새 패키지가 필요 없지만, 이번처럼 manifest의 아이콘이 바뀌면 새 패키지를 제출해야 한다. [Microsoft PWA 업데이트 안내](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/microsoft-store#make-updates-to-your-app)

## 3. 모든 채널보다 먼저 준비할 공통 항목

- [x] 최종 운영 소스·필요 자산·검사를 커밋하고 API/Web CI와 핵심 회귀를 통과했다. 로컬 검증 산출물과 시크릿 값은 포함하지 않았다.
- [x] 같은 확정 SHA로 API → 실제 기능 확인 → Web 운영 배포와 버전 확인을 완료했다.
- [ ] 기존 계정·설치 상태에서 업데이트 후 기록·기기 연결·언어 선택이 보존되는지 확인한다. 브라우저 새 세션 검사만으로 기존 PWA/TWA/Windows 설치 앱의 갱신을 완료로 판정하지 않는다.
- [ ] 한·영 출시 문구와 개인정보처리방침·지원 URL을 실제 구현과 맞춘다. 아이콘·스토어 스크린샷은 각 플랫폼에서 구현한 화면으로 준비한다.
- [ ] 공개 버전명, 채널별 빌드 번호, 공개 순서를 확정한다. 기존 앱 항목·도메인·앱 식별자·서명과 사용자 데이터 저장소를 유지하는 업데이트로 배포한다.

### OpenAI 전송 안내와 정책 정합성

`RecommendationPromptBuilder.formatLog`는 작품명·종류·장르·느낌 값·장소·상황·메모를 추천 요청에 포함한다. 배포 준비 변경에서 추천 버튼 앞에 전송 항목과 OpenAI를 안내하고, `/privacy#recommendations`에 최대 50개 기록과 제외 작품명, 처리 목적, 계정에 보관하는 추천 결과·이용 횟수·삭제 방법을 맞췄다. 사용자가 생성 버튼을 직접 눌렀을 때 실행하는 기존 흐름과 전송 범위를 유지한다. OpenAI에 요청하는 `store: false`를 보관 기간이 전혀 없다는 보장으로 표현하지 않는다.

iOS에 해당 기능을 제공할 경우 Apple의 제3자 AI 개인정보 공유 고지·명시적 허락 요건을 반영하고, 실제 데이터 처리에 맞춰 App Privacy를 점검한다. [Apple App Review 5.1.2](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing)

### API → Web 배포 순서

1. 운영 DB 백업과 복구 절차, V32 신규 테이블 4개의 마이그레이션 검증을 준비한다. 로컬에서 수동 적용한 이력이 운영 적용을 대신하지 않는다.
2. 기존 OpenAI 시크릿 동기화를 재확인하고 API Deployment의 `OPENAI_API_KEY`·모델 설정 연결을 검토한다. 키 값은 출력하거나 클라이언트에 넣지 않는다.
3. 코드 PR을 검토·머지하고 배포할 **동일한 전체 SHA**를 고정한다. 코드만 반영하는 PR에서는 `deploy/oke` 변경을 제외한다. 운영 설정은 별도로 검토해 반영하며, ArgoCD 자동 동기화로 이미지 수동 배포 전에도 적용될 수 있으므로 설정 머지 시점도 배포 절차에 포함한다.
4. `deploy-api-production.yml`에 확정 SHA를 입력해 API를 배포한다. Flyway V32, 실제 이미지·APP_VERSION·Pod Ready, 기존 클라이언트 계약과 추천·연결 API를 확인한다.
5. API 확인 후 `deploy-web-production.yml`에 같은 SHA를 입력한다. 웹 버전과 실제 기능·캐시 갱신을 확인한다.
6. 기존 설치 Android/Windows 앱도 같은 웹 본문을 사용하므로 해당 진입 경로의 저장·기기 연결·공유·뒤로가기를 배포 확인에 포함한다.
7. 되돌릴 API/Web 이미지 SHA를 기록한다. V32는 추가 스키마이므로 이미지 롤백과 스키마 삭제를 묶지 않고 기존 기록·추천 제외·사용 횟수를 보존한다.

운영 확인에는 KO Kakao·EN Google Books 실제 검색, 책 표지, 시즌/회차, 기록 생성·수정·동기화·기기 연결, 공유·기존 이야기 연결, 리포트의 빈/유효 기간, 추천 제외/되돌리기·재추천·하루 3회 제한을 포함한다. 기존 iOS와 토스 클라이언트의 API 호환도 확인한다. 워크플로우 성공만으로 기능 확인을 대신하지 않는다.

## 4. 채널별 추가 준비

### Android / Google Play (`2026-11-09` 완료)

- [x] `apps/android-native`(`Kotlin + Jetpack Compose + Room + WorkManager`)로 모노레포 통합 및 CI/CD(`.github/workflows/native-android-ci.yml`, `native-android-release.yml`) 구축 완료.
- [x] 모바일 v2 구성·문구·6종 아바타·CI v2 디자인과 풀화면 빠른 기록 모달(상태 선택 후 하단 `기록 남기기` 명시적 저장, `그날의 순간` 기본 펼침), 오프라인 우선 Outbox 동기화, KDC `내 서가`, `내 미래는?`(OpenAI 추천), `함께`, `내 이용 리포트` 전면 적용 완료.
- [x] 기존 Google Play `app.ottline` 패키지·서명·컴포넌트 연속성 유지 및 **기존 TWA(`versionCode <= 23`) → 네이티브(`versionCode >= 24`) 2단계 자동 세션·기록 복구**(`POST /api/android/notification-devices/restore-session` 서버 토큰 복원 + `TwaBrowserBridge` 외부 브라우저 `?native_handoff=1` → `ottline://open?handoff=1` 자동 핸드오프 및 임시 계정 자동 병합) 반영 완료.
- [x] 홈 위젯(`QuickLogWidgetProvider`), 앱 바로가기, UsageStats 기반 시청 기록 알림(`WatchReminderWorker`), 회고 알림(`RevisitReminderWorker`) 및 R8/DEX 시작 계약 검증(`scripts/verify-release-aab.sh`) 통과.
- [x] Google Play `production` 트랙에 `2.0.0`(`versionCode=24`, run `42550886641`) 및 `2.0.1`(`versionCode=25`, run `42564729159`) 배포 완료, Play Store `ko-KR`/`en-US` 출시 노트와 v2 신규 아이콘(`512x512`)·피처 그래픽(`1024x500`)·휴대폰 스크린샷 5장(`1080x1920`) 커밋 완료.

### iOS / App Store

- [ ] `apps/native`에 v2 모바일 구성, 문구, 아바타, 실제로 제공할 기능 범위를 적용한다. 웹 CSS·컴포넌트는 React Native에 자동 반영되지 않는다. 기록 완료의 이야기 연결·리포트 공유 조건도 별도로 맞춘다.
- [ ] 새 아이콘과 스플래시를 실제 네이티브 자산에 적용한다. 현재 설정은 기존 `splash-icon.png`를 참조하므로 시작 화면도 확인한다.
- [ ] 실제 App Store Connect의 최신 빌드 번호를 확인한다. 저장소의 `ios.buildNumber=23`, 문서에 기록된 출시 build 24, EAS `autoIncrement`를 함께 확인하고 중복 번호를 피한다.
- [ ] `native-ios-ci.yml` 및 `native-ios-testflight.yml` 경로로 검사·빌드하고 TestFlight에서 실제 iPhone 업데이트·검색·저장·수정·동기화·공유를 확인한다.
- [ ] 새 네이티브 화면을 촬영한 스크린샷, KO/EN 설명·변경사항, 심사용 기록 연결 방법과 샘플 데이터, 실제 기능에 맞는 App Privacy를 준비한다. 웹 화면을 미구현 네이티브 기능의 스크린샷으로 제출하지 않는다.

### Windows / Microsoft Store

- [ ] 운영 v2 manifest와 아이콘이 공개된 뒤 `ottline.app`을 대상으로 PWABuilder 패키지를 다시 만든다. 오래된 문서의 이전 도메인을 패키징 기준으로 쓰지 않는다.
- [ ] 기존 Product/Package/Publisher 식별자를 유지해 업데이트 제출을 준비한다. 설치 목록·작업표시줄 아이콘·앱 이름과 manifest 정합성을 확인한다.
- [ ] 실제 설치 앱에서 PC 레이아웃, 언어·테마, 파일 저장·공유, 업데이트 후 기록 유지, 오프라인 복귀를 확인한다.
- [ ] 새 PC 스크린샷·스토어 이미지·KO/EN 설명과 패키지를 Partner Center에 준비한다.

### Chrome / Edge / Whale 확장

- [x] 기존 확장 단위 검사 7개 통과. `capture_title/type/platform`을 보내는 기존 계약이 현재 웹에 남아 있음을 확인했다.
- [ ] 확장의 팝업·내장 아이콘과 스토어 이미지를 새 CI에 맞춘다.
- [ ] 각 스토어의 실제 게시 버전을 확인해 manifest 버전을 올리고 `browser-extension-package.yml`로 ZIP을 만든다. 이 워크플로우는 패키지 생성까지이며 스토어 게시는 별도다.
- [ ] 지원 OTT 페이지에서 작품 제목·플랫폼을 읽어 v2 기록창으로 이어지는 동작을 Chrome·Edge·Whale 실제 브라우저에서 확인한다.
- [ ] 세 스토어의 기존 확장 항목에 패키지·KO/EN 설명·스크린샷·변경사항을 제출한다.

### 토스 인앱

- [ ] 별도 운영 브랜치의 SDK·설정·빌드 방식을 유지하며 v2를 통합한다. 현재 참고 브랜치는 `chore/toss-inapp-current-release-20260517`이며 `granite.config.ts`, 정적 export, `NEXT_PUBLIC_API_BASE_URL` 등을 사용하는 별도 빌드다. 최신 실제 출시 번들과의 일치도 먼저 확인한다.
- [ ] v2의 서버 렌더링 페이지와 상대 `/api`·`/og/share-card` 호출을 토스 정적 배포 및 운영 API 주소에 맞춰 점검한다. 새 이야기 연결 조회도 이 대상이다.
- [ ] 기존 검수 대응의 저장 브리지·텍스트 공유 fallback·확대 제어·설치 유도 비노출을 보존한다. 토스에서 지원하지 않는 브라우저 파일 공유에만 의존하지 않는다.
- [ ] 새 콘솔 아이콘·썸네일과 번들 아이콘을 갱신한다. 새 `.ait`를 샌드박스/실기기에서 검증한 뒤 업로드·검토·승인·출시를 준비한다.

토스의 새 번들은 검토 요청 → 승인 → 출시 과정을 거치며, 기존 승인 버전으로 롤백할 수 있다. [토스 버전 관리 안내](https://developers-apps-in-toss.toss.im/guide/operation/deploy.md)

## 5. 권장 진행 순서

먼저 코드·문서를 검토하고 PR/CI를 거쳐 main에 반영한다. 운영 설정 변경과 실제 배포는 별도 단계로 진행한다. 공통 선행 항목과 기존 클라이언트 호환을 정리한 뒤 **API → Web/PWA → Windows 패키지·확장·토스 → Android 네이티브·iOS v2** 순서로 공개를 준비하되 네이티브 구현과 스토어 자료는 병행 준비할 수 있다. 모든 플랫폼을 같은 날 v2로 공개하려면 Android·iOS 네이티브 구현과 토스 통합·검수가 먼저 끝나야 한다.

새 CI 원본과 플랫폼별 내보내기 자산은 [CI 통합 기록](ottline-ci-v2-integration.md)을 기준으로 사용한다. 웹/PWA에 이미 적용한 아이콘과 각 플랫폼에 아직 내장하지 않은 자산을 구분해 출시 상태를 기록한다. 스토어 콘솔의 최신 버전·빌드·제출 상태는 실제 제출 직전에 다시 확인한다.
