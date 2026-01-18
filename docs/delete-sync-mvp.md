# 삭제 동기화(MVP, 복구 없음) 설계 문서

## 목표
- 시청 로그 삭제 시 로컬/서버 동기화가 일관되게 반영됨
- 다른 화면(홈/타임라인/상세)에서도 즉시 제거
- 복구 UX는 제공하지 않음

---

## 핵심 원칙
1) **Soft Delete(tombstone)**: 로컬/서버 모두 `deletedAt` 마킹
2) **Outbox 기반 삭제 동기화**: `op: delete` 전송
3) **LWW + 삭제 우선 보호**: 삭제가 최신이면 되살아나지 않음

---

## 클라이언트 동작
### 삭제 플로우
1) 사용자 삭제 버튼 클릭 → Confirm
2) 로컬 로그에 `deletedAt` + `updatedAt` 저장
3) Outbox에 `delete_log` 추가
4) UI 즉시 숨김(필터링)

### 화면 반영
- 홈/타임라인/상세 모두 `deletedAt` 필터링
- 삭제 후 즉시 제거(이벤트 or 재조회)

---

## 서버 동작(요약)
- `deleted_at` 컬럼 사용
- `op: delete` 수신 시 LWW 비교
- 최신 삭제가 있으면 기존 업데이트 무시

---

## Sync API
### Push
- 클라이언트 → 서버
```
{ id, op: "delete", updatedAt, deletedAt }
```

### Pull
- 서버 → 클라이언트
```
{ id, deletedAt, updatedAt }
```

---

## 구현 체크리스트
### 프론트
- `deletedAt` 필드 필터링 (홈/타임라인/상세)
- 로컬 DB Soft Delete
- Outbox delete 추가
- UI 삭제 버튼 + confirm

### 서버
- 삭제 op 처리
- deleted_at 반환

---

## 범위 외
- 복구 UX
- 휴지통
- 삭제 기록 통계
