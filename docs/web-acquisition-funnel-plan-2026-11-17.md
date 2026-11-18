# Web→스토어 전환 퍼널 정비 및 검색 유입 확장 계획 (2026-11-17)

> **목적**: Microsoft Partner Center 유입 지표 진단 결과와 `apps/web` 코드베이스의 실제 전환·검색 유입 누수 지점을 정리하고, **Web 담당자(`apps/web`)가 단독 PR로 바로 착수할 수 있는 작업 명세와 검증 기준**을 전달한다.

- **대상 영역**: `apps/web` (백엔드 API·DB·네이티브 바이너리 수정 없음)
- **기반 브랜치**: `main` (확인 기준 커밋 `34b42be`)
- **참고 디자인·SEO 기준**: [DESIGN.md](../DESIGN.md), [seo-v2-refresh-2026-11-11.md](./seo-v2-refresh-2026-11-11.md), [windows-native-v2-transition.md](./windows-native-v2-transition.md)

---

## 1. 현황 진단 (`2026-11-17` Microsoft Partner Center 기준)

Microsoft Partner Center 획득 리포트(최근 12개월, `2026-03-18` 출시 이후~`2026-11-17` 확인) 기준 Microsoft Store `ottline`(`9NSVNZGDMGF5`) 실측 수치는 다음과 같다.

| 지표 | 실측치 | 해석 |
|---|---|---|
| 스토어 페이지 조회수 | **`488`** | 3~8월 주당 `3~8회` → **9~11월 주당 `30~46회`(최근 3개월 300+회)**로 노출 급증 |
| 설치 (`성공률 100%`) | **`24`** (`시도 27`, `취소 1`, `실패 0`) | 설치 오류 문제는 없으나 노출 대비 유입 전환이 저조 |
| 스토어 전환율 | **`4.92%`** (`9~11월 2~4%대`) | 9~11월 스토어 탐색 노출 증가분을 구버전 PDP가 설치로 연결하지 못함 |
| Microsoft Store 첫 실행 | **`16`** (`66.7%`) | 설치자 3명 중 1명은 스토어에서 바로 실행하지 않음 |
| 국가별 설치 비중 | **인도 `9(37.5%)` · 미국 `5(20.83%)` · 덴마크 `2(8.33%)` · 한국 `2(8.33%)`** | 싱가포르·조지아·말레이시아 각 `1`. 한국 특화 기능에도 한국 설치 극소수 |
| 사용자 지정 캠페인 성과 | **`ottline.app` 유입 `0건`** | 외부 노이즈(`zb-invoice-gen-hero`, 0설치) 1건만 잡히고 자사 `?cid=` 추적 전무 |

### 선조치 완료 (네이티브/스토어 트랙)

- 9~11월 전환율 급락(`2~4%`)의 주원인이던 구 `v1.0.1.0`(PWABuilder Edge PWA, 키워드 `0개`, 부제 없음, 2:3 포스터 없음, 브라우저 스크린샷 1장) 목록은 `2026-11-17` 제출(`Submission 1152921505702424456`) 후 **`2026-11-18` Microsoft Store 정식 게시(`Status = Published`)**로 대체 완료했다.
- KO/EN 부제(`ottline - 영화·드라마·책·독서 기록`, `ottline: Movie, TV & Book Log`), 검색 키워드 7개, 2:3 포스터, 네이티브 캡션 스크린샷 4종, Windows 11 공식 위젯이 스토어와 `winget`에 라이브 반영되었고 타 PC `1.0.x → 2.0.0.0` 자동 핸드오프까지 확인되었으므로 이제 **`ottline.app` 웹 방문자와 검색 유입을 3대 스토어와 웹으로 연결하는 퍼널**을 고쳐야 한다.

---

## 2. `apps/web` 코드베이스에서 확인된 유입·전환 누수 지점

현재 웹 코드에는 Android Google Play 전환 장치만 구축되어 있고, Windows·iOS 웹 방문자 유도 및 검색 유입 입구가 비어 있다.

