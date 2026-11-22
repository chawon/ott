# AGENTS.md

<!-- omd:start v=1 hash=be71c8d154c9 -->
## Design System (oh-my-design)

**Before any UI, styling, copy, or motion change, open and read `./DESIGN.md` in full.** It is the authoritative brand/design spec. Treat its tokens, voice, and component rules as binding unless the user overrides in chat.

If present, read `./.omd/preferences.md` — pending corrections not yet folded into DESIGN.md. Apply them; flag conflicts.
<!-- omd:end -->

## 지침과 작업 인계

Codex와 Google Antigravity(`agy`)는 저장소 루트의 이 파일을 읽는다. Claude Code는 [CLAUDE.md](CLAUDE.md)에서 같은 파일을 불러온다. 세 도구에서 ottline 저장소 루트를 열어 작업한다.

- 작업을 이어갈 때는 [v2 후속 작업](docs/changes/v2-follow-up.md)과 해당 변경안의 최신 브랜치·PR·검증 결과를 확인한다. 사용자가 요청한 작업과 플랫폼 범위에서 진행한다.
- 새 업무의 원문은 저장소 GitHub Issue로 등록하고 Project V2에 연결한다. Project 접근 권한이 없는 담당자는 이슈 본문·댓글·연결 문서로 진행하며, 본부가 프로젝트 상태·담당·우선순위를 갱신한다. 기존 Draft 카드는 중복 이슈를 만들기 전에 본부가 확인하고 전환한다. 공개 이슈에는 비공개 통계·개인별 활동·접속 정보를 복제하지 않는다.
- Wiki를 편집할 때는 [Wiki 지침](wiki/AGENTS.md)을 먼저 읽는다.
- 다른 도구로 작업을 넘길 때는 해당 변경안에 작업 브랜치와 기준 커밋, 완료한 검증, 남은 실기기·출시 확인을 남긴다.

## 역할

이 저장소는 ottline의 플랫폼 간 변경을 설계하고 조율하는 곳이다. 공유 API와 합의된 플랫폼별 구현을 관리한다. 출발점은 [문서 지도](docs/README.md)다.

지속 개선은 [제품 기획 운영](docs/product-planning.md)을 따른다. 제품 기획 담당은 사용자 문제·개선안·성공 지표와 [공통 기능/플랫폼 차이](docs/feature-matrix.md)를 관리하고, 관리 본부는 우선순위·담당·의존성·출시 순서·완료 근거를 관리한다. 플랫폼/API 담당은 구현·PR·테스트·릴리스를 맡는다. 프로젝트의 `플랫폼`은 서비스 대상, `담당 역할`은 제품 기획·본부·플랫폼 담당 등 업무 책임을 뜻한다.

마케팅 담당은 [마케팅 운영](docs/marketing-operations.md)에 따라 대상·채널·메시지·출시 안내와 유입→첫 기록→반복 이용의 측정·실험을 관리한다. 제품·화면·계측 변경은 기획·본부와 조율해 각 구현 담당에게 연결하고, 실제 지원 기능·출시 상태와 공개 안내를 맞춘다.

- [플랫폼 현황](docs/platforms.md)에서 소스 위치, 개발 브랜치, 공개 버전과 전환 경로를 확인한다. 작업 중인 브랜치와 CI, 스토어 제출, 공개 출시는 각각 근거를 남긴다.
- 기능·제품 정책·공통 데이터 계약을 바꾸는 작업은 [변경안 양식](docs/changes/README.md)으로 목표와 플랫폼별 영향을 기록한다. 같은 사용자 동작이 필요한 플랫폼과 별도 출시가 필요한 플랫폼을 명시한다.
- 공통 목표와 현재 반영 상태를 구분하고, 플랫폼 차이는 허용된 차이·추가 반영 필요·확인 필요·종료 이행 중으로 기록한다. 차이의 사유·담당·추적 카드·재검토 조건을 연결한다. 소규모 수정은 기존 이슈/PR에 같은 항목을 남겨도 된다.
- 현재 코드와 운영 증거를 우선한다. [공통 API와 데이터 계약](docs/product-contracts.md)은 계약 요약, [Wiki](wiki/index.md)는 기능·플랫폼별 탐색, [아카이브](docs/archive/README.md)는 과거 의사결정과 검증 기록이다. 같은 계약 전문을 여러 위치에 복제하지 않는다.
- 설계·문서 정리 요청에서는 구현 또는 배포 승인 단계를 따로 다룬다. 요청된 작업 범위에서 결정, 변경, 검증 근거를 연결한다.

## 제품과 호환성

- ottline의 중심은 영상·책 기록, 회상, 공유다. 공개 동작과 문구는 한국어·영어를 함께 검토한다.
- 사용자용 개별 기록 삭제는 제공하지 않는다. 수정 이력을 보존하고, 이 기기 초기화와 서버 계정 데이터 전체 삭제는 구분한다.
- 개인 프로필은 페어링 계정의 개인화 정보다. 공개 글과 댓글에 프로필을 자동 노출하지 않는다. 기존 추천 기능의 계약은 [미래의 타임라인 정책](docs/future-timeline-account-policy.md)을 따른다.
- 로그·작품·기기 계약을 바꿀 때 이미 설치된 앱과 기존 기록/판본 ID, 페어링과 인플레이스 업데이트를 확인한다. 새 값·필드는 단계적으로 적용하고, 응답 변경 시 이전 바이너리의 파싱과 동기화를 검증한다.
- 로컬 우선 클라이언트에서는 로컬 저장, outbox, 서버 push/pull, 재시도와 중복 방지를 확인한다. DB 변경은 Flyway 경로와 롤백 범위를 함께 검토한다.
- 구형 Android TWA 및 Windows Store PWA 사용자에게는 기존 계정·미동기화 기록의 복구 경로가 남아 있다. [Android 전환](docs/android-native-v2-transition.md), [Windows 전환](docs/windows-native-v2-transition.md), [데스크톱 연결](docs/desktop-protocol-and-extension-bridge-plan-2026-11-18.md)을 확인한다.

## 작업과 배포

- 작업을 시작할 때 현재 브랜치와 변경사항을 확인한다. 관련 없는 변경이 있으면 전용 브랜치와 worktree를 사용한다. 코드·워크플로우 변경은 PR로 검토한다. 문서 전용 변경은 작업트리와 diff를 확인한 뒤 main에 직접 반영할 수 있다.
- 변경한 플랫폼의 패키지 스크립트 또는 CI로 검증한다. 공통 기록 변경은 생성·수정·이력·동기화와 오프라인 재시도를 확인한다. 신규/기존 설치, 앱 전환, 시스템 기능은 관련 플랫폼에서 직접 확인하고 남은 검증을 기록한다.
- Web/API 운영 이미지 배포는 병합 SHA를 고정한 수동 워크플로우다. API 의존 변경은 API → 실제 API 확인 → 동일 SHA의 Web 순으로 진행한다. 실행 이미지·`APP_VERSION`·Pod 준비 상태와 실제 기능을 함께 확인한다.
- `deploy/oke/`는 main의 변경이 Argo CD로 자동 동기화된다. 앱 코드와 운영 설정 변경의 적용 시점을 각각 검토한다. 시크릿 값은 출력하거나 커밋하지 않는다. 절차는 [배포 운영 가이드](docs/staging-environment-plan.md)를 따른다.
- 검증을 마치면 변경안, 영향을 받은 Wiki, 플랫폼 현황 중 달라진 내용을 업데이트한다. 코드·빌드·배포와 실사용 검증의 상태를 각각 기록한다.
