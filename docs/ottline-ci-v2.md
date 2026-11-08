# ottline CI v2

따뜻한 v2 UI에 맞춰 기존의 열린 책 + 재생 심볼을 정리한 A안을 권장 방향으로 준비했다. 이 문서는 CI 자산과 플랫폼별 출력의 인수인계 문서다. 네이티브 앱·스토어 배포 기록은 별도로 남긴다.

## 방향

- **A · 한 장, 한 순간**: 기존 열린 책과 재생 모양의 위치 관계를 보존했다. 96×96 마스터에서 8unit의 둥근 획을 사용해 간격과 모서리를 규칙적으로 맞췄다. 책과 영상의 개인 기록을 함께 담는다.
- 심볼은 navy `#1E4D8C`, 앱 바탕은 cream `#F8F6F2`다. 작은 아이콘의 형태를 흐리지 않도록 심볼 안에는 추가 장식이나 색을 넣지 않았다.
- `ottline` 워드마크는 **기존 Pretendard Variable 700**, 30px, 자간 **-0.025em(-0.75px)**을 그대로 사용한다. 사용자 교정에 따라 새로 그린 글자체를 제거하고 원래 폰트의 실제 glyph 경로를 추출했다. 글자 모양·굵기·기본 kerning과 기존 자간에 수동 보정을 더하지 않았다. 웹 헤더는 동일 폰트를 텍스트로 렌더링하고, CI 벡터는 같은 윤곽을 고정한 path로 제공한다.
- `ON THE TIMELINE`은 기존과 같은 **Pretendard Variable 600**, 9px, 자간 **0.1em(0.9px)**이다. 색은 orange `#FF9933`다. 심볼 40px와 간격 8px, 본문 line-height 36px·캡션 9px·전체 높이 48px로 기존 헤더의 비례를 유지한다.
- **B · 시간과 책갈피**는 원형 시간 궤적과 책갈피·재생을 결합한 탐색 시안이다. 실루엣은 뚜렷하게 다르지만 작은 크기에서 겹친 부분의 구분이 약해 권장안으로 사용하지 않는다.

심볼은 이 프로젝트를 위해 직접 만든 SVG 경로이며 글자는 이미 사용 중인 Pretendard 폰트의 윤곽이다. 생성형 이미지, 다른 브랜드의 로고, 비트맵 트레이싱, 임베디드 폰트 데이터를 사용하지 않았다. 기존 CI 비트맵은 비교 보드의 ‘기존’ 칸에만 표시한다.

## 파일

모든 버전 자산은 `apps/web/public/brand/v2/` 아래에 있다.

