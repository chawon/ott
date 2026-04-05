# 삭제 동기화 (MVP)

> Soft Delete + Tombstone 방식의 로컬 초기화, 복구 UX 없음

## 관련 페이지
- [[book-log]]
- [[timeline-export]]

---

## 목표

- 개별 삭제는 제공하지 않음
- 설정 화면의 "로컬 초기화"로만 데이터 제거
- 복구 UX 없음

---

## 핵심 원칙

1. **Soft Delete(tombstone)**: 로컬/서버 모두 `deletedAt` 마킹
2. **Outbox 기반 삭제 동기화**: `op: delete` 전송
3. **LWW + 삭제 우선 보호**: 삭제가 최신이면 되살아나지 않음

---

## 클라이언트 동작

**로컬 초기화 플로우:**
1. 설정 > 로컬 초기화 → 확인
2. IndexedDB/localStorage 데이터 삭제
3. 새로고침

---

## MVP 범위 외

- 서버 삭제 연동 (서버 측 삭제는 이번 MVP에서 제외)
- 삭제 관련 Sync API Push/Pull
- 복구 UX, 휴지통, 삭제 기록 통계

---

## 프론트 체크리스트

- 설정 화면에 "로컬 초기화" 버튼
- FAQ에서 "전체 초기화" 안내 문구
