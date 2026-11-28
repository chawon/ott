---
omd: 0.1
brand: ottline
bootstrapped_from: cookpad
bootstrapped_at: 2026-06-14T00:00:00+09:00
---

# ottline v2 디자인 기준

영화·시리즈·책을 기록하고 다시 펼쳐보는 서비스다. v2의 기준은 사용자가 선택한 A 타임라인이다. PC에서는 한 달의 기록을 여유 있게 펼쳐 보고, 모바일에서는 한 손으로 기록을 시작한다. [확정 시안](https://github.com/chawon/ott/blob/main/archive/prototypes/ottline-v2/README.md)

## 색·서체·표지

- 라이트의 배경·카드·본문은 `#F8F6F2`·`#FFFFFF`·`#0F0F0F`, 다크는 `#15120F`·`#211C18`·`#FFF8EF`를 쓴다. 밝은 바탕의 심벌과 워드마크는 네이비 `#1E4D8C`, 어두운 바탕은 해당 테마의 밝은 로고 자산을 쓴다.
- 오렌지 `#FF9933`와 짙은 글자는 최종 기록·저장 버튼에 쓴다. 상태 선택은 중립색으로 표시하고, 포커스와 현재 탭에는 작은 강조를 허용한다. 같은 오렌지의 코드 이름은 Web `--primary`, Compose·SwiftUI `brandOrange`, WPF `AccentOrangeBrush`다. [Android 테마](https://github.com/chawon/ott/blob/main/apps/android-native/app/src/main/java/app/ottline/ui/theme/OttlineTheme.kt) · [Apple 공통 테마](https://github.com/chawon/ott/blob/main/apps/apple-core/Sources/OttlineCore/UI/Theme/OttlineTheme.swift) · [Windows 브러시](https://github.com/chawon/ott/blob/main/apps/windows-native/src/Ottline.App/Theme/OttlineThemeManager.cs)
- 기본 서체는 Pretendard다. 로고는 열린 책과 재생 심벌, 굵기 700·자간 -0.025em의 `ottline`, 오렌지색 `ON THE TIMELINE` 부제로 구성한다. 승인된 자산을 재사용한다. [로고 원본과 타이포그래피](https://github.com/chawon/ott/blob/main/docs/ottline-ci-v2.md)
- 기록 카드와 상세에서는 포스터·표지와 제목을 먼저 보여 준다. 날짜·장소·상황을 묶어 감상 상태와 메모를 함께 읽을 수 있게 한다. 웹 카드·버튼의 기본 모서리는 8px이며 작은 표지와 전체 화면 기록창에는 각각의 컴포넌트 값을 쓴다. [웹 테마](https://github.com/chawon/ott/blob/main/apps/web/app/globals.css) · [기록창 스타일](https://github.com/chawon/ott/blob/main/apps/web/components/recording.module.css)

## 기록과 회상

- 작품을 찾아 상태를 고르면 초안이 된다. 사용자가 마지막 **기록 남기기**를 눌러야 저장한다. 날짜는 시각 없이 고르고, 플랫폼 프리셋·직접 입력, 장소·상황, 시리즈 시즌·회차에 계속 접근할 수 있게 한다.
- 감상은 영상·책에 맞는 세 가지 느낌으로 표현한다. 기록창·타임라인·공유 카드에서 같은 표현을 쓰고, 선택과 저장 결과에 같은 느낌 아이콘을 쓴다. 느낌과 메모는 선택 사항이다. 메모가 비어도 완성된 기록으로 보여 주고 추가 입력은 상세에서 권한다.
- 홈의 월별 대표·목록에는 감상을 마친 작품을 모으고, 이어가는 작품은 별도로 보여 준다. 진행 중이거나 보고 싶은 작품만 있는 사람에게도 기존 타임라인을 보여 준다.
- 모바일에서는 보이는 화면 상단에 검색창과 영상·책 선택을 둔다. 키보드가 열려도 검색 결과를 스크롤하고 기록을 마칠 수 있게 한다. 웹 기록창은 상태를 고른 뒤에도 크기를 유지하며, 추가 입력은 본문만 스크롤하고 하단 저장 버튼은 보이게 한다. [저장 동작과 검증](https://github.com/chawon/ott/blob/main/docs/ottline-ux-v2-web.md#L508)

<a name="8-responsive-behavior"></a>

## 화면 폭과 플랫폼

창에 실제로 주어진 너비와 운영체제의 크기 등급에 따라 배치를 정한다. 이전 Expo iOS·Android TWA·Windows Store PWA의 설치판 전환 경로는 [플랫폼 현황](https://github.com/chawon/ott/blob/main/docs/platforms.md)에 있다.

| 대상 | 화면과 입력 방식 | 구현 근거 |
| --- | --- | --- |
| Web/PWA | 768 CSS px부터 상단 탐색과 넉넉한 월별 배치를 쓴다. PC 타임라인의 기록 버튼은 상단에 한 번 둔다. 더 좁은 화면에서는 하단 기록 진입과 접는 필터를 쓴다. | [타임라인](https://github.com/chawon/ott/blob/main/apps/web/components/timeline-v2/timeline.module.css) |
| Android · Compose | 현재 창 너비가 700dp 미만이면 하단 탐색, 700dp 이상이면 상단 탐색과 ‘함께’ 목록·상세 2단을 쓴다. 검색·입력은 전체 화면으로 열고 키보드와 시스템 탐색 영역을 피한다. | [창 너비 기준](https://github.com/chawon/ott/blob/main/apps/android-native/app/src/main/java/app/ottline/ui/layout/AdaptiveLayoutMetrics.kt) · [기록창](https://github.com/chawon/ott/blob/main/apps/android-native/app/src/main/java/app/ottline/ui/screens/QuickRecordDialog.kt) |
| iPhone · SwiftUI | 가로 크기 등급이 `compact`이면 하단 탐색에서 전체 화면 기록창을 연다. 검색과 저장에는 iPad·Mac과 같은 `QuickRecordSheet`를 쓴다. | [iPhone 탐색](https://github.com/chawon/ott/blob/main/apps/ios-native/Sources/OttlineApp/OttlineApp.swift) · [공용 기록창](https://github.com/chawon/ott/blob/main/apps/apple-core/Sources/OttlineCore/UI/Components/QuickRecordSheet.swift) |
| iPad · SwiftUI | 가로 크기 등급이 `regular`이고 창이 700pt 이상이면 상단 탐색과 ‘함께’ 2단을 쓴다. 좁은 Split View는 한 열로 돌아간다. 기록창의 표시는 크기 등급을 따라 `regular`면 큰 시트, `compact`면 전체 화면이다. | [창 너비 기준](https://github.com/chawon/ott/blob/main/apps/ios-native/Sources/OttlineApp/UI/Components/OttlinePadAdaptiveComponents.swift) · [탐색과 시트](https://github.com/chawon/ott/blob/main/apps/ios-native/Sources/OttlineApp/OttlineApp.swift) |
| macOS · SwiftUI | 창 상단에 탐색과 기록 버튼을 둔다. 메뉴의 새 기록이나 `⌘N`으로 같은 기록 시트를 열고, 이동 메뉴에서는 키보드로 탭을 바꾼다. | [창과 시트](https://github.com/chawon/ott/blob/main/apps/macos-native/Sources/OttlineMacApp/UI/MacRootSpreadView.swift) · [메뉴와 단축키](https://github.com/chawon/ott/blob/main/apps/macos-native/Sources/OttlineMacApp/OttlineMacApp.swift) |
| Windows · WPF | 상단 기록 버튼, `Ctrl+N`·`Ctrl+K`, 트레이에서 같은 기록창을 연다. ‘함께’는 창 너비 980 DIP부터 목록과 상세를 나란히 표시한다. | [창과 단축키](https://github.com/chawon/ott/blob/main/apps/windows-native/src/Ottline.App/MainWindow.xaml.cs) · [2단 기준](https://github.com/chawon/ott/blob/main/apps/windows-native/src/Ottline.Core/Domain/TogetherSpreadCoordinator.cs) |

Windows 새 기록에는 상태 `DONE`과 느낌 `SATISFIED`가 미리 선택돼 있다. 이 초기값은 사용자가 저장 버튼을 눌러야 기록에 반영된다. [Windows 기록 폼](https://github.com/chawon/ott/blob/main/apps/windows-native/src/Ottline.App/ViewModels/MainViewModel.cs#L2289)

<a name="10-voice--tone"></a>

## 문구와 접근성

- 한국어는 자연스러운 해요체, 영어는 짧은 문장과 sentence case를 쓴다. 타임라인에 쌓이는 한 건은 ‘기록’(record)이다. 입력·수정의 날짜·플랫폼·장소·상황은 ‘그날의 순간’, 저장한 기록의 회상은 ‘그날의 온기’, 영어는 ‘The moment’다.
- 공개 동작은 ‘함께 나누기’, 완료는 ‘함께 나눴어요’, 공유용 이미지는 ‘공유 카드’다. ‘기록 연결 코드’(record connection code)와 그 개인 보관용 이미지인 ‘복구 카드’(recovery card)를 구분한다. 도움말·문의에서도 앱의 실제 저장·공유·연결·내보내기 동작을 같은 용어로 안내한다. [제품 문구 예시](https://github.com/chawon/ott/blob/main/wiki/pages/processes/ux-copy.md)
- 빈 상태·불러오는 중·오류를 구별하고 오류에는 다음 행동을 적는다. 라이트·다크와 한국어·영어에서 버튼 이름과 키보드 포커스가 읽히게 한다. 선택과 완료는 글자나 아이콘으로도 드러내고, 모션 감소 설정을 존중한다.

<a name="13-personas"></a>

초기 Cookpad 예시와 가상 페르소나는 당시 참고 자료로 보관한다. [초기 디자인 원문](https://github.com/chawon/ott/blob/1d7a6f549a990245f293a697f5899b249f614e53/DESIGN.md) · [당시 페르소나](https://github.com/chawon/ott/blob/1d7a6f549a990245f293a697f5899b249f614e53/DESIGN.md#13-personas)
