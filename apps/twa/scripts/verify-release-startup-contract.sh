#!/usr/bin/env bash

set -euo pipefail

aab_path="${1:?Usage: verify-release-startup-contract.sh <release.aab>}"
if [[ ! -f "$aab_path" ]]; then
  echo "Release AAB not found: $aab_path" >&2
  exit 1
fi

android_sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
dexdump_bin="$(command -v dexdump || true)"
if [[ -z "$dexdump_bin" && -n "$android_sdk_root" && -d "$android_sdk_root/build-tools" ]]; then
  dexdump_bin="$(find "$android_sdk_root/build-tools" -type f -name dexdump -print 2>/dev/null | sort -V | tail -1)"
fi
if [[ -z "$dexdump_bin" || ! -x "$dexdump_bin" ]]; then
  echo "dexdump was not found in PATH or the Android SDK build-tools directory." >&2
  exit 1
fi

verification_dir="$(mktemp -d)"
trap 'rm -rf "$verification_dir"' EXIT

unzip -p "$aab_path" base/dex/classes.dex > "$verification_dir/classes.dex"
"$dexdump_bin" -d "$verification_dir/classes.dex" > "$verification_dir/dexdump.txt"

if ! awk '
  /Class descriptor  *: '\''Landroidx\/work\/impl\/WorkDatabase_Impl;'\''/ {
    in_target_class = 1
    next
  }
  in_target_class && /Class descriptor  *:/ {
    in_target_class = 0
  }
  in_target_class && /name  *: '\''<init>'\''/ {
    saw_constructor = 1
    next
  }
  in_target_class && saw_constructor && /type  *: '\''\(\)V'\''/ {
    found_default_constructor = 1
  }
  END {
    exit found_default_constructor ? 0 : 1
  }
' "$verification_dir/dexdump.txt"; then
  echo "WorkDatabase_Impl default constructor is missing from the release DEX." >&2
  exit 1
fi

echo "Verified WorkDatabase_Impl default constructor in the release DEX."
