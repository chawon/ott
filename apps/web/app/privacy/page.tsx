import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "On the Timeline 개인정보처리방침 안내",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-10 text-foreground">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">개인정보처리방침</h1>
        <p className="text-sm text-muted-foreground">최종 업데이트: 2026-02-14</p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          On the Timeline(이하 "서비스")는 이용자의 개인정보를 소중히 여기며, 관련 법령을 준수합니다.
          본 방침은 서비스 이용 중 처리되는 정보의 항목, 목적, 보관 방식, 이용자 권리를 안내합니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. 수집하는 정보</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>기록 데이터: 작품명, 감상/독서 상태, 평점, 메모, 기록 시각</li>
          <li>서비스 운영 정보: 기기 유형, 브라우저 유형, OS 계열, 설치 상태(PWA 여부)</li>
          <li>기기 식별용 정보: 서비스 동기화 및 기기 연결을 위한 내부 식별자</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. 정보 이용 목적</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>기록 저장/조회, 타임라인 구성, 기기 간 동기화 제공</li>
          <li>오류 분석 및 서비스 안정성 개선</li>
          <li>기능 사용 현황 분석을 통한 UX 개선</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. 보관 및 파기</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>이용 목적 달성 또는 이용자 요청 시 지체 없이 파기합니다.</li>
          <li>법령상 보관 의무가 있는 경우 해당 기간 동안만 보관합니다.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4. 제3자 제공 및 처리 위탁</h2>
        <p className="text-sm text-muted-foreground">
          서비스는 원칙적으로 이용자 정보를 외부에 판매하지 않으며, 법령에 따른 경우를 제외하고 제3자에게 제공하지 않습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">5. 이용자 권리</h2>
        <p className="text-sm text-muted-foreground">
          이용자는 자신의 기록 데이터에 대해 열람, 정정, 삭제를 요청할 수 있습니다. 서비스 내 기능 또는 운영자 문의를 통해 요청할 수 있습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">6. 문의</h2>
        <p className="text-sm text-muted-foreground">
          개인정보 관련 문의는 서비스 운영 채널을 통해 접수해 주세요. 접수된 문의는 확인 후 지체 없이 처리합니다.
        </p>
      </section>
    </div>
  );
}
