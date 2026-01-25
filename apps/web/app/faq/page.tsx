import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "자주 묻는 질문 (FAQ)",
  description: "On the Timeline의 데이터 저장 방식과 로그인 없는 서비스 이용에 대해 궁금한 점을 해결해 드립니다.",
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 py-10 text-foreground">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">자주 묻는 질문</h1>
        <p className="text-sm text-muted-foreground">
          On the Timeline의 데이터 저장 방식과 로그인 없는 서비스 이용에 대해 궁금한 점을 해결해 드립니다.
        </p>
      </div>
      
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Q. 로그인 없이 어떻게 데이터가 유지되나요?</h2>
          <p className="leading-relaxed text-muted-foreground">
            On the Timeline은 <strong>로컬 퍼스트(Local-first)</strong> 기술을 사용합니다. 
            사용자가 입력한 모든 기록은 먼저 브라우저 내부 저장소(IndexedDB)에 저장됩니다. 
            따라서 로그인을 하지 않아도 기기를 바꾸지 않는 한 기록이 안전하게 유지됩니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Q. 기기를 변경해도 기록을 볼 수 있나요?</h2>
          <p className="leading-relaxed text-muted-foreground">
            네, 가능합니다! [계정] 메뉴에서 발급받은 <strong>페어링 코드</strong>를 새 기기에 입력하면
            지금까지의 기록을 그대로 이어서 볼 수 있어요. 여러 기기에서 각각 쌓아둔 기록도 하나로 모아집니다.
          </p>
        </section>
        
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Q. 페어링을 하면 기록은 어떻게 합쳐지나요?</h2>
          <p className="leading-relaxed text-muted-foreground">
            같은 작품에 대한 기록이 양쪽에 모두 있으면, <strong>더 최근에 수정된 내용</strong>이 남아요.
            그래서 최신 상태로 자연스럽게 정리됩니다. 기존 기록이 사라지는 것이 아니라, 더 최신 기록으로 정리된다고 보면 됩니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Q. 기록을 삭제하고 싶으면 어떻게 하나요?</h2>
          <p className="leading-relaxed text-muted-foreground">
            기록은 개별 삭제 대신 <strong>설정 &gt; 로컬 초기화</strong>에서 한 번에 지울 수 있어요.
            이 기능은 현재 기기에 저장된 데이터만 삭제하며, 서버 데이터는 삭제되지 않습니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Q. 서비스 이용료가 있나요?</h2>
          <p className="leading-relaxed text-muted-foreground">
            On the Timeline은 모든 기능을 무료로 제공합니다. 시청 기록을 남기는 즐거움에만 집중하세요!
          </p>
        </section>
      </div>
    </div>
  );
}