| 파일 | 크기 / 비율 | 용도 |
| --- | --- | --- |
| `mark.svg`, `mark-inverse.svg` | 96×96 / 1:1 | 투명 심볼, 밝은/어두운 배경 |
| `mark-mono.svg` | 96×96 / 1:1 | `currentColor` 단색 심볼, 기본 검정 |
| `wordmark.svg`, `wordmark-inverse.svg` | 86×36 / 2.389:1 | Pretendard 700의 투명 워드마크, 원래 line box 포함 |
| `lockup.svg`, `lockup-inverse.svg` | 136.445×48 / 2.843:1 | 심볼 + 원래 폰트의 워드마크·캡션, 밝은/어두운 헤더 |
| `app-icon.svg` | 1024×1024 | 모서리를 미리 자르지 않은 불투명 앱 아이콘 원본 |
| `app-icon-{size}.png` | 1024, 512, 192, 180, 128, 64, 48, 32, 16px | 불투명 RGB 앱 아이콘 / PWA |
| `app-foreground.svg`, `app-foreground-1024.png` | 1024×1024 | 투명 전경, Apple 레이어 입력용 |
| `app-background.svg`, `app-background-1024.png` | 1024×1024 | 불투명 cream 배경, Apple 레이어 입력용 |
| `app-monochrome.svg`, `app-monochrome-1024.png` | 1024×1024 | 투명 바탕의 검정 단색 전경 |
| `adaptive-{foreground,background,monochrome}.svg` | 108×108 좌표 | Android adaptive 레이어 원본 |
| `adaptive-{foreground,background,monochrome}-432.png` | 432×432 | Android 4x 출력. 전경/단색은 RGBA, 배경은 RGB |
| `favicon.svg`, `favicon-{size}.png` | SVG 1024 좌표 / 16, 24, 32, 48px | 투명 바탕의 브라우저 파비콘. SVG는 어두운 탭에서 cream 역상색 |
| `favicon.ico` | 16, 24, 32, 48px 32비트 RGBA PNG 프레임 | 투명 바탕의 브라우저 fallback 파비콘 |
| `og-image.svg`, `og-image.png` | 1200×630 | cream 캔버스 중앙의 A 락업, 별도 제품 문구 없는 공유 미리보기 |
| `alternative-b-mark.svg`, `alternative-b-app-icon.svg` | 96×100 / 1024×1024 | 탐색용 B안 |
| `comparison-board.svg`, `comparison-board.png` | 1200×920 | 기존/A/B·작은 크기·밝고 어두운 락업 비교 |
| `index.html` | 반응형 정적 페이지 | 실제 140/150/168px 헤더, 16/24/32px 파비콘과 다운로드 검토 |
| `asset-manifest.json` | JSON | PNG별 크기·alpha·SHA-256 및 안전 영역 검증값 |
| `typography-outlines.json` | JSON | 기존 폰트의 glyph path, weight·자간·메트릭·출처·SHA-256 |

웹에서는 버전 경로 `/brand/v2/lockup.svg` 등을 참조한다. 기존 파일을 같은 경로에서 조용히 교체하지 않는다. 기존 `public/icon.png`, TWA, iOS 앱, 스토어 자산의 실제 교체는 각 플랫폼 통합 범위에 맞춰 별도로 진행한다.

기본 락업은 가로세로 비율을 고정하고 너비 140~168px로 사용한다. 세로 압축이나 캡션만 별도로 줄이지 않는다. 공간이 더 좁은 곳은 심볼 또는 워드마크를 사용한다. `inverse`는 투명 바탕의 cream 그림이며 orange 캡션을 유지한다. 앱 아이콘에는 워드마크나 캡션을 넣지 않는다.

## 재생성과 검증

레포 루트에서 실행한다. 설치된 `apps/web`의 `sharp`를 사용하며 추가 의존성이 필요 없다.

```sh
node scripts/generate-brand-assets.mjs
```

브라우저 파비콘만 바꿀 때는 `node scripts/generate-brand-assets.mjs --favicon-only`로 SVG·PNG·ICO와 해당 매니페스트 항목을 갱신한다. 이 경로는 앱/PWA 아이콘·글자·플랫폼 레이어를 다시 쓰지 않으며 앱 라우트와 public 루트의 ICO 복사본도 같은 파일로 맞춘다. 브라우저 파비콘은 투명 바탕이고, 앱/PWA 배경의 불투명 RGB 규칙은 유지한다.

생성 스크립트에 A/B 심볼 경로가 들어 있고 워드마크·캡션은 고정된 `typography-outlines.json`에서 읽는다. SVG에서 직접 PNG를 출력하고 ICO 프레임을 만든다. 동일한 의존성 버전에서는 PNG와 매니페스트가 결정적으로 재생성된다. 정적 검토 페이지의 레이아웃은 `index.html`에서 별도로 관리한다.

