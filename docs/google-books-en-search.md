# 영어 환경 Google Books 도서 검색

## 목표와 범위

- 우선순위 P1. 영어 환경의 도서 검색 범위를 Google Books로 확장한다.
- `GET /api/titles/search?type=book`의 `Accept-Language`에서 지원 언어(`ko`, `en`)를 협상한다. `en`, `en-US`, `en-GB` 등 영어 선호이면 Google Books, 한국어·헤더 없음·잘못된 헤더는 기존 Kakao를 사용한다. 검색어의 문자나 사용자 국적은 판정에 사용하지 않는다.
- 영상 검색, 한국어 KDC 서가, 기존 기록 내용과 기록 히스토리는 유지한다.
- API 검색/저장/동기화와 Web/PWA/Android TWA의 도서 식별자 처리를 변경한다. 연결된 iOS 클라이언트의 새 제공자 처리도 코드와 회귀 테스트에 포함한다. iOS 바이너리 빌드·제출은 별도 작업이며, API/Web 운영 배포 결과는 아래에 기록한다.
- 사용자 후속 결정: **EN의 책 구매처·독서 서비스만** 국제 서비스로 조정한다. 영상 OTT·극장 및 한국어 기본 선택지는 유지한다. Web 기록 생성/수정과 Native 기록 생성/수정이 같은 EN 목록을 사용하도록 `shared/bookPlatforms.ts`에 목록을 둔다. 기존 한국 서비스명과 직접 입력값은 변환하거나 지우지 않고 그대로 저장·동기화한다.
- 배포 산출물도 같은 공통 목록을 포함하도록 Web Docker build 단계에서 `shared/`를 복사하고 Metro 기본 watchFolders를 유지하면서 `shared/`를 추가한다. CI는 Web 컨테이너 빌드·브라우저 검증과 실제 iOS export까지 확인한다.
- EN 기본 선택지: Amazon, Bookshop.org, Local bookstore / Kindle, Apple Books, Google Play Books, Kobo / Audible / Libby, Public Library, University Library, School Library. 이는 기록용 선택지이며 서비스 지역·구독 권한을 판정하거나 구매를 연결하는 기능은 아니다.
- CI 호환성: 첫 Native CI는 타입 검사와 42개 테스트를 통과한 뒤 Expo doctor의 기존 SDK 패치 차이(`expo 55.0.31→55.0.32`, `expo-sharing 55.0.24→55.0.25`)에서 멈췄다. SDK 55를 유지하고 두 직접 의존성과 이에 필요한 Expo 도구 종속성을 갱신했다. 로컬 Expo doctor 1.20.4의 20개 검사와 CI의 실제 iOS 번들이 모두 통과했다. 두 직접 의존성의 upstream changelog는 사용자 동작 변경이 없다고 명시한다. iOS 바이너리 빌드/제출은 하지 않는다.

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

