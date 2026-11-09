#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "==> Verifying apps/ios-native project contract in $ROOT_DIR"

# 1. Verify XcodeGen project.yml and version/bundle contracts
grep -q 'PRODUCT_BUNDLE_IDENTIFIER: app.ottline' "$ROOT_DIR/project.yml"
grep -q 'PRODUCT_BUNDLE_IDENTIFIER: app.ottline.QuickLogWidget' "$ROOT_DIR/project.yml"
grep -q 'MARKETING_VERSION: "2.0.0"' "$ROOT_DIR/project.yml"
grep -q 'CURRENT_PROJECT_VERSION: "25"' "$ROOT_DIR/project.yml"

# 2. Verify Info.plist & Entitlements
grep -q '<key>ITSAppUsesNonExemptEncryption</key>' "$ROOT_DIR/Sources/OttlineApp/Info.plist"
grep -q '<string>group.app.ottline</string>' "$ROOT_DIR/Sources/OttlineApp/OttlineApp.entitlements"
grep -q '<string>group.app.ottline</string>' "$ROOT_DIR/Sources/OttlineWidget/OttlineWidget.entitlements"

# 3. Verify Pretendard OTF fonts exist
for font in Pretendard-Regular.otf Pretendard-Medium.otf Pretendard-SemiBold.otf Pretendard-Bold.otf Pretendard-ExtraBold.otf; do
  if [[ ! -s "$ROOT_DIR/Sources/OttlineApp/Resources/Fonts/$font" ]]; then
    echo "ERROR: Missing font $font"
    exit 1
  fi
done

# 4. Verify AppIcon-1024.png exists and is 1024x1024 RGB (no alpha channel for App Store Connect)
ICON_FILE="$ROOT_DIR/Sources/OttlineApp/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
if [[ ! -s "$ICON_FILE" ]]; then
  echo "ERROR: Missing AppIcon-1024.png"
  exit 1
fi
if command -v file >/dev/null 2>&1; then
  FILE_INFO="$(file "$ICON_FILE")"
  echo "AppIcon info: $FILE_INFO"
  if [[ "$FILE_INFO" != *"1024 x 1024"* ]] || [[ "$FILE_INFO" == *"RGBA"* ]]; then
    echo "ERROR: AppIcon-1024.png must be 1024x1024 RGB without alpha channel"
    exit 1
  fi
fi

# 5. Verify 6 Storybook Persona Avatars exist
for persona in cinema_keeper book_drifter deep_watcher midnight_logger weekend_curator archive_collector; do
  AVATAR_PNG="$ROOT_DIR/Sources/OttlineApp/Resources/Assets.xcassets/avatar_${persona}.imageset/avatar_${persona}.png"
  if [[ ! -s "$AVATAR_PNG" ]]; then
    echo "ERROR: Missing persona avatar $AVATAR_PNG"
    exit 1
  fi
done

# 6. Verify Analytics platform constraint ("ios_native")
grep -q 'platform: "ios_native"' "$ROOT_DIR/Sources/OttlineApp/Data/OttlineRepository.swift"

echo "==> All static iOS Native v2 checks passed!"
