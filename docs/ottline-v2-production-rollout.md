# ottline v2 운영 배포

2026-11-08 사용자 배포 요청으로 API와 Web/PWA 운영 전환을 완료했다. Android 네이티브·iOS·스토어 패키지 제출은 별도다. 기존 작업 경로와 개발 데이터는 보존했다.

## 배포 기준

- 기능 코드는 PR #125, main `19710548cddccb3b7ce5bd0a467cc06447f0eefb`다. API 169개 검사와 Web 컨테이너·브라우저 CI가 통과했다.
- 배포 준비 브랜치는 `release/ottline-v2-production-20261108`이다. OpenAI 서버 환경변수·ExternalSecret 선언과 전송 안내 문구를 함께 검토한다.
- 운영 Vault 키는 `ott-openai-secrets`에 동기화됐고, 실제 키로 `gpt-6-luna` 모델 조회 HTTP 200을 확인했다. 값은 출력하거나 소스에 넣지 않는다.
- 추천 전송 범위와 생성·횟수 정책은 유지한다. 버튼 앞과 한·영 개인정보처리방침에서 실제 항목과 목적을 안내한다.

## 데이터 보존과 사전 검증

- 운영 PostgreSQL은 16.11, 배포 전 Flyway는 V31이다. V32는 추천 계정 상태·결과·생성 요청·제외 작품의 테이블 4개만 추가한다.
- 전용 임시 PostgreSQL 클라이언트를 읽기 전용 설정으로 실행해 운영 DB를 custom archive로 백업했다. 백업은 Git에서 제외된 `.recovery/ottline-v2/production-backups`에 권한을 제한해 보관한다.
- `pg_restore --list`의 필수 테이블과 전체 archive 파싱을 확인했다. 실행 중인 개발 DB에 복원하지 않았다. 복구가 필요하면 별도 대상 DB를 확인하고 `pg_restore --no-owner --no-acl --dbname=<target> <archive>`를 사용한다.
- API Deployment와 ExternalSecret은 Kubernetes server dry run을 통과했다. `deploy/oke`는 main에서 ArgoCD가 자동 동기화하므로 설정 PR 머지 시 API 설정도 적용된다.

## 순서와 검증

1. 배포 준비 PR의 Web CI와 API 소스가 검증된 기능 코드와 같은지 확인하고 머지한다. 해당 main의 전체 SHA를 API/Web의 공통 배포 입력으로 고정한다.
2. OpenAI 환경변수·SecretSynced와 API readiness를 확인한 뒤 `deploy-api-production.yml`을 실행한다.
3. V32, 실제 이미지·APP_VERSION·Pod Ready와 API 응답을 확인한다. 검색·기록·수정·동기화·기기 연결·추천은 별도 테스트 계정으로 확인하고 마친 뒤 그 계정만 정리한다. 기존 공개 이야기에는 테스트 댓글을 게시하지 않는다.
4. API 확인 후 `deploy-web-production.yml`에 같은 SHA를 입력한다. 실제 버전·새 CI·기록 버튼·한영 전송 안내·공유 카드·리포트·PWA 캐시를 확인한다.
5. ArgoCD Synced/Healthy와 API/Web Pod 상태를 다시 확인하고 임시 검증 리소스를 정리한다. 실제 배포 결과와 워크플로우 번호는 아래에 기록한다.

## 되돌리기

배포 전 API/Web 이미지와 APP_VERSION은 `98417a9f22079e17650b6f1d2dfd2c022c5afd30` / `98417a9`다. 필요하면 이 SHA로 Web을 먼저 되돌리고 API를 되돌려 새 웹이 이전 API를 호출하는 구간을 줄인다. V32 테이블과 사용자 기록·제외·사용 횟수는 삭제하지 않는다. DB 복구는 이미지 롤백과 구분한다.

## 결과

- 배포 완료 SHA: `b9f88a6d5f329ffa1bfaea4dacc3b7be8bfb3022` / `APP_VERSION=b9f88a6`.
- [API production 42481109076](https://github.com/chawon/ott/actions/runs/42481109076) 완료 후 실제 API 확인을 거쳐 [Web production 42482058132](https://github.com/chawon/ott/actions/runs/42482058132)를 같은 SHA로 완료했다. Web의 운영 버전 확인과 IndexNow 단계도 성공했다.
- 운영 manifest commit은 API `64a485b8e317ad77bb7693786b5c2065a18c2e3f`, Web `182c4e959d6e08b4ab7b129ee92b646e742fea84`다. ArgoCD는 Synced/Healthy, 두 Pod는 Ready 1/1·restart 0이며 실제 이미지와 버전이 배포 SHA와 일치한다.
- Flyway V32와 추천 테이블 4개를 확인했다. 테스트 계정 정리 후 기존 기록 568개·변경 이력 983개는 배포 전과 같고 해당 테스트 사용자의 기록·추천·횟수 데이터는 0개다.
- KO Kakao·EN Google Books, TMDB 검색·인기 작품 조회가 실제 운영 API에서 성공했다. 전용 계정의 기록 생성·수정·이력, 커서 페이지, push/pull, 두 번째 기기 연결·조회·해제, 빈/유효 리포트를 확인했다.
- 실제 OpenAI 추천은 6개 → 제외 후 5개 → 재생성 후 6개를 확인했다. 제외 항목과 횟수는 기기 간 공유됐고, 되돌리기는 횟수를 차감하지 않으며, 성공 3회 뒤 네 번째 생성은 429였다. 동일 요청 재시도도 추가 차감하지 않았다.
- 운영 웹을 직접 연결한 브라우저에서 모바일 390px·PC 1440px의 팝업 높이, 상태 선택과 저장 분리, 하단 버튼, 전송 안내와 정책 이동을 확인했다. 실제 저장 후 로컬 기록이 정식 서버 ID로 정리되고 outbox가 0개가 됐다. 공개 댓글은 게시하지 않았다.
- 운영 웹의 공유 카드 렌더 경로에서 HTTP 200과 1080×1920 PNG 생성을 확인했다. 카드는 검증용 로컬 파일로만 보관했다.
- 검증 호스트와 서버의 약 5초 시각 차이로 직접 API 수정 직후 전송한 요청은 stale 정책에 따라 거절됐다. 최신 서버 revision을 받아 재전송하는 경로를 검증했다. 브라우저의 실제 저장·동기화는 별도로 통과했다.
- WSL의 운영 도메인 자동 요청은 Cloudflare 403이어서 화면·기능 검사는 운영 Pod 연결로 수행했다. GitHub 배포 워크플로우의 공개 버전 확인은 통과했다. 실제 설치형 PWA·네이티브 앱의 실기기 업데이트 검증은 플랫폼별 후속 항목이다.
- DB 백업과 검증 근거는 권한을 제한한 Git 제외 경로 `.recovery/ottline-v2/production-backups`, `.recovery/ottline-v2/production-smoke`에 보관한다. 테스트 계정과 임시 DB 클라이언트는 정리했다.
