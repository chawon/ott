# 홈 함께 기록 인기 작품 보충

## 배경

- 홈의 `요즘 함께 하는 기록들`은 현재 `/api/discussions/latest?limit=6&days=14` 결과를 그대로 표시한다.
- 초기 사용량이 적으면 섹션이 비어 보여 서비스가 활성화되지 않은 것처럼 보일 수 있다.
- 실제 사용자 활동처럼 보이게 만들면 안 되므로, 부족분만 TMDB 기반 인기 작품으로 명확히 구분해 보충한다.

## 목표

1. 실제 공개 기록을 최대 6개까지 우선 표시한다.
2. 실제 공개 기록이 6개 미만이면 부족한 개수만 TMDB 기반 인기 작품으로 채운다.
3. 인기 작품은 실제 함께 기록과 다른 배지/문구로 표시한다.
4. TMDB 호출은 백엔드에서만 수행하고, 언어/지역별로 1일 캐시한다.

## 구현 상태

- 2026-05-23 기준 PR #37로 production 반영 완료.
- 배포 SHA: `9a3fcdf28ef142f2021c143da3a00598762a6053`
- staging workflow:
  - `Deploy Web to Staging` run `26330960327`
  - `Deploy API to Staging` run `26330960490`
- production workflow:
  - `Deploy Web to Production` run `26331154875`
  - `Deploy API to Production` run `26331157652`
- production 이미지:
  - `ott-web:9a3fcdf28ef142f2021c143da3a00598762a6053`
  - `ott-api:9a3fcdf28ef142f2021c143da3a00598762a6053`

## 범위

### 포함

- movie/tv 인기 작품 혼합 조회
- `Accept-Language` 기반 TMDB language/watch region 추정
  - `ko`는 `KR`, region 없는 `en`은 `US`를 기본값으로 사용한다.
  - 한국어(`ko-KR`) fallback은 TMDB 주간 트렌드에서 `original_language=ko` 또는 `origin_country=KR`인 항목만 노출한다.
  - 한국어 fallback은 필터링 후 부족해지지 않도록 주간 트렌드를 최대 5페이지까지 overfetch한다.
- 영화는 공개일, 시리즈는 첫 방영일이 요청일 이후인 후보 제외
- 영어 등 비한국어 fallback은 추정 region이 있으면 `watch_region`과 시청 방식(`flatrate|free|ads|rent|buy`)으로 후보 제한
- `providerId` 기준 실제 공개 기록과 인기 작품 중복 제거
- 인기 작품 카드 클릭 시 QuickLog 검색창에 제목 프리필

### 제외

- 개인화 추천
- 책 인기 작품 보충
- 실제 공개 기록처럼 댓글/리액션/작성일을 꾸며 표시하는 UX
- TMDB 인기 작품 저장 또는 DB 적재

## 검증 시나리오

1. 실제 공개 기록이 6개 이상이면 TMDB 보충 없이 기존 목록만 표시된다.
2. 실제 공개 기록이 1~5개면 부족한 개수만 인기 작품 카드가 표시된다.
3. 실제 공개 기록이 0개면 인기 작품 카드 6개가 표시된다.
4. 인기 작품 카드를 누르면 QuickLog가 영상 모드로 전환되고 제목 검색어가 채워진다.
