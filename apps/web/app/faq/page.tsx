import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "자주 묻는 질문 (FAQ)",
  description: "On the Timeline의 데이터 저장 방식과 로그인 없는 서비스 이용에 대해 궁금한 점을 해결해 드립니다.",
};

export default function FaqPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-10 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">자주 묻는 질문</h1>
      
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-neutral-900">Q. 로그인 없이 어떻게 데이터가 유지되나요?</h2>
          <p className="text-neutral-600 leading-relaxed">
            On the Timeline은 <strong>로컬 퍼스트(Local-first)</strong> 기술을 사용합니다. 
            사용자가 입력한 모든 기록은 먼저 브라우저 내부 저장소(IndexedDB)에 저장됩니다. 
            따라서 로그인을 하지 않아도 기기를 바꾸지 않는 한 기록이 안전하게 유지됩니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-neutral-900">Q. 기기를 변경해도 기록을 볼 수 있나요?</h2>
          <p className="text-neutral-600 leading-relaxed">
            네, 가능합니다! [계정] 메뉴에서 발급받은 <strong>페어링 코드</strong>를 새로운 기기에 입력하면 
            기존의 모든 기록을 동기화하여 이어서 사용할 수 있습니다. 개인정보를 수집하지 않으면서도 강력한 동기화를 제공합니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-neutral-900">Q. 기록을 삭제하고 싶으면 어떻게 하나요?</h2>
          <p className="text-neutral-600 leading-relaxed">
            기록은 개별 삭제 대신 <strong>설정 &gt; 로컬 초기화</strong>에서 한 번에 지울 수 있어요.
            이 기능은 현재 기기에 저장된 데이터만 삭제하며, 서버 데이터는 삭제되지 않습니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-neutral-900">Q. 서비스 이용료가 있나요?</h2>
          <p className="text-neutral-600 leading-relaxed">
            On the Timeline은 모든 기능을 무료로 제공합니다. 시청 기록을 남기는 즐거움에만 집중하세요!
          </p>
        </section>
      </div>
    </div>
  );
}
