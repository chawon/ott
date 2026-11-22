# 출시 채널 기준 Web 서비스 소개·가이드 정리

## 사용자 문제와 완료 조건

2026-11-22 사용자가 macOS·iOS·iPadOS 출시 완료를 확인했지만 공개 서비스 소개에는 macOS가 없고 iOS 안내는 iPhone만 설명했다. 한국어·영어 `/about`에 macOS와 iPhone·iPad 지원을 반영하고 `/guide`에서 기록 연결 코드로 기기를 이어 쓰는 방법을 안내한다. 같은 날 사용자가 미운영 ChatGPT 안내를 서비스 가이드에서 제외하도록 요청해 같은 카드·PR의 범위를 확장했다.

- [프로젝트 카드와 배포 후 완료 조건](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827749)
- 작업 브랜치 `feat/web-apple-launch-guides-20261122`. 최초 기준 main `4664791`, 추가 안내 정리 기준 main `1d9d4ea`.
- [PR #151](https://github.com/chawon/ott/pull/151)은 최종 SHA `c693fd8`에 병합했다. 운영 Web 배포와 공개 페이지의 현재 확인은 [통합 운영 반영 기록](../web-api-rollout-2026-11-22.md)을 따른다. Mac 스토어 설치판·Safari/Chrome 연결과 실제 설치형 PWA 검증은 별도다.

## 공통 계약

- 서비스 소개에서 미운영 ChatGPT 카드·준비 중 설명과 관련 번역을 제외한다. 같은 소개 문구를 쓰는 본문·메타데이터·SoftwareApplication 설명에서 함께 사라지도록 정리한다. 관련 KO/EN 가이드에 별도 연결/설치 안내가 없는지도 확인한다.
- 이 작업은 공개 서비스 소개·가이드의 노출 범위만 바꾼다. `/chatgpt` 직접 경로, sitemap/색인 경계, 기존 OAuth/MCP·리뷰 경로·제출 자산과 읽기 전용 계약은 유지한다. root README 정리는 본부가 별도 처리한다.
- 동일 App Store 앱 ID `6780318110`에서 iPhone·iPad와 macOS 설치 링크를 구분한다. Mac 링크에만 `platform=mac`을 명시하고 공용 `localizedStoreUrls()`에서 한국어·영어 URL을 관리한다.
- SoftwareApplication 구조화 데이터의 지원 OS와 설치 URL에 iPadOS·macOS를 반영한다. 소개와 가이드 목록의 sitemap 수정일은 실제 변경일인 2026-11-22를 사용한다.
- 기록 연결은 기존 `내 공간`의 연결 코드 흐름을 설명한다. API·동기화·브라우저 저장소·기록 데이터와 스토어 바이너리 변경은 없다.
- 기존 Android·Windows의 스토어 유입 정책과 이벤트 계약을 유지한다. macOS 카드는 iPhone·iPad와 같은 명시적 외부 스토어 링크이며, 신규 설치 배너·자동 앱 열기 분기는 [Mac 설치판 검증](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827720)에서 별도로 확인한다.

## 플랫폼별 반영

| 대상 | 변경과 소스 | 검증과 상태 |
| --- | --- | --- |
| Web/PWA | [About](../../apps/web/app/[locale]/about/page.tsx), [Guide](../../apps/web/app/[locale]/guide/page.tsx), [가이드 문구](../../apps/web/lib/guides.ts), 한·영 메시지, [스토어 URL](../../apps/web/lib/store-acquisition.mjs), [SEO](../../apps/web/lib/seo.ts), [sitemap](../../apps/web/app/sitemap.ts) | 로컬 검증·최종 CI 성공 후 `c693fd8`로 운영 배포했다. 운영 화면 근거와 남은 설치판 조건은 [통합 기록](../web-api-rollout-2026-11-22.md)을 따른다. |
| ChatGPT | 공개 소개의 미운영 안내만 제외. 기존 직접 경로·OAuth/MCP·리뷰 자료/계약 보존 | 관련 소스와 기존 SEO 공개 경계를 확인. 서비스 재개/중단이나 API 변경 작업이 아님 |
| iOS·iPadOS·macOS | 출시 플랫폼과 연결 코드 안내의 출처. 해당 앱 소스와 바이너리는 변경하지 않음 | 현재 SwiftUI `내 공간`의 연결 코드 표시·입력 소스와 안내를 대조. Mac App Store 설치판의 Safari·Chrome 연결 확인은 macOS 담당 업무 |
| API·Android·Windows·확장·토스 | 기존 동작·계약 보존. 확장 안내에서 종료된 ‘Mac App Store 출시 후’ 문구만 제거 | 스토어 유입 정책 18개 통과. 별도 출시 없음 |

## 검증 결과

기존 `fa669ec`의 [CI 성공](https://github.com/chawon/ott/actions/runs/44982769889)은 Apple 안내 추가의 이전 근거다. ChatGPT 안내 제외는 변경 후 별도 빌드·KO/EN 공개 소개/가이드 회귀·CI로 확인하며 그 결과는 같은 프로젝트 카드에 남긴다.

- SEO 계약 20개, Android·Windows 스토어 유입 정책 18개, TypeScript, 변경 파일 Biome, Next.js production 빌드 통과.
- 기존 SEO runtime 검사로 공개 URL 19개·개인 경로 14개·가이드 Article 6개·이미지 7개를 확인했다. 소개의 iPhone·iPad/Mac 스토어 링크와 2026-11-22 수정일도 확인했다.
- 격리 Chromium에서 KO/EN × 390/1440px 4조건의 macOS·iPhone·iPad 카드, Mac 스토어 `platform=mac`, 지원 OS·설치 URL 구조화 데이터, 가이드 → 소개 플랫폼 영역 탐색, 가로 넘침 없음, 페이지 오류 0을 확인했다.
- ChatGPT 안내 제외 후 SEO 20개·스토어 정책 18개·타입 포함 production build·Biome을 다시 통과했다. 기존 SEO runtime의 소개·가이드 총 10개 KO/EN URL에서 공개 본문/메타데이터·JSON-LD의 ChatGPT 안내 부재를 추가 검증했고 공개 19/개인 14·Article 6·이미지 7 경계를 유지했다.
- 변경 후 Chromium KO/EN × 390/1440px 4조건에서 소개·가이드 목록·개별 가이드의 본문/메타/JSON-LD·링크에 ChatGPT 안내가 없고, Mac·iPhone·iPad 카드와 스토어 URL·연결 가이드 탐색이 정상임을 확인했다. `/chatgpt`·OAuth/MCP·리뷰 자산·sitemap은 기존 `fa669ec` 대비 소스 차이가 없다. 캡처는 `/tmp/ott-web-apple-guides-no-chatgpt-20261122`에 있다.
- 외부 네트워크와 실제 계정 API를 차단한 로컬 fixture로 검증했다. 실제 Safari·Chrome의 스토어 설치/미설치 앱 열기나 실제 설치형 PWA 업데이트를 검증한 결과로 간주하지 않는다.

## 출시와 복구

Web 전용 변경으로 PR·CI 검토 후 병합 SHA를 고정해 수동 배포한다. 공개 `/about`, `/en/about`, `/guide`, `/en/guide`와 sitemap·스키마를 다시 확인한 뒤 카드의 배포 조건을 갱신한다. 로컬 데이터·API 스키마 변경이 없어 Web 이전 이미지로 복구할 수 있다. PR·CI 실행 링크와 검증 SHA는 프로젝트 카드에서 추적한다.