폰트 원본은 `apps/web/public/fonts/PretendardVariable.woff2`이며 SHA-256은 `9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4`다. [Pretendard 공식 저장소](https://github.com/orioncactus/pretendard)의 SIL Open Font License 1.1 폰트이며 원본 메타데이터는 `Copyright © 2023 Kil Hyung-jin`, `Version 1.309;Glyphs 3.2 (3225)`다. 배포본 옆의 `apps/web/public/fonts/Pretendard-OFL.txt`에 원본 저작권 고지와 라이선스를 함께 둔다. 일반 생성 시 원본 해시도 검사해 다른 폰트의 경로가 섞이지 않도록 한다.

윤곽을 다시 추출할 때만 별도 임시 도구를 설치한다. 프로젝트의 package.json·lockfile에는 추가하지 않는다.

```sh
npm install --prefix /tmp/ottline-ci-font-tools --no-audit --no-fund --package-lock=false fontkit@2.0.4 wawoff2@2.0.1
node scripts/generate-brand-assets.mjs --extract-typography /tmp/ottline-ci-font-tools
```

[wawoff2](https://github.com/fontello/wawoff2)로 WOFF2의 압축을 메모리에서 TTF로 해제한 뒤 [fontkit](https://github.com/foliojs/fontkit)의 `getVariation({ wght: 700/600 })`, `layout`, glyph `path.toSVG`를 사용한다. 이렇게 얻은 원래 advance·kerning에 CSS의 기존 letter-spacing을 더해 경로 위치를 고정한다. 폰트 내용·글자 모양은 수정하지 않는다. 임시 폴더가 없어져도 일반 생성은 고정 path 데이터만 사용하므로 추가 도구 없이 작동한다.

스크립트는 다음을 실제 RGBA 픽셀로 확인하고 실패 시 종료한다.

- 불투명 PNG는 alpha 채널이 없는 RGB, 전경/단색 PNG는 alpha가 있는 RGBA다.
- PNG의 가로·세로가 요청한 크기와 같다.
- **PWA**: 1024px 전경의 모든 비투명 픽셀은 중앙 반경 **405.663px** 안에 있다. 규격상 안전 반경 **409.6px**(너비의 40%) 안이다.
- **Android**: 108dp 전경을 1080px로 래스터화했을 때 모든 비투명 픽셀은 중앙 반경 **32.899dp** 안에 있다. **33dp**(66dp 지름) 원 안에 있고 전경 외곽 크기는 약 54.9×48.2dp다.
- 투명 전경의 네 모서리는 alpha 0이다. 앱/배경 PNG의 네 모서리는 cream으로 불투명하다.

비교 보드와 CI 검토 페이지에서 실제 16/24/32px 파비콘, 48/64px 아이콘, 원형·squircle 마스크, 밝고 어두운 140/150/168px 락업을 시각 검토한다. 워드마크·락업은 투명 여백을 검사해 획이 viewBox에 잘리지 않는지도 확인한다. 안전 영역 검사는 실제 기기의 시스템 효과·OS 버전별 최종 렌더링 검증을 대신하지 않는다.

## 플랫폼 기준과 적용 한계

- [Apple 앱 아이콘 가이드](https://developer.apple.com/design/human-interface-guidelines/app-icons/): 시스템이 모서리와 마스크를 적용하므로 정사각형 원본/레이어를 제공한다. 1024px 아이콘과 벡터 전경·불투명 배경을 준비했다. 이 결과물은 Icon Composer에 넣을 입력 자산이며 `.icon` 파일 구성·Xcode 적용·기기 검증을 완료했다는 뜻은 아니다. Apple이 제공하는 시스템 시각 효과는 원본에 그리지 않았다.
- [Android adaptive 아이콘 가이드](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive): 108×108dp 전경/배경과 단색 레이어를 제공하고 중앙 66dp 영역 안에 핵심 그림을 둔다. 이 프로젝트는 그보다 구체적으로 중앙 **66dp 지름 원**까지 검사한다. SVG는 마스터이며 실제 Android 적용 시 VectorDrawable 변환이나 제공된 PNG 연결이 필요하다.
- [Web App Manifest의 icon masks와 safe zone](https://www.w3.org/TR/appmanifest/#icon-masks): maskable 핵심 그림은 중앙 반경 40% 안에 두며 바탕은 끝까지 채운다. `app-icon` 자산은 그 기준을 충족한다. 넓게 배치한 `favicon` 자산은 브라우저 탭용이며 maskable 앱 아이콘으로 지정하지 않는다.

공식 문서는 2026-11-04 확인했다. iOS/Android 네이티브 소스와 스토어 바이너리 배포는 이 CI 자산 작업에서 수행하지 않았다.
