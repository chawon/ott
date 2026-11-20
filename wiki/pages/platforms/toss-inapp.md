# 토스 인앱

토스 앱의 WebView에서 앱인토스 미니앱 `내 OTT 타임라인`을 제공한다. 2026-05-18 재검토 승인 후 출시했다. 토스 앱 안에서는 `intoss://ottline`으로 열 수 있다. [공개 링크](https://minion.toss.im/XYvjpUB2)

## 소스와 출시

| 항목 | 기준 |
| --- | --- |
| 운영 빌드 소스 | [별도 배포 브랜치 `chore/toss-inapp-current-release-20260517`](https://github.com/chawon/ott/tree/8bfb63190e84e9e549e0d99f78d3ffe5a6423665/apps/web) |
| 빌드 | `apps/web/granite.config.ts`의 WebView 설정과 `npm run build:next-ait` 정적 export를 사용한다. 토스 제출 산출물은 `apps/web/ottline.ait`다. |
| SDK 및 API | 운영 브랜치의 `@apps-in-toss/web-framework` 선언 `^2.5.1`, API 주소 `https://ottline.app` |
| 출시 근거 | 2026-05-18 승인·출시 기록 및 공개 링크의 토스 딥링크 확인. 콘솔의 최신 번들 버전과 실기기 동작은 후속 제출 전 확인한다. |

`main`의 웹 배포와 토스의 검토·출시는 별개다. Web v2를 이식할 경우 실제 서비스 중인 토스 번들을 먼저 대조하고 정적 빌드, 페어링 코드 기기 연결, 빠른 기록, 이미지 저장 및 텍스트 공유를 토스 앱에서 검증한다.

## 미니앱에서 확인할 동작

- 앱인토스 환경에서는 PWA 설치 안내와 서비스워커 등록을 건너뛴다.
- 토스 브리지로 공유 카드 이미지를 기기에 저장하고, 공유 버튼은 텍스트 공유를 사용한다.
- 정적 페이지에서 API를 호출할 때는 `https://ottline.app/api/…`를 사용한다. 운영 API 계약이나 페어링 방식 변경 시 현재 공개 번들과 새 번들 양쪽에서 확인한다.

[초기 검수 및 출시 이력](../../archive/toss-inapp-launch-2026.md) · [앱인토스 개발자 센터](https://developers-apps-in-toss.toss.im)
