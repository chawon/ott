# React Native 카카오 책 공급자 적용

## 목표와 범위

운영 책 검색은 이미 Kakao를 사용한다. 네이티브의 `Provider` 타입과 함께 기록의 작품 변환에는 `KAKAO`가 빠져 있어, 최근 작품에서 책을 선택하거나 공개 글에 반응해 기록할 때 공급자가 `LOCAL` 또는 빈 값으로 바뀔 수 있다.

`apps/native`에서 검색 결과 → 로컬 기록 → outbox, 최근 함께 작품 → 기록, 공개 글 반응 → 기록의 공급자와 작품 ID를 유지한다. 기존 `NAVER` 기록도 계속 읽고 수정·동기화한다. 같은 ISBN 판본에 대한 서버의 기존 `titleId`를 그대로 사용하며, 네이티브에서 공급자를 일괄 치환하거나 제목으로 작품을 합치지 않는다.

API·DB 스키마·웹·Expo 의존성과 앱 버전은 이번 변경 범위에 포함하지 않는다. 화면의 디자인과 한국어·영어 문구도 그대로 사용한다. 검토한 다른 웹/네이티브 기능 차이는 후속 작업이다.

## 개발 방향

- 화면 내부의 검색·공개 글 작품 변환을 공용 함수로 옮겨 실제 저장 경로의 회귀 검증 지점을 만든다. 먼저 기존 동작을 유지한 상태에서 `KAKAO` 식별자 소실을 재현한다.
- 공급자 타입과 변환에서 `TMDB`, `LOCAL`, `NAVER`, `KAKAO`를 인식한다. 알 수 없는 공급자의 기존 fallback은 유지한다.
- 검색 응답의 저자·출판사·ISBN·출판일과 `providerId`를 로컬 기록 및 outbox까지 유지한다. 서버에서 기존 책 `titleId`를 반환하면 재사용한다.
- 새로운 책 저장, 기존 Naver 책 수정, 온라인 push/pull, 오프라인 저장 후 재시도 흐름을 검증한다. 사용자가 입력한 상태·평점·메모·날짜는 공급자 처리와 분리해 보존한다.

## 검증 시나리오

1. Kakao 책 검색 응답으로 만든 기록과 outbox에 `KAKAO`, ISBN 공급자 ID, 메타데이터가 남는다.
2. 최근 함께 책을 선택하거나 공개 글에 반응할 때 공급자가 바뀌지 않고 기존 서버 작품 ID를 재사용한다.
3. 기존 `NAVER` 책의 ID·공급자·메타데이터와 수정한 기록 값이 outbox에 유지된다.
4. 오프라인 저장 후 재연결 push와 서버 pull에서 Kakao/Naver 식별자가 유지된다. TMDB 영상과 기존 fallback도 회귀가 없다.
5. 네이티브 타입 검사, 전체 Jest, TestFlight 구성 검사와 iOS JS 번들 생성을 실행한다. 기존 Expo doctor 실패는 기능 변경과 구분해 기록한다.

## 구현 결과

`Provider`에 `KAKAO`를 추가하고, 기록하기와 공개 글 상세가 같은 `lib/titleAdapters.ts`의 변환 함수를 사용하도록 했다. 기존 `NAVER`를 포함한 다른 공급자의 처리와 알 수 없는 값의 fallback은 유지한다.

기존 화면 함수를 동작 변경 없이 옮긴 상태에서 회귀 테스트 2건이 실패했다. 최근 함께 작품에서는 `KAKAO`가 `LOCAL`로 바뀌고, 공개 글 반응에서는 공급자가 `undefined`로 빠졌다. 공급자 허용 목록에 `KAKAO`를 추가한 뒤 두 경로 모두 통과했다. 검색에서 직접 만든 기록은 수정 전에도 공급자와 책 메타데이터를 유지했고, 이번에 타입 계약을 맞췄다.

## 검증 결과 — 2026-10-14

| 확인 | 결과 |
|---|---|
| `npm run native:typecheck` | 통과 |
| `npm run native:test` | 11 suites, 39 tests 통과. 기존 27개 + 책 공급자·동기화 회귀 12개 |
| `npm run native:testflight:check` | 통과 |
| `CI=1 npx expo export --platform ios --no-bytecode` | iOS JavaScript 번들 생성 통과, 1,299개 모듈 |
| `npx expo-doctor` | 19/20 통과. 기존 Expo SDK 55 패치 버전 차이 9개로 1개 검사 실패 |
| `git diff --check` | 통과 |

검색·오프라인 재시도·push/pull 테스트는 실제 네이티브 API 함수와 공급자 변환·outbox 생성·sync 코드를 실행한다. 외부 HTTP 응답과 네이티브 저장소 경계는 fixture/mock으로 대체했다. 신규 Kakao 책의 임시 작품 ID가 서버 ID로 갱신되는 경우, 기존 Naver 책의 서버 ID와 ISBN-10 공급자 ID가 유지되는 경우를 모두 확인했다. 상태·평점·메모·사용자가 입력한 날짜도 보존된다.

운영 Web Pod에서 네이티브가 사용하는 같은 `/api/titles/search` 경로를 한국어 헤더로 읽기 전용 확인했다. `채식주의자` 10건, `9788936433598` 1건, `C++` 10건이 모두 HTTP 200 및 `KAKAO` 공급자를 반환했다. ISBN 검색의 `isbn10=8936433598`, `isbn13=9788936433598`, `pubdate=20071030`도 확인했다.

이 작업은 package manifest와 lockfile을 변경하지 않는다. Expo doctor의 기존 차이는 `expo`, `expo-file-system`, `expo-linking`, `expo-localization`, `expo-notifications`, `expo-router`, `expo-secure-store`, `expo-sharing`, `expo-sqlite`의 패치 버전이다. 따라서 현재 Native iOS CI의 해당 검사는 계속 실패할 수 있다.

로컬 ARM Linux에서 기본 export는 동봉된 x86-64 Hermes 컴파일러를 실행하지 못했다. `--no-bytecode`는 로컬 JavaScript 번들 검증에만 사용했고 앱의 Hermes 설정은 변경하지 않았다. EAS/Xcode 빌드와 실제 iPhone 설치·실행은 아직 검증하지 않았다. TestFlight/App Store 바이너리는 배포하지 않았다.
