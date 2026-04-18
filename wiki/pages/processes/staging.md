# 스테이징 환경

> OKE 클러스터 내 별도 namespace + Cloudflare Access로 접근 제한된 검증 환경

## 관련 페이지
- [[gitops]]
- [[ottline-branding]]
- [[security]]

---

## 인프라 구조

```
OKE 클러스터
├── namespace: ott          → ottline.app          (프로덕션)
└── namespace: ott-staging  → staging.ottline.app  (스테이징, Cloudflare Access 제한)

PostgreSQL (10.0.20.97:5432)
├── DB: watchlog           (프로덕션)
└── DB: watchlog_staging   (스테이징)
```

**이미지 태그 규칙:**
- 스테이징: `ott-web:staging-{sha}`, `ott-api:staging-{sha}`
- 프로덕션: `ott-web:{sha}`, `ott-api:{sha}`

---

## 배포 흐름

```
feature/* → PR → main 머지
    → [자동] 스테이징 빌드·배포
    → staging.ottline.app 검증
    → GitHub Actions workflow_dispatch (SHA 입력)
    → 프로덕션 빌드·배포 → ottline.app 반영
```

### 스테이징 자동 배포 (main 머지)
- 이미지 태그: `staging-{full-sha}`
- 업데이트 대상: `deploy/oke-staging/{web,api}-deployment.yaml`
- 완료 후 워크플로우 Summary 탭에 프로덕션 배포용 SHA 출력

### 프로덕션 수동 배포
1. staging 검증 완료
2. GitHub Actions → **Deploy Web/API to Production** → `Run workflow`
3. Summary에서 SHA 복사 입력
4. 새 이미지를 `{sha}` 태그로 빌드 → `deploy/oke/{web,api}-deployment.yaml` 업데이트
5. ArgoCD 자동 적용

### 최근 웹 배포 예시 (2026-04-18)
- 변경 내용: 루트 공유용 OG 이미지를 `public/ottline.png` 기반 `public/og-image.png`로 교체
- 스테이징 웹 배포:
  - run: `24603483718`
  - 배포 SHA: `4c885565b74ba02f9a39736cf990c436791d2748`
  - 결과: 성공
- 프로덕션 웹 배포:
  - run: `24603593210`
  - 입력 SHA: `4c885565b74ba02f9a39736cf990c436791d2748`
  - 결과: 성공

---

## 환경 식별

- 스테이징: 화면 상단 **amber 색 `STAGING` 배너** (`APP_ENV=staging`)
- 프로덕션: 배너 없음

---

## 버전 표시 (Footer)

```
web staging-a1b2c3d · api staging-a1b2c3d   (스테이징)
web a1b2c3d · api a1b2c3d                   (프로덕션)
```

- web 버전: K8s Deployment `APP_VERSION` env → 서버 컴포넌트에서 읽음
- api 버전: `BACKEND_URL/actuator/info` (1시간 캐시)

---

## 시크릿 관리

OCI Vault → ESO → Kubernetes Secret. Git에 실제 시크릿 값 커밋 금지.

스테이징 전용 Vault 키: `STAGING_DB_URL`, `STAGING_DB_USER`, `STAGING_DB_PASSWORD`, `STAGING_ADMIN_ANALYTICS_TOKEN`

---

## TLS

Cloudflare Origin Certificate로 관리. cert-manager/Let's Encrypt 사용 안 함.

```bash
kubectl create secret tls staging-ottline-app-tls \
  --cert=origin.crt --key=origin.key -n ott-staging
```

---

## Cloudflare Access 접근 제한

Cloudflare Zero Trust → Access → Applications → `staging.ottline.app`
이메일 OTP 인증 후 진입. 세션 기간 기본 24시간.

---

## 주의사항

- **PostgreSQL 15 public schema 권한:** `GRANT CREATE ON SCHEMA public TO watchlog_staging;` 최초 설정 시 실행 필요
- **Telegram 알림:** 스테이징에서는 비활성화 (`TELEGRAM_NOTIFY_ENABLED: "false"`)
- `registry-secret.yaml`: `.dockerconfigjson`이 현재 git에 커밋되어 있음 → 추후 ESO 교체 고려
