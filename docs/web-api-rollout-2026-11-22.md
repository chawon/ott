# 2026-11-22 Web·API 통합 운영 반영

## 현재 상태

본부가 Web·API 담당의 다섯 PR을 검토해 main에 병합했다. 최종 애플리케이션 SHA는 `c693fd86f49d5433350ad7e61b2ec53fd9bab055`다. [본부 진행 카드](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313875656)에서 배포와 남은 확인을 관리한다.

최종 SHA의 API·Web CI, API → 실제 계약 확인 → 같은 SHA Web 운영 배포와 실제 운영 Pod 브라우저 14개 검증을 마쳤다. 실제 설치형 PWA, Mac 스토어 설치판, 태블릿 터치·확대는 별도 검증이다.

## 변경 범위

| PR | 변경 |
| --- | --- |
| [#145](https://github.com/chawon/ott/pull/145) | Web 추천 응답 유실·폴링 단절 뒤 상태 조회와 동일 요청 ID 재시도, 계정·언어별 결과 보존 |
| [#150](https://github.com/chawon/ott/pull/150) | 공개 큐레이터 빈 배열 호환, 관리자 인증 후 쓰기 종료, 생성·승인 자동화 제거와 이력 보존 |
| [#151](https://github.com/chawon/ott/pull/151) | KO/EN 서비스 소개·가이드에 macOS·iPhone·iPad 반영, 미운영 ChatGPT 안내 제외 |
| [#152](https://github.com/chawon/ott/pull/152) | iPad·Android 태블릿의 연결 기기 표시, 기존 기기 ID·OS 계열·플랫폼 헤더 보존 |
| [#153](https://github.com/chawon/ott/pull/153) | 함께 상세의 첫 조회·오류 상태, 큰 화면 목록/상세 2단, 큐레이터 UI·조회·이벤트 제거 |

공통 계약은 [API와 데이터 계약](product-contracts.md)을 따른다. `/chatgpt` 직접 경로와 OAuth/MCP·리뷰 자산·색인 경계는 보존한다. Web/API의 이번 변경에는 Flyway·DB 스키마 변경이 없다. 네이티브 앱의 스토어 배포는 각 플랫폼 근거를 따른다.

## 통합 검토와 CI

main `1d9d4ea`에 다섯 PR을 가상 통합한 전체 tree `7051278540baf47afb2eb9c42136ecca86ffc28b`와 실제 병합 SHA의 tree가 완전히 일치했다. 원래 checkout과 다른 담당자의 작업트리는 보존했다.

- 통합본 TypeScript·Next production build와 관리자·SEO·계측·스토어·클라이언트 복구·타임라인/추천 관련 단위 101개 통과.
- 격리 API의 Together KO/EN 22개, 소개/가이드 KO/EN × 390/1440px 4조건, 실제 서비스워커 제어 추천 복구 4개 통과.
- SEO 공개 19·개인 14 경로, Apple 링크·ChatGPT 안내 제외와 기존 MCP 2개 프로토콜의 읽기 전용 계약 유지 확인.
- API 변경은 운영 `7e9913d` 대비 #150·#152뿐이며, 일반 문의·데일리 Telegram 설정/스케줄러와 API 빌드·배포 절차를 보존했다.

| 검증 | 실행 | 결과 |
| --- | --- | --- |
| 최종 SHA API CI | [44985947298](https://github.com/chawon/ott/actions/runs/44985947298) | 성공. PostgreSQL 필수 suite gate·ARM64 이미지·기준 이미지 업그레이드/재시작 데이터 보존 |
| 최종 SHA Web CI | [44985968381](https://github.com/chawon/ott/actions/runs/44985968381) | 성공. 단위·빌드·ARM64 이미지·Together/SEO/저장소/접근성 등 런타임 |
| API production | [44986440444](https://github.com/chawon/ott/actions/runs/44986440444) | 성공. Manifest `e01873b`·실제 이미지/APP_VERSION `c693fd8`·API 확인 완료 |
| Web production | [44986943059](https://github.com/chawon/ott/actions/runs/44986943059) | 성공. Manifest `98b9388`·실제 버전/이미지 `c693fd8`·공개 버전 검증과 IndexNow 성공 |

## 운영 적용과 확인

#150의 `deploy/oke/` 변경은 병합만으로 Argo CD에 적용된다. `CURATOR_AUTOMATION_ENABLED=false`와 승인자 전용 참조 제거를 먼저 반영했으며, 기존 API 이미지가 정상 기동한 `Synced Healthy`·Ready `1/1`을 확인했다. 이후 최종 SHA의 CI 성공을 확인하고 **API → 실제 API 확인 → 같은 SHA Web** 순서로 배포했다.

API·Web Deployment의 이미지 전체 SHA가 모두 `c693fd86f49d5433350ad7e61b2ec53fd9bab055`, `APP_VERSION=c693fd8`, Pod Ready `1/1`·restart `0`이었다. Argo CD `Synced Healthy`·revision `98b9388`, ExternalSecret 4종 `Ready/SecretSynced`를 확인했다. 사용자 재개 후에도 같은 두 이미지·정상 상태를 재확인했다. 시크릿 값은 출력하지 않았다.

운영 API에서 KO/EN `200 []`·`no-store`, 잘못된 관리자 인증의 기존 `400`, 올바른 인증 후 생성/게시/비활성화의 `410`, 보관 목록 GET `200`과 자료 6건을 확인했다. 관리자 쓰기는 존재하지 않는 UUID만 사용했고 일반 Telegram 메시지는 발송하지 않았다.

기기 표기는 SQL로 고립 생성한 QA 계정 1개·기기 3개만 사용해 iPad/iPhone·Android Tablet/Mobile·구형/빈/불명/TV UA 등 13개와 metadata-free touch를 검증했다. 기존 ID·createdAt·다른 기기 정보가 보존됐다. 검증 도구가 메모리의 나노초와 DB의 마이크로초 표기를 문자열로 비교한 오류는 285ns 차이로 재현했고, 정수 기반 DB 정밀도 비교와 회귀 12개로 보완했다. ID/createdAt/OS/browser와 다른 기기의 실제 1µs 변경은 계속 엄격히 검출한다. 앱 소스 변경은 없었다. QA 계정·기기를 ID 한정으로 정리한 뒤 잔여 0·삭제 기기의 `401`을 확인했다.

운영 Web은 실제 새 Pod의 port-forward로 익명 브라우저에서 14개 모두 통과했다. 신고된 KO 꿀알바·EN Dune/Project Hail Mary의 최초 HTML과 desktop/mobile × 직접 진입·카드 클릭·새로고침 18회를 확인했다. 매 단계 가시 상세 영역이 정확히 1개이고 선택 ID·실제 API 제목·댓글 대상/입력 영역이 일치했다. 큰 화면 2단·작은 화면 탐색과 KO/EN 소개·가이드의 Apple 링크·ChatGPT 안내 제외도 통과했다.

실제 browser 공개 API GET 72건과 별도 상세/댓글 기준 GET 18건이 모두 200이었다. 브라우저에 응답을 주입하지 않았고 계정 생성·기록·댓글·반응·추천 생성·analytics 수집을 차단해 전달된 비GET 0, 큐레이터 요청 0, pageerror 0이었다. 시작/종료 버전은 모두 HTTP200 `c693fd8`이었다. 숨겨진 streaming DOM은 0×0·hidden 조상의 근거로 구분했고 실제 가시 영역 중복은 허용하지 않았다.

본부의 공개 도메인 직접 HTTP probe는 Cloudflare403으로 제한됐다. 위 화면 결과는 실제 운영 Pod 경유이며 공개 Cloudflare 브라우저 경유·설치형 PWA·Mac 설치판 결과로 확대하지 않는다. 배포 workflow의 별도 공개 버전 확인과 IndexNow는 성공했다. 새 Web 프록시의 KO/EN 큐레이터 `200 [] / no-store`도 확인했다.

## 데이터 보존

배포 전 DB를 읽기 전용으로 확인한 기준값은 기록 **648**, 수정 이력 **1,094**, 큐레이터 자료 **6**(게시 1·초안 5), 승인 이력 **5**, 감사 이력 **1**, 수신 상태 **1**이며 Flyway 최종 버전은 **32**다. API 배포·QA 정리 후와 16:15 KST 재확인에서 모든 기준값과 계정 1,891개·기기 1,903개가 동일했다. 큐레이터 본문·승인·감사 전체 행 해시도 일치했다. QA fixture는 자신이 만든 ID만 정리했다.

기존 신규 계정 등록에서 고아 기록을 전역 귀속하는 경로를 발견해 [API 후속 #155](https://github.com/chawon/ott/issues/155)로 분리했다. 기준 시점의 고아 기록은 0이다. 이번 운영 QA에서는 `/api/auth/register`를 호출하지 않는다. 기존 사용자 기록에 영향을 줄 수 있는 등록→계정 삭제 조합도 사용하지 않는다.

## 남은 플랫폼 확인

- 실제 설치형 PWA의 독립 창·기존 설치 업데이트·종료/재실행·오프라인 재접속과 추천 횟수 실측은 별도 증거가 필요하다. 서비스워커 제어 브라우저 검증을 설치판 검증으로 처리하지 않는다.
- [Mac 스토어 설치판 연결](https://github.com/users/chawon/projects/1/views/2?pane=issue&itemId=313827720)은 macOS 담당이 Safari·Chrome의 이어받기를 확인한다.
- [기기 표기 #147](https://github.com/chawon/ott/issues/147)은 공개 앱의 실제 기기 목록·기존 ID 확인을 추적한다. Android의 새 Tablet UA는 해당 바이너리의 공개·설치 증거와 구분한다.
- 큐레이터 제거와 큰 화면 2단의 Apple·Windows·Android 설치판 및 토스 공개 번들은 각 플랫폼 카드에서 관리한다.
- Android 첫 설치 가져오기 522는 별도 [#149](https://github.com/chawon/ott/issues/149)다. 이번 Web·API 배포만으로 그 원인 해결을 선언하지 않는다.

## 복구

이전 운영 이미지는 API `7e9913d2177cc5cea6056ab41eb370161b93719d`, Web `4472ad39a88395959187897a51f891cd13bf3e23`다. DB migration은 없으므로 이번 배포에 따른 데이터 복원은 필요하지 않다. API를 이전 이미지로만 되돌리면 큐레이터 공개 피드·관리자 쓰기가 다시 열릴 수 있어 종료 동작을 보존하는 수정 이미지/차단을 먼저 확보해야 한다. 자동화 false 가드는 유지한다.

세부 변경안: [API 큐레이터](changes/api-curator-retirement-2026-11-22.md) · [기기 표기](changes/api-tablet-device-info-2026-11-22.md) · [서비스 안내](changes/web-apple-launch-guides-2026-11-22.md) · [함께 화면](changes/web-together-spread-2026-11-22.md) · [추천 복구](changes/web-recommendation-recovery-verification-2026-11-22.md).
