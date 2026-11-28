# AGENTS.md

<!-- omd:start v=1 hash=be71c8d154c9 -->
## Design System (oh-my-design)

**Before any UI, styling, copy, or motion change, open and read `./DESIGN.md` in full.** It is the authoritative brand/design spec. Treat its tokens, voice, and component rules as binding unless the user overrides in chat.

If present, read `./.omd/preferences.md` — pending corrections not yet folded into DESIGN.md. Apply them; flag conflicts.
<!-- omd:end -->

이 저장소에서 ottline의 Web/PWA·공통 API와 네이티브 앱의 변경을 조율한다. Android는 Kotlin/Compose, iPhone·iPad·Mac은 SwiftUI, Windows는 WPF를 쓴다. 소스 위치·공개 버전·이전 설치판 복구 경로는 [플랫폼 현황](https://github.com/chawon/ott/blob/main/docs/platforms.md)에서 확인한다.

## 작업 시작

- `git status -sb`로 브랜치와 기존 변경을 확인한다. 코드·워크플로는 전용 브랜치와 PR로 반영하고, 다른 작업이 있으면 worktree를 분리한다. 문서만 바꿀 때는 `git diff --check` 후 `main`에 직접 반영할 수 있다.
- 새 업무는 저장소 이슈에 기록한다. 본부는 기획이 발행한 플랫폼 이슈와 요청 댓글도 확인해 프로젝트판의 실행 담당·우선순위·상태를 갱신한다. 비공개 통계와 개인별 활동·접속 정보는 공개 이슈에서 제외한다. [프로젝트판](https://github.com/users/chawon/projects/1) · [역할과 이슈 운영](https://github.com/chawon/ott/blob/main/docs/product-planning.md)
- 기능·정책·공통 API를 바꿀 때는 영향받는 플랫폼과 완료 조건을 적는다. 작은 수정은 기존 이슈나 PR에 기록한다. [기능 기준표](https://github.com/chawon/ott/blob/main/docs/feature-matrix.md) · [변경안 양식](https://github.com/chawon/ott/blob/main/docs/changes/README.md)

## 구현·검증·배포

- 개별 기록은 수정 이력을 남겨 정정한다. 기기 초기화와 서버 계정 전체 삭제를 구분하고, 개인 프로필은 본인 화면에만 표시한다.
- 저장·동기화 변경은 기존 설치판의 페어링·기록 ID 보존과 로컬 저장 → outbox → push/pull 경로를 확인한다. 오프라인 편집과 재시도 때 기록이 누락되거나 중복되는지도 검증한다. [공통 API와 데이터 계약](https://github.com/chawon/ott/blob/main/docs/product-contracts.md)
- 변경한 플랫폼의 테스트·CI를 실행하고 사용자 화면은 한국어·영어로 확인한다. 인계할 때 이슈나 변경안에 브랜치·SHA, 검증 결과, 남은 실기기·출시 확인을 적는다. [실행·테스트 명령](https://github.com/chawon/ott/blob/main/docs/development.md)
- Web/API 운영 이미지는 검증한 `main`의 전체 SHA로 수동 배포한다. Web이 API 변경에 의존하면 API 배포 → 실제 API 확인 → 같은 SHA로 Web 배포 순서를 지킨다.
- `deploy/oke/`는 Argo CD가 `main`에서 자동 반영한다. 배포 후 이미지·`APP_VERSION`·Pod 준비 상태와 실제 기능을 확인한다. 시크릿 값은 로그·커밋에서 제외한다. [배포 절차](https://github.com/chawon/ott/blob/main/docs/staging-environment-plan.md)

출시 상태가 바뀌면 플랫폼 현황을 갱신한다. 상세 이력은 해당 변경안에 남긴다. Wiki 편집 전에는 [Wiki 지침](https://github.com/chawon/ott/blob/main/wiki/AGENTS.md)을 읽는다.
