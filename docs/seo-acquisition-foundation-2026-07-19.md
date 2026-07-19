# SEO·유입 기반 정리 (2026-07-19)

## 목표

- 검색엔진이 공개 콘텐츠만 안정적으로 발견하고 언어별 URL을 구분하도록 한다.
- 검색 유입 이후의 탐색·첫 기록 전환을 세션 기준으로 확인한다.
- 관리 화면은 제품 세션과 분리하고 Cloudflare Access로 보호한다.
- 웹/PWA의 기존 기록 흐름과 출시된 iOS 바이너리는 바꾸지 않는다.

## 공개 검색 표면

- 한국어: `/`, `/about`, `/faq`, `/privacy`, `/public`, `/guide`, `/guide/*`
- 영어: `/en`, `/en/about`, `/en/faq`, `/en/privacy`, `/en/public`, `/en/guide`, `/en/guide/*`
- 별도 공개 표면: `/chatgpt`
- 각 한국어·영어 페이지는 self-canonical과 상호 `hreflang`, `x-default`를 가진다.
- `/public` 목록은 서버에서 먼저 데이터를 읽어 HTML에 렌더링하며, 백엔드 장애 시에도 안정적인 안내 문구를 반환한다.
- 홈과 서비스 소개에만 실제 앱 정보를 사용하는 `SoftwareApplication` JSON-LD를 노출한다. 사이트 공통 레이아웃에는 `Organization` JSON-LD만 둔다.
- `sitemap.xml`은 공개 URL만 포함하고, 공개 기록의 `lastModified`는 서버에서 확인할 수 있을 때만 최신 기록 시각을 사용한다.
- `/account`, `/timeline`, `/me/report`, `/feedback`, `/offline`, `/migration-helper`, 제목 상세, 공개 기록 상세, `/admin`은 색인하지 않는다.

## 검색 유입용 가이드

- `/guide/ott-watch-log`: OTT 시청 기록
- `/guide/movie-series-log`: 영화·시리즈 기록
- `/guide/book-log`: 독서 기록
- 세 가이드는 한국어·영어 원문을 각각 제공하고, 기록하기 CTA는 `guide_cta_click`을 남긴 뒤 기존 QuickLog로 연결한다.
- 가이드는 추천·순위·FOMO 대신 기록과 회상의 사용 가치를 설명한다.

## 유입 집계 계약

클라이언트는 첫 진입 시 아래 문맥을 세션에 고정해 자체 analytics 이벤트에 붙인다.

- `landingPath`
- referrer 전체 URL이 아닌 `origin`
- `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`
- 허용 목록에 포함된 자체 재방문 진입만 `entrySource`로 저장

관리자 API는 `GET /internal/admin/analytics/acquisition?days=7|30|90|180`이다. 외부 `/api` ingress에는 노출하지 않으며, 웹 서버가 클러스터 내부에서 `X-Admin-Token`을 붙여 호출한다.

집계 우선순위는 UTM, 자체 재방문 진입, 외부 referrer, direct 순이다. `app_open`이 있는 웹·PWA·TWA 세션을 모수로 삼고 같은 세션의 탐색, 첫 기록, 기록 생성을 연결한다. 유입 시작 이벤트가 없는 전환 세션은 `orphanConversionSessions`로 따로 표시한다.

자체 `analytics_events`는 `created_at` 기준 180일이 지나면 매일 자동 삭제한다. GA4와 Clarity로 전송된 데이터는 각 제공자의 설정과 정책을 따른다.

## Cloudflare Access 운영 설정

배포 전에 Cloudflare Zero Trust에서 다음 설정을 완료해야 한다.

1. Cloudflare를 identity provider로 활성화한다.
2. Self-hosted application을 만들고 domain은 `ottline.app`, path는 `admin`으로 설정한다. `admin/*`만 설정하면 bare `/admin`이 빠질 수 있으므로 사용하지 않는다.
3. Allow policy의 Include selector는 `Cloudflare Account Member`로 두고 현재 운영 계정을 선택한다.
4. application 또는 policy session duration을 `8 hours`로 설정한다.
5. `Everyone`, 모든 유효 이메일, 영구 Bypass 정책을 추가하지 않는다.
6. application의 team domain과 AUD tag를 `deploy/oke/web-config.yaml`의 `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_ADMIN_AUD`에 반영한다.

웹 origin은 `Cf-Access-Jwt-Assertion`의 RS256 서명, issuer, audience, 시간 범위, `type=app`을 다시 검증한다. 설정이 비어 있으면 `/admin/**`만 `503`으로 fail-closed하고, 토큰이 없거나 유효하지 않으면 `403`을 반환한다. 브라우저에는 `X-Admin-Token`을 전달하지 않는다.

관리자 백엔드 컨트롤러는 `/internal/admin/**`에서만 동작한다. production ingress는 `/api`만 API 서비스로 보내므로 외부에서 이 경로로 API를 직접 호출할 수 없다.

## PWA·iOS 영향

