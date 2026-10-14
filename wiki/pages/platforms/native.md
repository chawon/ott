# Native 앱 (React Native + Expo)

> `apps/native/`의 iOS 네이티브 앱. 기준일: 2026-10-14.

## 현황

`apps/native`는 main에 병합됐으며 2026-06-29 [App Store](https://apps.apple.com/app/ottline/id6780318110)에 출시됐다. 사용자 화면을 React Native로 구현한다. Android의 현재 배포 경로는 별도의 [[twa]]다.

- 공개 버전: `1.0.3` (`2026-10-14` Apple 공개 조회).
- 최신 EAS 빌드: `1.0.4 (24)`, SHA `fc074ceef188161940a9aec6facaef2034f2119f`, [빌드 성공](https://expo.dev/accounts/ergate23/projects/ottline/builds/057972ad-3c10-4a59-9e5b-ef051c1a160d).
- 카카오 책 공급자 식별자 보존, 기존 Naver 기록 호환, Expo SDK 55 패치와 CI 검사를 반영했다.
- Apple 계약 차단 해제 후 같은 빌드로 재제출했다. Apple `VALID`, 내부 TestFlight `IN_BETA_TESTING`, `expired=false`를 확인했다. 실제 iPhone QA와 `1.0.4` App Store 공개 심사는 후속 단계다.
- 상세: [카카오 적용·검증](../../../docs/native-kakao-books.md), [TestFlight 이력](../../../docs/ios-testflight-review-notes.md).

## 기술과 화면

| 항목 | 현재 구현 |
|---|---|
| 프레임워크 | Expo SDK 55, React Native `0.83.10`, React `19.2.1` |
| 라우팅 | Expo Router |
| 주요 탭 | 기록하기 `log`, 타임라인 `timeline`, 함께 `together`, 설정 `account` |
| 추가 화면 | 작품·공개 글 상세, 이용 리포트, 문의, 소개·FAQ·개인정보 안내, 오프라인 안내 |
| 인증·저장 | Zustand, SecureStore, SQLite 로컬 기록·outbox |
| API·동기화 | 기본 `https://ottline.app`, `/api/sync/push`, `/api/sync/pull` |
| 언어·테마 | 한국어·영어, 라이트·다크·시스템 설정 |
| 테스트 | Jest 11 suites / 39 tests, TypeScript, Expo doctor, iOS Hermes export |

검색·공개 글의 작품 변환은 `lib/titleAdapters.ts`, 로컬 DB는 `lib/localDb.ts`, 동기화는 `lib/sync.ts`와 `lib/syncPayload.ts`에서 관리한다. `KAKAO`와 `NAVER` 책 식별자를 모두 유지한다.

## 실행과 검사

저장소 루트에서 실행한다.

```bash
npm ci
npm run start --workspace native
npm run native:typecheck
npm run native:test
npm run native:testflight:check
```

## 빌드·제출

- `.github/workflows/native-ios-ci.yml`: 타입·Jest·Expo doctor·iOS Hermes export.
- `.github/workflows/native-ios-testflight.yml`: 명시한 Git SHA를 체크아웃하고 검사 후 EAS 빌드·자동 제출. 배포 러너 Node `24`, EAS CLI `24.13.0`.
- `apps/native/eas.json`: TestFlight store 배포, 로컬 버전 관리와 빌드 번호 자동 증가. 다음 빌드 전 로컬 기준을 완료 빌드 `24` 이상으로 올린다. 재제출할 때는 성공한 기존 빌드 ID를 지정한다.
- EAS project: `efe8f7e5-75d8-45a9-9a4e-88bfeba07b98`, bundle ID: `app.ottline`, Apple app ID: `6780318110`.

## 관련 페이지

- [[twa]]
- [[book-log]]
- [[kmp]]
