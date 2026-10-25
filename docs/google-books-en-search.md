# 영어 환경 Google Books 도서 검색

## 목표와 범위

- 우선순위 P1. 영어 환경의 도서 검색 범위를 Google Books로 확장한다.
- `GET /api/titles/search?type=book`의 `Accept-Language`에서 지원 언어(`ko`, `en`)를 협상한다. `en`, `en-US`, `en-GB` 등 영어 선호이면 Google Books, 한국어·헤더 없음·잘못된 헤더는 기존 Kakao를 사용한다. 검색어의 문자나 사용자 국적은 판정에 사용하지 않는다.
- 영상 검색, 한국어 KDC 서가, 기존 기록 내용과 기록 히스토리는 유지한다.
- API 검색/저장/동기화와 Web/PWA/Android TWA의 도서 식별자 처리를 변경한다. 연결된 iOS 클라이언트의 새 제공자 처리도 코드와 회귀 테스트에 포함한다. iOS 바이너리 빌드·제출과 운영 배포는 별도 작업이다.
- 사용자 후속 결정: **EN의 책 구매처·독서 서비스만** 국제 서비스로 조정한다. 영상 OTT·극장 및 한국어 기본 선택지는 유지한다. Web 기록 생성/수정과 Native 기록 생성/수정이 같은 EN 목록을 사용하도록 `shared/bookPlatforms.ts`에 목록을 둔다. 기존 한국 서비스명과 직접 입력값은 변환하거나 지우지 않고 그대로 저장·동기화한다.
- EN 기본 선택지: Amazon, Bookshop.org, Local bookstore / Kindle, Apple Books, Google Play Books, Kobo / Audible / Libby, Public Library, University Library, School Library. 이는 기록용 선택지이며 서비스 지역·구독 권한을 판정하거나 구매를 연결하는 기능은 아니다.
- CI 호환성: 첫 Native CI는 타입 검사와 42개 테스트를 통과한 뒤 Expo doctor의 기존 SDK 패치 차이(`expo 55.0.31→55.0.32`, `expo-sharing 55.0.24→55.0.25`)에서 멈췄다. SDK 55를 유지하고 두 직접 의존성과 이에 필요한 Expo 도구 종속성을 갱신했다. 로컬 Expo doctor 1.20.4의 20개 검사가 모두 통과했으며 실제 iOS 번들은 CI에서 검증한다. 두 직접 의존성의 upstream changelog는 사용자 동작 변경이 없다고 명시한다. iOS 바이너리 빌드/제출은 하지 않는다.

## API와 데이터 계약

- Google Books Volumes API를 서버에서 호출한다. `langRestrict=en`, `printType=books`, `maxResults=10`을 사용하고 ISBN 입력은 `isbn:` 검색으로 전달한다.
- 기존 DTO에 `provider=GOOGLE_BOOKS`, `providerId=Google volume ID`와 선택적 `sourceUrl`을 추가한다. ISBN이 없는 책도 volume ID로 저장할 수 있다. 같은 ISBN으로 기존 제공자의 ID를 반환하더라도 Google 원문 링크는 유지한다.
- 제목/저자/출판사/표지/설명/출판일/ISBN을 기존 DTO로 변환한다. 연도·월만 있는 출판일은 정밀도를 보존하고 임의의 월·일을 만들지 않는다.
- 동일 판본의 유효한 ISBN-10/13만 NAVER/KAKAO/GOOGLE_BOOKS 사이에서 연결한다. 기존 서버 UUID와 제공자 ID를 보존하고 번역본·다른 판본·제목만 같은 책은 합치지 않는다. DB 스키마 마이그레이션은 필요하지 않다.
- 새 제공자가 기존 클라이언트에서 LOCAL로 변환되어도 서버 동기화가 canonical 제공자 식별자를 덮어쓰지 못하게 한다.
- Google 가이드에 따라 검색창/결과/선택 화면에 공식 출처 로고와 책별 Google Books 링크를 표시한다. 결과 순서는 유지한다. 공식 원본 이미지 `https://books.google.com/googlebooks/images/poweredby.png`(62×30 PNG)를 Web/native에 그대로 포함한다.
- 기존 iOS 앱은 필수 출처 표시를 지원하지 않으므로 Kakao를 유지한다. 새 네이티브 코드가 `X-Client-Platform: ios_native`와 `X-Book-Search-Capability: google_books_v1`을 보낼 때 영어 검색을 Google로 전환한다. Web/PWA/TWA는 별도 capability 헤더 없이 언어만으로 분기한다.
- 영어 검색의 키 미설정·권한/쿼터 거부(403)·사용량 제한(429)은 503, 그 밖의 upstream 장애/잘못된 응답은 502로 반환한다. 오류 원인이나 URL을 통해 키·검색어·upstream 응답이 노출되지 않게 한다. 장애 시 검색 결과 없음으로 오인하거나 Kakao로 조용히 전환하지 않는다.

## 설정

