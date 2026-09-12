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

웹·네이티브 Provider 타입에 KAKAO를 추가하고 네이티브 공개/함께 기록의 공급자 변환을 보강한다.
네이티브 소스 반영과 App Store 바이너리 배포는 별도 단계다.

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
- PostgreSQL/Testcontainers 테스트가 실제 JPA 판본 조회를 검증한다.
  로컬 Docker가 없으면 이 테스트는 생략되며, CI에서는 Docker를 필수 확인한다.

현재 구현은 배포 전 상태다. 실제 카카오 upstream 성공은 확인했지만
ottline 운영 도서 검색 복구는 production 배포 후 별도로 확인해야 한다.

## 공식 문서

- [카카오 책 검색](https://developers.kakao.com/docs/ko/daum-search/dev-guide#search-book)
- [네이버 검색 API 종료 공지](https://developers.naver.com/notice/article/32564)
