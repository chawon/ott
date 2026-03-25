# Native App 개발 가이드

## 실행 방법

### 사전 준비
- Node.js 18+
- [Expo Go](https://expo.dev/go) 앱 (Android / iOS)
- 또는 Android 에뮬레이터

### 의존성 설치
```bash
cd apps/native
npm install
```

### 웹 (가장 빠름)
```bash
cd apps/native
NODE_PATH="$(pwd)/node_modules" npx expo start --web
```
→ `http://localhost:8081` 에서 확인

### Android 에뮬레이터
```bash
# 에뮬레이터 먼저 실행
~/Library/Android/sdk/emulator/emulator -avd Pixel_7_API34 &

# Expo 실행
cd apps/native
NODE_PATH="$(pwd)/node_modules" npx expo start --android
```

### Android / iOS 실기기 (Expo Go)
```bash
cd apps/native
NODE_PATH="$(pwd)/node_modules" npx expo start
```
→ QR 코드를 Expo Go 앱으로 스캔

> **주의:** 모노레포 구조라 `NODE_PATH` 설정이 필수. 없으면 루트의 expo CLI가 `expo-router`를 못 찾음.

---

## 환경 구성 (최초 1회)

### Android 에뮬레이터 환경 (macOS)

```bash
# JDK 17
brew install openjdk@17
sudo ln -sfn /usr/local/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk

# Android SDK cmdline-tools (공식 zip 다운로드 필요)
# https://developer.android.com/studio#command-tools
mkdir -p ~/Library/Android/sdk/cmdline-tools/latest
unzip commandlinetools-mac-*.zip
mv cmdline-tools/* ~/Library/Android/sdk/cmdline-tools/latest/

# 환경변수 (~/.zshrc)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

# SDK 패키지 설치
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager \
  "platform-tools" \
  "build-tools;34.0.0" \
  "platforms;android-34" \
  "system-images;android-34;google_apis;x86_64"

# AVD 생성
$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd \
  -n Pixel_7_API34 \
  -k "system-images;android-34;google_apis;x86_64" \
  -d pixel_7
```

> 가속기: macOS Hypervisor.Framework 내장 (`kern.hv_support: 1`), 별도 HAXM 불필요

---

## 테스트

```bash
cd apps/native
npx jest
```

---

## 구현 완료 기능

### Journey 화면 — DNA Aura 디자인 (2026-03-25)

시청 기록 메타데이터에서 **26종 특질(DNA)** 을 추출하여 Journey 화면에 시각화.

**특질 카테고리:**
- 콘텐츠 타입: `book_maniac`, `movie_lover`, `series_lover`, `omnivore`
- 장소: `homebody`, `theater_maniac`, `cafe_type`, `transit_type`, `outdoor_type`
- 상황: `solo_viewer`, `social_viewer`
- 패턴: `binge_watcher`, `completionist`, `collector`, `note_taker`, `generous_rater`, `picky_rater`
- 플랫폼: `netflix_loyal`, `tving_loyal`, `wavve_loyal`, `watcha_loyal`, `disney_loyal`, `appletv_loyal`, `global_ott`, `k_ott`, `platform_explorer`

**시각화:**
- **HeroBar**: 상위 3개 특질 칩 표시 (아이콘 + 라벨 + 색상)
- **JourneyNode**: auraScore(0~1)에 따라 카드 너비/글로우 강도/테두리 색상 차등 적용
  - `score >= 0.7`: 카드 230px, shadowRadius 32, 강한 글로우
  - `score >= 0.3`: 카드 220px, shadowRadius 20, 중간 글로우
  - `score < 0.3`:  카드 200px, shadowRadius 8, 약한 글로우

**관련 파일:**
- `lib/types.ts` — TraitKey, DnaTraitMap, AuraResult 타입
- `lib/traits.ts` — TRAIT_META (라벨/아이콘/색상), getAuraColor()
- `lib/gamification.ts` — calcDnaTraits(), calcAuraScore()
- `lib/secureStore.ts` — expo-secure-store 웹 폴백 (localStorage)
- `components/journey/HeroBar.tsx` — DNA 칩 UI
- `components/journey/JourneyNode.tsx` — Aura 글로우 적용
- `app/(tabs)/journey/index.tsx` — 조합 및 데이터 흐름
- `__tests__/gamification.dna.test.ts` — 단위 테스트 11개
