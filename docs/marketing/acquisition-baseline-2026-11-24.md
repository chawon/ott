# 채널별 유입·첫 기록·반복 이용 기준선 (2026-11-24)

- **기준일**: `2026-11-24` (`main` [`81b0a0c`](https://github.com/chawon/ott/commit/81b0a0c), Web·API 운영 [`c693fd8`](../web-api-rollout-2026-11-22.md))
- **담당 역할**: 마케팅 담당 (`플랫폼=공통`)
- **연결 카드·이슈**: [채널별 유입·첫 기록·반복 이용 기준선 정리](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313863452) · [Apple·네이티브 v2 출시 안내와 첫 유입 실험안](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313863479) · [Web 실행 #175](https://github.com/chawon/ott/issues/175) · [스토어 노출·오티티라인 ASO #187](https://github.com/chawon/ott/issues/187)
- **연관 문서**: [마케팅 운영](../marketing-operations.md) · [통계 집계 기준](../realistic-analytics-metrics.md) · [유입 기반](../seo-acquisition-foundation-2026-07-19.md) · [경쟁 리서치](../research/competitor-landscape-2026-11.md) · [공통 계측 정합성 #169](https://github.com/chawon/ott/issues/169)

> **공개 문서 경계**: 저장소 운영 규칙에 따라 비공개 운영 DB 집계([주간 사용 통계](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312007804))의 원천 수치·개인별 활동·식별자는 이 문서에 복제하지 않는다. 이 문서는 **측정 출처·기간 경계·분모/단위·확보 상태(`비공개 운영 집계 확인` vs `미측정`)·정성 진단과 측정 공백**을 정리한다. 과거 시점 참고 수치([2026-11-17 Microsoft Store 진단](../web-acquisition-funnel-plan-2026-11-17.md))를 현재 v2 실적으로 복사하지 않는다.

---

## 1. 목표 흐름과 집계 원칙

마케팅의 목표 흐름은 **서비스 발견 → 첫 기록 → 반복 이용**이다. 단계마다 서로 다른 출처와 단위를 쓰므로 임의로 합산하거나 전환율로 환산하지 않는다.

| 단계 | 기준 출처 (Source of Truth) | 기본 단위 / 분모 | 금지하는 해석 |
| --- | --- | --- | --- |
| **검색 발견** | Google Search Console · 네이버 서치어드바이저 · Bing Webmaster Tools | 노출(Impressions), 클릭(Clicks), CTR, 평균 순위, 색인 URL 수 | 자체 analytics의 방문·첫 기록을 검색 노출·순위로 해석 금지 |
| **AI 언급 vs 유입** | 외부 AI 답변 관찰(별도) vs 자체 `acquisition` (`channel=ai_referral`, `source=chatgpt`) | 언급·인용 관찰 건수 ≠ 유입 세션(`app_open`) ≠ 첫 기록 세션 | AI 언급·유입을 미운영 ChatGPT 앱 출시나 실적과 혼동 금지 |
| **스토어 발견·설치** | App Store Connect · Google Play Console · Microsoft Partner Center · 확장/토스 콘솔 | 스토어 노출/페이지 조회, 최초 다운로드/설치, 캠페인(`pt`/`ct`, `utm_*`, `cid`) 귀속 | 웹의 스토어 버튼 클릭(`*_cta_click`)을 스토어 설치 완료로 표기 금지 |
| **웹 진입·행동·첫 기록** | 자체 `/internal/admin/analytics/acquisition` · `overview` + 서버 보존 DB (`origin=LOG`) | 유입 세션(`web`·`pwa`·`twa`), 활성 클라이언트(`client_id`), 행동 `resolved actor`, 서버 보존 첫 직접 기록 계정 | `appOpenSessions`·`activeClients`·`qualifiedActors`·계정을 "실제 사람 수"로 통칭하거나 순차 전환율로 왜곡 금지 |
| **반복 이용** | 운영 DB 완료 주간 코호트 (`[월 00:00, 다음 월 00:00)` KST, `origin=LOG`, `deleted_at IS NULL`) | 완료 주별 신규 직접 기록 계정, 의미 있는 수정 계정, 다음 주 재기록 계정 | 미성숙 주(진행 중 주)나 분모 0 주를 유지율 0%로 표기 금지 |
| **다중 기기 연결·실사용** | `user_devices` 스냅샷 + 연결 이벤트(`device_pair`, `handoff`) + 향후 기기 귀속 계측([#169](https://github.com/chawon/ott/issues/169)) | 등록 기기 2대+ 계정(스냅샷) vs 기간 내 2대+ 기기 실기록/동기화 계정(현재 미측정) | 기기 등록 수만으로 물리적 기기 수나 지속 이용 판정 금지; `login_success(method=register)`를 페어링 성공으로 산입 금지 |

- **운영자·테스트 분리**: 운영자 계정과 운영자에 연결된 불확실한 익명 클라이언트 활동은 제외한다. 테스트 여부가 확정되지 않은 기기 그룹(예: Android 11 특정 기기 신호)은 임의 삭제하지 않고 기본 집계와 제외 참고치를 병기한다.
- **소표본 원칙**: 표본이 작을 때는 비율만 강조하지 않고 절대 건수·사용자 피드백·측정 한계를 함께 해석하며 인과관계를 과장하지 않는다.

---

## 2. 채널·단계별 기준선 현황 (`2026-11-24`)

### 2-1. 발견 채널 (검색 · AI · 스토어 · 외부 커뮤니티)

| 채널 | 대상 언어·플랫폼 | 현재 지원·공개 상태 (`2026-11-24`) | 기준선 확보 상태 | 출처 · 확인 필요 항목 / 측정 공백 |
| --- | --- | --- | --- | --- |
| **유기적 검색 (Google · 네이버 · Bing)** | KO·EN / Web (`ottline.app`) | 공개 19 URL(`sitemap.xml`), `hreflang`/`canonical`, `SoftwareApplication`·`Article`·`BreadcrumbList` 적용. 단, 영문 대표 스크린샷(`v2-en-desktop.png`) 스켈레톤 결함 확인 | **미측정** *(콘솔 회신 대기)* | GSC·네이버 서치어드바이저·Bing 최근 28~30일 노출·클릭·CTR·색인·상위 검색어/페이지 |
| **AI 검색·언급 (`ai_referral`)** | KO·EN / Web | `utm_source=chatgpt.com` 및 ChatGPT referrer → `ai_referral`/`chatgpt` 계측 배포 완료([PR #141](https://github.com/chawon/ott/pull/141)). 단, [`llms.txt`](../../apps/web/public/llms.txt)에 `macOS`·`iPad` 누락 | 언급: **부분 관찰** / 실제 유입·첫 기록: **미측정** | `2026-11-22` 웹 검색 기준 KO 추천 검색에서 Google Play 출처 노출 관찰, EN 비교 검색 미노출. 실제 `ai_referral` 세션·첫 기록은 `/admin/analytics/acquisition` 회신 대기 |
| **Apple App Store (iPhone·iPad)** | KO·EN / iOS·iPadOS `16.0+` | **`2.0.1` 공개** (`2026-11-24` 한국·미국 스토어 확인, 제출 빌드 `28`, [공개·CI 기록](https://github.com/chawon/ott/issues/163#issuecomment-7119018051); 최초 SwiftUI `2.0.0`은 `11/22` 출시). 공개 설치판 계정 삭제·Expo 업데이트 보존은 실기기 검증 진행 중 | **미측정** *(초기 수집 구간)* | App Store Connect App Analytics 노출·조회·최초 다운로드 + **캠페인 링크(`pt`)** 확인 대기 (Apple 담당 확인 전에도 기본 링크·웹 클릭 측정 가능) |
| **Mac App Store (macOS)** | KO·EN / macOS `14.0+` | **`2.0.1` 공개** (`2026-11-24` 한국·미국 스토어 확인, 데스크톱·알림 센터 위젯 3종 포함, [공개·CI 기록](https://github.com/chawon/ott/issues/163#issuecomment-7119018051); 최초 출시 `2.0.0`은 `11/22`). Safari·Chrome `?native_handoff=1` 이어받기 및 삭제 처리는 실기기 검증 중 | **미측정** *(초기 수집 구간)* | App Store Connect macOS 조회·최초 다운로드. 웹→Mac 안내·클릭 측정은 [#175](https://github.com/chawon/ott/issues/175)에서 구현 예정 |
| **Google Play (Android)** | KO·EN / Android 폰·태블릿 | **`2.0.5` 공개 확인** (`2026-11-24` [한국 Play](https://play.google.com/store/apps/details?id=app.ottline&hl=ko&gl=KR)·[미국 Play](https://play.google.com/store/apps/details?id=app.ottline&hl=en&gl=US)). 공개 설치판 실기기 확인 및 `#149` 웹 기록 가져오기 522 수정(PR `#154`)은 별도 추적 중 | **미측정** *(콘솔 회신 대기)* | Google Play Console 최근 30일 방문자·설치 및 UTM(`android_play_cta`, `quicklog_saved`, `about_page`) 유입 |
| **Microsoft Store (Windows)** | KO·EN / Windows 10/11 | **`2.0.1.0` 공개·계정 삭제 실기기 검증 완료** (`2026-11-23`), `2.0.2.0` 심사 중 | `2026-11-18` v2 개편 이후 **미측정** | Microsoft Partner Center `11/18` 이후 조회·설치·전환율 및 `?cid=`(`web_global_banner`, `web_quicklog_saved`, `about_platform_card`, `extension_handoff`) 귀속 *(과거 `2026-11-17` v1 기록과 구분)* |
| **브라우저 확장 (Chrome·Edge·Whale)** | KO·EN / 데스크톱 Chromium | Chrome `0.1.0` 공개(소스 `0.1.1`), Edge·Whale 최신 게시 버전 미확인 | **미측정** | 각 확장 스토어 조회·설치·활성 사용자 수 및 `capture_title` 웹 진입 건수 |
| **토스 인앱 (`내 OTT 타임라인`)** | KO / iOS·Android 토스 앱 | 별도 출시 브랜치 공개판 유지 (최신 라이브 번들·실사용 미확인) | **미측정** | 토스 콘솔 방문·기록·재기록 및 서버 저장 성공 건수([채널 전략](../changes/v2-channel-strategy.md#토스-인앱)) |
| **외부 커뮤니티·디렉토리** | KO·EN | GeekNews·디스콰이엇·Reddit·AlternativeTo·Product Hunt 등록/언급 미확인(`2026-11-22` 검색 점검) | **0건 (미집행)** | 출시 검증 완료 후 고정 UTM(`utm_source`, `utm_medium=community|directory`, `utm_campaign`)으로 계측 예정 |
| **ChatGPT 앱** | — | **미운영** (공개 안내 제외 유지) | **대상 제외** | 실제 재제출·운영 전환 전까지 마케팅 채널 기준선에서 제외 |

> 11월 28일 마케팅 점검에서 영문 `ottline`은 조사한 Apple·Google Play·Microsoft·Chrome 검색 결과의 첫 번째에 나왔다. 한국 스토어에서 `오티티라인`을 검색했을 때 같은 채널에서 우리 앱을 찾지 못했다. Mac의 띄어쓰기형 `오티티 라인` 조회는 403으로 끝났고, Edge·Whale의 한글 검색 순위는 미확인이다. Web·API 운영 버전은 `33942ae`, Windows 공개 버전은 `2.0.3.0`이다. [채널별 측정 범위와 문구 초안](store-search-visibility-and-ko-brand-aso-2026-11-28.md) · [실행 이슈 #187](https://github.com/chawon/ott/issues/187)

### 2-2. 사이트 진입 이후 · 첫 기록 · 반복 이용 · 다중 기기

| 관찰 영역 | 기준 구간 (KST) | 확보 상태 | 확인된 정성 진단 및 해석 한계 |
| --- | --- | --- | --- |
| **채널·출처·랜딩·캠페인별 웹 유입** (`/internal/admin/analytics/acquisition`) | 최근 완료된 7일 / 30일 | **미측정** *(운영/콘솔 회신 대기)* | `byChannel`·`bySource`(`chatgpt` 포함)·`byLandingPath`(`/`, `/about`, `/guide/*`)·`byLocale`·`byCampaign`·`orphanConversionSessions` 및 `guide_cta_click`, `android_play_cta_*`, `windows_store_cta_*` 확인 요청 등록 완료([313863452](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313863452)) |
| **플랫폼별 활동·행동 도달 및 첫 기록** (`overview` + 서버 보존 DB) | 완료 7일 `[11-15, 11-22)` · 30일 `[10-23, 11-22)` | **비공개 운영 집계 확보** ([주간 사용 통계](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312007804) `2026-11-22` 회신, 세부 수치 비공개) | ① **`web` 구간 전환 병목이 가장 큼**: 웹 실행 세션·활성 클라이언트 규모 대비 실제 행동 actor·기록 생성 비중이 매우 낮음. ② **계측 정합성 제한([#169](https://github.com/chawon/ott/issues/169))**: `first_log_create` resolved actor(특히 `ios_native`의 계정 미연결 이벤트)와 서버 보존 기준 첫 직접 기록 계정 간 괴리가 커, 정합성 확인 전까지 어느 한쪽을 실제 신규 사용자 수·전환율로 단정할 수 없음. ③ 이 구간은 `11/22` 공개된 Apple v2 성과를 포함하지 않음 |
| **완료 주간 반복 이용 코호트** | 완료 4주 `[10-19, 11-16)` 및 최신 비교 `[11-09, 11-16)` vs `[11-16, 11-23)` | **비공개 운영 집계 확보** ([주간 사용 통계](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=312007804) `2026-11-23` 월요일 정기 집계, 세부 수치 비공개) | ① **일회성 기록 후 이탈이 핵심 병목**: 완료 주간 비교에서 연속 2주 기록·수정 활동 계정이 극소수/부재하며, 누적 기준에서도 대다수 기록 계정이 단일 날짜 활동에 머무름. ② 표본이 작고 최신 주(`[11-16, 11-23)`)는 Apple v2 공개일 하루만 포함돼 출시 효과 판단 시기상조. ③ 다음 정기 집계는 `2026-11-30` KST(`[11-16, 11-23)` vs `[11-23, 11-30)`) |
| **다중 기기 연결 및 실사용** | `2026-11-21`~`23` 스냅샷 및 최근 30일 보관 연결 이벤트 | 등록 스냅샷: **확보(비공개)** / **기간 내 2대+ 실사용률·페어링 성공률: 미측정** | ① 현재 2대 이상 기기 등록 계정 비중이 매우 작으며, 최근 30일 보관 이벤트에서는 자동 이어받기(Android TWA·Windows PWA→네이티브)만 소수 확인되고 코드 페어링 성공 이벤트는 미확인. ② `watch_logs`/`history`에 작성 기기 ID가 없고 `analytics client_id`와 `user_devices`가 1:1 대응하지 않으며 시도·실패 분모도 공통 수집되지 않아 실사용률·성공률은 `미측정`([#169](https://github.com/chawon/ott/issues/169) 연계) |
| **사용자 문의 유형** | 최근 30일 (`[10-23, 11-22)`) | **비공개 운영 집계 확보** (개인정보·원문 제외) | 사용자 선택 카테고리(BUG·IDEA·QUESTION·OTHER) 기준이며 검증된 장애 원인이 아님. 소표본과 의심 기기 그룹 분리 주의 |

---

## 3. 코드·공개 표면 실사에서 확인된 측정·안내 공백 (`2026-11-24`)

외부 콘솔 수치가 도착하기 전에도 현재 운영 코드(`c693fd8`, `main` `81b0a0c`)에서 아래 5건의 안내·계측 공백이 확인됐다. 다만 **이 공백이 실제 스토어 다운로드 손실로 이어지는 규모는 현재 콘솔 자료가 없어 확정할 수 없으며, 첫 실험([#175](https://github.com/chawon/ott/issues/175))에서 검증할 가설로 둔다.**

1. **웹→Apple(iPhone·iPad·macOS) 스토어 안내 및 클릭 계측 부재**
   - [`apps/web/lib/store-acquisition.mjs`](../../apps/web/lib/store-acquisition.mjs)의 `StorePlatform`은 `"android-play" | "windows-store"`만 지원한다.
   - [`PwaInstallBanner.tsx`](../../apps/web/components/PwaInstallBanner.tsx)는 iPhone·iPad 방문자에게 여전히 `Safari > Add to Home Screen`(`ios-pwa`)을, macOS 방문자에게는 `browser-pwa`를 노출한다.
   - [`SavedNativeStoreCta.tsx`](../../apps/web/components/SavedNativeStoreCta.tsx)는 첫 기록 저장 직후 Android·Windows CTA만 노출하고 iPhone·iPad·macOS가 빠져 있다.
   - [`apps/web/app/[locale]/layout.tsx`](../../apps/web/app/%5Blocale%5D/layout.tsx)에 iOS Safari 공식 Smart App Banner(`itunes: { appId: "6780318110" }`)가 없다. *(Apple이 그리는 Smart App Banner는 사이트가 직접 세는 노출·클릭과 구분해 해석한다.)*
   - [`apps/web/app/[locale]/about/page.tsx`](../../apps/web/app/%5Blocale%5D/about/page.tsx)의 iPhone·iPad 및 macOS 스토어 링크에 App Store Connect 캠페인 파라미터(`pt`·`ct`·`mt=8`)와 자체 클릭 이벤트(`ios_appstore_cta_*`, `macos_appstore_cta_*`)가 없으며, Google Play `/about` 링크도 `StoreCampaignLink`를 거치지 않아 자체 클릭 이벤트가 기록되지 않는다.
2. **웹 계측의 iPadOS 분류 불일치**
   - [`apps/web/lib/analytics.ts`](../../apps/web/lib/analytics.ts)에서 iPadOS 데스크톱 Safari가 `deviceType="tablet"` vs `osFamily="macos"`로 불일치 기록된다([기능 기준표](../feature-matrix.md) 9번 항목). Apple 전환 실험 시 iPadOS(`Macintosh` + `maxTouchPoints > 1`)를 iPhone·iPad 대상으로 정확히 분리해야 한다.
3. **`llms.txt`의 macOS·iPad 누락**
   - [`apps/web/public/llms.txt`](../../apps/web/public/llms.txt) 6행의 지원 플랫폼 목록에 `macOS`와 `iPad`가 빠져 있어 AI 검색·요약 크롤러가 최신 지원 범위를 놓친다.
4. **공개 검색·PWA 대표 스크린샷 결함**
   - `SoftwareApplication` JSON-LD([`seo.ts`](../../apps/web/lib/seo.ts))와 [`manifest.webmanifest`](../../apps/web/app/manifest.webmanifest/route.ts)가 참조하는 [`/pwa/v2-en-desktop.png`](../../apps/web/public/pwa/v2-en-desktop.png)가 본문 대신 회색 스켈레톤 박스만 찍혀 있다.
   - 가이드 대표 이미지 [`v2-brand-ko-home.png`](../../apps/web/public/guides/v2-brand-ko-home.png)·[`v2-brand-en-home.png`](../../apps/web/public/guides/v2-brand-en-home.png) 하단 인기 작품 영역도 회색 스켈레톤 상태이며, [`v2-brand-en-recording.png`](../../apps/web/public/guides/v2-brand-en-recording.png)에는 영문 화면에 한국어 포스터가 혼입돼 있다.
5. **공통 계측 정합성 선행 과제 ([이슈 #169](https://github.com/chawon/ott/issues/169))**
   - 클라이언트별 `first_log_create` 귀속과 기기별 실사용 집계가 정리되기 전에는 마케팅 실험의 1차 판정 지표를 **배포일부터 집계하는 위치별 CTA 노출·클릭·닫기 + 배포 전후 웹 세션 첫 기록·기록 완료 + App Store Connect 공식 최초 다운로드**로 각각 분리해 보고한다.

---

## 4. 개선 기회와 다음 실험 추천 근거

기준선 진단과 [경쟁 리서치(#159)](../research/competitor-landscape-2026-11.md)를 교차하면, 지금 단계에서 **대규모 외부 홍보를 먼저 여는 것은 비효율적**이다.

1. **웹 방문 → 첫 기록 공백과 Apple 안내·계측 미비가 함께 존재한다**: 비공개 운영 집계에서 웹 실행 세션·활성 클라이언트 대비 실제 기록 비중이 낮고, Apple `2.0.0`·`2.0.1` 출시 이후에도 웹에 iPhone·iPad·Mac 스토어 안내와 클릭 계측이 비어 있다. 이 안내를 보강하면 스토어 이동이 늘고 웹 첫 기록을 방해하지 않을 것이라는 점은 **첫 실험([#175](https://github.com/chawon/ott/issues/175))으로 검증할 가설**이다.
2. **일회성 기록 후 이탈이 핵심 병목이다**: 반복 이용 개선은 제품 기획의 1순위 데이터 신뢰 복구(`#161`·`#162`·`#163`)와 2·3순위 회상/안심 연결(`#158`)이 병행돼야 하므로, 마케팅은 **이미 공개된 Web/PWA + Apple `2.0.1`의 이동 경로와 계측을 먼저 정비**하고 실기기·공개 자산 검증 완료 시점에 외부 유입을 여는 2단계 접근이 타당하다.
3. **채택된 순서** (상세 실행안: [Apple·네이티브 v2 출시 안내 및 첫 유입 실험안](apple-v2-launch-and-first-experiment-2026-11-24.md)):
   - **1단계 (채택 · Web 실행 [#175](https://github.com/chawon/ott/issues/175))**: 웹→Apple(iPhone·iPad·macOS) App Store 이동 경로·클릭 계측·`llms.txt`·깨진 공개 스크린샷 정비 (비용 0원, `#162` 우선 처리 후 진행).
   - **2단계 (조건부 후속 · 후보 B)**: 공개 설치판 실기기 검증(`#163` Apple 삭제 처리, `312000240` Expo 업데이트 보존, `313827720` Mac 이어받기)·공개 자산 검증·사용자 게시 승인 후, 고의도 외부 채널 1곳(국내 GeekNews Show GN 또는 글로벌 `r/macapps`) + 영구 디렉토리(AlternativeTo) 1건 집중 실험.

---

## 5. 미확보 기준선 회신 체크리스트 (본부·운영·소유자 확인용)

아래 자료가 확보되면 이 문서의 `미측정` 항목을 같은 정의로 갱신한다(세부 비공개 수치는 비공개 프로젝트 카드에 보관하고 이 문서에는 공개 가능한 해석·변화 방향만 반영).

- [ ] `/internal/admin/analytics/acquisition` 최근 완료 7일·30일 (`byChannel`, `bySource`, `byLandingPath`, `byLocale`, `byCampaign`, `orphanConversionSessions`) 및 `guide_cta_click`·`android_play_cta_*`·`windows_store_cta_*`
- [ ] Google Search Console · 네이버 서치어드바이저 · Bing Webmaster Tools 최근 28~30일 (노출·클릭·CTR·색인·상위 검색어/페이지)
- [ ] App Store Connect (`id6780318110`) iOS·iPadOS·macOS 초기 조회·최초 다운로드 및 **캠페인 `pt` (Provider Token)**
- [ ] Google Play Console (`app.ottline`) 최근 30일 스토어 방문자·설치·UTM 귀속
- [ ] Microsoft Partner Center (`9NSVNZGDMGF5`) `2026-11-18` v2 개편 이후 조회·설치·`?cid=` 귀속
- [ ] 확장(Chrome·Edge·Whale) 및 토스 인앱(`내 OTT 타임라인`) 최근 설치/방문 확인 가능 여부
