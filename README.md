# OTT Monorepo

Next.js 프런트엔드와 Spring Boot 백엔드를 같은 레포에서 워크스페이스로 관리합니다.

## 구조
- `apps/web` – Next.js 앱 (기존 소스)
- `apps/api` – Spring Boot API
- `package.json` – 루트 워크스페이스 스크립트/설정
- `tsconfig.json` – 프로젝트 참조(루트 → apps/web)

## 사용법
```bash
# 루트에서
npm install        # 워크스페이스 설치 및 lock 재생성 필요
npm run dev        # apps/web 개발 서버
npm run build      # apps/web 빌드
npm run lint       # apps/web biome check
```

개별 앱에서 실행하려면 `cd apps/web` 후 기존과 동일하게 `npm run dev` 등을 사용할 수 있습니다.
