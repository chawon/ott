import { notFound } from "next/navigation";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readToken(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return null;
}

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const token = readToken(params?.token);
  const expected = process.env.ADMIN_ANALYTICS_TOKEN ?? null;

  // MVP: dedicated URL + server-side token check.
  if (!expected || token !== expected) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">관리자 통계</h1>
        <p className="text-sm text-muted-foreground">
          현재는 접근 제어와 운영 체크리스트를 먼저 적용한 MVP 단계입니다.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="text-sm font-semibold">연결 상태</div>
        <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
          <li>관리자 토큰 검증: 적용됨</li>
          <li>전역 이벤트 수집 저장소: 준비 필요</li>
          <li>DAU/D1/D7 집계 쿼리: 준비 필요</li>
          <li>플랫폼별(Web/PWA/TWA) 대시보드: 준비 필요</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="text-sm font-semibold">다음 작업</div>
        <ol className="mt-3 list-decimal pl-5 text-sm text-muted-foreground">
          <li>이벤트 테이블 생성 및 서버 수집 API 추가</li>
          <li>DAU/리텐션/퍼널 집계 SQL 및 뷰 구성</li>
          <li>관리자 페이지에 실제 지표 카드/차트 연결</li>
          <li>토큰 방식에서 관리자 계정 기반 권한(RBAC)으로 전환</li>
        </ol>
      </section>
    </div>
  );
}
