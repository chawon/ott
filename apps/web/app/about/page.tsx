import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "서비스 소개 및 사용법",
  description: "로그인 없이 10초 만에 끝내는 OTT 시청 기록 서비스, On the Timeline 사용법을 알아보세요.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 py-10 text-foreground">
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">
          로그인 없이 기록하는 시청 타임라인
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          On the Timeline은 당신의 소중한 시청 시간을 가장 빠르고 간편하게 기록하기 위해 태어났습니다. 
          번거로운 가입 절차 없이, 지금 보고 있는 작품을 바로 기록해보세요.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="border-b border-border pb-2 text-xl font-semibold">어떻게 사용하나요?</h2>
        <div className="grid gap-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">1</div>
            <div>
              <h3 className="font-medium">작품 검색</h3>
              <p className="text-sm text-muted-foreground">홈 화면 상단에서 영화나 시리즈 제목을 검색하세요.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">2</div>
            <div>
              <h3 className="font-medium">상태 및 평점 선택</h3>
              <p className="text-sm text-muted-foreground">보고 있는 중인지, 다 봤는지 선택하고 가벼운 평점을 남겨주세요.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">3</div>
            <div>
              <h3 className="font-medium">기록 저장</h3>
              <p className="text-sm text-muted-foreground">저장 즉시 나만의 타임라인이 구축됩니다. 모든 데이터는 브라우저에 안전하게 우선 저장됩니다.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="border-b border-border pb-2 text-xl font-semibold">더 편하게 쓰는 방법</h2>
        <div className="grid gap-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">+</div>
            <div>
              <h3 className="font-medium">앱처럼 설치해서 사용</h3>
              <p className="text-sm text-muted-foreground">
                On the Timeline은 설치형 앱처럼 사용할 수 있어요. 홈 화면에 추가하면 앱 아이콘으로 빠르게 열 수 있습니다.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">+</div>
            <div>
              <h3 className="font-medium">공유 카드로 기록 올리기</h3>
              <p className="text-sm text-muted-foreground">
                기록 저장 후 “공유 카드 만들기”를 선택하면, SNS에 올릴 수 있는 예쁜 카드가 자동으로 만들어집니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-muted/60 p-6 italic text-muted-foreground">
        "기억은 흐릿해지지만, 기록은 타임라인으로 남습니다."
      </section>
    </div>
  );
}
