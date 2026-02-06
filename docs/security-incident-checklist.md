# 보안 사고 대응 체크리스트 (Public Repo Secret 노출)

## 1) 즉시 접근 차단 (당일)
- [ ] `TMDB_ACCESS_TOKEN` 재발급 후 기존 토큰 폐기
- [ ] `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET` 재발급 후 기존 비밀 폐기
- [ ] DB 계정 비밀번호 변경
- [ ] 가능하면 신규 DB 사용자 발급 후 애플리케이션 계정 전환
- [ ] OCIR Auth Token 재발급 후 기존 토큰 폐기
- [ ] ArgoCD `admin` 비밀번호 즉시 변경
- [ ] 가능하면 ArgoCD `admin` 비활성화 및 운영 전용 계정/RBAC 전환

## 2) 운영 반영 전 안전장치
- [ ] ArgoCD `Auto-Sync` 일시 중지
- [ ] 새 시크릿 값을 클러스터에 먼저 적용
- [ ] API/Web 순차 롤링 재시작 (`rollout restart`)
- [ ] 헬스체크 확인 (`/actuator/health`, 주요 페이지 접속, 기록 저장/동기화)
- [ ] 문제 없으면 ArgoCD `Auto-Sync` 재활성화

## 3) 저장소 정리 (Git + 파일)
- [ ] Git 추적에서 평문 시크릿 제거
- [ ] `deploy/oke/api-secret.yaml` 평문 값 제거(템플릿화 또는 Git 제외)
- [ ] `deploy/oke/registry-secret.yaml` 제거 또는 암호화 방식으로 전환
- [ ] `apps/api/src/main/resources/application-local.yaml` 하드코딩 토큰 제거
- [ ] `docs/GitOps_Guide.md` 등 문서 내 계정/비밀번호 제거
- [ ] `git filter-repo` 또는 BFG로 Git 히스토리 내 비밀 문자열 제거
- [ ] 원격 강제 푸시 후 팀원 재클론 공지

## 4) 사후 검증
- [ ] GitHub/OCI/DB/ArgoCD 접근 로그에서 이상 징후 확인
- [ ] 비정상 로그인/대량 조회/의심 배포 이력 점검
- [ ] 회전된 키가 실제로만 사용되는지 최종 확인
- [ ] 대응 완료 시각과 담당자 기록

## 5) 재발 방지
- [ ] Git에는 시크릿 절대 커밋 금지 원칙 확정
- [ ] 시크릿 관리 방식 전환
- [ ] 옵션 A: External Secrets + Vault
- [ ] 옵션 B: Sealed Secrets
- [ ] CI에 시크릿 스캔 도입 (`gitleaks` 등)
- [ ] PR 단계에서 시크릿 탐지 시 머지 차단

## 참고
- Public 저장소에 노출된 시크릿은 외부 수집(크롤링/봇 스캔) 가능성이 높으므로, 노출 시점부터 유출로 간주하고 회전하는 것을 기본 원칙으로 한다.
