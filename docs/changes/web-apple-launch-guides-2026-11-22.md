# Apple 출시 후 Web 서비스 소개·가이드 반영

## 사용자 문제와 완료 조건

2026-11-22 사용자가 macOS·iOS·iPadOS 출시 완료를 확인했지만 공개 서비스 소개에는 macOS가 없고 iOS 안내는 iPhone만 설명했다. 한국어·영어 `/about`에 macOS와 iPhone·iPad 지원을 반영하고 `/guide`에서 기록 연결 코드로 기기를 이어 쓰는 방법을 안내한다.

- [프로젝트 카드와 배포 후 완료 조건](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827749)
- 작업 브랜치 `feat/web-apple-launch-guides-20261122`, 기준 main `4664791`
- 구현은 검증 후보이며 운영 Web 배포와 Mac 스토어 설치판 검증은 남아 있다.

## 공통 계약

- 동일 App Store 앱 ID `6780318110`에서 iPhone·iPad와 macOS 설치 링크를 구분한다. Mac 링크에만 `platform=mac`을 명시하고 공용 `localizedStoreUrls()`에서 한국어·영어 URL을 관리한다.
- SoftwareApplication 구조화 데이터의 지원 OS와 설치 URL에 iPadOS·macOS를 반영한다. 소개와 가이드 목록의 sitemap 수정일은 실제 변경일인 2026-11-22를 사용한다.
- 기록 연결은 기존 `내 공간`의 연결 코드 흐름을 설명한다. API·동기화·브라우저 저장소·기록 데이터와 스토어 바이너리 변경은 없다.
- 기존 Android·Windows의 스토어 유입 정책과 이벤트 계약을 유지한다. macOS 카드는 iPhone·iPad와 같은 명시적 외부 스토어 링크이며, 신규 설치 배너·자동 앱 열기 분기는 [Mac 설치판 검증](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827720)에서 별도로 확인한다.

## 플랫폼별 반영

| 대상 | 변경과 소스 | 검증과 상태 |
| --- | --- | --- |
| Web/PWA | [About](../../apps/web/app/[locale]/about/page.tsx), [Guide](../../apps/web/app/[locale]/guide/page.tsx), [가이드 문구](../../apps/web/lib/guides.ts), 한·영 메시지, [스토어 URL](../../apps/web/lib/store-acquisition.mjs), [SEO](../../apps/web/lib/seo.ts), [sitemap](../../apps/web/app/sitemap.ts) | 로컬 production 빌드·한국어/영어·390/1440px 검증 통과. 공개 Web 배포 후 확인 대기 |
| iOS·iPadOS·macOS | 출시 플랫폼과 연결 코드 안내의 출처. 해당 앱 소스와 바이너리는 변경하지 않음 | 현재 SwiftUI `내 공간`의 연결 코드 표시·입력 소스와 안내를 대조. Mac App Store 설치판의 Safari·Chrome 연결 확인은 macOS 담당 업무 |
| API·Android·Windows·확장·토스 | 기존 동작·계약 보존. 확장 안내에서 종료된 ‘Mac App Store 출시 후’ 문구만 제거 | 스토어 유입 정책 18개 통과. 별도 출시 없음 |

## 검증 결과

- SEO 계약 20개, Android·Windows 스토어 유입 정책 18개, TypeScript, 변경 파일 Biome, Next.js production 빌드 통과.
- 기존 SEO runtime 검사로 공개 URL 19개·개인 경로 14개·가이드 Article 6개·이미지 7개를 확인했다. 소개의 iPhone·iPad/Mac 스토어 링크와 2026-11-22 수정일도 확인했다.
- 격리 Chromium에서 KO/EN × 390/1440px 4조건의 macOS·iPhone·iPad 카드, Mac 스토어 `platform=mac`, 지원 OS·설치 URL 구조화 데이터, 가이드 → 소개 플랫폼 영역 탐색, 가로 넘침 없음, 페이지 오류 0을 확인했다.
- 외부 네트워크와 실제 계정 API를 차단한 로컬 fixture로 검증했다. 실제 Safari·Chrome의 스토어 설치/미설치 앱 열기나 실제 설치형 PWA 업데이트를 검증한 결과로 간주하지 않는다.

## 출시와 복구

Web 전용 변경으로 PR·CI 검토 후 병합 SHA를 고정해 수동 배포한다. 공개 `/about`, `/en/about`, `/guide`, `/en/guide`와 sitemap·스키마를 다시 확인한 뒤 카드의 배포 조건을 갱신한다. 로컬 데이터·API 스키마 변경이 없어 Web 이전 이미지로 복구할 수 있다. PR·CI 실행 링크와 검증 SHA는 프로젝트 카드에서 추적한다.
