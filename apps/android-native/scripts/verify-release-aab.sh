#!/usr/bin/env bash
set -euo pipefail

aab_path="${1:-app/build/outputs/bundle/release/app-release.aab}"
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

unzip -q "$aab_path" "base/dex/classes*.dex" -d "$verification_dir"
for dex_file in "$verification_dir"/base/dex/classes*.dex; do
  "$dexdump_bin" -d "$dex_file" >> "$verification_dir/dexdump.txt"
done

for cls in \
  "Landroidx/work/impl/WorkDatabase_Impl;" \
  "Lapp/ottline/data/local/OttlineDatabase_Impl;" \
  "Lapp/ottline/LauncherActivity;" \
  "Lapp/ottline/WatchReminderSettingsActivity;" \
  "Lapp/ottline/QuickLogWidgetProvider;" \
  "Lapp/ottline/ReminderBootReceiver;" \
  "Lapp/ottline/WatchReminderWorker;" \
  "Lapp/ottline/RevisitReminderWorker;" \
  "Lapp/ottline/data/SyncWorker;"; do
  if ! grep -Fq "Class descriptor  : '${cls}'" "$verification_dir/dexdump.txt"; then
    echo "Missing required class in release DEX: ${cls}" >&2
    exit 1
  fi
  echo "[OK] DEX class present: ${cls}"
done

seeds_file="app/build/outputs/mapping/release/seeds.txt"
if [[ -f "$seeds_file" ]]; then
  for seed in \
    "androidx.work.impl.WorkDatabase_Impl: WorkDatabase_Impl()" \
    "app.ottline.data.local.OttlineDatabase_Impl: OttlineDatabase_Impl()" \
    "app.ottline.WatchReminderWorker: WatchReminderWorker(android.content.Context,androidx.work.WorkerParameters)" \
    "app.ottline.RevisitReminderWorker: RevisitReminderWorker(android.content.Context,androidx.work.WorkerParameters)" \
    "app.ottline.data.SyncWorker: SyncWorker(android.content.Context,androidx.work.WorkerParameters)"; do
    if ! grep -Fq "$seed" "$seeds_file"; then
      echo "Missing R8 constructor seed in seeds.txt: ${seed}" >&2
      exit 1
    fi
    echo "[OK] R8 constructor seed verified: ${seed}"
  done
fi

sha256sum "$aab_path"
echo "Verified ottline Native release startup & R8 contract."
