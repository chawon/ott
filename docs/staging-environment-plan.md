# Staging 종료 후 배포 운영 가이드

## 현재 구조

상시 staging 환경은 비용 절감을 위해 종료한다. 운영 중인 Kubernetes 환경은 production namespace만 유지한다.

```
OKE 클러스터
└── namespace: ott  → ottline.app (프로덕션)

PostgreSQL (10.0.20.97:5432)
└── DB: watchlog    (프로덕션)

OCIR 이미지 태그 규칙
└── ott-web:{sha}, ott-api:{sha}
```

`deploy/oke-staging/`, `ott-staging`, `staging.ottline.app`, staging 전용 이미지 태그(`staging-{sha}`)는 더 이상 상시 운영하지 않는다. 과거 staging DB(`watchlog_staging`)와 Vault secret은 즉시 삭제 대상이 아니라, 백업/참조 여부를 확인한 뒤 별도로 정리한다.

---

## 배포 흐름

```
feature/* ──PR/CI──→ main ──→ GitHub Actions workflow_dispatch
                                      (main SHA 입력)
                                      ↓
                                production 이미지 빌드
                                      ↓
                         deploy/oke/{web,api}-deployment.yaml 갱신
                                      ↓
                                ArgoCD production 적용
```

### 검증 CI

- 워크플로우: `deploy-web.yml`, `deploy-api.yml`
- 트리거: PR, main push, 수동 실행
- 동작:
  - Web: Next.js build, Dockerfile build 검증
  - API: Gradle build, Dockerfile build 검증
- OCIR push와 Kubernetes manifest 갱신은 하지 않는다.

### 프로덕션 수동 배포

1. PR CI 또는 main 검증 워크플로우 성공을 확인한다.
2. 배포할 main 커밋 SHA를 확인한다.
3. GitHub Actions → **Deploy Web to Production** / **Deploy API to Production** → `Run workflow`
4. `sha` 입력란에 main 커밋 SHA를 붙여넣는다.
5. workflow가 `{sha}` 태그로 이미지를 빌드하고 `deploy/oke/{web,api}-deployment.yaml`을 갱신한다.
6. ArgoCD가 변경 감지 후 production에 적용한다.

---

## GitOps

ArgoCD는 `deploy/oke/`만 production source of truth로 본다.

- production namespace: `ott`
- production route: `ottline.app`
- production manifests: `deploy/oke/*`
- removed always-on staging: `deploy/oke-staging/*`, `ott-staging`, `staging.ottline.app`

---

## 버전 표시

Footer에는 production web/API 버전만 표시한다.

```
web a1b2c3d · api a1b2c3d
```

- web 버전: K8s Deployment의 `APP_VERSION` env
- api 버전: `BACKEND_URL/actuator/info` 호출 결과
- production workflow가 배포 시 `APP_VERSION`을 `{short-sha}` 형식으로 기록한다.

---

## On-demand Staging

큰 DB migration, 외부 심사, 위험도가 높은 UI/계약 변경이 있을 때만 임시 staging을 다시 만든다.

권장 원칙:

1. 임시 namespace와 host를 명시적으로 만든다.
2. 검증이 끝나면 namespace, ingress, staging 전용 이미지, staging DB를 같이 정리한다.
3. staging은 main push 자동 배포로 되살리지 않는다.
4. DB 변경은 staging 유무와 관계없이 expand/contract 방식으로 하위 호환을 유지한다.

---

## 주의사항

- production 직접 배포 전 PR/CI 결과를 확인한다.
- public `curl`은 Cloudflare 정책으로 403이 날 수 있으므로 배포 검증은 GitHub Actions, ArgoCD, in-cluster image/`APP_VERSION`을 우선한다.
- `deploy/oke/registry-secret.yaml`의 OCIR pull secret은 ESO/Vault 전환이 남아 있다.
- staging 이미지가 더 이상 생성되지 않으므로 OCIR 이미지 누적 속도는 줄어든다. 기존 `staging-*` 태그는 live reference가 없음을 확인한 뒤 삭제할 수 있다.