1. **Windows·iOS 웹 방문자에게 스토어 앱 대신 브라우저 PWA 설치만 안내**
   - [`apps/web/components/PwaInstallBanner.tsx`](../apps/web/components/PwaInstallBanner.tsx#L68-L116): Android(`isAndroidUserAgent`)만 `beforeinstallprompt`를 억제하고 Google Play(`android-play`) 배너를 띄운다.
   - iOS 방문자에게는 App Store(`id6780318110`) 대신 `"Safari > Add to Home Screen"`(`ios-pwa`)만 노출하고, Windows 데스크톱 방문자에게는 Microsoft Store(`9NSVNZGDMGF5`) 대신 브라우저 PWA(`browser-pwa`) 설치를 띄워 네이티브 앱 전환을 잠식한다.
2. **iOS Safari 공식 Smart App Banner 미적용**
   - [`apps/web/app/[locale]/layout.tsx`](../apps/web/app/[locale]/layout.tsx#L25-L72) 및 [`<head>`](../apps/web/app/[locale]/layout.tsx#L174-L222)에 `<meta name="apple-itunes-app" content="app-id=6780318110">`(`itunes` 메타데이터)가 빠져 있다.
3. **QuickLog 첫 저장 직후 전환 시점 누락 (Windows·iOS)**
   - [`apps/web/components/QuickLogCard.tsx`](../apps/web/components/QuickLogCard.tsx#L1498)는 기록 저장 직후 [`SavedAndroidPlayCta.tsx`](../apps/web/components/SavedAndroidPlayCta.tsx#L17-L96)만 렌더링한다. 웹에서 1건을 방금 기록해 가치를 체감한 Windows·iOS 방문자에게는 아무 스토어 안내도 뜨지 않는다.
   - 참고: [`layout.tsx`](../apps/web/app/[locale]/layout.tsx#L129-L152)에는 이미 `?native_handoff=1` → `ottline://open?handoff=1` 자동 세션·기록 핸드오프 스크립트가 들어 있어 Windows Native v2 및 Android Native와 바로 이어진다.
4. **`/about` Windows v2 카피 구버전 유지 & 캠페인 파라미터(`?cid=`, `?ct=`) 부재**
   - [`apps/web/messages/ko.json`](../apps/web/messages/ko.json#L572-L574) / [`en.json`](../apps/web/messages/en.json#L572-L574)의 `About.platformWindowsDesc`가 여전히 *"같은 웹 앱을 Microsoft Store 배포 형태로 열 수 있어..."*로 구버전 PWA를 설명한다.
   - [`apps/web/app/[locale]/about/page.tsx`](../apps/web/app/[locale]/about/page.tsx#L115-L140)와 [`apps/web/lib/seo.ts`](../apps/web/lib/seo.ts#L44-L114)의 Microsoft Store 링크에 `?cid=`가 없고, App Store 링크에 `?ct=...&mt=8`이 없으며, `localizedStoreUrls(locale)`에도 Microsoft Store가 빠져 있다.
5. **검색엔진 색인 입구 협소 (고정 URL `19개` + `/public/[id]` `noindex`)**
   - [`apps/web/app/sitemap.ts`](../apps/web/app/sitemap.ts#L9-L84)는 공개 경로 6개×2언어 + 가이드 3개×2언어 + `/chatgpt` 총 `19개` URL만 제공한다.
   - 사용자가 공개로 작성한 작품 이야기 상세([`apps/web/app/[locale]/public/[id]/layout.tsx`](../apps/web/app/[locale]/public/[id]/layout.tsx#L1-L12), [`page.tsx`](../apps/web/app/[locale]/public/[id]/page.tsx#L1))가 `privateRouteMetadata`(`noindex`)와 `"use client"`로 막혀 있어 `[작품명] 감상·후기·기록` 롱테일 검색 유입이 발생하지 않는다.

---

## 3. Web 담당자 구현 명세 (PR 분리 권장)

### Phase 1 — 웹→3대 스토어 전환 퍼널 & 캠페인 계측 (`apps/web` 단독, 최우선 Quick Win)

> 백엔드 변경이나 스토어 재심사 없이 웹 배포만으로 즉시 효과를 볼 수 있다. 기존 [`DESIGN.md`](../DESIGN.md)의 조용하고 방해하지 않는 톤(작성 흐름 비차단, 닫기 시 **14일 쿨다운**)을 모든 플랫폼 배너에 동일하게 적용한다.

#### 1-1. 스토어 URL 빌더 및 캠페인 추적 파라미터 규격화
- **대상 파일**: [`apps/web/lib/android-acquisition.mjs`](../apps/web/lib/android-acquisition.mjs) 확장 또는 `apps/web/lib/store-acquisition.mjs` 신설 + [`apps/web/lib/seo.ts`](../apps/web/lib/seo.ts)
- **보안·프라이버시 원칙 (필수)**: 기존 `buildGooglePlayStoreUrl` 주석(`L102-L107`)과 동일하게 외부 스토어 URL(`referrer`, `cid`, `ct`)에 **`pairingCode`나 `userId` 등 개인·계정 식별자를 절대 포함하지 않는다.**
- 플랫폼별 링크 규격:
  - **Google Play**: 기존 `buildGooglePlayStoreUrl` 유지 (`utm_source=ottline_web`, `utm_medium=owned`, `utm_campaign`, `utm_content`, `web_handoff=1`).
  - **Microsoft Store**:
    - 웹 랜딩·`/about`: `https://apps.microsoft.com/detail/9nsvnzgdmgf5?hl={ko-kr|en-us}&gl={KR|US}&cid={campaign}`
    - Windows 데스크톱 브라우저 배너/저장 직후 CTA에서는 웹 PDP 또는 Store 앱 직접 실행(`ms-windows-store://pdp/?productid=9NSVNZGDMGF5&cid={campaign}`) 중 사용자 이탈이 적은 방식으로 연결(웹 폴백 포함 확인).
    - 표준 `cid` 값: `web_global_banner`, `web_quicklog_saved`, `about_platform_card`.
  - **App Store**: `localizedStoreUrls(locale).appStore`에 `?ct={campaign}&mt=8` 부착 (`web_global_banner`, `web_quicklog_saved`, `about_platform_card`).
- `localizedStoreUrls(locale)`(`apps/web/lib/seo.ts#L44-L56`)에 `microsoftStore`를 추가(`ko` → `?hl=ko-kr&gl=KR`, `en` → `?hl=en-us&gl=US`)해 `/about`과 배너·CTA가 동일 출처를 참조하도록 통일한다.

#### 1-2. iOS Safari Smart App Banner 추가
- **대상 파일**: [`apps/web/app/[locale]/layout.tsx`](../apps/web/app/[locale]/layout.tsx#L25-L72)
- `generateMetadata` 반환 객체에 `itunes: { appId: "6780318110" }`를 추가(또는 `<meta name="apple-itunes-app" content="app-id=6780318110">`)한다.
- 확인: iOS Safari에서 상단 시스템 배너가 정상 출력되고, 기존 `appleWebApp` 설정과 충돌하지 않는지 확인한다.

#### 1-3. `PwaInstallBanner.tsx` 3대 스토어 우선 전환 배너로 개편
- **대상 파일**: [`apps/web/components/PwaInstallBanner.tsx`](../apps/web/components/PwaInstallBanner.tsx), [`apps/web/messages/ko.json`](../apps/web/messages/ko.json#L772-L781), [`apps/web/messages/en.json`](../apps/web/messages/en.json)
- 플랫폼 분기 규칙:
  1. **Android (`android-play`)**: 기존 동작 유지 (`twaSignal`이 있으면 미노출, 닫기/클릭 시 `PLAY_CTA_DISMISSED_AT_KEY` 14일 쿨다운).
  2. **Windows 데스크톱 (`windows-store`)**: `Windows NT` UA이면서 `standalone` 모드가 아닐 때 `beforeinstallprompt` 브라우저 PWA 안내를 띄우지 않고 **Microsoft Store 앱 설치 배너**를 노출한다. (핵심 소구: *"Windows 11 위젯, `Ctrl+Shift+O` 빠른 기록, 오프라인 보관함"*) 닫기/클릭 시 별도 `localStorage` 키로 14일 쿨다운 적용.
  3. **iOS (`ios-appstore`)**: 기존 `"Safari > 홈 화면에 추가"`(`ios-pwa`) 대신 **App Store에서 `ottline` 받기**로 전환하고, 닫기/클릭 시 14일 쿨다운을 적용한다.
  4. **기타 데스크톱(`macOS`, `Linux` 등, `browser-pwa`)**: 네이티브 스토어 앱이 없는 OS에서만 기존 `beforeinstallprompt` 기반 PWA 설치 배너를 유지한다.
- 인앱 WebView(`TossApp` 등 설치 전환이 부적절한 임베드 환경) 감지 시 배너를 과도하게 띄우지 않도록 예외 규칙을 unit test로 고정한다.

#### 1-4. QuickLog 저장 직후 네이티브 스토어 안내 확장
- **대상 파일**: [`apps/web/components/SavedAndroidPlayCta.tsx`](../apps/web/components/SavedAndroidPlayCta.tsx) 일반화(예: `SavedNativeStoreCta.tsx`) 및 [`apps/web/components/QuickLogCard.tsx`](../apps/web/components/QuickLogCard.tsx#L1498)
- Android에서 이미 검증된 저장 직후 CTA 패턴(`data-testid` 유지 또는 플랫폼별 확장)을 Windows·iOS 웹 사용자에게도 확장한다.
  - Android: Google Play(`campaign: "quicklog_saved"`, `webHandoff: true`) — 기존 동작 유지.
  - Windows 비-standalone 웹: Microsoft Store(`cid=web_quicklog_saved`), *"방금 남긴 기록, Windows 11 위젯과 데스크톱 앱에서도 페어링 코드로 그대로 이어집니다"* 안내.
  - iOS 비-standalone 웹: App Store(`ct=web_quicklog_saved`), *"방금 남긴 기록, iPhone·iPad 앱에서도 이어서 볼 수 있어요"* 안내.

#### 1-5. `/about` Windows v2 설명 갱신 & 애널리틱스 이벤트 추가
- **대상 파일**: [`apps/web/messages/ko.json`](../apps/web/messages/ko.json#L572-L574), [`apps/web/messages/en.json`](../apps/web/messages/en.json#L572-L574), [`apps/web/app/[locale]/about/page.tsx`](../apps/web/app/[locale]/about/page.tsx#L128-L140), [`apps/web/lib/seo.ts`](../apps/web/lib/seo.ts#L68-L114), [`apps/web/lib/analytics.ts`](../apps/web/lib/analytics.ts#L374-L382)
- `About.platformWindowsDesc`를 PWABuilder 웹 래퍼 설명에서 **Windows 11 네이티브 앱(SQLite 로컬 보관, 바탕화면 위젯, 전역 단축키 `Ctrl+Shift+O`, OTT 시청 기록 이어받기)** 설명으로 교체한다.
- `/about`의 Android·iOS·Windows 링크 모두 표준 캠페인 파라미터(`about_platform_card`)를 전달한다.
- `apps/web/lib/analytics.ts` 이벤트 타입에 아래 이벤트를 추가해 `/admin/analytics`에서 플랫폼별 클릭률을 비교할 수 있게 한다:
  - `windows_store_cta_impression` / `windows_store_cta_click` / `windows_store_cta_dismiss`
  - `ios_appstore_cta_impression` / `ios_appstore_cta_click` / `ios_appstore_cta_dismiss`

---

### Phase 2 — 검색 유입(SEO) 입구 확장 (`apps/web`, 별도 PR)

> 현재 검색엔진이 볼 수 있는 페이지가 19개뿐이므로, 비로그인 사용자가 **"영화·책·시청 기록 관리"** 의도로 검색했을 때 들어올 수 있는 공개 페이지를 넓힌다.

1. **공개 작품 이야기 상세(`/public/[id]`) SSR 전환 + 메타데이터·사이트맵 개방**
   - [`apps/web/app/[locale]/public/[id]/layout.tsx`](../apps/web/app/[locale]/public/[id]/layout.tsx)의 `privateRouteMetadata`(`noindex`)를 제거하고, Server Component 기반 동적 `generateMetadata`로 `[작품명] 감상 이야기 | ottline`·설명·OG·self-canonical·hreflang을 생성한다.
   - [`apps/web/app/sitemap.ts`](../apps/web/app/sitemap.ts)에 공개 discussion ID 목록(최근/인기 공개 글)을 안전하게 포함해 검색엔진이 작품명 롱테일 키워드로 색인할 수 있게 한다.
   - **경계 엄수**: 개인 화면(`/timeline`, `/title/[id]`, `/account`, `/me/*`, `/admin/*`)의 `noindex` 및 canonical/hreflang 제외 경계(`lib/seo-boundary.test.mjs`)는 절대 훼손하지 않는다.
2. **고의도 유입 랜딩·가이드 확장 검토 (`/guide` 또는 가져오기 도구)**
   - 실제 한국·영문 검색 수요가 큰 *"넷플릭스 시청 기록 내보내기/정리"*, *"왓챠피디아/독서 기록 백업 및 대안"* 주제의 가이드·웹 도구를 기획·추가한다.
   - 참고: 과거 넷플릭스 가져오기 작업 이력은 [`seo-v2-refresh-2026-11-11.md`](./seo-v2-refresh-2026-11-11.md#L5) 기준 stash(`8c2d5af14c9b49c29d55c2aec7c4f508dc538097`)에 보존되어 있다.

---

### Phase 3 — 공유 바이럴 루프 & Web 외 병행 트랙 (참고)

- **월간/기간 결산 공유 카드 (Web 추가 검토)**: 현재 [`ShareBottomSheet.tsx`](../apps/web/components/ShareBottomSheet.tsx)는 개별 기록 1건 이미지(`1080×1920`, `1080×1350`) 중심이다. 한 달 동안 본 영화·드라마·책 포스터 4~9편을 한 장에 모은 *월간 결산 포스터(워드마크 + `ottline.app` QR/링크 포함)*를 추가하면 SNS 자발 공유를 유도할 수 있다.
- **네이티브 인앱 리뷰 요청 (Web 담당 범위 외)**:
  - Android: [`apps/android-native/app/src/main/java/app/ottline/ui/InAppReviewHelper.kt`](../apps/android-native/app/src/main/java/app/ottline/ui/InAppReviewHelper.kt)로 **구현 완료** 상태.
  - Windows: `2.0.0.0` Microsoft Store 정식 출시(`2026-11-18`, `Published`)가 완료되었으므로 다음 마이너 업데이트(`2.0.1.0`)에서 `StoreContext.RequestRateAndReviewAppAsync()` 추가 예정.
  - iOS: `apps/native` 트랙에서 `SKStoreReviewController` / `StoreKit` 점검 후 별도 반영.
- **외부 배포·GEO 엔티티**: `v2.0.0.0` Microsoft Store 승인 시점에 맞춰 한국(GeekNews Show GN·디스콰이엇·독서/영화 커뮤니티) 및 글로벌(`r/windowsapps`, `r/Windows11`, AlternativeTo, Product Hunt, Wikidata/나무위키) 채널 동시 배포.

---

## 4. Web 담당자 검증 체크리스트

### PR #133: Windows 전환 구현

- **이번 PR 범위 정정**: 후속 사용자 확인에 따라 Windows 전환만 구현한다. 아래 원래 Phase 1 명세의 iOS Smart App Banner·App Store `ct` 및 Android `/about` 캠페인 변경은 이번 PR에 포함하지 않는다.
- 작업 브랜치: `feature/web-store-acquisition-phase1`, 기반 `origin/main` = `77d7c9c`.
- 변경 범위는 웹 UI·URL 빌더·이벤트 및 관련 검사다. API/DB/동기화 계약과 네이티브 바이너리는 변경하지 않는다.
- Microsoft Store는 `https://apps.microsoft.com/detail/...` 링크를 사용한다. Store 프로토콜 처리기가 없는 브라우저에서도 웹 상세 페이지를 열 수 있고, 같은 링크로 `cid`를 전달한다([Microsoft 공식 캠페인 링크 규격](https://learn.microsoft.com/en-us/windows/apps/publish/create-a-custom-app-promotion-campaign)).
- 공통 플랫폼 판별은 iPadOS의 데스크톱 UA, standalone, TWA, TossApp·WebView·iframe 예외를 처리한다. Windows 전역 배너가 14일 쿨다운 중일 때 PWA 배너로 바뀌지 않게 한다.
- Android 저장 후 CTA의 기존 노출 정책은 유지한다. Windows 저장 후 CTA는 전역 배너와 쿨다운을 공유하고 클릭 후 14일간 숨긴다. 기록 저장·완료를 막지 않는다. iOS는 기존 PWA 안내를 유지한다.
- 외부 링크는 고정 스토어 주소·공개 캠페인 이름만 사용한다. 계정·페어링·기기·기록 식별자는 전달하지 않는다.
- `/about`의 Windows 링크는 실제 화면 노출·클릭을 동일 이벤트로 계측한다. 기존 관리자 이벤트 집계에서 Windows 이벤트 수를 볼 수 있으며, 웹 클릭을 설치 완료로 간주하지 않는다.
- 검증 시나리오: Windows 배너·저장 CTA 및 standalone/임베드 제외, Android·iOS·macOS 기존 설치 동선, 14일 경계와 스토어 URL의 개인정보 배제, 한국어·영어 `/about`, 공개 URL 19개·개인 경로 14개의 SEO 경계.

### 실행 결과 (2026-11-17)

| 검사 | 결과 |
|---|---|
| `npm run test:android-acquisition --workspace ott` | 17개 통과: Windows·Android·iOS·macOS/Linux, standalone/TWA/임베드, 14일 경계, 3개 `cid`, 개인정보 배제 |
| `npm run test:analytics --workspace ott` | 10개 통과 |
| `npm run test:seo --workspace ott` | 20개 통과 |
| `npm run typecheck --workspace ott` | 통과 |
| `BACKEND_URL=http://127.0.0.1:18081 npm run build --workspace ott -- --webpack` | Next.js 16.3.8 프로덕션 빌드·타입 검사 통과 |
| `WEB_RUNTIME_URL=http://127.0.0.1:3220 npm run test:seo-runtime --workspace ott` | 공개 URL 19개·개인 경로 14개·Article 6개·이미지 7개 통과. KO/EN Windows 링크·문구·수정일 확인 |
| `WEB_RUNTIME_URL=http://127.0.0.1:3220 npm run test:store-acquisition-runtime --workspace ott` | Chromium 21개 시나리오 통과. 3개 노출 위치의 링크·impression/click/dismiss, 재진입 쿨다운, 작성 중 배너 숨김, 실제 QuickLog 저장, 좁은 화면 확인 |
| `npm run lint --workspace ott` | **실패: 기존 오류 23개**. 동일 Biome 2.5.15로 `origin/main` 아카이브와 비교해 오류 종류·파일 목록이 같음을 확인. FAQ/privacy의 기존 `dangerouslySetInnerHTML`, import 정렬·포맷 오류이며 이번 PR의 새 오류는 없음 |
| 변경 파일의 `biome check` | 통과. 기존 QuickLog 경고 2개 유지 |
| `git diff --check` | 통과 |

- 브라우저 검사는 테스트 계정·API mock을 사용한다. 외부 링크의 목적지와 클릭 이벤트를 확인하며 실제 Store 설치·Windows OS 위젯 실행은 수행하지 않는다. 공개 사이트·운영 계정 데이터 쓰기는 없다.
- 스크린샷: `/tmp/ottline-windows-acquisition/`의 `windows-banner-{ko,en}.png`, `saved-windows-{ko,en}.png`, `about-{ko,en}.png`.
- 로컬 SWC가 샌드박스의 상위 폴더 권한 검사를 거부하여 타입·빌드·서버는 승인된 샌드박스 밖에서 `SWC_NATIVE_BINDING_CACHE=/tmp/ottline-acquisition-swc-cache`로 실행했다. 기존 SEO 검증 문서에 기록된 localhost rewrite 차이를 피하도록 `next start --port 3220`을 사용했다.
- CI `Verify Web`에도 스토어 전환 단위 테스트와 브라우저 검사를 연결했다.

### 운영 배포 (2026-11-18)

- PR #133과 네이티브 기기 표시 PR #135를 병합하고 공통 SHA `2f262ec1f854df70d7a48674b9ca612b590b2248`로 API → 실제 API 확인 → Web 순서로 배포했다.
- 운영 Web Pod 기준 전환 퍼널 21개 브라우저 시나리오와 SEO 공개 19개·개인 14개 경로 검사가 통과했다. 공개 버전 HTTP 200, ArgoCD `Synced Healthy`, API/Web `Ready 1/1`·restart 0, IndexNow 19개 접수를 확인했다.
- 배포 범위는 위 Windows 정정 사항을 따른다. iOS Smart App Banner·`ct`, Android 소개 카드 캠페인 변경은 별도다. 실행 번호·실제 기기 표시·데이터 보존 결과는 [운영 배포 기록](desktop-acquisition-rollout-2026-11-18.md)을 따른다.

### 후속 Phase 1 작업 시 실행할 검사

> **단축키 표기 정정 (`2026-11-18`)**: PR `#133`의 `Ctrl+Alt+O` 표기를 [데스크톱 브릿지 Phase A](desktop-protocol-and-extension-bridge-plan-2026-11-18.md)에서 Windows Native v2의 실제 전역 단축키인 **`Ctrl+Shift+O`**로 고쳤다. 한·영 전역 배너·저장 후 CTA·소개 카드와 런타임 검사를 함께 맞췄다.

Phase 1 PR 완료 후 아래 검사를 순서대로 통과해야 한다 (`apps/web/package.json` 기준).

1. **유입·스토어 전환 단위 테스트 확장 및 실행**
   - `npm run test:android-acquisition --workspace ott` (또는 확장한 스토어 전환 테스트 스크립트에서 Windows/iOS/Android/macOS UA, 14일 쿨다운, `?cid=`/`?ct=` 파라미터, `pairingCode`·`userId` 미포함 검증)
   - `npm run test:analytics --workspace ott`
2. **SEO·빌드·타입·린트 검증**
   - `npm run test:seo --workspace ott`
   - `npm run lint --workspace ott` (`biome check`)
   - `npm run typecheck --workspace ott`
   - `BACKEND_URL=http://127.0.0.1:18081 npm run build --workspace ott -- --webpack`
   - `WEB_RUNTIME_URL=http://127.0.0.1:3220 npm run test:seo-runtime --workspace ott` (`layout.tsx` iOS Smart App Banner 및 `/about` 변경 이후 19개 공개 URL·14개 개인 화면 계약 유지 확인)
3. **패치 위생 확인**
   - `git diff --check`
