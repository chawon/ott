#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TWA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$TWA_DIR"

if ! grep -Fq 'android:resource="@drawable/splash"' app/src/main/AndroidManifest.xml; then
  echo "AndroidManifest.xml no longer points at the verified TWA splash resource." >&2
  exit 1
fi

sha256sum --check scripts/brand-assets.sha256

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [release.aab]" >&2
  exit 2
fi

if [[ $# -eq 1 ]]; then
  AAB_PATH="$1"
  if [[ ! -f "$AAB_PATH" ]]; then
    echo "AAB not found: $AAB_PATH" >&2
    exit 2
  fi

  if ! command -v java >/dev/null 2>&1; then
    echo "Java is required to compare decoded PNG pixels in the release AAB." >&2
    exit 2
  fi

  VERIFICATION_DIR="$(mktemp -d)"
  trap 'rm -rf "$VERIFICATION_DIR"' EXIT

  while read -r DENSITY; do
    SOURCE_PATH="app/src/main/res/drawable-${DENSITY}/splash.png"
    AAB_ENTRY="base/res/drawable-${DENSITY}-v4/splash.png"
    PACKAGED_PATH="$VERIFICATION_DIR/splash-${DENSITY}.png"

    unzip -p "$AAB_PATH" "$AAB_ENTRY" > "$PACKAGED_PATH"
    java scripts/VerifyBrandPngPixels.java "$SOURCE_PATH" "$PACKAGED_PATH"
  done <<'EOF'
mdpi
hdpi
xhdpi
xxhdpi
xxxhdpi
EOF
fi

echo "Verified current ottline brand assets in the Android release${AAB_PATH:+ AAB}."
