# ottline macOS Native v2 (`apps/macos-native`) 개발 가이드

`apps/macos-native`는 공용 코어 패키지 `apps/apple-core`(`OttlineCore`)를 공유하며, 데스크톱 환경에 맞춘 **"펼쳐보는 기록장"** UI와 상단 메뉴바 빠른 기록(`MenuBarExtra`)을 제공합니다.

```bash
cd apps/macos-native

# 1) 정적 계약 검증
bash scripts/verify-macos-project.sh

# 2) XcodeGen 프로젝트 생성
xcodegen generate

# 3) macOS 빌드 및 단위 테스트
xcodebuild test \
  -project OttlineMac.xcodeproj \
  -scheme OttlineMacApp \
  -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO

# 4) Xcode에서 열기
open OttlineMac.xcodeproj
```
