# Flutter SDK (Linux ARM64) setup for WSL on Windows ARM

This repo uses Flutter inside WSL (Linux ARM64). The SDK source is the community Linux ARM64 build.

## Source
- Repo: https://github.com/zhzhzhy/Flutter-SDK-ARM64

## Notes from upstream
- After first init, run `flutter doctor`.
- Flutter may overwrite the ARM64 Dart binary; re-download and replace Dart for ARM.
- Copy Flutter SDK artifacts to `${install_path}/bin/cache/artifacts/engine`.

## Suggested install flow (WSL Linux ARM64)
1) Download the latest Linux ARM64 Flutter SDK from the repo Releases page.
2) Extract to a stable path (example: `/opt/flutter-arm64`).
3) Add Flutter to PATH in `~/.bashrc`:
   - `export PATH="$PATH:/opt/flutter-arm64/bin"`
4) Run `flutter doctor` (expect downloads and initial cache creation).
5) Re-download the ARM Dart SDK (per upstream) and replace the Dart binary if overwritten.
6) Copy/restore Flutter engine artifacts into `bin/cache/artifacts/engine` if needed.

## WSL permission-safe env (if HOME is not writable)
If `~/.config` or `~/.dart-tool` isn't writable in WSL, run Flutter with these env vars:

```
HOME=/home/ergate23/workspace/ott
XDG_CONFIG_HOME=/home/ergate23/workspace/ott/.config
XDG_CACHE_HOME=/home/ergate23/workspace/ott/.cache
PUB_CACHE=/home/ergate23/workspace/ott/.pub-cache
FLUTTER_SUPPRESS_ANALYTICS=true
```

## Verification
- `flutter --version`
- `flutter doctor`

If you want me to automate the install steps, confirm where you want Flutter installed and whether I can run downloads in WSL.
