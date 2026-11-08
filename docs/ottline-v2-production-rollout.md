# ottline v2 운영 배포

2026-11-08 사용자 배포 요청으로 API와 Web/PWA 운영 전환을 진행한다. Android 네이티브·iOS·스토어 패키지 제출은 별도다. 기존 작업 경로와 로컬 테스트 서버는 보존한다.

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

배포 진행 중. 운영 이미지·마이그레이션·기능 확인 뒤 확정한다.