- 서버 환경변수 `GOOGLE_BOOKS_API_KEY`를 사용한다. 선택적 `GOOGLE_BOOKS_BASE_URL`은 로컬 검증용이다.
- 공개 데이터 검색용 서버 API 키는 Google Books API 사용 설정과 적절한 API 제한을 적용해 발급한다. 기존 Gemini/GA4 자격증명을 재사용하지 않는다.
- 운영용 키를 OCI Vault에 별도로 등록하고 ESO로 주입한 뒤 실제 Google 응답을 확인해야 한다. 값은 Git·클라이언트 번들·로그에 기록하지 않는다.
- 기존 ExternalSecret의 필수 키 목록에 미등록 Vault 키를 추가하면 전체 동기화에 영향을 줄 수 있으므로, 새 키는 별도 ExternalSecret과 선택적 Secret 참조로 준비한다.
- 운영 Vault 키 이름은 **`GOOGLE_BOOKS_API_KEY`**다. `deploy/oke/google-books-external-secret.yaml`이 같은 이름으로 읽고, `deploy/oke/api-deployment.yaml`의 선택적 참조가 API 환경변수로 전달한다. Secret이 생긴 뒤 새 API Pod를 배포해야 환경변수가 적용된다.
- 사용자가 제공한 개발 키는 `/tmp`의 권한 0600 파일에서만 읽어 로컬 실제 API 검증에 사용한다. Git/CI/운영 Secret에는 포함하지 않는다. 운영 키는 사용자가 별도로 OCI Vault에 등록한다.

## 검증 시나리오

1. 영어/지역별 영어 헤더는 Google, 한국어/누락/잘못된 헤더는 Kakao를 호출하며 영상 검색은 기존 경로를 유지한다.
2. 실제 HTTP 클라이언트에서 공백·`C++`·`&`·괄호를 한 번만 인코딩하고, ISBN 검색·언어/종류 제한·최대 결과 수를 확인한다.
3. 메타데이터 누락, ISBN 없는 책, 부분 출판일, 빈 검색 결과, 키 누락, 429/403/5xx 및 malformed 응답을 검증한다.
4. 기존 NAVER/KAKAO와 같은 ISBN인 Google 결과는 검색·직접 저장·오프라인 push/pull에서 기존 ID를 재사용한다. 역방향 조회, 다른 판본, ISBN 없는 volume ID도 확인한다.
5. Web 로컬 저장/재시도/서버 pull과 iOS 검색·공개 기록·outbox 경로에서 제공자와 사용자가 작성한 메모/평점/날짜가 유지되는지 검증한다.
6. API 테스트/빌드, Web 타입 검사·도서 테스트·빌드, Native 타입 검사·도서 회귀 테스트를 실행한다. Docker 없는 로컬 환경의 PostgreSQL 통합 테스트는 skip으로 명시하고 PR CI에서 실제 실행을 확인한다.

## 외부 계약

- [Google Books 사용 가이드](https://developers.google.com/books/docs/v1/using)
- [Volumes list](https://developers.google.com/books/docs/v1/reference/volumes/list)
- [Google Books 출처 표시 가이드](https://developers.google.com/books/branding)

## 검증 결과와 배포 상태

- 구현과 로컬 검증 완료. 운영 배포는 하지 않았다. PR CI 검증 상태는 PR에 기록한다.
- API `./gradlew test bootJar --no-daemon`: 101개 중 62개 통과, Docker가 필요한 PostgreSQL 통합 테스트 39개는 skip. Mockito attach 제한 때문에 동일 명령을 샌드박스 밖에서 실행했다. PR CI에서는 Docker를 사용해 skip 없이 검증한다.
- `npm ci --ignore-scripts`로 잠금 파일에 맞춘 의존성을 별도 작업 폴더에 설치했다. Web 타입 검사와 Next.js 16.3.8 프로덕션 빌드, 도서/원문 링크 단위 테스트 11개가 통과했다. SWC 캐시의 샌드박스 권한 제한을 피하기 위해 빌드는 샌드박스 밖에서 실행했다.
- Native 타입 검사와 전체 Jest 11 suite / 42개 테스트가 통과했다. 새 제공자의 직접 검색, 최근 작품, 공개 리액션, 오프라인 오류/재시도, push/pull의 식별자·수동 필드를 확인했다. iOS 실기기 검증과 바이너리 배포는 별도다.
- Web 프로덕션 빌드를 로컬에서 실행해 실제 브라우저의 신규 Google 책/기존 Kakao ISBN 판본/ISBN 없는 책 3가지 시나리오를 검증했다. 영어 헤더·공식 출처/원문 링크, 오프라인 생성/수정, 실패한 push, 재시도, 서버 canonical ID remap, 메모·평점·시청일 보존, 타임라인 재조회와 모바일 가로 넘침 없음을 확인했다. 이 브라우저 검증은 mock API를 사용하며 운영 사용자 데이터는 쓰지 않는다.
- EN 도서 플랫폼의 Kindle 선택값이 오프라인 생성/수정과 재시도·pull을 거쳐 유지됐다. 기존 `밀리의서재` 기록을 영어 상세 화면에서 메모만 수정해도 플랫폼·평점·날짜가 보존되는 것을 브라우저로 확인했다. Native sync 테스트도 Kindle과 기존 한국 서비스 문자열을 보존한다.
- 제공된 개발 키로 **실제 구현된 GoogleBooksClient**에서 `Atomic Habits`, `Project Hail Mary`, `C++` 검색을 수행해 각각 10건(앱 반환 상한)의 메타데이터 변환을 확인했다. ISBN `9780140328721`은 정상 응답이지만 0건이었다. 검색원 추가가 모든 특정 원서의 수록을 보장하지는 않는다.
- 루트 `npm run test`는 프로젝트에 해당 스크립트가 없어 실행할 수 없다. 실제 API/Web/Native 검증 명령을 사용했다.
- 운영용 `GOOGLE_BOOKS_API_KEY`의 OCI Vault 등록은 사용자가 진행한다. 이후 ESO 동기화와 신규 Pod의 키 존재를 값 노출 없이 확인하고, API → Web 순서로 명시적 SHA 배포 및 영어/한국어 검색 확인이 필요하다. 이번 변경에서는 운영 키 등록이나 배포를 실행하지 않았다.
