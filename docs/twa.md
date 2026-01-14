# TWA 내부 테스트 가이드

## 목표
- PWA를 Android TWA로 패키징해 내부 테스트용 APK 생성
- 실제 배포 전, 기본 설치/실행/딥링크/스탠드얼론 동작 확인

## 필수 입력 값
- 도메인: https://ott.preview.pe.kr
- 패키지명: kr.pe.preview.ott
- 앱명: On the Timeline (OTT)

## 사전 요구사항
- JDK 17
- Android SDK (platform tools, build tools)
- Node.js

## 1) Bubblewrap 초기화
아래 명령으로 TWA 프로젝트를 생성한다.

```bash
NPM_CONFIG_CACHE=./.npm-cache npx @bubblewrap/cli init \
  --manifest "https://ott.preview.pe.kr/manifest.webmanifest" \
  --directory "apps/twa"
```

프롬프트 예시(중요 항목만):
- JDK 설치 질문: `No` (이미 JDK 17 사용 중이면)
- App name: `On the Timeline (OTT)`
- Short name: `OTT`
- Package name: `kr.pe.preview.ott`
- Host: `ott.preview.pe.kr`
- Start URL: `/`

## 2) APK 빌드(내부 테스트)
```bash
cd apps/twa
./gradlew assembleDebug
```

결과 APK 경로:
- `apps/twa/app/build/outputs/apk/debug/app-debug.apk`

## 3) Asset Links 설정
TWA는 디지털 자산 링크 검증이 필요하다. 서명 키의 SHA-256 지문을 구한 후
`assetlinks.json`을 배포 도메인에 추가한다.

### SHA-256 지문 확인 (디버그 키 예시)
```bash
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android
```

### assetlinks.json 템플릿
- 템플릿: `docs/assetlinks.template.json`
- 실제 배치 위치: `apps/web/public/.well-known/assetlinks.json`

## 4) 기기 설치 테스트
```bash
adb install -r apps/twa/app/build/outputs/apk/debug/app-debug.apk
```

## 참고
- 스토어 배포용은 AAB 빌드 필요 (`./gradlew bundleRelease`)
- 실서비스 배포 시에는 release keystore의 SHA-256으로 `assetlinks.json`을 갱신해야 함
