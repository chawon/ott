# v2 개편 후 sitemap·SEO 보완 (2026-11-11)

## 범위와 기준

- 기준은 원격 main `84f8d87`이다. Netflix 가져오기 PR #109는 닫고, 미커밋 소스와 신규 파일은 stash `8c2d5af14c9b49c29d55c2aec7c4f508dc538097`에 보존했다. 브랜치는 삭제하지 않는다.
- 코드 변경은 최신 main에서 분기한 `fix/sitemap-seo-v2-20261111`에서 검증한 뒤 PR로 main에 반영한다.
- 변경 범위는 Web의 sitemap, 공개 페이지 메타데이터와 가이드 구조화 데이터다. API·DB·네이티브·운영 설정은 변경하지 않는다.
- 점검 시 운영 Web은 `916be7a`였고 Pod 내부 `/sitemap.xml`은 200 및 공개 URL 19개를 반환했다. 외부 직접 요청은 Cloudflare 403으로 차단됐다.

## 확인한 문제와 결정

1. 홈·서비스 소개는 7월 25일, FAQ·가이드 목록은 7월 19일을 `lastmod`로 내보냈다. 홈·소개·FAQ에는 v2 반영일인 11월 8일을 사용하고, 가이드 목록은 자체 개편일과 언어별 가이드 수정일 가운데 최신 날짜를 사용한다. 날짜를 요청·빌드 시각으로 갱신하지 않는다.
2. 가이드 목록의 OG·Twitter 이미지는 4월 CI를 사용했다. 공통 OG 생성기로 현재 v2 이미지를 사용한다.
3. 공통 레이아웃이 Twitter 제목·설명·이미지를 지정해 자식 공개 페이지의 OG를 상속하지 못했다. 레이아웃에는 카드 형식만 지정하고, Next.js가 각 페이지의 OG에서 빠진 Twitter 필드를 채우도록 한다. 홈 OG 제목도 실제 페이지 제목과 맞춘다.
4. 가이드 상세에는 본문·수정일·이미지·상위 가이드 링크가 있지만 구조화 데이터가 없었다. 실제 문서에서 `Article`과 `BreadcrumbList`를 만들고, 가이드 수정일과 표시 날짜를 이번 구조화 데이터 추가일인 11월 11일로 맞춘다. 조회 수·평점·최초 게시일은 만들지 않는다.
5. 공개 URL 구성, self-canonical·상호 hreflang·x-default 및 개인 화면의 noindex 경계를 유지한다. 개인 기록을 검색용 공개 페이지로 확장하지 않는다.

## 검증 결과

- `npm run test:seo --workspace ott`: 기존 SEO 계약 20개 통과.
- `BACKEND_URL=http://127.0.0.1:18081 npm run build --workspace ott -- --webpack`: Next.js 16.3.8·React 19.3.0·TypeScript 7.0.2 환경에서 build와 타입 검사 통과. 원본 작업 폴더의 오래된 의존성과 활성 도구를 건드리지 않도록 `/tmp/ottline-seo-v2-qa-rde5splu`에 소스를 복사하고 기존 v2 의존성을 읽기 전용으로 연결했다.
- `WEB_RUNTIME_URL=http://127.0.0.1:3220 npm run test:seo-runtime --workspace ott`: 공개 URL 19개, 개인 화면 14개, 가이드 `Article`·`BreadcrumbList` 6세트, 실제 이미지 7개 통과. XML·HTML의 self-canonical·상호 hreflang·x-default, 페이지별 OG·Twitter 제목·설명·이미지, 가이드 본문 제목·날짜와 구조화 데이터의 일치, 개인 화면의 noindex 및 공개 canonical·언어 대체 링크 부재를 확인했다.
- runtime 검사를 기존 Web CI의 컨테이너 검증 단계에도 추가했다. API가 없는 환경에서도 공개 목록의 기존 fallback과 sitemap의 수정일 생략 동작을 유지한다.
- 수정 파일 9개의 Biome 검사와 `git diff --check` 통과.
- 임시 서버에 `--hostname 127.0.0.1`을 지정했을 때만 한국어 내부 rewrite가 자기 자신으로 redirect되는 차이가 있었다. 운영 Pod의 `/`, `/about`, `/en`, `/en/about`은 모두 200이었고, 임시 서버도 운영과 같은 `next start --port 3220`으로 실행하면 통과했다. 이번 작업에서 운영 routing 코드는 변경하지 않는다.

## 후속 SEO 점검

- Search Console·네이버 서치어드바이저·Bing Webmaster Tools의 색인 및 검색어 지표는 연결된 콘솔에서 별도 확인해야 한다. 자체 analytics의 유입·첫 기록 전환을 검색어·검색 순위로 해석하지 않는다.
- 실제 검색 로봇의 차단 여부는 Cloudflare 보안 이벤트와 콘솔 URL 검사에서 확인한다. 이 환경의 403만으로 Googlebot도 차단됐다고 판단하지 않는다.
- 배포 후 sitemap과 가이드 대표 URL을 콘솔에서 검사한다. 기존 Web 배포의 IndexNow 알림은 유지한다.
- FAQ 구조화 데이터는 실제 FAQ를 설명하지만, 일반 서비스의 Google FAQ 리치 결과 노출을 전제로 하지 않는다.

## 참고 기준

- [Google sitemap: 실제 의미 있는 수정일](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google Article 구조화 데이터](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google Breadcrumb 구조화 데이터](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)
- [Next.js 메타데이터 병합](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