- [PR #124](https://github.com/chawon/ott/pull/124)의 구현·로컬 검증과 API/Web/Native CI가 모두 통과했다. 운영 반영 상태는 아래 배포 기록을 따른다.
- API `./gradlew test bootJar --no-daemon`: 로컬에서는 101개 중 62개 통과, Docker가 필요한 PostgreSQL 통합 테스트 39개는 skip. Mockito attach 제한 때문에 동일 명령을 샌드박스 밖에서 실행했다. [PR API CI](https://github.com/chawon/ott/actions/runs/40251567460)는 실제 PostgreSQL 테스트 실행 게이트와 API 컨테이너 검증까지 통과했다.
- `npm ci --ignore-scripts`로 잠금 파일에 맞춘 의존성을 별도 작업 폴더에 설치했다. Web 타입 검사와 Next.js 16.3.8 프로덕션 빌드, 도서/원문 링크 단위 테스트 11개가 통과했다. SWC 캐시의 샌드박스 권한 제한을 피하기 위해 빌드는 샌드박스 밖에서 실행했다.
- Native 타입 검사와 전체 Jest 11 suite / 42개 테스트가 통과했다. 새 제공자의 직접 검색, 최근 작품, 공개 리액션, 오프라인 오류/재시도, push/pull의 식별자·수동 필드를 확인했다. iOS 실기기 검증과 바이너리 배포는 별도다.
- Web 프로덕션 빌드를 로컬에서 실행해 실제 브라우저의 신규 Google 책/기존 Kakao ISBN 판본/ISBN 없는 책 3가지 시나리오를 검증했다. 영어 헤더·공식 출처/원문 링크, 오프라인 생성/수정, 실패한 push, 재시도, 서버 canonical ID remap, 메모·평점·시청일 보존, 타임라인 재조회와 모바일 가로 넘침 없음을 확인했다. 이 브라우저 검증은 mock API를 사용하며 운영 사용자 데이터는 쓰지 않는다.
- EN 도서 플랫폼의 Kindle 선택값이 오프라인 생성/수정과 재시도·pull을 거쳐 유지됐다. 기존 `밀리의서재` 기록을 영어 상세 화면에서 메모만 수정해도 플랫폼·평점·날짜가 보존되는 것을 브라우저로 확인했다. 이 테스트의 서버 fixture 수정은 실제 수정처럼 `updatedAt`을 갱신하고 로컬 캐시에 동기화된 뒤 편집 화면을 연다. Native sync 테스트도 Kindle과 기존 한국 서비스 문자열을 보존한다.
- 로컬 `expo export --platform ios --no-bytecode`는 공통 도서 플랫폼 모듈과 공식 출처 PNG를 포함해 1,303개 모듈의 JS 번들을 생성했다. [Native CI](https://github.com/chawon/ott/actions/runs/40251567459)는 타입 검사, 전체 Jest, Expo doctor와 bytecode를 포함한 기본 iOS export까지 통과했다. iOS 바이너리 빌드와 실기기 검증은 별도다.
- 제공된 개발 키로 **실제 구현된 GoogleBooksClient**에서 `Atomic Habits`, `Project Hail Mary`, `C++` 검색을 수행해 각각 10건(앱 반환 상한)의 메타데이터 변환을 확인했다. ISBN `9780140328721`은 정상 응답이지만 0건이었다. 검색원 추가가 모든 특정 원서의 수록을 보장하지는 않는다.
- 루트 `npm run test`는 프로젝트에 해당 스크립트가 없어 실행할 수 없다. 실제 API/Web/Native 검증 명령을 사용했다.
- [PR Web CI](https://github.com/chawon/ott/actions/runs/40251567479)는 프로덕션 Docker 이미지의 브라우저 검증까지 통과했다.
- 병합 SHA `98417a9`의 main [API CI](https://github.com/chawon/ott/actions/runs/40252227809), [Web CI](https://github.com/chawon/ott/actions/runs/40252227849), [Native CI](https://github.com/chawon/ott/actions/runs/40252227842)도 모두 통과했다.

## 2026-10-26 운영 배포

- 사용자가 OCI Vault 설정을 완료하고 배포를 승인했다. `ott-google-books-secrets`가 `Ready=True` / `SecretSynced`이며 키가 비어 있지 않음을 값 노출 없이 확인했다.
- PR #124를 main SHA `98417a9f22079e17650b6f1d2dfd2c022c5afd30`로 병합했다. 같은 명시적 SHA로 API → Web 순서로 배포했다.
- API production [run 40252251489](https://github.com/chawon/ott/actions/runs/40252251489) 성공, API manifest commit `f043d76f0b0d9d9872011962abd2441e0be8ae26`. 새 API Pod의 `APP_VERSION=98417a9`와 운영 키 존재를 값 노출 없이 확인했다.
- 운영 API의 영문 제목·지역별 영어·`C++`·ISBN·한국어·기존 iOS·신규 capability iOS 검색 7건이 모두 HTTP 200이었다. 영문 제목·지역별 영어·`C++`는 각각 Google 10건, 한국어/기존 iOS는 KAKAO/NAVER 10건이었다. ISBN `9780735211292`는 정상 응답이지만 0건이었다. 검색만 수행하고 운영 기록을 생성·수정하지 않았다.
- API 반영과 실제 검색 확인 후 동일 SHA로 Web production [run 40252514676](https://github.com/chawon/ott/actions/runs/40252514676)도 성공했다. Web manifest commit은 `dc3b3471988c0f209dcb702cc3a35b61120285ba`다. 공개 버전 검증과 IndexNow 후속 단계도 성공했다.
- ArgoCD `ott-app`은 배포 매니페스트 revision `dc3b3471988c0f209dcb702cc3a35b61120285ba`에서 `Synced Healthy`였다. 운영 API/Web 이미지 모두 배포 SHA와 일치하며 `APP_VERSION=98417a9`, 두 Pod `1/1` ready·restart 0을 확인했다. 공개 `https://ottline.app/.well-known/ottline-version`도 `98417a9`를 반환했다.
- 새 Web Pod의 `/api/titles/search` 프록시를 통해 같은 7개 검색을 반복해 모두 200과 제공자·원문 링크 계약을 확인했다. 직접 API를 포함해 검색 14건을 검증했으며, ISBN의 정상 빈 결과도 동일했다.
- 운영 Web의 공식 Google 출처 PNG는 HTTP 200, 원본 크기 62×30이었다. 실제 배포된 브라우저 JS에서 Bookshop.org, Kindle, Apple Books, Google Play Books, Kobo, Audible, Libby 목록도 확인했다.
- iOS 바이너리 빌드·TestFlight/App Store 제출은 이번 배포에 포함하지 않는다. 현재 iOS 사용자는 Kakao를 유지하고 새 capability를 지원하는 바이너리부터 영어 Google 검색을 사용한다.
