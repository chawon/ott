#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPLE_CORE_DIR="$(cd "$ROOT_DIR/../apple-core" && pwd)"
FONTS_DIR="$ROOT_DIR/../ios-native/Sources/OttlineApp/Resources/Fonts"
echo "==> Verifying apps/macos-native project contract in $ROOT_DIR"

# 1. Verify XcodeGen project.yml and version/bundle contracts
grep -q 'PRODUCT_BUNDLE_IDENTIFIER: app.ottline' "$ROOT_DIR/project.yml"
grep -q 'PRODUCT_BUNDLE_IDENTIFIER: app.ottline.MacWidget' "$ROOT_DIR/project.yml"
MARKETING_VER="$(awk -F'"' '/MARKETING_VERSION:/ {print $2; exit}' "$ROOT_DIR/project.yml")"
if [[ ! "$MARKETING_VER" =~ ^2\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: MARKETING_VERSION must be 2.x.y (got: '${MARKETING_VER:-empty}')"
  exit 1
fi
BUILD_NUM="$(awk -F'"' '/CURRENT_PROJECT_VERSION:/ {print $2; exit}' "$ROOT_DIR/project.yml")"
if [[ ! "$BUILD_NUM" =~ ^[0-9]+$ ]] || (( BUILD_NUM < 28 )); then
  echo "ERROR: CURRENT_PROJECT_VERSION must be an integer >= 28 (got: '${BUILD_NUM:-empty}')"
  exit 1
fi

# 2. Verify Info.plist & Entitlements
grep -q '<key>ATSApplicationFontsPath</key>' "$ROOT_DIR/Sources/OttlineMacApp/Info.plist"
grep -q '<key>ITSAppUsesNonExemptEncryption</key>' "$ROOT_DIR/Sources/OttlineMacApp/Info.plist"
grep -q '<key>com.apple.security.app-sandbox</key>' "$ROOT_DIR/Sources/OttlineMacApp/OttlineMacApp.entitlements"
grep -q '<key>com.apple.security.network.client</key>' "$ROOT_DIR/Sources/OttlineMacApp/OttlineMacApp.entitlements"
grep -q '<string>3Z9ULN66D4.group.app.ottline</string>' "$ROOT_DIR/Sources/OttlineMacApp/OttlineMacApp.entitlements"
grep -q '<key>com.apple.security.app-sandbox</key>' "$ROOT_DIR/Sources/OttlineMacWidget/OttlineMacWidget.entitlements"
grep -q '<string>3Z9ULN66D4.group.app.ottline</string>' "$ROOT_DIR/Sources/OttlineMacWidget/OttlineMacWidget.entitlements"

# 3. Verify Pretendard OTF fonts exist in shared Fonts directory
for font in Pretendard-Regular.otf Pretendard-Medium.otf Pretendard-SemiBold.otf Pretendard-Bold.otf Pretendard-ExtraBold.otf; do
  if [[ ! -s "$FONTS_DIR/$font" ]]; then
    echo "ERROR: Missing font $font"
    exit 1
  fi
done

# 4. Verify macOS transparent RGBA AppIcon-1024, template menubar_icon, and 6 persona avatars
ICON_FILE="$ROOT_DIR/Sources/OttlineMacApp/Resources/Assets.xcassets/AppIcon.appiconset/icon_1024.png"
if [[ ! -s "$ICON_FILE" ]]; then
  echo "ERROR: Missing AppIcon icon_1024.png"
  exit 1
fi
file "$ICON_FILE" | grep -q "RGBA"

MENUBAR_ICON_36="$ROOT_DIR/Sources/OttlineMacApp/Resources/Assets.xcassets/menubar_icon.imageset/menubar_icon_36.png"
if [[ ! -s "$MENUBAR_ICON_36" ]]; then
  echo "ERROR: Missing menubar_icon_36.png"
  exit 1
fi
file "$MENUBAR_ICON_36" | grep -q "RGBA"

swift - "$ICON_FILE" << 'EOF'
import AppKit
import Foundation

let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path),
      let rep = img.representations.first as? NSBitmapImageRep else {
    fputs("ERROR: Failed to decode bitmap for \(path)\n", stderr)
    exit(1)
}
let w = rep.pixelsWide
let h = rep.pixelsHigh
for (x, y) in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)] {
    let alpha = rep.colorAt(x: x, y: y)?.alphaComponent ?? 1.0
    if alpha > 0.01 {
        fputs("ERROR: AppIcon corner (\(x),\(y)) is not transparent (alpha=\(alpha))\n", stderr)
        exit(1)
    }
}
let centerAlpha = rep.colorAt(x: w / 2, y: h / 2)?.alphaComponent ?? 0.0
if centerAlpha < 0.99 {
    fputs("ERROR: AppIcon center (\(w/2),\(h/2)) is not opaque (alpha=\(centerAlpha))\n", stderr)
    exit(1)
}
EOF

for persona in cinema_keeper book_drifter deep_watcher midnight_logger weekend_curator archive_collector; do
  AVATAR_PNG="$ROOT_DIR/Sources/OttlineMacApp/Resources/Assets.xcassets/avatar_${persona}.imageset/avatar_${persona}.png"
  if [[ ! -s "$AVATAR_PNG" ]]; then
    echo "ERROR: Missing persona avatar $AVATAR_PNG"
    exit 1
  fi
done

# 5. Verify shared OttlineCore analytics platform compatibility
grep -q 'platform: "ios_native"' "$APPLE_CORE_DIR/Sources/OttlineCore/Data/OttlineRepository.swift"

# 6. Verify retired AI Curator endpoint/UI references are removed
if grep -rnE 'curated-contents|getCuratedContents|CuratedContentItem' "$APPLE_CORE_DIR/Sources" "$ROOT_DIR/Sources"; then
  echo "ERROR: Retired curator references must be removed from Apple sources"
  exit 1
fi

echo "==> All static macOS Native v2 checks passed!"
