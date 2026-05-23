# 홈 함께 기록 인기 작품 보충

> 실제 함께 기록이 부족할 때 홈이 비어 보이지 않도록 TMDB 기반 인기 작품으로 부족분만 채우는 fallback

## 관련 페이지
- [[timeline]]
- [[i18n]]
- [[public-reactions]]

---

## 구현 상태

- 2026-05-23 기준 PR #37로 production 반영 완료.
- 배포 SHA: `9a3fcdf28ef142f2021c143da3a00598762a6053`
- production workflow:
  - `Deploy Web to Production` run `26331154875`
  - `Deploy API to Production` run `26331157652`
- production 이미지:
  - `ott-web:9a3fcdf28ef142f2021c143da3a00598762a6053`
  - `ott-api:9a3fcdf28ef142f2021c143da3a00598762a6053`

## 제품 원칙

- 실제 사용자 활동처럼 꾸미지 않는다.
- 실제 공개 기록을 항상 우선한다.
- 실제 기록과 fallback 작품을 `인기 작품` / `Popular pick` 배지로 구분한다.
- 추천 기능으로 확장하지 않는다. 홈 섹션의 빈 상태 보충만 담당한다.

## 동작

- 홈은 `/api/discussions/latest?limit=6&days=14`로 실제 함께 기록을 먼저 가져온다.
- 실제 함께 기록이 6개 미만이면 부족한 개수만 `/api/titles/popular` 결과로 채운다.
- 실제 기록과 같은 `provider/providerId` 또는 제목/type/year 조합은 제외한다.
- fallback 카드 클릭 시 QuickLog 영상 검색창에 제목을 프리필한다.

## API

- `GET /api/titles/popular?limit=`
  - 백엔드에서만 TMDB를 호출한다.
  - 언어/지역/일자별 1일 캐시를 사용한다.
  - `limit`은 서버에서 1~20으로 제한한다.

## TMDB 후보 생성

- `Accept-Language`에서 language/watch region을 추정한다.
  - `ko`는 `ko-KR`/`KR`
  - region 없는 `en`은 `en-US`/`US`
  - `en-GB`처럼 region이 있으면 해당 region 유지
- 한국어 fallback:
  - TMDB weekly trending movie/tv를 최대 5페이지까지 조회한다.
  - `original_language=ko` 또는 `origin_country=KR`인 항목만 남긴다.
  - 영화 공개일, 시리즈 첫 방영일이 미래인 항목은 제외한다.
- 비한국어 fallback:
  - TMDB discover movie/tv를 사용한다.
  - `watch_region`과 `flatrate|free|ads|rent|buy` 시청 방식으로 후보를 제한한다.
  - 영화 공개일, 시리즈 첫 방영일이 미래인 항목은 제외한다.

## 구현

- `apps/api/src/main/java/com/watchlog/api/tmdb/TmdbClient.java`
  - `availablePopular`
  - 한국어 weekly trending overfetch/filter
  - 비한국어 region/watch availability 기반 discover
- `apps/api/src/main/java/com/watchlog/api/web/TitleController.java`
  - `/api/titles/popular`
- `apps/web/app/[locale]/page.tsx`
  - 실제 함께 기록 부족분 계산
  - fallback 중복 제거
  - QuickLog 프리필
- `apps/web/components/DiscussionList.tsx`
  - 실제 기록 row와 fallback row 병행 표시
- `apps/web/messages/ko.json`, `apps/web/messages/en.json`
  - `인기 작품` / `Popular pick`

## 검증 기록

- `npx tsc -p apps/web/tsconfig.json --noEmit --pretty false`
- `node_modules/@biomejs/cli-linux-arm64/biome check ...`
  - 기존 `DiscussionList.tsx`의 `<img>` 성능 warning만 존재
- `./gradlew build` (`apps/api`)
- `npm run build --workspace ott`
- `git diff --check`
- production 배포 후 사용자가 운영 반영 확인
