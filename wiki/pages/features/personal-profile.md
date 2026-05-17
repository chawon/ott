# 개인 프로필

> 로그인 없이 생성되는 기존 페어링 계정에 닉네임, 성향 타이틀, 프리셋 아바타를 붙이는 개인화 기능

## 관련 페이지
- [[timeline]]
- [[share-card]]
- [[delete-sync]]
- [[ux-copy]]

---

## 구현 상태

- 2026-05-17 기준 PR #33으로 production 반영 완료.
- 기능 배포 SHA: `652c249ba7b09f7d9086652514436a2d5fb31c1a`
- production ArgoCD revision: `240f531cb211e293c8d1d85497f8758bff2bbde6`
- production 이미지:
  - `ott-api:652c249ba7b09f7d9086652514436a2d5fb31c1a`
  - `ott-web:652c249ba7b09f7d9086652514436a2d5fb31c1a`

## 범위

- 로그인 기능을 추가하지 않는다.
- 첫 기록 이후 자동 생성되는 기존 페어링 계정에 개인화 메타데이터만 저장한다.
- v1 노출 범위는 본인 화면으로 제한한다.
  - 홈
  - 타임라인
  - 리포트
  - 설정
  - 공유 포토 카드의 선택형 서명
- 공개 댓글/함께 화면에는 v1에서 닉네임과 아바타를 노출하지 않는다.

## 데이터 모델

`users`에 아래 컬럼을 추가한다.

- `nickname varchar(32)`
- `persona_key varchar(32)`
- `profile_updated_at timestamptz`

성향 표시 이름과 아바타 파일 매핑은 서버에 저장하지 않고 프론트에서 관리한다.

## API 계약

- `GET /api/auth/profile`
  - `X-User-Id`, `X-Device-Id` 활성 기기 검증 필요
  - 응답: `userId`, `nickname`, `personaKey`, `profileUpdatedAt`
- `PATCH /api/auth/profile`
  - `nickname`: trim 후 1~32자
  - `personaKey`: 고정 6종만 허용

## 성향 프리셋

| key | 한국어 | English |
|---|---|---|
| `cinema_keeper` | 영화 감상파 | Cinema Keeper |
| `book_drifter` | 책 유랑가 | Book Drifter |
| `deep_watcher` | 몰입 감상가 | Deep Watcher |
| `midnight_logger` | 심야 기록가 | Midnight Logger |
| `weekend_curator` | 주말 큐레이터 | Weekend Curator |
| `archive_collector` | 기록 수집가 | Archive Collector |

## 프론트 구현

- 프로필 공통 로직: `apps/web/lib/profile.ts`, `apps/web/lib/profileApi.ts`, `apps/web/lib/useUserProfile.ts`
- 설정 편집 UI: `apps/web/components/ProfileEditor.tsx`
- 첫 기록 후 홈 프로필 생성 카드: `apps/web/components/ProfilePromptCard.tsx`
- 아바타 렌더링: `apps/web/components/ProfileAvatar.tsx`
- 아바타 asset: `apps/web/public/avatars/clean-bg/*.webp`

프로필은 서버 저장을 기준으로 하고, 화면 깜빡임을 줄이기 위해 마지막 프로필을 `localStorage`에 캐시한다.

## 공유 카드 서명

공유 포토 카드에서는 프로필이 완성된 경우에만 `아바타와 닉네임 서명 포함` 옵션을 노출한다.

- 기본값은 꺼짐이다.
- 옵션을 켜면 좌하단 서명은 `아바타 + 닉네임 · by ottline.app` 형태로 표시한다.
- 옵션을 끄거나 프로필이 없으면 기존 `ottline.app` 워터마크만 표시한다.

## 검증 기록

- `npm run build --workspace ott`
- `GRADLE_USER_HOME=.gradle ./gradlew build` (`apps/api`)
- `git diff --check`
- production `/api/auth/profile` 무인증 요청 401 확인
- production `/api/titles/search` 정상 응답 확인
- production 공유 카드 POST 렌더 `200 image/png` 확인
- production clean-bg avatar WebP asset `200 image/webp` 확인
