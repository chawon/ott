# 📝 OKE GitOps 구축 및 운영 가이드

## 1. 시스템 개요

이 프로젝트는 **Oracle Cloud Infrastructure (OCI) Kubernetes Engine (OKE)** 환경에서 운영되며, **ArgoCD**를 통한 **GitOps** 방식으로 배포를 자동화하고 있습니다.

### 주요 특징
*   **GitOps:** GitHub 저장소의 `deploy/oke` 폴더가 진실의 원천(Source of Truth)입니다. ArgoCD가 이 폴더를 감지하여 클러스터 상태를 동기화합니다.
*   **분리 배포 (Split Deployment):** Web(`apps/web`)과 API(`apps/api`)는 서로 다른 GitHub Actions 워크플로우를 통해 독립적으로 빌드되고 배포됩니다.
*   **ARM64 지원:** OKE의 Ampere A1 (ARM64) 노드에서 실행되도록 `linux/arm64` 아키텍처로 도커 이미지를 빌드합니다. GitHub Actions는 **ARM64 호스티드 러너(ubuntu-24.04-arm)** 를 사용합니다.
*   **비용 최적화:** ArgoCD 전용 Load Balancer 없이 기존 Traefik Ingress를 통해 통합 접속(`argocd.preview.pe.kr`)합니다.

---

## 2. CI/CD 아키텍처 흐름도

```mermaid
graph TD
    subgraph "Local Development"
        Dev[👨‍💻 Developer]
        CodeWeb[📝 Web Code]
        CodeAPI[⚙️ API Code]
    end

    subgraph "GitHub Actions (CI)"
        ActionWeb[🚀 Deploy Web Workflow (ARM64 Runner)]
        ActionAPI[🚀 Deploy API Workflow (ARM64 Runner)]
    end

    subgraph "Repositories"
        GitSource[("🐙 GitHub (Source)")]
        GitManifest[("🐙 GitHub (Manifests)")]
        OCIR[("📦 OCIR (Docker Images)")]
    end

    subgraph "OCI Kubernetes Engine (OKE)"
        ArgoCD[("🐙 ArgoCD Controller")]
        PodWeb[("🌍 OTT Web Pod (ARM64)")]
        PodAPI[("⚙️ OTT API Pod (ARM64)")]
    end

    %% Flow
    Dev -->|Push apps/web| CodeWeb
    Dev -->|Push apps/api| CodeAPI
    
    CodeWeb --> ActionWeb
    CodeAPI --> ActionAPI
    
    ActionWeb -->|Build & Push| OCIR
    ActionWeb -->|Update Tag & Push| GitManifest
    
    ActionAPI -->|Build & Push| OCIR
    ActionAPI -->|Update Tag & Push| GitManifest
    
    ArgoCD -- "Watch deploy/oke" --> GitManifest
    ArgoCD -- "Sync" --> PodWeb & PodAPI
```

---

## 3. GitHub Actions 워크플로우

두 개의 독립된 워크플로우 파일이 존재합니다.

1.  **`deploy-web.yml`**:
    *   **트리거:** `apps/web/**` 또는 `shared/**` 폴더 변경 시.
    *   **동작:** Web Dockerfile 빌드 (`linux/arm64`) -> OCIR 푸시 -> `deploy/oke/web-deployment.yaml` 태그 업데이트 -> Git Push.
    *   **러너:** `ubuntu-24.04-arm` (ARM64 호스티드 러너)
    *   **yq:** 러너 아키텍처에 맞는 바이너리 다운로드 (arm64/amd64 자동 선택)

2.  **`deploy-api.yml`**:
    *   **트리거:** `apps/api/**` 또는 `shared/**` 폴더 변경 시.
    *   **동작:** API Dockerfile 빌드 (`linux/arm64`) -> OCIR 푸시 -> `deploy/oke/api-deployment.yaml` 태그 업데이트 -> Git Push.
    *   **러너:** `ubuntu-24.04-arm` (ARM64 호스티드 러너)
    *   **yq:** 러너 아키텍처에 맞는 바이너리 다운로드 (arm64/amd64 자동 선택)

> **주의:** `deploy/` 폴더 내의 파일 수정은 CI를 트리거하지 않도록 설정되어 있습니다 (`paths-ignore` 효과). 이는 무한 배포 루프를 방지하기 위함입니다.

---

## 4. 운영 가이드

### A. 새로운 버전 배포 방법 (Routine Deployment)

개발자는 **소스 코드만 수정하고 푸시**하면 됩니다. 나머지는 자동입니다.

1.  **코드 수정:** `apps/web` 또는 `apps/api` 코드를 수정합니다.
2.  **Git Push:** `main` 브랜치로 푸시합니다.
3.  **자동 배포:**
    *   GitHub Actions가 자동으로 실행되어 이미지를 빌드합니다.
    *   빌드가 성공하면 Manifest 파일(`deploy/oke/*.yaml`)의 이미지 태그가 자동으로 업데이트됩니다.
    *   ArgoCD가 변경 사항을 감지하고 OKE 클러스터의 파드를 교체합니다.

### B. 환경 설정 변경 (Config/Secret)

1.  **ConfigMap/Secret 변경:**
    *   `deploy/oke/web-config.yaml` 또는 `api-secret.yaml`을 수정하고 푸시하면 ArgoCD가 반영합니다.
    *   **Secret 주의:** `api-secret.yaml`에는 실제 DB 접속 정보가 포함되어야 합니다. (플레이스홀더 `<DB_HOST>` 등이 있으면 안 됨)

### C. 문제 발생 시 대응

*   **배포 실패 (GitHub Actions):** Actions 탭에서 로그를 확인합니다. `npm build` 에러나 `docker push` 에러인지 확인하세요.
*   **Git Push 충돌:** Web과 API가 동시에 배포될 경우 `git push` 단계에서 충돌이 날 수 있습니다. 워크플로우에는 `git pull --rebase` 로직이 포함되어 있어 자동으로 해결을 시도합니다.
*   **파드 에러 (CrashLoopBackOff):** `kubectl logs -n ott <pod-name>`으로 로그를 확인하세요. DB 연결 정보나 환경 변수 문제일 수 있습니다.
*   **롤백 (Rollback):**
    *   GitHub에서 문제가 발생하기 전의 커밋으로 `git revert` 합니다.
    *   ArgoCD가 과거 버전의 이미지 태그로 Manifest를 되돌리고, 클러스터도 롤백됩니다.
    *   *참고:* Deployment 설정에 `revisionHistoryLimit: 3`이 적용되어 있어, 클러스터 내에는 최근 3개의 버전만 기록으로 남습니다.

### D. 접속 정보

*   **서비스 주소:** `https://ott.preview.pe.kr`
*   **ArgoCD 대시보드:** `https://argocd.preview.pe.kr`
    *   계정: `admin` / `FZU-8L2G9Thq2nUC`