- 서비스 워커는 `/admin`과 그 하위 요청을 가로채거나 캐시하지 않는다. 기존 PWA 캐시는 v3로 갱신하면서 이전 ottline 캐시만 정리한다.
- 일반 웹/PWA 기록, 오프라인, 설치 흐름에는 별도 동작 변경이 없다.
- iOS 네이티브 런타임에는 웹 Cloudflare Access나 서비스 워커가 적용되지 않는다.
- 개인정보처리방침 원문은 웹과 네이티브에 함께 갱신했지만, App Store 사용자에게 보이려면 다음 네이티브 바이너리 릴리스가 필요하다.

## 로컬 검증

```bash
npm run test:seo --workspace ott
npm run test:admin-access --workspace ott
npm run test:analytics --workspace ott
npm run test:client-recovery --workspace ott
BACKEND_URL=http://127.0.0.1:8080 npm run build --workspace ott
apps/api/gradlew -p apps/api test --no-daemon
```

로컬 dev server에는 Cloudflare가 JWT header를 넣지 않으므로 `/admin`은 의도대로 열리지 않는다. 코드에 개발용 인증 우회는 두지 않는다. 관리 화면은 집중 테스트로 계약을 확인하고, 실제 로그인·로그아웃은 Access application이 연결된 환경에서 확인한다.

수동 화면 확인 대상:

- `/guide`, `/en/guide`와 각 가이드 상세
- `/public`, `/en/public`의 최초 HTML 및 검색·정렬
- `/about`, `/faq`, footer의 가이드 진입 링크
- 페이지 소스의 canonical, hreflang, JSON-LD
- `/robots.txt`, `/sitemap.xml`, `/llms.txt`
- PWA 설치 상태에서 일반 탐색·기록·오프라인 복구가 기존과 같은지

## 운영 배포 완료

- PR: `#81`
- 기능 merge SHA: `8303f4f51ccc12c1eda4a41efe58c79afd28f378`
- main CI: Native iOS `29678410613`, API `29678410582`, Web `29678410578` 성공
- production: API `29678500818`, Web `29678607528` 성공
- manifest commit: API `9c3972b648cdbdcc05e596c31543cc1de248cc04`, Web `e8a9118fcc2610876dc56aa2e27db5815a390c97`
- ArgoCD: `ott-app` revision `e8a9118fcc2610876dc56aa2e27db5815a390c97`, `Synced Healthy`
- production image: `ott-web`, `ott-api` 모두 `8303f4f51ccc12c1eda4a41efe58c79afd28f378`
- production `APP_VERSION`: Web/API 모두 `8303f4f`
- API Flyway는 schema v28까지 적용됐고 앱이 정상 기동했다.
- origin `/admin`은 Access JWT 없이 `403`, 인증된 내부 acquisition API는 `200`과 새 응답 계약을 반환했다.
- 공개 `/.well-known/ottline-version`은 `8303f4f`, `robots.txt`는 `/admin` 차단과 sitemap 위치를 반환하며, sitemap은 공개 URL 19개를 제공한다.
- Web production의 필수 live version 검증과 best-effort IndexNow 전송이 모두 성공했다.
- Native iOS CI만 실행했으며 TestFlight/App Store 바이너리는 새로 빌드하거나 배포하지 않았다.

## 배포 후 검색 도구 확인

최초 배포 뒤 한 번 확인하는 항목이며, 콘텐츠 URL이 추가되지 않은 일반 배포마다 반복할 필요는 없다.

1. Google Search Console
   1. `https://ottline.app/sitemap.xml`을 다시 제출한다.
   2. URL 검사에서 `/`, 한국어 가이드 3개, 영어 가이드 3개의 색인 생성을 요청한다.
2. Bing Webmaster Tools
   1. sitemap 상태가 성공인지 확인한다.
   2. IndexNow 화면에서 이번 배포 알림 수신 상태를 확인한다. 이후 Web production 배포가 sitemap URL을 자동 전송한다.
3. 네이버 서치어드바이저
   1. 사이트 소유 확인 상태를 점검하고 `https://ottline.app/sitemap.xml`을 제출한다.
   2. robots.txt 검증에서 `/admin`만 차단되고 sitemap이 발견되는지 확인한다.
   3. `/`와 한국어 가이드 3개의 수집을 요청한다.
4. 7일 기준으로 색인된 페이지, 검색 노출, 클릭, 실제 유입 세션, 첫 기록 세션을 함께 기록한다.
5. 30일 기준으로 채널·landing path·campaign별 세션과 첫 기록을 비교한다.
6. 검색 노출·클릭은 Search Console을 source of truth로, 사이트 진입 이후 행동은 자체 acquisition 집계를 source of truth로 사용한다.

## 배포 전 차단 조건 확인 결과

- Cloudflare application path `/admin`, account-member policy, 8시간 세션을 설정했다.
- team domain과 AUD를 Web ConfigMap에 반영했다.
- `/admin`, `/admin/analytics`, `/admin/report`, `/admin/feedback`은 Access 인증 전 로그인 화면으로 이동한다.
- `/internal/admin/**`는 public `/api` ingress로 노출하지 않는다.
- sitemap에는 공개 URL만 포함한다.
- 웹/API CI와 PWA cache 회귀 테스트가 모두 성공했다.
