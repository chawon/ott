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

  while read -r DENSITY; do
    SOURCE_PATH="app/src/main/res/drawable-${DENSITY}/splash.png"
    AAB_ENTRY="base/res/drawable-${DENSITY}-v4/splash.png"
    SOURCE_HASH="$(sha256sum "$SOURCE_PATH" | awk '{print $1}')"
    PACKAGED_HASH="$(unzip -p "$AAB_PATH" "$AAB_ENTRY" | sha256sum | awk '{print $1}')"

    if [[ "$SOURCE_HASH" != "$PACKAGED_HASH" ]]; then
      echo "Packaged splash does not match $SOURCE_PATH: $AAB_ENTRY" >&2
      exit 1
    fi
  done <<'EOF'
mdpi
hdpi
xhdpi
xxhdpi
xxxhdpi
EOF
fi

echo "Verified current ottline brand assets in the Android release${AAB_PATH:+ AAB}."
