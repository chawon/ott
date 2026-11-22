# 경쟁·인접 제품 리서치 및 ottline 시사점 (2026-11)

- **기준일 / 최종 확인일**: `2026-11-22` (본부 검토 반영 보완판)
- **작성 역할**: 제품 기획 담당 ([이슈 #159](https://github.com/chawon/ott/issues/159))
- **연결 업무**: [#157 플랫폼별 핵심 흐름·기능 차이 1차 감사](https://github.com/chawon/ott/issues/157) · [#158 다음 개선 사이클 우선순위 제안](https://github.com/chawon/ott/issues/158)
- **목적**: 국내·글로벌 감상/독서 기록 시장의 공개 관찰 사실을 정리하고, 이를 바탕으로 **검증할 ottline 적용 가설**과 **지켜야 할 차별점(배제 원칙)**을 분리한다.

> **근거 기록 원칙**: 이 문서는 공개 자료(공식 FAQ·공지·스토어 설명·언론 보도·사용자 리뷰)로 확인한 **관찰 사실**과 ottline에 대한 **적용 가설·검증 계획**을 명확히 구분한다. 경쟁사가 특정 기능을 제공한다는 사실만으로 성장 원인이나 유지율 개선 효과를 단정하지 않는다.

---

## 1. 2026년 시장 관찰 사실 (출처 · 확인일 · 근거 유형)

| 관찰 항목 | 확인된 사실 | 출처 · 확인일 (`2026-11-22`) | 근거 유형 |
| --- | --- | --- | --- |
| **TV Time 서비스 종료** | TV Time은 **2026년 7월 15일 서비스를 종료**했다(앱·웹 중단 및 계정 데이터 삭제, 종료 전 데이터 내보내기 안내). | 공식 종료 안내 · JustWatch 공지 · [Buck The Critics (2026-07)](https://buckthecritics.com/blog/tv-time-serializd-alternative/) · [Refract (2026-11)](https://getrefract.app/tv-time-alternative) | 공식 공지·대안 서비스 안내 |
| **Letterboxd의 TV 지원 범위** | Letterboxd는 **반복 편성 TV 시리즈(에피소드 단위 추적)를 지원하지 않으며**, 단 **미니시리즈·TV 영화·스탠드업 스페셜 등 일부 예외**만 카탈로그에 포함한다. | [Letterboxd 공식 FAQ](https://support.letterboxd.com/hc/en-us/articles/15269096507407-Do-you-support-TV-shows) · [Refract (2026-11)](https://getrefract.app/letterboxd-for-tv-shows) | 공식 FAQ |
| **국내 영상 평가 시장 재편 보도** | 키노라이츠가 왓챠 인수를 추진 중이라는 보도가 2026년 8월 공개됐다. | [테크M 보도 (2026-08-19)](https://www.techm.kr/news/articleView.html?idxno=154434) | 언론 보도 |
| **국내 기록 앱의 데이터 가져오기 제공** | 레포브(repov)는 2025년 7월 `1.2.2` 업데이트로 **왓챠피디아·북적북적·북모리·키노라이츠·Goodreads·Letterboxd 6개 플랫폼 데이터 가져오기** 기능을 출시했다. *(단, 이 기능이 성장의 핵심 원인이라는 인과는 공개 자료로 입증되지 않음.)* | [레포브 공식 공지 (2025-07-24)](https://page.repov.me/n8pw9x2zw94g6mg7yrqv) | 공식 공지 |
| **통합 미디어 트래커의 플랫폼 편중** | 영화·시리즈·책을 함께 다루는 글로벌 통합 앱 **Sofa**, **Sequel**, **Omniphile**은 2026년 11월 기준 **Apple 생태계 전용**(iOS/iPadOS/macOS 등)이며 Android·Windows·Web 동시 지원을 제공하지 않는다. | [App Store Sequel](https://apps.apple.com/us/app/sequel-media-tracker/id1630746993) · [Omniphile 비교 (2026-11-01)](https://www.omniphile.app/blog/best-media-tracker-app) | 스토어 설명·비교 글 |

---

## 2. 제품군별 관찰 비교표 (확인일 `2026-11-22`)

### A. 영상·OTT 기록 전문

| 제품 | 권역/주 플랫폼 | 공개 확인 기능·특징 (관찰 사실) | 공개 확인 제한·사용자 불만 | ottline 관점 참고 포인트 |
| --- | --- | --- | --- | --- |
| **Letterboxd** | 글로벌 / Web·iOS·Android | 영화 다이어리, `Four Favorites`, 연간 통계·공유, 알고리즘 피드/DM 없는 영화 커뮤니티 | 반복 편성 TV 시리즈 미지원(미니시리즈·TV 영화 예외, [공식 FAQ](https://support.letterboxd.com/hc/en-us/articles/15269096507407-Do-you-support-TV-shows)), 기록 작성 시 회원가입 필요 | 저압박 커뮤니티 톤, 다이어리·회고 경험 |
| **Serializd** | 글로벌 / Web·iOS·Android | TV 전용 시즌/에피소드 단위 별점·리뷰, 광고 없음 ([공식 사이트](https://serializd.com/)) | TV 전용(영화·책 별도 앱 필요) | 시리즈 시즌/에피소드 단위 기록 흐름 |
| **Trakt** | 글로벌 / Web·iOS·Android | 에피소드 진행률 추적, Plex 등 외부 연동, Year in Review ([Achriom, 2026-11](https://www.achriom.com/blog/trakt-year-in-review/)) | 무료 구간 광고, 유료 VIP 구독 | 자동 스크로블링 대신 저부담 수동 기록과 대비 |
| **키노라이츠** | 한국 / iOS·Android·Web | 국내 OTT별 시청 가능 플랫폼 통합 검색, 콘텐츠 추천·평가 ([Google Play](https://play.google.com/store/apps/details?id=com.kinolights.kinolights&hl=ko)) | OTT 탐색/추천 포털 중심, 개인 기록장 성격과 결이 다름 | 탐색 포털과 개인 기록장의 경계 |
| **왓챠피디아** | 한국 / iOS·Android·Web | 영화·드라마·책·웹툰 평가 DB | 인수 추진 보도 등 서비스 변화 국면([테크M, 2026-08](https://www.techm.kr/news/articleView.html?idxno=154434)) | 기존 기록 보유자의 백업·이전 수요 관찰 대상 |

### B. 도서·독서 기록 전문

| 제품 | 권역/주 플랫폼 | 공개 확인 기능·특징 (관찰 사실) | 공개 확인 제한·사용자 불만 | ottline 관점 참고 포인트 |
| --- | --- | --- | --- | --- |
| **북모리 (Bookmory)** | 한국·글로벌 / iOS·Android·iPad | 독서 달력, 독서 타이머, 메모/OCR, 통계, 오프라인 기록 ([공식 사이트](https://bookmory.net/ko/), [App Store](https://apps.apple.com/kr/app/id1515533482)) | 앱 스토어 리뷰에 광고 증가 불만 존재, 영상 미지원 | 월간 달력 뷰·오프라인 친화 기록 노트 |
| **북적북적** | 한국 / iOS·Android | 읽은 책을 물리적 높이(cm)로 쌓는 시각화([App Store](https://apps.apple.com/kr/app/id1472538417)) | 영상 미지원, 일부 리뷰에 기기 전환/로그아웃 불편 언급 | 숫자 통계 외 감성적 누적 표현(KDC 내 서가와 비교) |
| **The StoryGraph** | 글로벌 / Web·iOS·Android | 무드·페이스 기반 통계 차트, 취향 기반 추천, `DNF`/일시정지 상태, Goodreads 데이터 가져오기 ([Google Play](https://play.google.com/store/apps/details?id=com.thestorygraph.thestorygraph&hl=ko)) | 비영어권 도서 DB 빈약 리뷰([App Store](https://apps.apple.com/fr/app/id1570489264)) | 취향 차트·데이터 가져오기 UX·독립 서비스 포지셔닝 |
| **Goodreads** | 글로벌 / Web·iOS·Android | 대규모 도서 DB·리뷰·읽을 책 목록 ([Google Play](https://play.google.com/store/apps/details/Goodreads_Find_Track_Books?id=com.goodreads&hl=ko)) | 구형 UI·스폰서 노출·리뷰 피로 지적([Old Town Books, 2025-01](https://www.blog.oldtownbooks.com/blog/making-the-switch-why-otb-staff-are-leaving-goodreads-in-2025)) | 광고/대형 소셜 중심 구조와의 차별점 |
| **Fable** | 글로벌 / iOS·Android | 책 + TV 시리즈 추적, 독서/시청 클럽 커뮤니티 ([Google Play](https://play.google.com/store/apps/details?id=co.fable.fable&hl=en)) | Reddit 사용자 의견 중 "기록 도구보다 SNS 성격이 강하다"는 피로 언급([r/books](https://www.reddit.com/r/books/comments/1fj4udh/book_tracking_apps_thinking_of_switching_to_fable/)) | 개인 기록 우선 vs SNS화 경계 참고 |

### C. 통합 미디어·아카이브 & 저부담 습관 레퍼런스

| 제품 | 권역/주 플랫폼 | 공개 확인 기능·특징 (관찰 사실) | 공개 확인 제한 | ottline 관점 참고 포인트 |
| --- | --- | --- | --- | --- |
| **레포브 (repov)** | 한국·일본 / iOS·Android | 영화·책·장소 등 40개 카테고리, 캘린더·지도 뷰, 타 앱 6종 데이터 가져오기 ([Google Play](https://play.google.com/store/apps/details?id=com.kilo.repov&hl=ko), [공지](https://page.repov.me/n8pw9x2zw94g6mg7yrqv)) | 범용 미니 블로그 성격(영상·책 전문 메타/서가 깊이 차이), 데스크톱/웹 앱 부재 | 캘린더 회상 뷰·가져오기 포맷 구성 참고 |
| **Sofa / Sequel / Omniphile** | 글로벌 / Apple 전용 | 영화·시리즈·책 등 통합 관리, 위젯, iCloud 동기화 ([Omniphile 비교, 2026-11](https://www.omniphile.app/blog/best-media-tracker-app)) | Android·Windows·Web 미지원, 일부 진행률/동기화 유료 | ottline의 5대 OS 크로스플랫폼·무료 로컬 우선 우위 |
| **Cookpad** ([DESIGN.md](../../DESIGN.md) 원형) | 글로벌·일본 | 따뜻하고 압박 없는 일상의 반복 기록, 사진 중심 카드 | (도메인 상이) | "생산성 대시보드"가 아닌 "손때 묻은 기억의 서가" 톤 |
| **Day One** | 글로벌 / 멀티 OS | 시간 기반 과거 기록 회상("On This Day"), 프라이버시/암호화 강조 | 유료 구독 | 압박 없는 시간 기반 회상 트리거 참고 |

---

## 3. 5가지 기획 렌즈별 분석 (관찰 사실 · 적용 가설 · 검증 계획 분리)

### 렌즈 1. 첫 기록 완료 & 외부 기록 이전
- **관찰 사실**:
  - Letterboxd·Goodreads 등 주요 서비스는 기록 작성 전 회원가입을 요구한다. 반면 ottline은 무로그인·로컬 우선 구조와 `FirstLogActivationPanel`을 Web·Android·iOS/iPadOS·macOS·Windows 5개 플랫폼 모두에 이미 구현했다([#157 감사](../feature-matrix.md)).
  - StoryGraph(Goodreads 가져오기), 레포브(6개 앱 가져오기), TV Time 종료 후 대안 앱(Refract 등)은 모두 외부 기록 가져오기 기능을 제공한다(공식 안내·스토어 설명 기준).
- **ottline 적용 가설**:
  - *가설 1A*: 외부 기록 가져오기(CSV·Letterboxd·Goodreads·왓챠피디아 등)를 제공하면 기존 타 앱 기록을 보유한 방문자의 ottline 전환 장벽이 낮아지고 초기 정착률(14일 내 추가 기록)이 높아질 것이다.
- **검증 계획**:
  - 본부로부터 현재 첫 기록 도달 기준선(`firstLogCreateActors`, `qualifiedActors`)을 확보한 뒤, [#164 외부 기록 가져오기 기획](https://github.com/chawon/ott/issues/164)에서 1차 지원 포맷·중복/판본 매칭 정책을 정의하고 Web/PWA 우선 도입 후 가져오기 사용 계정의 2~4주차 재기록률을 관찰한다.

### 렌즈 2. 여러 주 반복 기록 (회상 루프)
- **관찰 사실**:
  - 북모리·레포브는 포스터/표지 기반 월간 달력 뷰를, 북적북적은 누적 높이 시각화를, Day One은 과거 기록 회상 기능을 제공한다.
  - `#157` 코드 감사 기준 ottline은 타임라인 리스트·주간 리포트 공유 카드([weekly-report-share-card-posters.md](../weekly-report-share-card-posters.md))·KDC 내 서가를 제공하지만, **전 플랫폼에 월간 달력 뷰는 없다**.
- **ottline 적용 가설**:
  - *가설 2A*: 영상·책 포스터/표지가 함께 채워지는 월간 기록 달력과 과거 기록 회상 카드를 제공하면, "새로 입력할 때만 여는 앱"에서 "돌아보기 위해 여는 앱"으로 사용 맥락이 확장되어 2~4주차 반복 기록 비율이 개선될 것이다.
- **검증 계획**:
  - 본부의 주간 반복 기록 기준선을 먼저 확보한다. 도입 시 단순 조회자/비조회자 비교(자기 선택 편향)로 인과를 단정하지 않고, **도입 전후 코호트 비교 또는 노출 실험**과 탐색 지표(`calendar_open`, 월간 공유 카드 생성)로 분리 측정한다.

### 렌즈 3. 다중 기기·데이터 안심 연결
- **관찰 사실**:
  - TV Time 종료 공지 및 일부 기록 앱 리뷰(북적북적 등)에서 기기 교체·서비스 변경 시 기록 유실에 대한 사용자 우려가 반복적으로 나타난다.
  - `#157` 감사에서 Windows 동기화 push 누락(`#161`), Web `stale` outbox 미해소(`#162`), Apple 계정 삭제 실패 UI 오표시(`#163`)가 확인됐다.
- **ottline 적용 가설**:
  - *가설 3A*: 멀티 기기 동기화·삭제 안전성 결함을 먼저 복구해 데이터 신뢰를 확보한 뒤, 초기 기록을 몇 건 남긴 사용자에게 복구 카드 보관 및 QR 코드 기기 연결([#165](https://github.com/chawon/ott/issues/165))을 자연스럽게 안내하면 2번째 기기 연결률과 다중 기기 실사용이 늘어날 것이다. *(초기 안내 노출 시점 — 예: 1~3건 — 은 확정 사실이 아닌 테스트할 가설이다.)*
- **검증 계획**:
  - 먼저 `#161`·`#162`·`#163` 복구 완료를 검증한다. 이후 운영·API 담당과 다중 기기 귀속/계측 정의를 확정한 뒤 안내 시점별 연결 시도·완료율을 측정한다.

### 렌즈 4. 개인 기록 ↔ 공개 대화 (`함께`의 큐레이터 종료 이후)
- **관찰 사실**:
  - Letterboxd는 알고리즘 피드·DM 없이 작품별 기록·반응 중심으로 운영되며, Fable 관련 사용자 의견에서는 과도한 SNS화에 대한 피로가 언급된다.
  - ottline은 큐레이터 종료를 진행 중이며, Web·Apple에는 저장 완료 직후 같은 작품의 공개 이야기로 이어주는 `SavedDiscussionLink`([saved-discussion-connection.md](../saved-discussion-connection.md))가 구현돼 있으나 Android·Windows에는 동일 계약이 미반영 상태다([#157 감사](../feature-matrix.md)).
- **ottline 적용 가설**:
  - *가설 4A*: 내 기록을 강제로 공개하지 않으면서 저장 직후 같은 작품 공개 이야기로 이어주는 경로를 전 플랫폼으로 일관화하면, 큐레이터 종료 이후에도 저부담으로 `함께` 열람·반응·댓글이 이어질 것이다.
- **검증 계획**:
  - 저장 뒤 연결 링크 노출 대비 클릭·상세 열람·반응/댓글 전환을 계측해 큐레이터 종료 후 `함께` 활성 추이를 관찰한다.

### 렌즈 5. ottline 제품 원칙상 배제할 패턴

| 경쟁사 패턴 | 배제 이유 (ottline 제품 원칙 충돌) |
| --- | --- |
| **강제 회원가입 / 이메일·SNS 로그인 선행** | 무로그인·로컬 우선·저부담 기록장 정체성 훼손 |
| **팔로워 수·공개 평점 랭킹·알고리즘 SNS 피드** | 평가 압박·SNS 피로 유발, 개인 프로필 비노출 원칙([AGENTS.md](../../AGENTS.md)) 충돌 |
| **죄책감 주는 일일 스트릭(Streak) / 공격적 푸시 알림** | "따뜻하고 압박 없는 기록장"([DESIGN.md](../../DESIGN.md)) 톤 훼손 |
| **40개 범용 카테고리 확장(맛집·일상·쇼핑 등)** | 영상·책 전문 메타데이터(TMDB·시즌/에피소드·ISBN·KDC 서가) 깊이 희석 |
| **핵심 기록/진행률 기능의 유료 페이월·광고 삽입** | 무료·광고 없음·로컬 우선 신뢰 훼손 |

---

## 4. `#157`·`#158` 연계 요약

1. **즉시 확정(1순위)**: `#157` 코드 감사에서 확인된 데이터 신뢰·계정 안전성 결함(`#161` Windows 동기화 복구, `#162` Web `stale` 해소, `#163` Apple 삭제 실패 안내)은 외부 가설과 무관하게 최우선 해결 대상이다.
2. **가설 검증 대기(2·3순위 및 후속 기획)**: 월간 포스터 달력(2순위 가설), 안심 연결·`SavedDiscussionLink`·`#165` QR 기기 연결(3순위 가설), `#164` 외부 기록 가져오기(사용자 방향 확인된 후속 기획)는 모두 **본부 기준선 확보 및 별도 변경안 검토를 거쳐 확정**한다.
