# OTT Monorepo (`ottline`)

Next.js 웹 프런트엔드, Spring Boot 백엔드, Android/iOS 네이티브 앱 및 브라우저 확장 프로그램을 같은 레포에서 관리합니다.

## 구조
- `apps/web` – Next.js App Router 웹/PWA 프런트엔드 (`https://ottline.app`)
- `apps/api` – Spring Boot + JPA + PostgreSQL API 서버
- `apps/android-native` – 순수 Android Native 앱 (Kotlin + Jetpack Compose + Room + WorkManager, Google Play `app.ottline` v2.0+)
- `apps/native` – iOS App Store 출시용 Expo React Native 앱
- `apps/browser-extension` – PC OTT 시청 중 빠른 기록 연결용 Chrome/Edge/Whale 확장 프로그램
- `apps/twa` – 레거시 Android Bubblewrap TWA 프로젝트 (`versionCode <= 23`, `2026-11-09`부터 `apps/android-native`로 전환)
- `package.json` – 루트 워크스페이스 스크립트/설정
- `tsconfig.json` – 프로젝트 참조(루트 → `apps/web`)

## 사용법

### 웹 (`apps/web`)
```bash
# 루트에서
npm install        # 워크스페이스 설치 및 lock 재생성 필요
npm run dev        # apps/web 개발 서버
npm run build      # apps/web 빌드
npm run lint       # apps/web biome check
```

### Android 네이티브 (`apps/android-native`)
```bash
cd apps/android-native
./gradlew testDebugUnitTest lintDebug
./gradlew bundleRelease -PreleaseVersionCode=25 -PreleaseVersionName=2.0.1
bash ./scripts/verify-release-aab.sh
```
자세한 Android 네이티브 아키텍처, TWA 자동 세션 복구, Google Play 배포 가이드는 [`apps/android-native/README.md`](apps/android-native/README.md) 및 [`docs/android-native-v2-transition.md`](docs/android-native-v2-transition.md)를 참고하세요.
