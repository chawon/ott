# 카카오 책 검색 전환

## 원인과 변경

네이버 책 검색 API 종료로 `/api/titles/search?q=...&type=book` 요청이
네이버 `404 / SE05`를 받아 ottline에서 500으로 실패했다.
책 검색은 카카오 `GET https://dapi.kakao.com/v3/search/book`으로 전환한다.
영상 검색은 기존 TMDB 경로를 사용한다.

- 카카오 `documents`를 기존 `TitleSearchItemDto[]`로 변환한다.
- `authors`는 문자열로 합치고, 출판일은 현지 날짜의 `YYYYMMDD`로 저장한다.
- ISBN 체크섬을 검증하고 ISBN-10을 ISBN-13으로 정규화한다.
- 979 ISBN에는 ISBN-10을 붙이지 않는다. 같은 응답의 잘못된 ISBN-10을 섞지 않는다.
- ISBN이 없으면 상세 URL의 SHA-256 앞 40자리를 공급자 ID로 사용한다.
- 연결 제한은 3초, 응답 제한은 5초다. 키 미설정/쿼터 초과는 503,
  외부 HTTP·네트워크·파싱 장애는 502로 응답한다. 외부 응답 본문이나 키를 오류에 넣지 않는다.

## 기존 책과의 연결

신규 책 식별자는 `KAKAO + ISBN13`을 사용한다. 서버에 같은 판본의 NAVER/KAKAO 책이 있으면
그 책의 `titleId`, `provider`, `providerId`를 검색 결과에 돌려준다.
이때 공급자 필드는 기존 책의 식별 네임스페이스이며, 최신 검색 데이터 출처는 카카오다.
기존 식별자를 변경하거나 과거 기록을 일괄 마이그레이션하지 않는다.

직접 저장과 outbox 동기화도 같은 ISBN 조회를 사용하며,
ISBN-10만 저장된 옛 네이버 책도 연결한다. 제목만 비슷한 책이나 다른 ISBN 판본은 합치지 않는다.
웹 로컬 캐시도 NAVER/KAKAO ISBN 별칭을 비교한다.
이미 중복 저장된 서로 다른 책 ID의 일괄 병합은 이 변경에 포함되지 않는다.

웹 Provider 타입에 KAKAO를 추가한다. 구버전 네이티브 앱이 함께 기록에서
새 공급자를 LOCAL로 바꾸더라도 서버는 titleId가 가리키는 기존 책의 공급자 식별자를 보존한다.
네이티브 소스, Expo 의존성, App Store 바이너리는 이번 배포 범위에 포함하지 않는다.

## 설정과 배포 순서

1. OCI Vault `ott-api`에 `KAKAO_API_KEY`를 등록한다.
2. `deploy/oke/external-secret.yaml`이 같은 이름의 Kubernetes Secret 키로 가져온다.
3. API는 `${KAKAO_API_KEY}`를 `kakao.rest-api-key`로 읽는다.
4. PR CI 이후 main에 병합하고 ExternalSecret `Ready=True`를 확인한다.
5. 승인된 SHA로 API/Web production 워크플로우를 실행한다.
6. ArgoCD 상태, 실제 이미지/APP_VERSION, 공개 도서 검색의 200 응답을 확인한다.

키 값을 Git에 추가하거나 요청 URL에 포함하지 않는다. 네이버 클라이언트와 설정은 제거하며,
기존 NAVER 식별자는 과거 기록 호환을 위해 계속 지원한다.

## 검증

- 실제 Vault 키로 `해리 포터`, ISBN `9788983921987`, `C++` 검색의 HTTP 200을 확인했다.
- HTTP 클라이언트의 한국어·공백·`&`·`+`·중괄호 인코딩과 인증 헤더를 테스트한다.
- 응답 변환, 빈 결과, 누락/잘못된 데이터, 401/429/500 응답 처리를 테스트한다.
- 기존 ISBN의 검색/직접 저장/동기화 연결 및 다른 판본 분리를 테스트한다.
- 구버전 네이티브의 LOCAL fallback 동기화에서도 기존 KAKAO 책 식별자가 유지되는지 검증한다.
- PostgreSQL/Testcontainers 테스트가 실제 JPA 판본 조회를 검증한다.
  로컬 Docker가 없으면 이 테스트는 생략되며, CI에서는 Docker를 필수 확인한다.

## 운영 배포 결과 (2026-09-12)

- PR #106, 배포 SHA `68f772e865aecf15fe232297bb588490898aa9aa`.
- PR API/Web CI `34683902588` / `34683902689`, main API/Web CI `34684072982` / `34684072965` 통과.
- API production run `34684081448`(2차 실행), Web production run `34684083501` 성공.
  API 1차 실행은 웹과 main manifest를 동시에 푸시해 ref 충돌로 실패했고, 같은 SHA 재실행으로 완료했다.
- API manifest `352bfe104ef27f7e8da3553f86f288c705474066`, Web manifest `7d4be7d7c02e6044205ad3cf1511e931e213a51d`.
- ExternalSecret `Ready=True / SecretSynced`, 운영 Secret의 `KAKAO_API_KEY` 존재 확인.
- ArgoCD `ott-app` `Synced Healthy`, API/Web 이미지 SHA 일치, `APP_VERSION=68f772e`, 두 Pod ready·restart 0.
- 운영 API 직접 호출과 웹 프록시에서 `해리 포터` 10건, ISBN `9788983921987` 1건,
  `C++` 10건, 결과 없는 검색 0건 모두 HTTP 200. 제목/ISBN/날짜/KAKAO 공급자 계약 확인.
- 기존 영상 검색 `Interstellar`도 두 경로 모두 HTTP 200, 9건 반환.
- 공개 도메인 직접 검증은 Cloudflare 403으로 제한되어 운영 내부 웹 프록시로 검색을 검증했다.
  웹 워크플로우의 공개 production version 검증은 통과했다.
- 네이티브·Expo·App Store 바이너리는 변경하거나 배포하지 않았다.

## 공식 문서

- [카카오 책 검색](https://developers.kakao.com/docs/ko/daum-search/dev-guide#search-book)
- [네이버 검색 API 종료 공지](https://developers.naver.com/notice/article/32564)
