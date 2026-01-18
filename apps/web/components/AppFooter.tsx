import Link from "next/link";

export default function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-neutral-100 bg-neutral-50/50 py-12">
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <div className="text-sm font-bold tracking-tighter text-neutral-900">
              On the Timeline
            </div>
            <p className="text-xs leading-relaxed text-neutral-500">
              로그인 없이 10초 만에 남기는 OTT 시청 기록.<br />
              나만의 필모그래피를 가장 빠르게 기록하고 공유하세요.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900">서비스</h3>
            <ul className="space-y-2 text-xs text-neutral-600">
              <li>
                <Link href="/" className="hover:text-neutral-900">홈</Link>
              </li>
              <li>
                <Link href="/timeline" className="hover:text-neutral-900">나의 발자취</Link>
              </li>
              <li>
                <Link href="/public" className="hover:text-neutral-900">함께 하는 기록</Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900">안내</h3>
            <ul className="space-y-2 text-xs text-neutral-600">
              <li>
                <Link href="/about" className="hover:text-neutral-900">서비스 소개</Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-neutral-900">자주 묻는 질문</Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4 text-xs text-neutral-400">
            <p>© {currentYear} On the Timeline. All rights reserved.</p>
            <p>Designed for the moments you watch.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
