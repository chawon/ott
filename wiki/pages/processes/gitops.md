# GitOps 운영 가이드

> OKE(Oracle Kubernetes Engine) + ArgoCD 기반 GitOps 배포 자동화

## 관련 페이지
- [[staging]]
- [[security]]

---

## 시스템 개요

- **인프라:** Oracle Cloud Infrastructure (OCI) Kubernetes Engine (OKE)
- **배포 방식:** ArgoCD GitOps — `deploy/oke` 폴더가 Source of Truth
- **아키텍처:** ARM64 (Ampere A1), GitHub Actions `ubuntu-24.04-arm` 러너

---

## CI/CD 흐름

```
코드 수정 → git push (main)
    → GitHub Actions (ARM64 Runner)
        → Docker 이미지 빌드 (linux/arm64)
        → OCIR 푸시
        → deploy/oke/*.yaml 이미지 태그 업데이트 → git push
    → ArgoCD 감지 → OKE 클러스터 동기화
```

---

## 워크플로우

| 파일 | 트리거 | 동작 |
|---|---|---|
| `deploy-web.yml` | `apps/web/**` 또는 `shared/**` 변경 | Web 이미지 빌드 → OCIR 푸시 → `web-deployment.yaml` 태그 업데이트 |
| `deploy-api.yml` | `apps/api/**` 또는 `shared/**` 변경 | API 이미지 빌드 → OCIR 푸시 → `api-deployment.yaml` 태그 업데이트 |

> `deploy/` 폴더 내 파일 수정은 CI를 트리거하지 않음 (무한 배포 루프 방지)

---

## 시크릿 관리

- **OCI Vault + ESO (External Secrets Operator):** API 서버 시크릿 관리
- 시크릿 값 변경 시 ESO가 최대 1시간 내 자동 반영
- 즉시 반영: `kubectl annotate externalsecret ott-api-secrets -n ott force-sync=$(date +%s) --overwrite`
- 비밀이 아닌 설정값은 `deploy/oke/api-deployment.yaml`에 직접 env로 관리
- ESO 파일: `deploy/oke/external-secret.yaml`

**ESO 주의사항:** InstancePrincipal 인증 방식 사용. `auth` 블록 명시 없음.

---

## 문제 대응

| 상황 | 대응 |
|---|---|
| GitHub Actions 실패 | Actions 탭에서 npm build / docker push 오류 확인 |
| Git Push 충돌 | `git pull --rebase` 로직이 자동 해결 시도 |
| CrashLoopBackOff | `kubectl logs -n ott <pod-name>` — DB 연결/환경변수 확인 |
| 롤백 | `git revert`로 이전 커밋 복원 → ArgoCD가 이전 이미지로 자동 롤백 |

`revisionHistoryLimit: 3` — 클러스터 내 최근 3개 버전만 보관

---

## 서비스/인프라 주소

- **서비스:** `https://ottline.app`
- **ArgoCD 대시보드:** `https://argocd.preview.pe.kr`

> ArgoCD 자격증명은 코드 리뷰에서 GitOps_Guide.md에 평문 노출 발견됨 → 즉시 변경 필요 [[security]]
