# 스테이징 환경

> 비용 절감을 위해 상시 staging namespace는 종료했다. 이 페이지는 과거 staging 링크를 보존하고, 현재 배포 전략을 안내한다.

## 관련 페이지
- [[gitops]]
- [[ottline-branding]]
- [[security]]

---

## 현재 상태

상시 운영 리소스:

```
OKE 클러스터
└── namespace: ott  → ottline.app (프로덕션)
```

종료한 리소스:

- `ott-staging` namespace
- `staging.ottline.app` ingress
- `deploy/oke-staging/*`
- staging 자동 배포 이미지 태그(`staging-{sha}`)

과거 staging DB(`watchlog_staging`)와 Vault secret은 별도 백업/참조 여부를 확인한 뒤 정리한다.

---

## 현재 배포 흐름

```
feature/* → PR/CI → main 머지
    → GitHub Actions workflow_dispatch (main SHA 입력)
    → 프로덕션 이미지 빌드·배포
    → deploy/oke manifest 갱신
    → ArgoCD production 적용
```

### 검증 CI

- `deploy-web.yml`: Next.js build, Dockerfile build 검증
- `deploy-api.yml`: Gradle build, Dockerfile build 검증
- OCIR push와 Kubernetes manifest 갱신은 하지 않는다.

### 프로덕션 수동 배포

1. PR CI 또는 main 검증 워크플로우 성공 확인
2. GitHub Actions → **Deploy Web/API to Production** → `Run workflow`
3. 배포할 main SHA 입력
4. `{sha}` 이미지 빌드 및 `deploy/oke/{web,api}-deployment.yaml` 갱신
5. ArgoCD 자동 적용

---

## On-demand Staging

DB migration, 외부 심사, 위험한 계약 변경처럼 별도 검증 환경이 필요할 때만 임시 staging을 만든다.

원칙:

- main push 자동 배포로 되살리지 않는다.
- 검증 후 namespace, ingress, staging image, staging DB를 함께 정리한다.
- DB 변경은 staging 유무와 관계없이 하위 호환 단계로 나눠 배포한다.

---

## 버전 표시

Footer에는 production 버전만 표시한다.

```
web a1b2c3d · api a1b2c3d
```

- web 버전: K8s Deployment `APP_VERSION` env
- api 버전: `BACKEND_URL/actuator/info`
