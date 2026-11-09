# ottline iOS Native v2 (`apps/ios-native`) 개발 및 배포 가이드

## 1. 로컬 Xcode 프로젝트 생성 및 실행 (macOS)

`apps/ios-native`는 `.xcodeproj` 머지 충돌 방지를 위해 **`XcodeGen` (`project.yml`)**을 단일 프로젝트 정의 원본으로 사용합니다.

```bash
cd apps/ios-native

# 1) 정적 계약 검증 (번들 ID, 버전, 폰트, 무알파 1024px 아이콘, 아바타)
bash scripts/verify-ios-project.sh

# 2) XcodeGen으로 Ottline.xcodeproj 생성
brew install xcodegen
xcodegen generate

# 3) Xcode에서 열기
open Ottline.xcodeproj
```

## 2. 시뮬레이터 빌드 및 단위 테스트 실행 (CLI / CI)

```bash
cd apps/ios-native
xcodegen generate

xcodebuild test \
  -project Ottline.xcodeproj \
  -scheme OttlineApp \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=latest' \
  CODE_SIGNING_ALLOWED=NO
```

## 3. 기존 EAS 인증서 → GitHub Actions Secrets 1회 등록 가이드

GitHub Actions `macos-15` 러너(`.github/workflows/native-ios-v2-release.yml`)에서 서명된 `.ipa`를 생성하고 TestFlight에 자동 업로드하려면, 기존 EAS에 보관된 Apple Distribution 인증서와 App Store Connect API Key를 GitHub Secrets에 1회 등록합니다.

### 3.1 기존 EAS에서 인증서 추출
```bash
cd apps/native
npx eas-cli credentials -p ios
# 1) Distribution Certificate (.p12) 다운로드 및 비밀번호 확인
# 2) Provisioning Profile (.mobileprovision) 다운로드
```

### 3.2 GitHub Repository Secrets 목록

| Secret 이름 | 설명 |
| --- | --- |
| `APPLE_TEAM_ID` | Apple Developer Team ID (10자리 영숫자) |
| `IOS_DIST_CERT_BASE64` | Distribution `.p12` 파일의 `base64` 인코딩 문자열 (`base64 -i dist.p12 \| tr -d '\n'`) |
| `IOS_DIST_CERT_PASSWORD` | Distribution `.p12` 비밀번호 |
| `IOS_PROVISION_PROFILE_BASE64` | `app.ottline` App Store Provisioning Profile `.mobileprovision`의 `base64` 문자열 |
| `IOS_WIDGET_PROVISION_PROFILE_BASE64` | `app.ottline.QuickLogWidget` App Store Provisioning Profile `.mobileprovision`의 `base64` 문자열 |
| `ASC_KEY_ID` | App Store Connect API Key ID (예: `2X9R4H...`) |
| `ASC_ISSUER_ID` | App Store Connect API Issuer ID (UUID 형식) |
| `ASC_PRIVATE_KEY_BASE64` | `AuthKey_<KEY_ID>.p8` 파일의 `base64` 인코딩 문자열 |

> **참고**: App Group(`group.app.ottline`) 및 WidgetKit 확장(`app.ottline.QuickLogWidget`)을 활성화하려면 [Apple Developer Identifiers](https://developer.apple.com/account/resources/identifiers/list)에서:
> 1. **App Groups**에 `group.app.ottline`을 등록합니다.
> 2. `app.ottline` App ID에 `App Groups` (`group.app.ottline`) 및 `Associated Domains`를 체크합니다.
> 3. `app.ottline.QuickLogWidget` App ID를 생성하고 `App Groups` (`group.app.ottline`)를 체크한 뒤, 각각의 App Store Provisioning Profile을 발급합니다.
